import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { BudgetController } from "./budget/budget.controller";
import { CONFIG, loadConfig } from "./config";
import { DbModule } from "./db/db.module";

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: () => loadConfig() }],
  exports: [CONFIG],
})
class ConfigModule {}

@Module({
  imports: [ConfigModule, DbModule, ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]), AuthModule],
  controllers: [BudgetController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
