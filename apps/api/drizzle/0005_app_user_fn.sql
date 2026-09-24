-- The user ScopedDb sets for the current transaction, or null outside one.
CREATE OR REPLACE FUNCTION app_user() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
