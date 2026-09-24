import { computeOpenCycle, cycleStartFor, localDate } from "@coinfidant/engine";
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
  // TODO(M3): start from the salary-received record instead of the expected payday.
  const start = cycleStartFor(today, profile.payday);
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
    .where(and(eq(spends.userId, userId), between(spends.localDate, start, today)))
    .orderBy(asc(spends.occurredAt));

  const snapshot = computeOpenCycle({
    today,
    settings: {
      savingsPercent: profile.savingsPercent,
      minSavingsPercent: 5,
      floorPercent: 70,
      weekStart: 0,
      expectedPayday: profile.payday,
      everydayEstimate: null,
    },
    cycle: { start, salary: profile.salary },
    bills: profile.bills,
    sinkingFunds: [],
    debts: [],
    commitments: [],
    transactions: rows.map((r) => ({ id: r.id, amount: r.amount, date: r.localDate, type: "spend" as const })),
    sweepChoices: {},
    debtPayments: [],
  });
  return { profile, snapshot, spends: rows };
}
