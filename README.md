# CreditFlow

CreditFlow is a standalone, multi-branch credit and loan management foundation built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui conventions, PostgreSQL, Prisma, and Auth.js.

## Prerequisites

- Node.js 22 or newer
- PostgreSQL 15 or newer

## Local setup

1. Copy `.env.example` to `.env` and set a PostgreSQL `DATABASE_URL`.
2. Generate a secure Auth.js secret with `npx auth secret` or another cryptographically secure generator and set `AUTH_SECRET`.
3. Install packages with `npm install`.
4. Generate the Prisma client with `npm run db:generate`.
5. Create/update the development schema with `npm run db:push`.
6. Load demo data with `npm run db:seed`.
7. Start the app with `npm run dev` and visit `http://localhost:3000`.

For migration-based environments, use `npx prisma migrate dev --name init` instead of `db:push`, then commit the generated migration.

## Development demo credentials

All demo accounts use password `DemoPass123!`.

| Portal | Email |
| --- | --- |
| Super admin | `superadmin@creditflow.demo` |
| Admin | `admin@creditflow.demo` |
| Member | `member@creditflow.demo` |

These credentials are development-only and must never be used in production.

## Authorization model

- `SUPER_ADMIN` and `ADMIN` can access data from all branches.
- `BRANCH_MANAGER` and `STAFF` are restricted to their assigned branch.
- `MEMBER` users can only access their own member profile, accounts, loans, and transactions.
- The route proxy rejects cross-portal navigation, and server layouts/data loaders repeat authorization checks at the data boundary.

## Quality commands

```bash
npm run db:validate
npm run lint
npm run typecheck
npm run build
```

## Phase 1 boundary

Phase 1 provides the production-oriented architecture, database foundation, credentials authentication, role and branch authorization, seeded dashboards, responsive portal navigation, loading/error/empty states, and placeholders for every requested module. Approval workflows, amortization and repayment engines, transfers, ledgers, advanced reporting, delivery notifications, translations, audit trails, and uploads are intentionally reserved for Phase 2.
