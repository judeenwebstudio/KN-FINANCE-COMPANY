# KN Finance Company — Production Release Guide

This document defines the single authoritative production release procedure for KN Finance Company to prevent Vercel advisory-lock concurrency errors (`Prisma Error P1002`).

---

## 1. Single Authoritative Deployment Trigger

- **Authoritative Trigger**: `git push origin main` (Vercel GitHub Integration).
- **Prohibited Command**: `vercel --prod` (Do **NOT** execute CLI `--prod` deployments alongside `git push`).

### Why Duplication Causes P1002 Errors
When code is pushed to `main`, GitHub automatically triggers a Vercel build. If a developer or automated task simultaneously invokes `vercel --prod`, Vercel launches **TWO** parallel production deployments for the exact same SHA. Both builds execute `vercel-build` concurrently, competing for the PostgreSQL advisory lock (`SELECT pg_advisory_lock(72707369)`). The second build times out after 10,000ms and fails with `Prisma Error P1002`.

---

## 2. Release Pipeline Architecture

### Build Command (`package.json`)
```json
"vercel-build": "prisma migrate deploy && tsx scripts/bootstrap-rbac.ts && tsx scripts/verify-settings-readiness.ts && next build"
```

### Execution Responsibilities
1. **`prisma migrate deploy`**: Applies pending database migrations safely.
2. **`bootstrap-rbac.ts`**: Ensures relational RBAC permissions and system roles are bootstrapped idempotently.
3. **`verify-settings-readiness.ts`**: Ensures notification templates and Super Admin relational assignments exist.
4. **`next build`**: Compiles Next.js application assets.

---

## 3. Standard Release Procedure

1. **Run Local Quality Gates**:
   ```bash
   npx tsx --test src/lib/auth/__tests__/rbac-integrity.test.ts src/lib/settings/__tests__/company-profile.test.ts src/lib/settings/__tests__/branch-service.test.ts src/lib/settings/__tests__/phase7c-notifications.test.ts src/lib/members/__tests__/member-service.test.ts
   npm run lint
   npm run typecheck
   npm run build
   ```

2. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat/fix: description of changes"
   ```

3. **Push to Production**:
   ```bash
   git push origin main
   ```

4. **Verify Single Vercel Deployment**:
   - Inspect Vercel dashboard or run `npx vercel ls`.
   - Confirm **EXACTLY ONE** production build is active.
   - Confirm build completes with `Status = Ready`.

---

## 4. Advisory Lock (P1002) Response Protocol

If a P1002 advisory lock error occurs:
1. **DO NOT** launch immediate concurrent CLI retries.
2. Verify if another build is currently running (`npx vercel ls`).
3. Wait for the active deployment to finish.
4. Check migration status safely: `npx prisma migrate status`.
5. NEVER disable Prisma advisory locking, run `prisma db push`, or run `prisma migrate reset` in production.
