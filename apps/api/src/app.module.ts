import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { BudgetController } from "./budget/budget.controller";
import { BudgetScope } from "./budget/budget.scope";
import { CategoriesController } from "./budget/categories.controller";
import { ItemsController } from "./budget/items.controller";
import { OnboardingController } from "./budget/onboarding.controller";
import { TransactionsController } from "./budget/transactions.controller";
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
  controllers: [BudgetController, ItemsController, CategoriesController, TransactionsController, OnboardingController],
  providers: [BudgetScope, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
