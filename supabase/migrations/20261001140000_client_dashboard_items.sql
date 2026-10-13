-- Dashboard principal por clientes (Cambio 3): configuración de las
-- acciones/checklist que aparecen en cada tarjeta de cliente. Cada fila
-- define QUÉ chequear y DÓNDE enlaza; el estado (hecho/en proceso/
-- pendiente) se deriva en la app a partir de datos reales de cada módulo
-- (nómina, facturación, presupuesto, licencias) en
-- src/services/client-dashboard.ts. manual_status solo se usa cuando
-- action_type = 'manual', es decir cuando no existe una fuente de datos
-- automática (p. ej. futuras cuentas por cobrar/pagar).
create table if not exists public.client_dashboard_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  key text not null,
  label text not null,
  action_type text not null check (action_type in (
    'tresbe_payroll',
    'weekly_payroll',
    'invoice_weekly',
    'tresbe_budget',
    'leave_accrual',
    'manual'
  )),
  frequency text not null default 'weekly' check (frequency in ('weekly', 'monthly', 'ongoing')),
  href text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  manual_status text check (manual_status in ('done', 'in_progress', 'pending')),
  manual_status_label text,
  manual_status_updated_by uuid references public.profiles(id),
  manual_status_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, key)
);

create index if not exists client_dashboard_items_company_id_idx
  on public.client_dashboard_items (company_id);

drop trigger if exists client_dashboard_items_updated_at on public.client_dashboard_items;
create trigger client_dashboard_items_updated_at before update on public.client_dashboard_items
for each row execute function public.set_updated_at();

alter table public.client_dashboard_items enable row level security;

drop policy if exists "Admins manage client dashboard items" on public.client_dashboard_items;
create policy "Admins manage client dashboard items" on public.client_dashboard_items for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Seed inicial para los 6 clientes activos, usando únicamente módulos que
-- ya tienen datos reales en Sinexia OS hoy (confirmado contra la base):
--   - Nómina: tresbe_payrolls solo tiene filas de Tresbe; weekly_payrolls
--     solo tiene filas de Sibarita. El resto de clientes no gestiona
--     nómina en esta app todavía.
--   - Facturación semanal: los 6 clientes tienen un perfil de facturación
--     recurrente semanal habilitado (recurring_invoice_profiles).
--   - Presupuesto: solo Tresbe tiene tablas tresbe_budget_*.
--   - Vacaciones/enfermedad: employee_leave_balances hoy solo tiene filas
--     de Tresbe.
-- No se agregan ítems de cobranzas (AR) ni pagos (AP) porque no existe
-- ninguna tabla que los respalde todavía; se pueden sumar más adelante
-- como filas action_type='manual' sin tocar código.
insert into public.client_dashboard_items (company_id, key, label, action_type, frequency, href, sort_order)
select c.id, x.key, x.label, x.action_type, x.frequency, replace(x.href_template, '{companyId}', c.id::text), x.sort_order
from public.companies c
join (
  values
    ('tresbe', 'payroll', 'Nómina semanal', 'tresbe_payroll', 'weekly', '/dashboard/admin/companies/{companyId}/payroll', 1),
    ('tresbe', 'invoice', 'Facturación semanal', 'invoice_weekly', 'weekly', '/dashboard/admin/companies/{companyId}/invoices', 2),
    ('tresbe', 'budget', 'Presupuesto', 'tresbe_budget', 'ongoing', '/dashboard/admin/companies/{companyId}/budget', 3),
    ('tresbe', 'leave-accrual', 'Vacaciones y enfermedad', 'leave_accrual', 'weekly', '/dashboard/admin/leave-accrual', 4),
    ('sibarita', 'payroll', 'Nómina semanal', 'weekly_payroll', 'weekly', '/dashboard/payroll?company={companyId}', 1),
    ('sibarita', 'invoice', 'Facturación semanal', 'invoice_weekly', 'weekly', '/dashboard/admin/companies/{companyId}/invoices', 2),
    ('cut', 'invoice', 'Facturación semanal', 'invoice_weekly', 'weekly', '/dashboard/admin/companies/{companyId}/invoices', 1),
    ('cut-meat-distributors', 'invoice', 'Facturación semanal', 'invoice_weekly', 'weekly', '/dashboard/admin/companies/{companyId}/invoices', 1),
    ('magol', 'invoice', 'Facturación semanal', 'invoice_weekly', 'weekly', '/dashboard/admin/companies/{companyId}/invoices', 1),
    ('baldonny-management', 'invoice', 'Facturación semanal', 'invoice_weekly', 'weekly', '/dashboard/admin/companies/{companyId}/invoices', 1)
) as x(slug, key, label, action_type, frequency, href_template, sort_order)
  on x.slug = c.slug
on conflict (company_id, key) do nothing;
