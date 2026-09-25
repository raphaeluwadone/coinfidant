CREATE TABLE "advice_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"week_index" smallint NOT NULL,
	"pace" text NOT NULL,
	"payload" jsonb NOT NULL,
	"review" jsonb NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advice_reviews_pace" CHECK ("advice_reviews"."pace" in ('ahead', 'onPace', 'behind'))
);
--> statement-breakpoint
ALTER TABLE "advice_reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "advice_reviews" ADD CONSTRAINT "advice_reviews_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advice_reviews" ADD CONSTRAINT "advice_reviews_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advice_reviews_budget_id_created_at_index" ON "advice_reviews" USING btree ("budget_id","created_at");--> statement-breakpoint
CREATE INDEX "advice_reviews_cycle_id_index" ON "advice_reviews" USING btree ("cycle_id");--> statement-breakpoint
CREATE POLICY "advice_reviews_member" ON "advice_reviews" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));