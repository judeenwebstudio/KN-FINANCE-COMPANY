export type NavItem = {
  name: string;
  href: string;
  icon: string;
  permission?: string;
};

export const adminNavItems: NavItem[] = [
  { name: "Dashboard", href: "/admin/dashboard", icon: "layout-dashboard", permission: "dashboard.view" },
  { name: "Members", href: "/admin/members", icon: "users", permission: "members.view" },
  { name: "Member Custom Fields", href: "/admin/custom-fields", icon: "user-settings", permission: "members.custom_fields.manage" },
  { name: "Loans", href: "/admin/loans", icon: "loans", permission: "loans.view" },
  { name: "Loan Products", href: "/admin/loan-products", icon: "deposit-method", permission: "loans.manage_products" },
  { name: "Upcoming Payments", href: "/admin/payments", icon: "calendar", permission: "loans.view" },
  { name: "Loan Repayments", href: "/admin/repayments", icon: "receipt", permission: "loans.view" },
  { name: "Overdue & Collections", href: "/admin/overdue", icon: "alert-triangle", permission: "loans.collections.manage" },
  { name: "Accounts", href: "/admin/accounts", icon: "accounts", permission: "accounts.view" },
  { name: "Account Types", href: "/admin/account-types", icon: "layers", permission: "accounts.view" },
  { name: "Transaction Categories", href: "/admin/transaction-categories", icon: "tag", permission: "accounts.view" },
  { name: "Deposits", href: "/admin/deposits", icon: "deposit", permission: "accounts.deposit" },
  { name: "Withdrawals", href: "/admin/withdrawals", icon: "withdrawal", permission: "accounts.withdraw" },
  { name: "Transactions", href: "/admin/transactions", icon: "transfer", permission: "accounts.view" },
  { name: "Expenses", href: "/admin/expenses", icon: "expense", permission: "expenses.view" },
  { name: "Expense Categories", href: "/admin/expense-categories", icon: "tag", permission: "expenses.manage_categories" },
  { name: "Bank Accounts", href: "/admin/bank-accounts", icon: "bank", permission: "banking.view" },
  { name: "Bank Transactions", href: "/admin/bank-transactions", icon: "transfer", permission: "banking.view" },
  { name: "Transfers", href: "/admin/transfers", icon: "transfer", permission: "banking.transfer" },
  { name: "Bank Reconciliation", href: "/admin/reconciliation", icon: "bank", permission: "banking.reconcile" },
  { name: "User Management", href: "/admin/users", icon: "user-settings", permission: "users.view" },
  { name: "Role Management", href: "/admin/roles", icon: "layers", permission: "roles.view" },
  { name: "Audit Log", href: "/admin/audit-log", icon: "receipt", permission: "audit.view" },
  { name: "Reports", href: "/admin/reports", icon: "reports", permission: "reports.view" },
  { name: "Portfolio Quality", href: "/admin/reports/portfolio-quality", icon: "reports", permission: "reports.portfolio_quality" },
  { name: "System Settings", href: "/admin/settings", icon: "settings", permission: "settings.view" },
];

export const adminNavigation = adminNavItems.map((item) => [item.name, item.href, item.icon] as const);

export const memberNavigation = [
  ["Dashboard", "/member/dashboard", "layout-dashboard"],
  ["My Accounts", "/member/accounts", "accounts"],
  ["My Loans", "/member/loans", "loans"],
  ["Loan Calculator", "/member/loan-calculator", "calculator"],
  ["Transfer Money", "/member/transfer", "transfer"],
  ["Deposit Money", "/member/deposits", "deposit"],
  ["Withdraw Money", "/member/withdrawals", "withdrawal"],
  ["Pending Requests", "/member/requests", "pending"],
  ["Reports", "/member/reports", "reports"],
] as const;

export const moduleTitles: Record<string, string> = Object.fromEntries(
  [...adminNavItems.map((item) => [item.name, item.href] as const), ...memberNavigation].map(([name, path]) => [path, name])
);
