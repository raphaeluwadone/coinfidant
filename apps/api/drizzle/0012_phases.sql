ALTER TABLE "budgets" ADD COLUMN "phase" text;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "phase_from" text;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "original_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing debts have no recorded original, so start their progress from today.
UPDATE "debts" SET "original_amount" = "amount_left" WHERE "original_amount" = 0;
