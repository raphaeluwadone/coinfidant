ALTER TABLE "profiles" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "spends" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "profiles_owner" ON "profiles" CASCADE;--> statement-breakpoint
DROP TABLE "profiles" CASCADE;--> statement-breakpoint
DROP POLICY "spends_owner" ON "spends" CASCADE;--> statement-breakpoint
DROP TABLE "spends" CASCADE;--> statement-breakpoint
DROP POLICY "bills_owner" ON "bills" CASCADE;--> statement-breakpoint
ALTER TABLE "bills" DROP CONSTRAINT "bills_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "bills_user_id_idx";--> statement-breakpoint
DELETE FROM "bills" WHERE "budget_id" IS NULL;--> statement-breakpoint
ALTER TABLE "bills" ALTER COLUMN "budget_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bills" DROP COLUMN "user_id";
