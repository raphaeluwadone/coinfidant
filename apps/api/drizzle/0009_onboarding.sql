CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🎯' NOT NULL,
	"target" bigint NOT NULL,
	"saved" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_amounts" CHECK ("goals"."target" > 0 and "goals"."saved" >= 0)
);
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "leftover_default" text DEFAULT 'savings' NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "payday_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "discovery" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "checkin_method" text DEFAULT 'app' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "leak_categories" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "overspend_times" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_budget_id_index" ON "goals" USING btree ("budget_id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_leftover_default" CHECK ("budgets"."leftover_default" in ('savings', 'debts'));--> statement-breakpoint
CREATE POLICY "goals_member" ON "goals" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));