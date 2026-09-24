CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount" bigint NOT NULL,
	CONSTRAINT "bills_amount_positive" CHECK ("bills"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"salary" bigint NOT NULL,
	"savings_percent" smallint NOT NULL,
	"payday" smallint NOT NULL,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"personality" text DEFAULT 'cheeky' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_salary_positive" CHECK ("profiles"."salary" > 0),
	CONSTRAINT "profiles_savings_range" CHECK ("profiles"."savings_percent" between 0 and 90),
	CONSTRAINT "profiles_payday_range" CHECK ("profiles"."payday" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "spends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" bigint NOT NULL,
	"category" text NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"local_date" date NOT NULL,
	CONSTRAINT "spends_amount_positive" CHECK ("spends"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spends" ADD CONSTRAINT "spends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bills_user_id_idx" ON "bills" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "spends_user_date_idx" ON "spends" USING btree ("user_id","local_date");