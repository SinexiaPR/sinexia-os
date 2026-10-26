-- Opción B (aprobada 10/26): foto congelada de cutmeat_recurrentes al
-- cerrar un día de "Informes diarios" (Cut Meat Distributors / Wagyu
-- Food Service LLC). Un día cerrado lee de esta foto, nunca
-- recalculando en vivo -- así, corregir un recurrente hoy no cambia
-- retroactivamente los buckets de un día ya cerrado y enviado al dueño
-- (closeDailyReport la crea, reopenDailyReport la borra -- ver
-- src/actions/cutmeat-daily.ts).

create table public.cutmeat_daily_recurring_snapshot (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.cutmeat_daily_reports(id) on delete cascade,
  recurrente_id uuid references public.cutmeat_recurrentes(id),
  vendor text not null,
  due_date date,
  amount numeric not null,
  is_paid boolean not null,
  paid_date date,
  entry_date date,
  item_type text,
  reference_number text,
  display_order integer,
  cutoff_date date not null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

comment on table public.cutmeat_daily_recurring_snapshot is
  'Foto congelada del estado de cutmeat_recurrentes al momento de cerrar un día -- un día cerrado lee de acá, no recalcula en vivo. Se borra al reabrir el día.';

create index cutmeat_daily_recurring_snapshot_report_id_idx
  on public.cutmeat_daily_recurring_snapshot(report_id);

alter table public.cutmeat_daily_recurring_snapshot enable row level security;

create policy "Admins manage recurring snapshot" on public.cutmeat_daily_recurring_snapshot
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Mismo patrón de bloqueo que las demás tablas *_items de un día cerrado
-- (ver 20261013130000_cutmeat_daily_data_contract.sql): solo se puede
-- escribir mientras el informe NO esté closed.
create trigger cutmeat_daily_recurring_snapshot_block_closed_write
  before insert or update or delete on public.cutmeat_daily_recurring_snapshot
  for each row execute function public.cutmeat_daily_block_closed_write();
