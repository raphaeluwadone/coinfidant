import { computeSnapshot, cycleFor, localDate } from "@coinfidant/engine";
import { and, asc, between, eq } from "drizzle-orm";
import { db } from "../db/client";
import { bills, profiles, spends } from "../db/schema";

export async function loadProfile(userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (!profile) return null;
  const billRows = await db
    .select({ id: bills.id, name: bills.name, amount: bills.amount })
    .from(bills)
    .where(eq(bills.userId, userId))
    .orderBy(asc(bills.name));
  return { ...profile, bills: billRows };
}

export async function loadToday(userId: string, now = new Date()) {
  const profile = await loadProfile(userId);
  if (!profile) return null;

  const today = localDate(now, profile.timezone);
  const cycle = cycleFor(today, profile.payday);
  const rows = await db
    .select({
      id: spends.id,
      amount: spends.amount,
      category: spends.category,
      note: spends.note,
      occurredAt: spends.occurredAt,
      localDate: spends.localDate,
    })
    .from(spends)
    .where(and(eq(spends.userId, userId), between(spends.localDate, cycle.start, cycle.end)))
    .orderBy(asc(spends.occurredAt));

  const snapshot = computeSnapshot(
    { salary: profile.salary, bills: profile.bills, savingsPercent: profile.savingsPercent, payday: profile.payday },
    rows.map((r) => ({ amount: r.amount, date: r.localDate })),
    today,
  );
  return { profile, snapshot, spends: rows };
}
