-- Seed inicial de configuración de "Informes diarios" para Cut Meat
-- Distributors (Wagyu Food Service LLC): proveedores incluidos/excluidos
-- del aging y el saldo de Prime Meats. Editable después desde la
-- pantalla, no hace falta tocar código para cambiarlo.
insert into public.cutmeat_daily_vendor_config (company_id, vendor_name, inclusion)
select c.id, v.vendor_name, v.inclusion
from public.companies c
join (
  values
    ('Mays Chemical Comp. PR Inc.', 'included'),
    ('Northwestern Selecta', 'included'),
    ('Puente Selections', 'included'),
    ('Quirch Foods Co.', 'included'),
    ('Service Zone Inc.', 'included'),
    ('Prime Meats & Seafoods', 'excluded'),
    ('Jose Santiago Inc', 'excluded')
) as v(vendor_name, inclusion) on true
where c.slug = 'cut-meat-distributors'
on conflict (company_id, vendor_name) do nothing;

insert into public.cutmeat_daily_settings (company_id, prime_meats_balance, prime_meats_recurring)
select id, 0, 0 from public.companies where slug = 'cut-meat-distributors'
on conflict (company_id) do nothing;
