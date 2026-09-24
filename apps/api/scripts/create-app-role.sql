-- Creates the API's login role. Run once per database as the owner:
--   psql "$MIGRATION_DATABASE_URL" -v pw="$APP_DB_PASSWORD" -f scripts/create-app-role.sql
SELECT format('CREATE ROLE coinfidant_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'coinfidant_app')
\gexec
