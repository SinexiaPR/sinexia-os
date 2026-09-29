-- TRESBE budget: table to record a day+category explicitly closed / with
-- no operations (e.g. "no abrimos ese sabado"), as opposed to a day where
-- data simply hasn't been loaded yet.
--
-- tresbe_budget_movements.amount has a CHECK (amount > 0) -- by design,
-- the same constraint the saveBudgetMovement server action enforces via
-- Zod ("El importe debe ser mayor a 0."). A $0.00 movement row is not a
-- valid way to record "cerrado, sin operaciones" -- this table is.
create table if not exists tresbe_budget_closed_days (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete restrict,
  entry_date date not null,
  category_id uuid not null references tresbe_budget_categories(id) on delete restrict,
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id) on delete restrict,
  unique (company_id, entry_date, category_id)
);

alter table tresbe_budget_closed_days enable row level security;

create policy "Admins manage tresbe_budget_closed_days"
  on tresbe_budget_closed_days
  for all
  to authenticated
  using (is_admin() and is_tresbe_company(company_id))
  with check (is_admin() and is_tresbe_company(company_id));
