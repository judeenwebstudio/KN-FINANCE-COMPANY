import { Prisma } from "@/generated/prisma/client";
import type { InterestType, RepaymentFrequency, FeeType } from "@/generated/prisma/client";

const Decimal = Prisma.Decimal;
export type DecimalInput = Prisma.Decimal | number | string;

function toDecimal(val: DecimalInput): Prisma.Decimal {
  return new Decimal(val.toString());
}

export function round(val: DecimalInput, decimals = 2): Prisma.Decimal {
  return new Decimal(new Decimal(val.toString()).toFixed(decimals, Decimal.ROUND_HALF_UP));
}

export function calculateProcessingFee(
  principalInput: DecimalInput,
  feeType: FeeType,
  feeValueInput: DecimalInput
): Prisma.Decimal {
  const principal = toDecimal(principalInput);
  const feeValue = toDecimal(feeValueInput);

  if (feeType === "FIXED") {
    return round(feeValue, 2);
  }
  // PERCENTAGE: principal * feeValue / 100
  const fee = principal.mul(feeValue).div(100);
  return round(fee, 2);
}

export function calculateFlatInterest(
  principalInput: DecimalInput,
  annualInterestRateInput: DecimalInput,
  termMonths: number
): Prisma.Decimal {
  const principal = toDecimal(principalInput);
  const annualRate = toDecimal(annualInterestRateInput); // e.g. 12 means 12%
  // principal * (annualRate / 100) * (termMonths / 12)
  const interest = principal.mul(annualRate.div(100)).mul(termMonths).div(12);
  return round(interest, 2);
}

export function calculateInstallmentCount(
  termMonths: number,
  repaymentFrequency: RepaymentFrequency
): number {
  if (repaymentFrequency === "MONTHLY") {
    return termMonths;
  }
  if (repaymentFrequency === "BIWEEKLY") {
    return Math.max(1, Math.round((termMonths * 26) / 12));
  }
  // WEEKLY
  return Math.max(1, Math.round((termMonths * 52) / 12));
}

export function calculateDueDate(
  startDate: Date,
  repaymentFrequency: RepaymentFrequency,
  installmentNumber: number
): Date {
  const date = new Date(startDate.getTime());
  if (repaymentFrequency === "MONTHLY") {
    date.setMonth(date.getMonth() + installmentNumber);
  } else if (repaymentFrequency === "BIWEEKLY") {
    date.setDate(date.getDate() + installmentNumber * 14);
  } else {
    // WEEKLY
    date.setDate(date.getDate() + installmentNumber * 7);
  }
  return date;
}

export function calculateFirstDueDate(
  disbursementDate: Date,
  repaymentFrequency: RepaymentFrequency
): Date {
  return calculateDueDate(disbursementDate, repaymentFrequency, 1);
}

export interface ScheduleRow {
  installmentNumber: number;
  dueDate: Date;
  principalDue: Prisma.Decimal;
  interestDue: Prisma.Decimal;
  feeDue: Prisma.Decimal;
  totalDue: Prisma.Decimal;
}

export interface CalculationResult {
  principalAmount: Prisma.Decimal;
  processingFee: Prisma.Decimal;
  totalInterest: Prisma.Decimal;
  totalPayable: Prisma.Decimal;
  installmentCount: number;
  maturityDate: Date;
  schedule: ScheduleRow[];
}

export function generateFlatRepaymentSchedule(params: {
  principalAmount: DecimalInput;
  annualInterestRate: DecimalInput;
  termMonths: number;
  repaymentFrequency: RepaymentFrequency;
  processingFee: DecimalInput;
  startDate: Date;
}): CalculationResult {
  const principal = toDecimal(params.principalAmount);
  const fee = toDecimal(params.processingFee);
  const totalInterest = calculateFlatInterest(principal, params.annualInterestRate, params.termMonths);
  const count = calculateInstallmentCount(params.termMonths, params.repaymentFrequency);

  const principalBase = round(principal.div(count), 2);
  const interestBase = round(totalInterest.div(count), 2);
  const feeBase = round(fee.div(count), 2);

  let accumulatedPrincipal = new Decimal(0);
  let accumulatedInterest = new Decimal(0);
  let accumulatedFee = new Decimal(0);

  const schedule: ScheduleRow[] = [];

  for (let i = 1; i <= count; i++) {
    const dueDate = calculateDueDate(params.startDate, params.repaymentFrequency, i);
    let pDue: Prisma.Decimal;
    let iDue: Prisma.Decimal;
    let fDue: Prisma.Decimal;

    if (i < count) {
      pDue = principalBase;
      iDue = interestBase;
      fDue = feeBase;

      accumulatedPrincipal = accumulatedPrincipal.add(pDue);
      accumulatedInterest = accumulatedInterest.add(iDue);
      accumulatedFee = accumulatedFee.add(fDue);
    } else {
      // Final installment absorbs rounding difference
      pDue = round(principal.sub(accumulatedPrincipal), 2);
      iDue = round(totalInterest.sub(accumulatedInterest), 2);
      fDue = round(fee.sub(accumulatedFee), 2);
    }

    const tDue = round(pDue.add(iDue).add(fDue), 2);

    schedule.push({
      installmentNumber: i,
      dueDate,
      principalDue: pDue,
      interestDue: iDue,
      feeDue: fDue,
      totalDue: tDue,
    });
  }

  const totalPayable = round(principal.add(totalInterest).add(fee), 2);
  const maturityDate = schedule[schedule.length - 1].dueDate;

  return {
    principalAmount: principal,
    processingFee: fee,
    totalInterest,
    totalPayable,
    installmentCount: count,
    maturityDate,
    schedule,
  };
}

