// Runs before each deploy goes live: makes sure the app role exists, then applies migrations as the owner.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.MIGRATION_DATABASE_URL;
const appPassword = process.env.APP_DB_PASSWORD;
if (!url || !appPassword) throw new Error("MIGRATION_DATABASE_URL and APP_DB_PASSWORD must be set");

const sql = postgres(url, { max: 1, onnotice: () => {} });
const [exists] = await sql`select 1 from pg_roles where rolname = 'coinfidant_app'`;
if (!exists) {
  // CREATE ROLE can't take a bind parameter, so Postgres quotes the password itself.
  const [row] = await sql<{ stmt: string }[]>`
    select format('CREATE ROLE coinfidant_app LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS', ${appPassword}::text) as stmt`;
  await sql.unsafe(row!.stmt);
  console.log("created role coinfidant_app");
}
await migrate(drizzle(sql), { migrationsFolder: process.env.MIGRATIONS_DIR ?? "./drizzle" });
await sql.end();
console.log("migrations applied");
