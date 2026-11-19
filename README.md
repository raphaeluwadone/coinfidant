# Coinfidant

A budgeting app built around the pay cycle, not the calendar month.

When your salary lands, Coinfidant splits it across bills, savings goals, debt repayments and the people you
support, then turns what's left into a weekly spending budget and a daily allowance. Overspend one week and it's
spread across the weeks ahead; underspend and the leftover is swept to savings or your next debt.

It's built for people paying down debt, so the app moves through three phases:

| Phase | When | Focus |
| --- | --- | --- |
| **Stabilise** | The plan doesn't fit the salary, or there's almost nothing left to live on | Get every minimum covered |
| **Attack** | Minimums are covered with room to spare | Clear debts, highest interest first, rolling each cleared repayment into the next (snowball) |
| **Build** | No debts left | Grow savings and sinking funds |

## Features

- **Payday:** mark your salary received, review the plan for the cycle, and accept suggested top-ups.
- **Today:** what you can spend today and this week, with quick spend and refund logging.
- **Discovery cycle:** no idea what you spend day to day? Track one cycle and Coinfidant learns it.
- **Sinking funds:** save toward dated goals (rent, school fees, a trip) a fixed slice per cycle.
- **Coach:** an end-of-cycle review written by Claude from your actual numbers.
- **Check-ins:** an evening push notification to log the day's spending.
- **History and growth:** past cycles, debt progress and when the next phase unlocks.
- Installable as a PWA on phone or desktop.

## How it's built

```text
apps/web            React PWA (Vite, TanStack Router and Query, Tailwind, shadcn/ui)
apps/api            NestJS API (Postgres via Drizzle, Google sign-in, JWT, web push, Claude coach)
packages/engine     The budget engine: pure TypeScript, no I/O, no clock
packages/contracts  Types and Zod schemas shared by the web app and API
```

The engine is the core. It takes a cycle's settings, bills, debts and transactions and returns every number the app
shows, recomputing from scratch each time so back-dated entries just work. Each rule (R1, R2, ...) is written down in
[docs/engine-spec.md](docs/engine-spec.md) and referenced by the tests that cover it.

The API connects to Postgres as a restricted role that can't change the schema; migrations run as the owner at
deploy time.

## Run it locally

Needs Node 24 and Docker, plus a Google OAuth client for sign-in.

```bash
npm install
cp apps/api/.env.example apps/api/.env   # set APP_DB_PASSWORD, JWT_SECRET and the GOOGLE_* values
npm run db:up                            # Postgres 17 on 127.0.0.1:5433
APP_DB_PASSWORD=<same as .env> npm run db:role -w @coinfidant/api   # creates the restricted app role
npm run db:migrate -w @coinfidant/api
npm run dev                              # web on http://localhost:5173, API on 8787
```

The coach (`ANTHROPIC_API_KEY`) and push check-ins (`VAPID_*`) are optional; leave them blank to run without them.

```bash
npm run check   # format, lint, typecheck and all tests
```

## Deploy

One Fly.io app serves the API and the built PWA from the same origin, with Fly Managed Postgres alongside. See
[docs/deploy.md](docs/deploy.md).
