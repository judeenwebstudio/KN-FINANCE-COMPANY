-- Migrate CompanyProfile locale to en-IN
UPDATE "CompanyProfile" SET "locale" = 'en-IN' WHERE "locale" != 'en-IN';

-- Update existing currency columns from USD/EUR to INR (without altering numerical monetary amounts)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Branch') THEN
        UPDATE "Branch" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Account') THEN
        UPDATE "Account" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'AccountTypePolicy') THEN
        UPDATE "AccountTypePolicy" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Loan') THEN
        UPDATE "Loan" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'LoanProduct') THEN
        UPDATE "LoanProduct" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Transaction') THEN
        UPDATE "Transaction" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Expense') THEN
        UPDATE "Expense" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'TreasuryAccount') THEN
        UPDATE "TreasuryAccount" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'BankAccount') THEN
        UPDATE "BankAccount" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'BankTransaction') THEN
        UPDATE "BankTransaction" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Transfer') THEN
        UPDATE "Transfer" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'DepositRequest') THEN
        UPDATE "DepositRequest" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'WithdrawalRequest') THEN
        UPDATE "WithdrawalRequest" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'BankStatementImport') THEN
        UPDATE "BankStatementImport" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'NotificationTemplate') THEN
        UPDATE "NotificationTemplate" SET "subject" = REPLACE("subject", 'USD', 'INR'), "bodyTemplate" = REPLACE("bodyTemplate", 'USD', 'INR') WHERE "subject" LIKE '%USD%' OR "bodyTemplate" LIKE '%USD%';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Notification') THEN
        UPDATE "Notification" SET "title" = REPLACE("title", 'USD', 'INR'), "message" = REPLACE("message", 'USD', 'INR') WHERE "title" LIKE '%USD%' OR "message" LIKE '%USD%';
    END IF;
END $$;
