import { Global, Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { CONFIG, type Config } from "../config";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export const DB = Symbol("DB");
const PG = Symbol("PG");

/** The only way to touch user-owned tables: row-level security sees `userId` for the whole transaction. */
@Injectable()
export class ScopedDb {
  constructor(@Inject(DB) private readonly db: Db) {}

  run<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
      return fn(tx);
    });
  }
}

@Injectable()
class PgShutdown implements OnModuleDestroy {
  constructor(@Inject(PG) private readonly pg: postgres.Sql) {}
  onModuleDestroy() {
    return this.pg.end({ timeout: 5 });
  }
}

@Global()
@Module({
  providers: [
    { provide: PG, inject: [CONFIG], useFactory: (c: Config) => postgres(c.DATABASE_URL, { onnotice: () => {} }) },
    { provide: DB, inject: [PG], useFactory: (pg: postgres.Sql) => drizzle(pg, { schema }) },
    ScopedDb,
    PgShutdown,
  ],
  exports: [DB, ScopedDb],
})
export class DbModule {}
