-- The API role reads and writes rows only: no DDL, no ownership, so RLS always applies to it.
GRANT USAGE ON SCHEMA public TO coinfidant_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO coinfidant_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO coinfidant_app;
