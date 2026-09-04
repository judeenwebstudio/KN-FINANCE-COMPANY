-- Migrate CompanyProfile locale to en-IN
UPDATE "CompanyProfile" SET "locale" = 'en-IN' WHERE "locale" = 'en-US';

-- Update existing currency columns from USD/EUR to INR (without altering numerical monetary amounts)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Branch') THEN
        UPDATE "Branch" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'Account') THEN
        UPDATE "Account" SET "currency" = 'INR' WHERE "currency" != 'INR';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'AccountType') THEN
        UPDATE "AccountType" SET "currency" = 'INR' WHERE "currency" != 'INR';
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
END $$;
