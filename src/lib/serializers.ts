import type {
  LoanProduct,
  Loan,
  LoanRepaymentSchedule,
  LoanRepayment,
  Account,
  MemberProfile,
  User,
  Branch,
  CollectionNote,
  AccountTypePolicy,
  TransactionCategory,
  Transaction,
  DepositRequest,
  WithdrawalRequest,
  ExpenseCategory,
  TreasuryAccount,
  TreasuryTransaction,
  BankTransaction,
  BankAccount,
  Expense,
  Transfer,
  BankStatementImport,
  BankStatementLine,
  BankReconciliationMatch,
} from "@/generated/prisma/client";

export type AccountTypePolicyDTO = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  currency: string | null;
  minimumOpeningBalance: string;
  minimumBalance: string;
  allowDeposits: boolean;
  allowWithdrawals: boolean;
  status: string;
  branchId: string | null;
  branchName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionCategoryDTO = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  direction: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type DepositRequestDTO = {
  id: string;
  requestNumber: string;
  memberId: string;
  memberName?: string | null;
  memberNumber?: string | null;
  accountId: string;
  accountNumber?: string | null;
  branchId: string;
  branchName?: string | null;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  rejectionReason: string | null;
  approvedTransactionId: string | null;
  approvedById: string | null;
  approvedByName?: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WithdrawalRequestDTO = {
  id: string;
  requestNumber: string;
  memberId: string;
  memberName?: string | null;
  memberNumber?: string | null;
  accountId: string;
  accountNumber?: string | null;
  branchId: string;
  branchName?: string | null;
  amount: string;
  currency: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
  status: string;
  rejectionReason: string | null;
  approvedTransactionId: string | null;
  approvedById: string | null;
  approvedByName?: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransactionDTO = {
  id: string;
  accountId: string | null;
  accountNumber?: string | null;
  memberId: string;
  memberName?: string | null;
  memberNumber?: string | null;
  branchId: string;
  branchName?: string | null;
  type: string;
  amount: string;
  currency: string;
  reference: string;
  description: string | null;
  status: string;
  balanceBefore: string | null;
  balanceAfter: string | null;
  categoryId: string | null;
  categoryName?: string | null;
  createdById: string | null;
  createdByName?: string | null;
  reversedAt: string | null;
  reversedById: string | null;
  reversedByName?: string | null;
  reversalReason: string | null;
  reversalOfId: string | null;
  createdAt: string;
};

export type AccountDTO = {
  id: string;
  accountNumber: string;
  memberId: string;
  memberName?: string | null;
  memberNumber?: string | null;
  branchId: string;
  branchName?: string | null;
  accountType: string;
  accountTypeId: string | null;
  accountTypeName?: string | null;
  currency: string;
  balance: string;
  loanGuarantee: string;
  status: string;
  hasOpeningBalance: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LoanProductDTO = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  currency: string;
  minimumAmount: string;
  maximumAmount: string;
  minimumTermMonths: number;
  maximumTermMonths: number;
  interestRate: string;
  interestType: string;
  repaymentFrequency: string;
  processingFeeType: string;
  processingFeeValue: string;
  requiresApproval: boolean;
  status: string;
  branchId: string | null;
  branchName?: string | null;
  penaltyRuleId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LoanRepaymentScheduleDTO = {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  principalDue: string;
  interestDue: string;
  feeDue: string;
  penaltyDue: string;
  totalDue: string;
  principalPaid: string;
  interestPaid: string;
  feePaid: string;
  penaltyPaid: string;
  totalPaid: string;
  overdueDays: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LoanRepaymentDTO = {
  id: string;
  repaymentNumber: string;
  loanId: string;
  loanNumber?: string | null;
  accountId: string;
  accountNumber?: string | null;
  memberId: string;
  memberName?: string | null;
  memberNumber?: string | null;
  branchName?: string | null;
  amount: string;
  principalAmount: string;
  interestAmount: string;
  feeAmount: string;
  penaltyAmount: string;
  paymentDate: string;
  status: string;
  transactionId: string | null;
  reference: string | null;
  notes: string | null;
  createdById: string | null;
  createdByName?: string | null;
  reversedAt: string | null;
  reversedById: string | null;
  reversedByName?: string | null;
  reversalReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CollectionNoteDTO = {
  id: string;
  loanId: string;
  memberId: string;
  actionType: string;
  notes: string;
  actionDate: string;
  followUpDate: string | null;
  promiseToPayAmount: string | null;
  promiseToPayDate: string | null;
  createdById: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LoanDTO = {
  id: string;
  loanNumber: string;
  productId: string | null;
  productName?: string | null;
  memberId: string;
  memberName?: string | null;
  memberNumber?: string | null;
  branchId: string;
  branchName?: string | null;
  principalAmount: string;
  approvedAmount: string | null;
  paidAmount: string;
  interestRate: string;
  interestType: string;
  termMonths: number;
  repaymentFrequency: string;
  processingFee: string;
  totalInterest: string;
  totalPayable: string;
  status: string;
  currency: string;
  rejectionReason: string | null;
  applicationDate: string;
  approvalDate: string | null;
  disbursementDate: string | null;
  maturityDate: string | null;
  approvedById: string | null;
  disbursedById: string | null;
  penaltyRuleId?: string | null;
  penaltyType?: string | null;
  penaltyFrequency?: string | null;
  penaltyBasis?: string | null;
  gracePeriodDays?: number | null;
  penaltyValue?: string | null;
  maximumPenaltyAmount?: string | null;
  repaymentSchedules?: LoanRepaymentScheduleDTO[];
  repayments?: LoanRepaymentDTO[];
  collectionNotes?: CollectionNoteDTO[];
  createdAt: string;
  updatedAt: string;
};

export function serializeAccountTypePolicy(
  policy: AccountTypePolicy & { branch?: Branch | null }
): AccountTypePolicyDTO {
  return {
    id: policy.id,
    name: policy.name,
    code: policy.code,
    description: policy.description,
    currency: policy.currency,
    minimumOpeningBalance: policy.minimumOpeningBalance.toString(),
    minimumBalance: policy.minimumBalance.toString(),
    allowDeposits: policy.allowDeposits,
    allowWithdrawals: policy.allowWithdrawals,
    status: policy.status,
    branchId: policy.branchId,
    branchName: policy.branch?.name ?? null,
    createdAt: policy.createdAt.toISOString(),
    updatedAt: policy.updatedAt.toISOString(),
  };
}

export function serializeTransactionCategory(
  category: TransactionCategory
): TransactionCategoryDTO {
  return {
    id: category.id,
    name: category.name,
    code: category.code,
    description: category.description,
    direction: category.direction,
    status: category.status,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export function serializeDepositRequest(
  req: DepositRequest & {
    member?: (MemberProfile & { user?: User }) | null;
    account?: Account | null;
    branch?: Branch | null;
    approvedBy?: User | null;
  }
): DepositRequestDTO {
  return {
    id: req.id,
    requestNumber: req.requestNumber,
    memberId: req.memberId,
    memberName: req.member?.user?.name ?? null,
    memberNumber: req.member?.memberNumber ?? null,
    accountId: req.accountId,
    accountNumber: req.account?.accountNumber ?? null,
    branchId: req.branchId,
    branchName: req.branch?.name ?? null,
    amount: req.amount.toString(),
    currency: req.currency,
    paymentMethod: req.paymentMethod,
    reference: req.reference,
    notes: req.notes,
    status: req.status,
    rejectionReason: req.rejectionReason,
    approvedTransactionId: req.approvedTransactionId,
    approvedById: req.approvedById,
    approvedByName: req.approvedBy?.name ?? null,
    approvedAt: req.approvedAt ? req.approvedAt.toISOString() : null,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
  };
}

export function serializeWithdrawalRequest(
  req: WithdrawalRequest & {
    member?: (MemberProfile & { user?: User }) | null;
    account?: Account | null;
    branch?: Branch | null;
    approvedBy?: User | null;
  }
): WithdrawalRequestDTO {
  return {
    id: req.id,
    requestNumber: req.requestNumber,
    memberId: req.memberId,
    memberName: req.member?.user?.name ?? null,
    memberNumber: req.member?.memberNumber ?? null,
    accountId: req.accountId,
    accountNumber: req.account?.accountNumber ?? null,
    branchId: req.branchId,
    branchName: req.branch?.name ?? null,
    amount: req.amount.toString(),
    currency: req.currency,
    paymentMethod: req.paymentMethod,
    reference: req.reference,
    notes: req.notes,
    status: req.status,
    rejectionReason: req.rejectionReason,
    approvedTransactionId: req.approvedTransactionId,
    approvedById: req.approvedById,
    approvedByName: req.approvedBy?.name ?? null,
    approvedAt: req.approvedAt ? req.approvedAt.toISOString() : null,
    createdAt: req.createdAt.toISOString(),
    updatedAt: req.updatedAt.toISOString(),
  };
}

export function serializeTransaction(
  tx: Transaction & {
    account?: Account | null;
    member?: (MemberProfile & { user?: User }) | null;
    branch?: Branch | null;
    category?: TransactionCategory | null;
    createdBy?: User | null;
    reversedBy?: User | null;
  }
): TransactionDTO {
  return {
    id: tx.id,
    accountId: tx.accountId,
    accountNumber: tx.account?.accountNumber ?? null,
    memberId: tx.memberId,
    memberName: tx.member?.user?.name ?? null,
    memberNumber: tx.member?.memberNumber ?? null,
    branchId: tx.branchId,
    branchName: tx.branch?.name ?? null,
    type: tx.type,
    amount: tx.amount.toString(),
    currency: tx.currency,
    reference: tx.reference,
    description: tx.description,
    status: tx.status,
    balanceBefore: tx.balanceBefore ? tx.balanceBefore.toString() : null,
    balanceAfter: tx.balanceAfter ? tx.balanceAfter.toString() : null,
    categoryId: tx.categoryId,
    categoryName: tx.category?.name ?? null,
    createdById: tx.createdById,
    createdByName: tx.createdBy?.name ?? null,
    reversedAt: tx.reversedAt ? tx.reversedAt.toISOString() : null,
    reversedById: tx.reversedById,
    reversedByName: tx.reversedBy?.name ?? null,
    reversalReason: tx.reversalReason,
    reversalOfId: tx.reversalOfId,
    createdAt: tx.createdAt.toISOString(),
  };
}

export function serializeAccount(
  account: Account & {
    member?: (MemberProfile & { user?: User }) | null;
    branch?: Branch | null;
    accountTypePolicy?: AccountTypePolicy | null;
  }
): AccountDTO {
  return {
    id: account.id,
    accountNumber: account.accountNumber,
    memberId: account.memberId,
    memberName: account.member?.user?.name ?? null,
    memberNumber: account.member?.memberNumber ?? null,
    branchId: account.branchId,
    branchName: account.branch?.name ?? null,
    accountType: account.accountType,
    accountTypeId: account.accountTypeId ?? null,
    accountTypeName: account.accountTypePolicy?.name ?? account.accountType,
    currency: account.currency,
    balance: account.balance.toString(),
    loanGuarantee: account.loanGuarantee.toString(),
    status: account.status,
    hasOpeningBalance: account.hasOpeningBalance ?? false,
    createdAt: account.createdAt ? account.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: account.updatedAt ? account.updatedAt.toISOString() : new Date().toISOString(),
  };
}

export function serializeLoanProduct(
  product: LoanProduct & { branch?: Branch | null }
): LoanProductDTO {
  return {
    id: product.id,
    name: product.name,
    code: product.code,
    description: product.description,
    currency: product.currency,
    minimumAmount: product.minimumAmount.toString(),
    maximumAmount: product.maximumAmount.toString(),
    minimumTermMonths: product.minimumTermMonths,
    maximumTermMonths: product.maximumTermMonths,
    interestRate: product.interestRate.toString(),
    interestType: product.interestType,
    repaymentFrequency: product.repaymentFrequency,
    processingFeeType: product.processingFeeType,
    processingFeeValue: product.processingFeeValue.toString(),
    requiresApproval: product.requiresApproval,
    status: product.status,
    branchId: product.branchId,
    branchName: product.branch?.name ?? null,
    penaltyRuleId: product.penaltyRuleId ?? null,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export function serializeRepaymentSchedule(
  schedule: LoanRepaymentSchedule
): LoanRepaymentScheduleDTO {
  return {
    id: schedule.id,
    loanId: schedule.loanId,
    installmentNumber: schedule.installmentNumber,
    dueDate: schedule.dueDate.toISOString(),
    principalDue: schedule.principalDue.toString(),
    interestDue: schedule.interestDue.toString(),
    feeDue: schedule.feeDue.toString(),
    penaltyDue: schedule.penaltyDue ? schedule.penaltyDue.toString() : "0",
    totalDue: schedule.totalDue.toString(),
    principalPaid: schedule.principalPaid.toString(),
    interestPaid: schedule.interestPaid.toString(),
    feePaid: schedule.feePaid.toString(),
    penaltyPaid: schedule.penaltyPaid ? schedule.penaltyPaid.toString() : "0",
    totalPaid: schedule.totalPaid.toString(),
    overdueDays: schedule.overdueDays ?? 0,
    status: schedule.status,
    paidAt: schedule.paidAt ? schedule.paidAt.toISOString() : null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

export function serializeLoanRepayment(
  repayment: LoanRepayment & {
    loan?: Loan | null;
    account?: Account | null;
    member?: (MemberProfile & { user?: User; branch?: Branch }) | null;
    createdBy?: User | null;
    reversedBy?: User | null;
  }
): LoanRepaymentDTO {
  return {
    id: repayment.id,
    repaymentNumber: repayment.repaymentNumber,
    loanId: repayment.loanId,
    loanNumber: repayment.loan?.loanNumber ?? null,
    accountId: repayment.accountId,
    accountNumber: repayment.account?.accountNumber ?? null,
    memberId: repayment.memberId,
    memberName: repayment.member?.user?.name ?? null,
    memberNumber: repayment.member?.memberNumber ?? null,
    branchName: repayment.member?.branch?.name ?? null,
    amount: repayment.amount.toString(),
    principalAmount: repayment.principalAmount.toString(),
    interestAmount: repayment.interestAmount.toString(),
    feeAmount: repayment.feeAmount.toString(),
    penaltyAmount: repayment.penaltyAmount ? repayment.penaltyAmount.toString() : "0",
    paymentDate: repayment.paymentDate.toISOString(),
    status: repayment.status,
    transactionId: repayment.transactionId,
    reference: repayment.reference,
    notes: repayment.notes,
    createdById: repayment.createdById,
    createdByName: repayment.createdBy?.name ?? null,
    reversedAt: repayment.reversedAt ? repayment.reversedAt.toISOString() : null,
    reversedById: repayment.reversedById,
    reversedByName: repayment.reversedBy?.name ?? null,
    reversalReason: repayment.reversalReason,
    createdAt: repayment.createdAt.toISOString(),
    updatedAt: repayment.updatedAt.toISOString(),
  };
}

export function serializeCollectionNote(
  note: CollectionNote & { createdBy?: User | null }
): CollectionNoteDTO {
  return {
    id: note.id,
    loanId: note.loanId,
    memberId: note.memberId,
    actionType: note.actionType,
    notes: note.notes,
    actionDate: note.actionDate.toISOString(),
    followUpDate: note.followUpDate ? note.followUpDate.toISOString() : null,
    promiseToPayAmount: note.promiseToPayAmount ? note.promiseToPayAmount.toString() : null,
    promiseToPayDate: note.promiseToPayDate ? note.promiseToPayDate.toISOString() : null,
    createdById: note.createdById,
    createdByName: note.createdBy?.name ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

export function serializeLoan(
  loan: Loan & {
    product?: LoanProduct | null;
    member?: (MemberProfile & { user?: User }) | null;
    branch?: Branch | null;
    repaymentSchedules?: LoanRepaymentSchedule[];
    repayments?: LoanRepayment[];
    collectionNotes?: (CollectionNote & { createdBy?: User | null })[];
  }
): LoanDTO {
  return {
    id: loan.id,
    loanNumber: loan.loanNumber,
    productId: loan.productId,
    productName: loan.product?.name ?? null,
    memberId: loan.memberId,
    memberName: loan.member?.user?.name ?? null,
    memberNumber: loan.member?.memberNumber ?? null,
    branchId: loan.branchId,
    branchName: loan.branch?.name ?? null,
    principalAmount: loan.principalAmount.toString(),
    approvedAmount: loan.approvedAmount ? loan.approvedAmount.toString() : null,
    paidAmount: loan.paidAmount.toString(),
    interestRate: loan.interestRate.toString(),
    interestType: loan.interestType,
    termMonths: loan.termMonths,
    repaymentFrequency: loan.repaymentFrequency,
    processingFee: loan.processingFee.toString(),
    totalInterest: loan.totalInterest.toString(),
    totalPayable: loan.totalPayable.toString(),
    status: loan.status,
    currency: loan.currency,
    rejectionReason: loan.rejectionReason,
    applicationDate: loan.applicationDate.toISOString(),
    approvalDate: loan.approvalDate ? loan.approvalDate.toISOString() : null,
    disbursementDate: loan.disbursementDate ? loan.disbursementDate.toISOString() : null,
    maturityDate: loan.maturityDate ? loan.maturityDate.toISOString() : null,
    approvedById: loan.approvedById,
    disbursedById: loan.disbursedById,
    penaltyRuleId: loan.penaltyRuleId ?? null,
    penaltyType: loan.penaltyType ?? null,
    penaltyFrequency: loan.penaltyFrequency ?? null,
    penaltyBasis: loan.penaltyBasis ?? null,
    gracePeriodDays: loan.gracePeriodDays ?? null,
    penaltyValue: loan.penaltyValue ? loan.penaltyValue.toString() : null,
    maximumPenaltyAmount: loan.maximumPenaltyAmount ? loan.maximumPenaltyAmount.toString() : null,
    repaymentSchedules: loan.repaymentSchedules
      ? loan.repaymentSchedules.map(serializeRepaymentSchedule)
      : undefined,
    repayments: loan.repayments
      ? loan.repayments.map(serializeLoanRepayment)
      : undefined,
    collectionNotes: loan.collectionNotes
      ? loan.collectionNotes.map(serializeCollectionNote)
      : undefined,
    createdAt: loan.createdAt.toISOString(),
    updatedAt: loan.updatedAt.toISOString(),
  };
}

// ==================================================
// PHASE 4 — EXPENSES & BANKING SERIALIZERS & DTO TYPES
// ==================================================

export type ExpenseCategoryDTO = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  branchId: string | null;
  branchName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TreasuryAccountDTO = {
  id: string;
  name: string;
  code: string;
  accountNumber: string;
  branchId: string;
  branchName?: string | null;
  currency: string;
  balance: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type TreasuryTransactionDTO = {
  id: string;
  treasuryTransactionNumber: string;
  treasuryAccountId: string;
  treasuryAccountName?: string | null;
  type: string;
  direction: string;
  amount: string;
  currency: string;
  balanceBefore: string;
  balanceAfter: string;
  transactionDate: string;
  reference: string | null;
  description: string | null;
  expenseId: string | null;
  transferId: string | null;
  reversalOfId: string | null;
  createdById: string | null;
  createdByName?: string | null;
  createdAt: string;
};

export type BankAccountDTO = {
  id: string;
  name: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branchName: string | null;
  currency: string;
  openingBalance: string;
  currentBalance: string;
  status: string;
  branchId: string;
  branchTitle?: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BankTransactionDTO = {
  id: string;
  bankTransactionNumber: string;
  bankAccountId: string;
  bankAccountName?: string | null;
  bankName?: string | null;
  type: string;
  direction: string;
  amount: string;
  currency: string;
  balanceBefore: string;
  balanceAfter: string;
  transactionDate: string;
  reference: string | null;
  description: string | null;
  expenseId: string | null;
  transferId: string | null;
  reversalOfId: string | null;
  reconciliationStatus: string;
  reconciledAt: string | null;
  reconciledById: string | null;
  externalStatementReference: string | null;
  createdById: string | null;
  createdByName?: string | null;
  createdAt: string;
};

export type ExpenseDTO = {
  id: string;
  expenseNumber: string;
  branchId: string;
  branchName?: string | null;
  categoryId: string;
  categoryName?: string | null;
  categoryCode?: string | null;
  amount: string;
  currency: string;
  expenseDate: string;
  paymentSourceType: string;
  treasuryAccountId: string | null;
  treasuryAccountName?: string | null;
  bankAccountId: string | null;
  bankAccountName?: string | null;
  reference: string | null;
  description: string | null;
  notes: string | null;
  status: string;
  createdById: string | null;
  createdByName?: string | null;
  reversedAt: string | null;
  reversedById: string | null;
  reversalReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TransferDTO = {
  id: string;
  transferNumber: string;
  transferType: string;
  sourceTreasuryAccountId: string | null;
  sourceTreasuryAccountName?: string | null;
  sourceBankAccountId: string | null;
  sourceBankAccountName?: string | null;
  destinationTreasuryAccountId: string | null;
  destinationTreasuryAccountName?: string | null;
  destinationBankAccountId: string | null;
  destinationBankAccountName?: string | null;
  amount: string;
  currency: string;
  transferDate: string;
  reference: string | null;
  notes: string | null;
  status: string;
  createdById: string | null;
  createdByName?: string | null;
  reversedAt: string | null;
  reversedById: string | null;
  reversalReason: string | null;
  reversalOfId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeExpenseCategory(
  c: ExpenseCategory & { branch?: Branch | null }
): ExpenseCategoryDTO {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    description: c.description,
    status: c.status,
    branchId: c.branchId,
    branchName: c.branch?.name ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function serializeTreasuryAccount(
  t: TreasuryAccount & { branch?: Branch | null }
): TreasuryAccountDTO {
  return {
    id: t.id,
    name: t.name,
    code: t.code,
    accountNumber: t.accountNumber,
    branchId: t.branchId,
    branchName: t.branch?.name ?? null,
    currency: t.currency,
    balance: t.balance.toString(),
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function serializeTreasuryTransaction(
  tx: TreasuryTransaction & {
    treasuryAccount?: TreasuryAccount | null;
    createdBy?: User | null;
  }
): TreasuryTransactionDTO {
  return {
    id: tx.id,
    treasuryTransactionNumber: tx.treasuryTransactionNumber,
    treasuryAccountId: tx.treasuryAccountId,
    treasuryAccountName: tx.treasuryAccount?.name ?? null,
    type: tx.type,
    direction: tx.direction,
    amount: tx.amount.toString(),
    currency: tx.currency,
    balanceBefore: tx.balanceBefore.toString(),
    balanceAfter: tx.balanceAfter.toString(),
    transactionDate: tx.transactionDate.toISOString(),
    reference: tx.reference,
    description: tx.description,
    expenseId: tx.expenseId,
    transferId: tx.transferId,
    reversalOfId: tx.reversalOfId,
    createdById: tx.createdById,
    createdByName: tx.createdBy?.name ?? null,
    createdAt: tx.createdAt.toISOString(),
  };
}

export function serializeBankAccount(
  b: BankAccount & { branch?: Branch | null }
): BankAccountDTO {
  return {
    id: b.id,
    name: b.name,
    accountName: b.accountName,
    accountNumber: b.accountNumber,
    bankName: b.bankName,
    branchName: b.branchName,
    currency: b.currency,
    openingBalance: b.openingBalance.toString(),
    currentBalance: b.currentBalance.toString(),
    status: b.status,
    branchId: b.branchId,
    branchTitle: b.branch?.name ?? null,
    notes: b.notes,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export function serializeBankTransaction(
  btx: BankTransaction & {
    bankAccount?: BankAccount | null;
    createdBy?: User | null;
  }
): BankTransactionDTO {
  return {
    id: btx.id,
    bankTransactionNumber: btx.bankTransactionNumber,
    bankAccountId: btx.bankAccountId,
    bankAccountName: btx.bankAccount?.name ?? null,
    bankName: btx.bankAccount?.bankName ?? null,
    type: btx.type,
    direction: btx.direction,
    amount: btx.amount.toString(),
    currency: btx.currency,
    balanceBefore: btx.balanceBefore.toString(),
    balanceAfter: btx.balanceAfter.toString(),
    transactionDate: btx.transactionDate.toISOString(),
    reference: btx.reference,
    description: btx.description,
    expenseId: btx.expenseId,
    transferId: btx.transferId,
    reversalOfId: btx.reversalOfId,
    reconciliationStatus: btx.reconciliationStatus,
    reconciledAt: btx.reconciledAt ? btx.reconciledAt.toISOString() : null,
    reconciledById: btx.reconciledById,
    externalStatementReference: btx.externalStatementReference,
    createdById: btx.createdById,
    createdByName: btx.createdBy?.name ?? null,
    createdAt: btx.createdAt.toISOString(),
  };
}

export function serializeExpense(
  e: Expense & {
    branch?: Branch | null;
    category?: ExpenseCategory | null;
    treasuryAccount?: TreasuryAccount | null;
    bankAccount?: BankAccount | null;
    createdBy?: User | null;
  }
): ExpenseDTO {
  return {
    id: e.id,
    expenseNumber: e.expenseNumber,
    branchId: e.branchId,
    branchName: e.branch?.name ?? null,
    categoryId: e.categoryId,
    categoryName: e.category?.name ?? null,
    categoryCode: e.category?.code ?? null,
    amount: e.amount.toString(),
    currency: e.currency,
    expenseDate: e.expenseDate.toISOString(),
    paymentSourceType: e.paymentSourceType,
    treasuryAccountId: e.treasuryAccountId,
    treasuryAccountName: e.treasuryAccount?.name ?? null,
    bankAccountId: e.bankAccountId,
    bankAccountName: e.bankAccount?.name ?? null,
    reference: e.reference,
    description: e.description,
    notes: e.notes,
    status: e.status,
    createdById: e.createdById,
    createdByName: e.createdBy?.name ?? null,
    reversedAt: e.reversedAt ? e.reversedAt.toISOString() : null,
    reversedById: e.reversedById,
    reversalReason: e.reversalReason,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export function serializeTransfer(
  t: Transfer & {
    sourceTreasuryAccount?: TreasuryAccount | null;
    sourceBankAccount?: BankAccount | null;
    destinationTreasuryAccount?: TreasuryAccount | null;
    destinationBankAccount?: BankAccount | null;
    createdBy?: User | null;
  }
): TransferDTO {
  return {
    id: t.id,
    transferNumber: t.transferNumber,
    transferType: t.transferType,
    sourceTreasuryAccountId: t.sourceTreasuryAccountId,
    sourceTreasuryAccountName: t.sourceTreasuryAccount?.name ?? null,
    sourceBankAccountId: t.sourceBankAccountId,
    sourceBankAccountName: t.sourceBankAccount?.name ?? null,
    destinationTreasuryAccountId: t.destinationTreasuryAccountId,
    destinationTreasuryAccountName: t.destinationTreasuryAccount?.name ?? null,
    destinationBankAccountId: t.destinationBankAccountId,
    destinationBankAccountName: t.destinationBankAccount?.name ?? null,
    amount: t.amount.toString(),
    currency: t.currency,
    transferDate: t.transferDate.toISOString(),
    reference: t.reference,
    notes: t.notes,
    status: t.status,
    createdById: t.createdById,
    createdByName: t.createdBy?.name ?? null,
    reversedAt: t.reversedAt ? t.reversedAt.toISOString() : null,
    reversedById: t.reversedById,
    reversalReason: t.reversalReason,
    reversalOfId: t.reversalOfId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export type BankStatementImportDTO = {
  id: string;
  importNumber: string;
  bankAccountId: string;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  branchId: string;
  branchName?: string | null;
  fileName: string;
  fileHash: string;
  statementStartDate: string | null;
  statementEndDate: string | null;
  currency: string;
  status: string;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  failureReason: string | null;
  createdById: string | null;
  createdByName?: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type BankStatementLineDTO = {
  id: string;
  statementImportId: string;
  lineNumber: number;
  transactionDate: string;
  description: string;
  reference: string | null;
  externalTransactionId: string | null;
  direction: string;
  amount: string;
  currency: string;
  runningBalance: string | null;
  status: string;
  ignoredAt: string | null;
  ignoredById: string | null;
  ignoredByName?: string | null;
  ignoreReason: string | null;
  rawDescription: string | null;
  createdAt: string;
};

export type BankReconciliationMatchDTO = {
  id: string;
  statementLineId: string;
  bankTransactionId: string;
  matchType: string;
  status: string;
  matchedById: string | null;
  matchedByName?: string | null;
  matchedAt: string;
  unmatchedById: string | null;
  unmatchedByName?: string | null;
  unmatchedAt: string | null;
  unmatchReason: string | null;
};

export function serializeBankStatementImport(
  imp: BankStatementImport & {
    bankAccount?: { name: string; accountNumber: string } | null;
    branch?: { name: string } | null;
    createdBy?: User | null;
  }
): BankStatementImportDTO {
  return {
    id: imp.id,
    importNumber: imp.importNumber,
    bankAccountId: imp.bankAccountId,
    bankAccountName: imp.bankAccount?.name ?? null,
    bankAccountNumber: imp.bankAccount?.accountNumber ?? null,
    branchId: imp.branchId,
    branchName: imp.branch?.name ?? null,
    fileName: imp.fileName,
    fileHash: imp.fileHash,
    statementStartDate: imp.statementStartDate ? imp.statementStartDate.toISOString() : null,
    statementEndDate: imp.statementEndDate ? imp.statementEndDate.toISOString() : null,
    currency: imp.currency,
    status: imp.status,
    rowCount: imp.rowCount,
    validRowCount: imp.validRowCount,
    invalidRowCount: imp.invalidRowCount,
    failureReason: imp.failureReason,
    createdById: imp.createdById,
    createdByName: imp.createdBy?.name ?? null,
    createdAt: imp.createdAt.toISOString(),
    completedAt: imp.completedAt ? imp.completedAt.toISOString() : null,
  };
}

export function serializeBankStatementLine(
  line: BankStatementLine & {
    ignoredBy?: User | null;
  }
): BankStatementLineDTO {
  return {
    id: line.id,
    statementImportId: line.statementImportId,
    lineNumber: line.lineNumber,
    transactionDate: line.transactionDate.toISOString(),
    description: line.description,
    reference: line.reference,
    externalTransactionId: line.externalTransactionId,
    direction: line.direction,
    amount: line.amount.toString(),
    currency: line.currency,
    runningBalance: line.runningBalance ? line.runningBalance.toString() : null,
    status: line.status,
    ignoredAt: line.ignoredAt ? line.ignoredAt.toISOString() : null,
    ignoredById: line.ignoredById,
    ignoredByName: line.ignoredBy?.name ?? null,
    ignoreReason: line.ignoreReason,
    rawDescription: line.rawDescription,
    createdAt: line.createdAt.toISOString(),
  };
}

export function serializeBankReconciliationMatch(
  m: BankReconciliationMatch & {
    matchedBy?: User | null;
    unmatchedBy?: User | null;
  }
): BankReconciliationMatchDTO {
  return {
    id: m.id,
    statementLineId: m.statementLineId,
    bankTransactionId: m.bankTransactionId,
    matchType: m.matchType,
    status: m.status,
    matchedById: m.matchedById,
    matchedByName: m.matchedBy?.name ?? null,
    matchedAt: m.matchedAt.toISOString(),
    unmatchedById: m.unmatchedById,
    unmatchedByName: m.unmatchedBy?.name ?? null,
    unmatchedAt: m.unmatchedAt ? m.unmatchedAt.toISOString() : null,
    unmatchReason: m.unmatchReason,
  };
}


