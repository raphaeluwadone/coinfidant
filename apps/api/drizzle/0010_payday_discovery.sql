CREATE TABLE "cycle_top_ups" (
	"budget_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"item_kind" text NOT NULL,
	"item_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "cycle_top_ups_cycle_id_item_id_pk" PRIMARY KEY("cycle_id","item_id"),
	CONSTRAINT "cycle_top_ups_kind" CHECK ("cycle_top_ups"."item_kind" in ('commitment', 'debt')),
	CONSTRAINT "cycle_top_ups_amount" CHECK ("cycle_top_ups"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "cycle_top_ups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "payday_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cycles" ADD COLUMN "learned" jsonb;--> statement-breakpoint
ALTER TABLE "cycle_top_ups" ADD CONSTRAINT "cycle_top_ups_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_top_ups" ADD CONSTRAINT "cycle_top_ups_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "cycle_top_ups_member" ON "cycle_top_ups" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
-- Cycles that already exist were started before Payday mode, so don't replay the flow for them.
UPDATE "cycles" SET "payday_seen_at" = now() WHERE "payday_seen_at" IS NULL;
