ALTER TABLE "sinking_funds" ALTER COLUMN "due_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "debts" ADD COLUMN "apr_bp" integer;--> statement-breakpoint
ALTER TABLE "sinking_funds" ADD COLUMN "per_cycle" bigint;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_apr" CHECK ("debts"."apr_bp" is null or "debts"."apr_bp" between 0 and 100000);--> statement-breakpoint
ALTER TABLE "sinking_funds" ADD CONSTRAINT "sinking_funds_schedule" CHECK ("sinking_funds"."due_date" is not null or "sinking_funds"."per_cycle" > 0);