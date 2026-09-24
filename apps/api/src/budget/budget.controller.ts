import { profileInput, spendInput, spendParams } from "@coinfidant/contracts";
import { localDate } from "@coinfidant/engine";
import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { UserId } from "../auth/auth.guard";
import { ZodPipe } from "../common/zod.pipe";
import { ScopedDb } from "../db/db.module";
import { bills, profiles, spends } from "../db/schema";
import { loadProfile, loadToday } from "./load";

@Controller()
export class BudgetController {
  constructor(@Inject(ScopedDb) private readonly scoped: ScopedDb) {}

  @Get("profile")
  async getProfile(@UserId() userId: string) {
    const profile = await this.scoped.run(userId, (tx) => loadProfile(tx, userId));
    if (!profile) throw new NotFoundException({ error: "no_profile" });
    return { profile };
  }

  @Put("profile")
  async putProfile(@UserId() userId: string, @Body(new ZodPipe(profileInput)) body: z.output<typeof profileInput>) {
    const { bills: billList, ...fields } = body;
    const profile = await this.scoped.run(userId, async (tx) => {
      await tx
        .insert(profiles)
        .values({ userId, ...fields })
        .onConflictDoUpdate({ target: profiles.userId, set: { ...fields, updatedAt: new Date() } });
      await tx.delete(bills).where(eq(bills.userId, userId));
      if (billList.length) await tx.insert(bills).values(billList.map((b) => ({ ...b, userId })));
      return loadProfile(tx, userId);
    });
    return { profile };
  }

  @Get("today")
  async today(@UserId() userId: string) {
    const data = await this.scoped.run(userId, (tx) => loadToday(tx, userId));
    if (!data) throw new NotFoundException({ error: "no_profile" });
    return data;
  }

  @Post("spends")
  @HttpCode(201)
  async logSpend(@UserId() userId: string, @Body(new ZodPipe(spendInput)) body: z.output<typeof spendInput>) {
    return this.scoped.run(userId, async (tx) => {
      const profile = await loadProfile(tx, userId);
      if (!profile) throw new ConflictException({ error: "no_profile" });
      const now = new Date();
      const [spend] = await tx
        .insert(spends)
        .values({ ...body, userId, occurredAt: now, localDate: localDate(now, profile.timezone) })
        .returning();
      return { spend, today: await loadToday(tx, userId, now) };
    });
  }

  @Delete("spends/:id")
  async deleteSpend(@UserId() userId: string, @Param(new ZodPipe(spendParams)) { id }: z.output<typeof spendParams>) {
    return this.scoped.run(userId, async (tx) => {
      const deleted = await tx
        .delete(spends)
        .where(and(eq(spends.id, id), eq(spends.userId, userId)))
        .returning({ id: spends.id });
      if (!deleted.length) throw new NotFoundException({ error: "not_found" });
      return { today: await loadToday(tx, userId) };
    });
  }
}
