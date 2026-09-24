-- Moves each profile-era user onto a budget. Runs as the owner, so RLS doesn't apply.
CREATE TEMP TABLE budget_map ON COMMIT DROP AS
SELECT gen_random_uuid() AS budget_id, p.* FROM profiles p;
--> statement-breakpoint
UPDATE users u SET timezone = m.timezone, personality = m.personality FROM budget_map m WHERE u.id = m.user_id;
--> statement-breakpoint
INSERT INTO budgets (id, owner_id, currency, savings_percent, expected_payday)
SELECT budget_id, user_id, currency, savings_percent, payday FROM budget_map;
--> statement-breakpoint
INSERT INTO budget_members (budget_id, user_id, role) SELECT budget_id, user_id, 'owner' FROM budget_map;
--> statement-breakpoint
INSERT INTO incomes (budget_id, name, amount, kind) SELECT budget_id, 'Salary', salary, 'salary' FROM budget_map;
--> statement-breakpoint
INSERT INTO categories (budget_id, name, emoji, slug, position)
SELECT m.budget_id, c.name, c.emoji, c.slug, c.position
FROM budget_map m
CROSS JOIN (VALUES
  ('Food', '🍜', 'food', 0), ('Groceries', '🛒', 'groceries', 1), ('Transport', '🚌', 'transport', 2),
  ('Shopping', '🛍️', 'shopping', 3), ('Fun', '🎉', 'fun', 4), ('Health', '❤️', 'health', 5),
  ('Home', '🏠', 'home', 6), ('Other', '✨', 'other', 7)
) AS c(name, emoji, slug, position);
--> statement-breakpoint
UPDATE bills b SET budget_id = m.budget_id FROM budget_map m WHERE b.user_id = m.user_id;
--> statement-breakpoint
-- The open cycle starts on the last expected payday on or before today, clamped to month end.
INSERT INTO cycles (budget_id, start_date, salary, status)
SELECT m.budget_id,
  CASE WHEN current_date >= this_pd THEN this_pd ELSE prev_pd END,
  m.salary, 'open'
FROM budget_map m
CROSS JOIN LATERAL (
  SELECT
    make_date(extract(year FROM current_date)::int, extract(month FROM current_date)::int,
      least(m.payday, extract(day FROM (date_trunc('month', current_date) + interval '1 month - 1 day'))::int)) AS this_pd,
    make_date(extract(year FROM current_date - interval '1 month')::int, extract(month FROM current_date - interval '1 month')::int,
      least(m.payday, extract(day FROM (date_trunc('month', current_date) - interval '1 day'))::int)) AS prev_pd
) pd;
--> statement-breakpoint
INSERT INTO transactions (id, budget_id, created_by, amount, type, category_id, note, occurred_at, local_date)
SELECT s.id, m.budget_id, s.user_id, s.amount, 'spend', c.id, s.note, s.occurred_at, s.local_date
FROM spends s
JOIN budget_map m ON m.user_id = s.user_id
JOIN categories c ON c.budget_id = m.budget_id AND c.slug = coalesce(nullif(s.category, ''), 'other');
