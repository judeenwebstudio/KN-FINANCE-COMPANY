/**
 * Truthful Scheduled Jobs Monitoring Service.
 * 
 * Invariants:
 * 1. Zero automated financial mutators or recurring background crons are introduced.
 * 2. System tasks execute on-demand via user actions or manual administrative triggers.
 * 3. Reports truthful "Not Configured" status when no production background scheduler is active.
 */

export type ScheduledJobDTO = {
  key: string;
  name: string;
  purpose: string;
  triggerType: "ON_DEMAND" | "EVENT_DRIVEN" | "MANUAL_ADMIN" | "CRON";
  schedule: string;
  status: "ACTIVE" | "NOT_CONFIGURED" | "DISABLED";
  lastRun: string | null;
  lastResult: string | null;
};

export type ScheduledJobsStatusDTO = {
  configured: boolean;
  message: string;
  jobs: ScheduledJobDTO[];
};

export function getScheduledJobsStatus(): ScheduledJobsStatusDTO {
  return {
    configured: false,
    message: "No production scheduler configured. System tasks execute on-demand or via manual administrative triggers.",
    jobs: [
      {
        key: "overdue-loans-processing",
        name: "Overdue Loan & Penalty Assessment",
        purpose: "Calculates installment overdue days, assesses penalties, and evaluates loan delinquency status.",
        triggerType: "ON_DEMAND",
        schedule: "On-demand (Evaluated during loan & dashboard queries)",
        status: "NOT_CONFIGURED",
        lastRun: null,
        lastResult: "On-demand execution",
      },
      {
        key: "payment-reminders-dispatch",
        name: "Repayment Reminder Dispatch",
        purpose: "Dispatches notifications for loan approvals, repayments, and account activities.",
        triggerType: "EVENT_DRIVEN",
        schedule: "Event-driven (Triggered synchronously by system events)",
        status: "NOT_CONFIGURED",
        lastRun: null,
        lastResult: "Synchronous event dispatch",
      },
      {
        key: "bank-reconciliation-match",
        name: "Bank Statement Auto-Reconciliation",
        purpose: "Matches imported bank statement lines against posted bank transactions.",
        triggerType: "MANUAL_ADMIN",
        schedule: "Manual trigger (Executed via administrative reconciliation panel)",
        status: "NOT_CONFIGURED",
        lastRun: null,
        lastResult: "Manual administrative execution",
      },
    ],
  };
}