export function generateDecliningBalanceSchedule(params: {
  principalAmount: DecimalInput;
  annualInterestRate: DecimalInput;
  termMonths: number;
  repaymentFrequency: RepaymentFrequency;
  processingFee: DecimalInput;
  startDate: Date;
}): CalculationResult {
  const principal = toDecimal(params.principalAmount);
  const fee = toDecimal(params.processingFee);
  const annualRate = toDecimal(params.annualInterestRate); // e.g. 12.0
  const count = calculateInstallmentCount(params.termMonths, params.repaymentFrequency);

  let periodicPeriodsPerYear = 12;
  if (params.repaymentFrequency === "BIWEEKLY") periodicPeriodsPerYear = 26;
  if (params.repaymentFrequency === "WEEKLY") periodicPeriodsPerYear = 52;

  // Periodic rate r = (annualRate / 100) / periodsPerYear
  const rateDecimal = annualRate.div(100).div(periodicPeriodsPerYear);

  let pmt: Prisma.Decimal;
  if (rateDecimal.isZero()) {
    pmt = principal.div(count);
  } else {
    // PMT = P * [ r(1+r)^N ] / [ (1+r)^N - 1 ]
    const onePlusR = rateDecimal.add(1);
    const pow = onePlusR.pow(count);
    const numerator = principal.mul(rateDecimal).mul(pow);
    const denominator = pow.sub(1);
    pmt = numerator.div(denominator);
  }

  const feeBase = round(fee.div(count), 2);
  let accumulatedFee = new Decimal(0);
  let accumulatedInterest = new Decimal(0);

  let remainingPrincipal = new Decimal(principal);
  const schedule: ScheduleRow[] = [];

  for (let i = 1; i <= count; i++) {
    const dueDate = calculateDueDate(params.startDate, params.repaymentFrequency, i);
    const iDue = round(remainingPrincipal.mul(rateDecimal), 2);
    let pDue: Prisma.Decimal;
    let fDue: Prisma.Decimal;

    if (i < count) {
      pDue = round(pmt.sub(iDue), 2);
      if (pDue.gt(remainingPrincipal)) {
        pDue = remainingPrincipal;
      }
      remainingPrincipal = remainingPrincipal.sub(pDue);

      fDue = feeBase;
      accumulatedFee = accumulatedFee.add(fDue);
    } else {
      // Final installment clears remaining principal and absorbs fee difference
      pDue = round(remainingPrincipal, 2);
      remainingPrincipal = new Decimal(0);

      fDue = round(fee.sub(accumulatedFee), 2);
    }

    accumulatedInterest = accumulatedInterest.add(iDue);
    const tDue = round(pDue.add(iDue).add(fDue), 2);

    schedule.push({
      installmentNumber: i,
      dueDate,
      principalDue: pDue,
      interestDue: iDue,
      feeDue: fDue,
      totalDue: tDue,
    });
  }

  const totalInterest = round(accumulatedInterest, 2);
  const totalPayable = round(principal.add(totalInterest).add(fee), 2);
  const maturityDate = schedule[schedule.length - 1].dueDate;

  return {
    principalAmount: principal,
    processingFee: fee,
    totalInterest,
    totalPayable,
    installmentCount: count,
    maturityDate,
    schedule,
  };
}

export function generateRepaymentSchedule(params: {
  principalAmount: DecimalInput;
  annualInterestRate: DecimalInput;
  termMonths: number;
  interestType: InterestType;
  repaymentFrequency: RepaymentFrequency;
  processingFee: DecimalInput;
  startDate: Date;
}): CalculationResult {
  if (params.interestType === "FLAT") {
    return generateFlatRepaymentSchedule(params);
  }
  return generateDecliningBalanceSchedule(params);
}

export function calculateLoanPreview(params: {
  principalAmount: DecimalInput;
  annualInterestRate: DecimalInput;
  termMonths: number;
  interestType: InterestType;
  repaymentFrequency: RepaymentFrequency;
  feeType: FeeType;
  feeValue: DecimalInput;
  startDate?: Date;
}) {
  const startDate = params.startDate ?? new Date();
  const processingFee = calculateProcessingFee(params.principalAmount, params.feeType, params.feeValue);
  const result = generateRepaymentSchedule({
    principalAmount: params.principalAmount,
    annualInterestRate: params.annualInterestRate,
    termMonths: params.termMonths,
    interestType: params.interestType,
    repaymentFrequency: params.repaymentFrequency,
    processingFee,
    startDate,
  });

  const firstDueDate = result.schedule[0]?.dueDate ?? calculateFirstDueDate(startDate, params.repaymentFrequency);
  const estimatedInstallment = result.schedule[0]?.totalDue ?? new Decimal(0);

  return {
    ...result,
    processingFee,
    firstDueDate,
    estimatedInstallment,
  };
}
