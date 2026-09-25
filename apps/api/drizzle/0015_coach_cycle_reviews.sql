ALTER TABLE "advice_reviews" ALTER COLUMN "week_index" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "advice_reviews" ADD COLUMN "kind" text DEFAULT 'week' NOT NULL;--> statement-breakpoint
ALTER TABLE "advice_reviews" ADD CONSTRAINT "advice_reviews_kind" CHECK (("advice_reviews"."kind" = 'week' and "advice_reviews"."week_index" is not null) or "advice_reviews"."kind" = 'cycle');