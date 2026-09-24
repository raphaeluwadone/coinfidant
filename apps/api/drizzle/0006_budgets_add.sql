CREATE TABLE "budget_members" (
	"budget_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_members_budget_id_user_id_pk" PRIMARY KEY("budget_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "budget_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"savings_percent" smallint NOT NULL,
	"min_savings_percent" smallint DEFAULT 5 NOT NULL,
	"floor_percent" smallint DEFAULT 70 NOT NULL,
	"week_start" smallint DEFAULT 0 NOT NULL,
	"expected_payday" smallint NOT NULL,
	"everyday_estimate" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budgets_savings_range" CHECK ("budgets"."savings_percent" between 0 and 90),
	CONSTRAINT "budgets_min_savings_range" CHECK ("budgets"."min_savings_percent" between 0 and 90),
	CONSTRAINT "budgets_floor_range" CHECK ("budgets"."floor_percent" between 0 and 100),
	CONSTRAINT "budgets_week_start_range" CHECK ("budgets"."week_start" between 0 and 6),
	CONSTRAINT "budgets_payday_range" CHECK ("budgets"."expected_payday" between 1 and 31)
);
--> statement-breakpoint
ALTER TABLE "budgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"slug" text,
	"position" smallint DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"name" text NOT NULL,
	"min_amount" bigint NOT NULL,
	"ideal_amount" bigint NOT NULL,
	CONSTRAINT "commitments_amounts" CHECK ("commitments"."min_amount" >= 0 and "commitments"."ideal_amount" >= "commitments"."min_amount")
);
--> statement-breakpoint
ALTER TABLE "commitments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"salary" bigint NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"end_date" date,
	"snapshot" jsonb,
	"engine_version" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cycles_budget_start" UNIQUE("budget_id","start_date"),
	CONSTRAINT "cycles_status" CHECK ("cycles"."status" in ('open', 'closed', 'locked')),
	CONSTRAINT "cycles_salary_positive" CHECK ("cycles"."salary" > 0)
);
--> statement-breakpoint
ALTER TABLE "cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"debt_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"paid_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debt_payments_amount_positive" CHECK ("debt_payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "debt_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "debts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"name" text NOT NULL,
	"creditor" text NOT NULL,
	"amount_left" bigint NOT NULL,
	"has_interest" boolean DEFAULT false NOT NULL,
	"plan" text NOT NULL,
	"due_date" date,
	"per_cycle" bigint,
	"min_amount" bigint,
	"ideal_amount" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "debts_amount_left" CHECK ("debts"."amount_left" >= 0),
	CONSTRAINT "debts_plan_fields" CHECK (("debts"."plan" = 'oneOff' and "debts"."due_date" is not null)
        or ("debts"."plan" = 'installments' and "debts"."per_cycle" > 0)
        or ("debts"."plan" = 'flexible' and "debts"."min_amount" >= 0 and "debts"."ideal_amount" >= "debts"."min_amount"))
);
--> statement-breakpoint
ALTER TABLE "debts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "incomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	"kind" text DEFAULT 'salary' NOT NULL,
	CONSTRAINT "incomes_amount_positive" CHECK ("incomes"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "incomes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sinking_funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target" bigint NOT NULL,
	"saved" bigint DEFAULT 0 NOT NULL,
	"due_date" date NOT NULL,
	CONSTRAINT "sinking_funds_amounts" CHECK ("sinking_funds"."target" > 0 and "sinking_funds"."saved" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sinking_funds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sweep_choices" (
	"budget_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"week_index" smallint NOT NULL,
	"debt_id" uuid,
	CONSTRAINT "sweep_choices_cycle_id_week_index_pk" PRIMARY KEY("cycle_id","week_index")
);
--> statement-breakpoint
ALTER TABLE "sweep_choices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"budget_id" uuid NOT NULL,
	"created_by" uuid,
	"amount" bigint NOT NULL,
	"type" text DEFAULT 'spend' NOT NULL,
	"category_id" uuid NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"local_date" date NOT NULL,
	CONSTRAINT "transactions_amount_positive" CHECK ("transactions"."amount" > 0),
	CONSTRAINT "transactions_type" CHECK ("transactions"."type" in ('spend', 'refund'))
);
--> statement-breakpoint
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "budget_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" text DEFAULT 'Africa/Lagos' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "personality" text DEFAULT 'cheeky' NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_members" ADD CONSTRAINT "budget_members_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_members" ADD CONSTRAINT "budget_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debts" ADD CONSTRAINT "debts_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incomes" ADD CONSTRAINT "incomes_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sinking_funds" ADD CONSTRAINT "sinking_funds_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sweep_choices" ADD CONSTRAINT "sweep_choices_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sweep_choices" ADD CONSTRAINT "sweep_choices_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sweep_choices" ADD CONSTRAINT "sweep_choices_debt_id_debts_id_fk" FOREIGN KEY ("debt_id") REFERENCES "public"."debts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_members_user_id_index" ON "budget_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "budgets_owner_id_index" ON "budgets" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "categories_budget_id_index" ON "categories" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "commitments_budget_id_index" ON "commitments" USING btree ("budget_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cycles_one_open" ON "cycles" USING btree ("budget_id") WHERE "cycles"."status" = 'open';--> statement-breakpoint
CREATE INDEX "debt_payments_cycle_id_index" ON "debt_payments" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "debts_budget_id_index" ON "debts" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "incomes_budget_id_index" ON "incomes" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "sinking_funds_budget_id_index" ON "sinking_funds" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "transactions_budget_id_local_date_index" ON "transactions" USING btree ("budget_id","local_date");--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bills_budget_id_index" ON "bills" USING btree ("budget_id");--> statement-breakpoint
CREATE POLICY "bills_member" ON "bills" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "budget_members_self" ON "budget_members" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (user_id = app_user()) WITH CHECK (user_id = app_user());--> statement-breakpoint
CREATE POLICY "budgets_member" ON "budgets" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (owner_id = app_user() or id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (owner_id = app_user() or id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "categories_member" ON "categories" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "commitments_member" ON "commitments" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "cycles_member" ON "cycles" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "debt_payments_member" ON "debt_payments" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "debts_member" ON "debts" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "incomes_member" ON "incomes" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "sinking_funds_member" ON "sinking_funds" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "sweep_choices_member" ON "sweep_choices" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));--> statement-breakpoint
CREATE POLICY "transactions_member" ON "transactions" AS PERMISSIVE FOR ALL TO "coinfidant_app" USING (budget_id in (select budget_id from budget_members where user_id = app_user())) WITH CHECK (budget_id in (select budget_id from budget_members where user_id = app_user()));