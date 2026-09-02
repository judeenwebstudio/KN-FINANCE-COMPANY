export type PermissionDefinition = {
  code: string;
  name: string;
  category: string;
  description: string;
};

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // Dashboard
  { code: "dashboard.view", name: "View Dashboard", category: "Dashboard", description: "Access main operational dashboard." },

  // Members
  { code: "members.view", name: "View Members", category: "Members", description: "View member list and profiles." },
  { code: "members.create", name: "Create Member", category: "Members", description: "Register new member profile." },
  { code: "members.update", name: "Update Member", category: "Members", description: "Update member profile details." },
  { code: "members.delete", name: "Delete Member", category: "Members", description: "Remove or deactivate member profile." },
  { code: "members.import", name: "Import Members", category: "Members", description: "Bulk import member data." },
  { code: "members.requests.review", name: "Review Member Requests", category: "Members", description: "Review member portal requests." },

  // Loans
  { code: "loans.view", name: "View Loans", category: "Loans", description: "View loan facilities and schedules." },
  { code: "loans.create", name: "Create Loan Application", category: "Loans", description: "Submit new loan application." },
  { code: "loans.approve", name: "Approve Loan", category: "Loans", description: "Approve pending loan applications." },
  { code: "loans.reject", name: "Reject Loan", category: "Loans", description: "Reject pending loan applications." },
  { code: "loans.disburse", name: "Disburse Loan", category: "Loans", description: "Atomically disburse approved loan funds." },
  { code: "loans.repay", name: "Post Repayment", category: "Loans", description: "Post loan repayments against schedules." },
  { code: "loans.reverse_repayment", name: "Reverse Repayment", category: "Loans", description: "Reverse previously posted loan repayments." },
  { code: "loans.manage_products", name: "Manage Loan Products", category: "Loans", description: "Create and update loan products." },
  { code: "loans.manage_penalties", name: "Manage Penalty Rules", category: "Loans", description: "Configure penalty rules and parameters." },
  { code: "loans.collections.manage", name: "Manage Collections", category: "Loans", description: "Record collection notes and actions." },

  // Accounts
  { code: "accounts.view", name: "View Accounts", category: "Accounts", description: "View member accounts and ledgers." },
  { code: "accounts.create", name: "Create Account", category: "Accounts", description: "Open new member account." },
  { code: "accounts.update_status", name: "Update Account Status", category: "Accounts", description: "Freeze, unfreeze, or close member accounts." },
  { code: "accounts.deposit", name: "Post Deposit", category: "Accounts", description: "Process manual deposits to member accounts." },
  { code: "accounts.withdraw", name: "Post Withdrawal", category: "Accounts", description: "Process manual withdrawals from member accounts." },
  { code: "accounts.reverse_transaction", name: "Reverse Member Transaction", category: "Accounts", description: "Reverse generic member account transactions." },

  // Expenses
  { code: "expenses.view", name: "View Expenses", category: "Expenses", description: "View company expenses and subledgers." },
  { code: "expenses.create", name: "Post Expense", category: "Expenses", description: "Post company expenses from treasury or bank." },
  { code: "expenses.reverse", name: "Reverse Expense", category: "Expenses", description: "Reverse previously posted company expenses." },
  { code: "expenses.manage_categories", name: "Manage Expense Categories", category: "Expenses", description: "Configure expense categories." },

  // Banking & Treasury
  { code: "banking.view", name: "View Banking & Treasury", category: "Banking", description: "View treasury accounts, bank accounts, and transactions." },
  { code: "banking.manage_accounts", name: "Manage Bank Accounts", category: "Banking", description: "Create and update bank & treasury accounts." },
  { code: "banking.post_transactions", name: "Post Bank Transactions", category: "Banking", description: "Post manual deposits/withdrawals on bank accounts." },
  { code: "banking.transfer", name: "Execute Transfers", category: "Banking", description: "Transfer funds between treasury and bank accounts." },
  { code: "banking.reverse_transfer", name: "Reverse Transfer", category: "Banking", description: "Reverse company fund transfers." },
  { code: "banking.reconcile", name: "Bank Reconciliation", category: "Banking", description: "Import statement CSV, auto-match, manual match, unmatch." },

  // Reports
  { code: "reports.view", name: "View Reports", category: "Reports", description: "Access operational and financial reports." },
  { code: "reports.export", name: "Export Reports", category: "Reports", description: "Export report datasets." },
  { code: "reports.portfolio_quality", name: "Portfolio Quality Reports", category: "Reports", description: "View PAR aging, collection rate, and vintage analysis." },

  // User Management
  { code: "users.view", name: "View Users", category: "Users", description: "View system user directory and details." },
  { code: "users.create", name: "Create User", category: "Users", description: "Create new administrative or staff users." },
  { code: "users.update", name: "Update User", category: "Users", description: "Update user profile details." },
  { code: "users.disable", name: "Change User Status", category: "Users", description: "Activate, deactivate, or suspend users." },
  { code: "users.assign_roles", name: "Assign Roles", category: "Users", description: "Assign or modify user roles." },
  { code: "users.manage_branch_access", name: "Manage Branch Scope", category: "Users", description: "Assign authorized branch scopes to users." },

  // Role Management
  { code: "roles.view", name: "View Roles", category: "Roles", description: "View defined system and custom roles." },
  { code: "roles.create", name: "Create Role", category: "Roles", description: "Create custom roles (requires global branch scope)." },
  { code: "roles.update", name: "Update Role", category: "Roles", description: "Update role metadata (requires global branch scope)." },
  { code: "roles.delete", name: "Delete Role", category: "Roles", description: "Delete unassigned custom roles (requires global branch scope)." },
  { code: "roles.assign_permissions", name: "Assign Role Permissions", category: "Roles", description: "Modify permissions mapped to roles (requires global branch scope)." },

  // Settings
  { code: "settings.view", name: "View Settings", category: "Settings", description: "View system configuration settings." },
  { code: "settings.update", name: "Update Settings", category: "Settings", description: "Update system settings." },

  // Audit
  { code: "audit.view", name: "View Audit Log", category: "Audit", description: "Access administrative audit log." },
];
