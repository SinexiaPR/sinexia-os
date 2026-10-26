-- Backfill de cutmeat_daily_recurring_snapshot para los 7 días ya
-- cerrados de octubre 2026 (10/15, 16, 19, 20, 21, 22, 23) de Cut Meat
-- Distributors -- ver 20261026150000_cutmeat_daily_recurring_snapshot.sql.
--
-- Cada fila usa la regla de fecha de corte ya aprobada (paid_date <=
-- cutoff_date, donde cutoff_date es el reconciled_on real guardado en
-- cutmeat_daily_reconciliation o, si no existe, el día hábil siguiente
-- al report_date), EXCEPTO el 10/16 (report_id
-- 4650c5c6-48b3-4f9c-95e4-b825862fa7a6): ahí Depósito - Jose Manzanares,
-- NOMINA 10/08 y NOMINA 10/15 quedan is_paid=false a mano, para no
-- mover el balance 29,412.44 ya congelado y ya enviado al dueño (los
-- tres se saldaron recién el 10/19, después de que el 10/16 se cerró).
--
-- Validado antes de aplicar (ver sesión 10/26): balanceAfterWeeklyPayments
-- recalculado con exactamente este estado de recurrentes reproduce, al
-- centavo, balance_after_weekly ya congelado en cutmeat_daily_reports
-- para los 7 días:
--   10/15 29,412.44 | 10/16 29,412.44 | 10/19 25,380.64 | 10/20 26,130.64
--   10/21 26,130.64 | 10/22 25,630.64 | 10/23 25,630.64
--
-- El insert va con el trigger de bloqueo desactivado porque estos 7
-- informes ya están closed (insertar es precisamente la foto de un día
-- cerrado) -- se reactiva al final. El delete previo hace el backfill
-- idempotente si se vuelve a aplicar.

alter table public.cutmeat_daily_recurring_snapshot
  disable trigger cutmeat_daily_recurring_snapshot_block_closed_write;

delete from public.cutmeat_daily_recurring_snapshot
where report_id in (
  '0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', -- 2026-10-15
  '4650c5c6-48b3-4f9c-95e4-b825862fa7a6', -- 2026-10-16
  '8f58ce26-9158-48a6-a371-0d570cc4881d', -- 2026-10-19
  '0012f852-ab0f-47bb-b327-387e67151679', -- 2026-10-20
  'a90984ab-bd89-4dda-854c-67872fcf8ce1', -- 2026-10-21
  '0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', -- 2026-10-22
  '5a74b123-d615-48bf-b690-bf1550fd0a58'  -- 2026-10-23
);

insert into public.cutmeat_daily_recurring_snapshot
  (report_id, recurrente_id, vendor, due_date, amount, is_paid, paid_date, entry_date, item_type, reference_number, display_order, cutoff_date)
values
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', 'b3629bc1-f384-46ac-8882-ce68d5846018', 'Caparra Country - Gabriel Manzanares', '2026-09-03', 692.00, false, NULL, '2026-09-03', 'Bill', NULL, 1, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', 'e34ee87b-6986-41eb-9ca9-9d3393459027', 'Juan Diaz', '2026-10-01', 150.00, false, NULL, '2026-10-01', 'Bill', NULL, 2, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '89de88cf-2ae2-4296-9d28-57f7f426180f', 'Deposito - Jose Manzanares', '2026-10-01', 1200.00, false, '2026-10-19', '2026-10-01', 'ACH', '3004592793 Plaza las Cumbres', 3, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '39c7e442-6e74-4670-a70f-709698fc153b', 'Caparra Country - Gabriel Manzanares', '2026-10-01', 692.00, false, NULL, '2026-10-01', 'Bill', NULL, 4, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '7f7ca800-7666-40db-9449-f264e8399cc9', 'CCC Logistic - Storage', '2026-10-02', 95.00, false, NULL, '2026-10-02', 'Bill', NULL, 5, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '6abfbaa8-d620-45a4-ae15-dca844ca9657', 'NOMINA', '2026-10-08', 400.00, false, '2026-10-19', '2026-10-08', 'Bill', NULL, 6, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '52502348-fa64-440b-b103-3b396ece7535', 'Internal Revenue Service', '2026-10-09', 600.00, true, '2026-10-14', '2026-09-30', 'Bill', 'SS Med Jul-26', 7, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '02ce92a0-3a11-427c-ae1b-895814cbfd87', 'Departamento de Hacienda', '2026-10-09', 180.00, true, '2026-10-15', '2026-09-30', 'Bill', 'Ret Jul-2026', 8, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', 'd9b58382-6ed1-472f-a7c4-7f0f5f22fd20', 'Carlos Mercado Seguros', NULL, 0.00, false, NULL, NULL, NULL, NULL, 9, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '9c25bedc-8c6c-42b6-bae0-b2e49f01f9d1', 'NOMINA', '2026-10-15', 400.00, false, '2026-10-19', '2026-10-15', 'Bill', NULL, 10, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '5cd1ad03-5a4f-4b7a-99b8-be03b525835d', 'SINERGIA LLC', '2026-10-16', 180.00, true, '2026-10-15', '2026-10-16', 'Bill', NULL, 11, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', 'eefe7234-b24d-4a83-9ba9-a909fa511175', 'Gabriel Manzanares - Auto', '2026-10-21', 1700.00, false, NULL, '2026-10-21', 'Bill', NULL, 12, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', 'f2fc3275-7bc3-4a47-ac79-8b50977289b5', 'NOMINA', '2026-10-22', 400.00, false, NULL, '2026-10-22', 'Bill', NULL, 13, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '7f2e6be7-2413-444e-aaff-bf01b0e16b18', 'SINERGIA LLC', '2026-10-23', 180.00, false, '2026-10-23', '2026-10-23', 'Bill', NULL, 14, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '744b366f-8359-4dcc-a61d-2b7fb3fcad6a', 'NOMINA', '2026-10-29', 400.00, false, NULL, '2026-10-29', 'Bill', NULL, 15, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '28a82ba4-d8b5-457b-b9d4-b22dffa8b020', 'SINERGIA LLC', '2026-10-30', 180.00, false, NULL, '2026-10-30', 'Bill', NULL, 16, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '4aa83bf3-4406-4388-b603-b4dfacdba058', 'PenFed - Jose Manzanares', '2026-10-01', 800.00, true, '2026-10-05', '2026-10-01', 'ACH', '724492-5025 PenFed', NULL, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', '757cc6b9-60eb-4dae-ad47-b2c155d5d6ab', 'Deposito Oriental Bank - Seg de vida - J Manzanares', '2026-10-01', 350.00, true, '2026-10-09', '2026-10-01', 'ACH', '1755670185 Scotiabank', NULL, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', 'a1a67ae8-750c-4fb9-8960-24aac6af9e26', 'SINERGIA LLC', '2026-10-09', 180.00, true, NULL, '2026-10-09', 'Bill', NULL, NULL, '2026-10-16'),
  ('0f40f3d3-7ee3-46a1-b9f8-48dd88d11627', 'be837a74-3a73-4a5b-aa3e-aa953818fdb6', 'Liberty Movil', NULL, 284.39, true, '2026-10-08', NULL, NULL, NULL, NULL, '2026-10-16'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', 'b3629bc1-f384-46ac-8882-ce68d5846018', 'Caparra Country - Gabriel Manzanares', '2026-09-03', 692.00, false, NULL, '2026-09-03', 'Bill', NULL, 1, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', 'e34ee87b-6986-41eb-9ca9-9d3393459027', 'Juan Diaz', '2026-10-01', 150.00, false, NULL, '2026-10-01', 'Bill', NULL, 2, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '89de88cf-2ae2-4296-9d28-57f7f426180f', 'Deposito - Jose Manzanares', '2026-10-01', 1200.00, false, '2026-10-19', '2026-10-01', 'ACH', '3004592793 Plaza las Cumbres', 3, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '39c7e442-6e74-4670-a70f-709698fc153b', 'Caparra Country - Gabriel Manzanares', '2026-10-01', 692.00, false, NULL, '2026-10-01', 'Bill', NULL, 4, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '7f7ca800-7666-40db-9449-f264e8399cc9', 'CCC Logistic - Storage', '2026-10-02', 95.00, false, NULL, '2026-10-02', 'Bill', NULL, 5, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '6abfbaa8-d620-45a4-ae15-dca844ca9657', 'NOMINA', '2026-10-08', 400.00, false, '2026-10-19', '2026-10-08', 'Bill', NULL, 6, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '52502348-fa64-440b-b103-3b396ece7535', 'Internal Revenue Service', '2026-10-09', 600.00, true, '2026-10-14', '2026-09-30', 'Bill', 'SS Med Jul-26', 7, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '02ce92a0-3a11-427c-ae1b-895814cbfd87', 'Departamento de Hacienda', '2026-10-09', 180.00, true, '2026-10-15', '2026-09-30', 'Bill', 'Ret Jul-2026', 8, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', 'd9b58382-6ed1-472f-a7c4-7f0f5f22fd20', 'Carlos Mercado Seguros', NULL, 0.00, false, NULL, NULL, NULL, NULL, 9, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '9c25bedc-8c6c-42b6-bae0-b2e49f01f9d1', 'NOMINA', '2026-10-15', 400.00, false, '2026-10-19', '2026-10-15', 'Bill', NULL, 10, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '5cd1ad03-5a4f-4b7a-99b8-be03b525835d', 'SINERGIA LLC', '2026-10-16', 180.00, true, '2026-10-15', '2026-10-16', 'Bill', NULL, 11, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', 'eefe7234-b24d-4a83-9ba9-a909fa511175', 'Gabriel Manzanares - Auto', '2026-10-21', 1700.00, false, NULL, '2026-10-21', 'Bill', NULL, 12, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', 'f2fc3275-7bc3-4a47-ac79-8b50977289b5', 'NOMINA', '2026-10-22', 400.00, false, NULL, '2026-10-22', 'Bill', NULL, 13, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '7f2e6be7-2413-444e-aaff-bf01b0e16b18', 'SINERGIA LLC', '2026-10-23', 180.00, false, '2026-10-23', '2026-10-23', 'Bill', NULL, 14, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '744b366f-8359-4dcc-a61d-2b7fb3fcad6a', 'NOMINA', '2026-10-29', 400.00, false, NULL, '2026-10-29', 'Bill', NULL, 15, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '28a82ba4-d8b5-457b-b9d4-b22dffa8b020', 'SINERGIA LLC', '2026-10-30', 180.00, false, NULL, '2026-10-30', 'Bill', NULL, 16, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '4aa83bf3-4406-4388-b603-b4dfacdba058', 'PenFed - Jose Manzanares', '2026-10-01', 800.00, true, '2026-10-05', '2026-10-01', 'ACH', '724492-5025 PenFed', NULL, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', '757cc6b9-60eb-4dae-ad47-b2c155d5d6ab', 'Deposito Oriental Bank - Seg de vida - J Manzanares', '2026-10-01', 350.00, true, '2026-10-09', '2026-10-01', 'ACH', '1755670185 Scotiabank', NULL, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', 'a1a67ae8-750c-4fb9-8960-24aac6af9e26', 'SINERGIA LLC', '2026-10-09', 180.00, true, NULL, '2026-10-09', 'Bill', NULL, NULL, '2026-10-19'),
  ('4650c5c6-48b3-4f9c-95e4-b825862fa7a6', 'be837a74-3a73-4a5b-aa3e-aa953818fdb6', 'Liberty Movil', NULL, 284.39, true, '2026-10-08', NULL, NULL, NULL, NULL, '2026-10-19'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', 'b3629bc1-f384-46ac-8882-ce68d5846018', 'Caparra Country - Gabriel Manzanares', '2026-09-03', 692.00, false, NULL, '2026-09-03', 'Bill', NULL, 1, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', 'e34ee87b-6986-41eb-9ca9-9d3393459027', 'Juan Diaz', '2026-10-01', 150.00, false, NULL, '2026-10-01', 'Bill', NULL, 2, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '89de88cf-2ae2-4296-9d28-57f7f426180f', 'Deposito - Jose Manzanares', '2026-10-01', 1200.00, true, '2026-10-19', '2026-10-01', 'ACH', '3004592793 Plaza las Cumbres', 3, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '39c7e442-6e74-4670-a70f-709698fc153b', 'Caparra Country - Gabriel Manzanares', '2026-10-01', 692.00, false, NULL, '2026-10-01', 'Bill', NULL, 4, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '7f7ca800-7666-40db-9449-f264e8399cc9', 'CCC Logistic - Storage', '2026-10-02', 95.00, false, NULL, '2026-10-02', 'Bill', NULL, 5, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '6abfbaa8-d620-45a4-ae15-dca844ca9657', 'NOMINA', '2026-10-08', 400.00, true, '2026-10-19', '2026-10-08', 'Bill', NULL, 6, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '52502348-fa64-440b-b103-3b396ece7535', 'Internal Revenue Service', '2026-10-09', 600.00, true, '2026-10-14', '2026-09-30', 'Bill', 'SS Med Jul-26', 7, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '02ce92a0-3a11-427c-ae1b-895814cbfd87', 'Departamento de Hacienda', '2026-10-09', 180.00, true, '2026-10-15', '2026-09-30', 'Bill', 'Ret Jul-2026', 8, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', 'd9b58382-6ed1-472f-a7c4-7f0f5f22fd20', 'Carlos Mercado Seguros', NULL, 0.00, false, NULL, NULL, NULL, NULL, 9, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '9c25bedc-8c6c-42b6-bae0-b2e49f01f9d1', 'NOMINA', '2026-10-15', 400.00, true, '2026-10-19', '2026-10-15', 'Bill', NULL, 10, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '5cd1ad03-5a4f-4b7a-99b8-be03b525835d', 'SINERGIA LLC', '2026-10-16', 180.00, true, '2026-10-15', '2026-10-16', 'Bill', NULL, 11, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', 'eefe7234-b24d-4a83-9ba9-a909fa511175', 'Gabriel Manzanares - Auto', '2026-10-21', 1700.00, false, NULL, '2026-10-21', 'Bill', NULL, 12, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', 'f2fc3275-7bc3-4a47-ac79-8b50977289b5', 'NOMINA', '2026-10-22', 400.00, false, NULL, '2026-10-22', 'Bill', NULL, 13, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '7f2e6be7-2413-444e-aaff-bf01b0e16b18', 'SINERGIA LLC', '2026-10-23', 180.00, false, '2026-10-23', '2026-10-23', 'Bill', NULL, 14, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '744b366f-8359-4dcc-a61d-2b7fb3fcad6a', 'NOMINA', '2026-10-29', 400.00, false, NULL, '2026-10-29', 'Bill', NULL, 15, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '28a82ba4-d8b5-457b-b9d4-b22dffa8b020', 'SINERGIA LLC', '2026-10-30', 180.00, false, NULL, '2026-10-30', 'Bill', NULL, 16, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '4aa83bf3-4406-4388-b603-b4dfacdba058', 'PenFed - Jose Manzanares', '2026-10-01', 800.00, true, '2026-10-05', '2026-10-01', 'ACH', '724492-5025 PenFed', NULL, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', '757cc6b9-60eb-4dae-ad47-b2c155d5d6ab', 'Deposito Oriental Bank - Seg de vida - J Manzanares', '2026-10-01', 350.00, true, '2026-10-09', '2026-10-01', 'ACH', '1755670185 Scotiabank', NULL, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', 'a1a67ae8-750c-4fb9-8960-24aac6af9e26', 'SINERGIA LLC', '2026-10-09', 180.00, true, NULL, '2026-10-09', 'Bill', NULL, NULL, '2026-10-20'),
  ('8f58ce26-9158-48a6-a371-0d570cc4881d', 'be837a74-3a73-4a5b-aa3e-aa953818fdb6', 'Liberty Movil', NULL, 284.39, true, '2026-10-08', NULL, NULL, NULL, NULL, '2026-10-20'),
  ('0012f852-ab0f-47bb-b327-387e67151679', 'b3629bc1-f384-46ac-8882-ce68d5846018', 'Caparra Country - Gabriel Manzanares', '2026-09-03', 692.00, false, NULL, '2026-09-03', 'Bill', NULL, 1, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', 'e34ee87b-6986-41eb-9ca9-9d3393459027', 'Juan Diaz', '2026-10-01', 150.00, false, NULL, '2026-10-01', 'Bill', NULL, 2, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '89de88cf-2ae2-4296-9d28-57f7f426180f', 'Deposito - Jose Manzanares', '2026-10-01', 1200.00, true, '2026-10-19', '2026-10-01', 'ACH', '3004592793 Plaza las Cumbres', 3, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '39c7e442-6e74-4670-a70f-709698fc153b', 'Caparra Country - Gabriel Manzanares', '2026-10-01', 692.00, false, NULL, '2026-10-01', 'Bill', NULL, 4, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '7f7ca800-7666-40db-9449-f264e8399cc9', 'CCC Logistic - Storage', '2026-10-02', 95.00, false, NULL, '2026-10-02', 'Bill', NULL, 5, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '6abfbaa8-d620-45a4-ae15-dca844ca9657', 'NOMINA', '2026-10-08', 400.00, true, '2026-10-19', '2026-10-08', 'Bill', NULL, 6, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '52502348-fa64-440b-b103-3b396ece7535', 'Internal Revenue Service', '2026-10-09', 600.00, true, '2026-10-14', '2026-09-30', 'Bill', 'SS Med Jul-26', 7, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '02ce92a0-3a11-427c-ae1b-895814cbfd87', 'Departamento de Hacienda', '2026-10-09', 180.00, true, '2026-10-15', '2026-09-30', 'Bill', 'Ret Jul-2026', 8, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', 'd9b58382-6ed1-472f-a7c4-7f0f5f22fd20', 'Carlos Mercado Seguros', NULL, 0.00, false, NULL, NULL, NULL, NULL, 9, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '9c25bedc-8c6c-42b6-bae0-b2e49f01f9d1', 'NOMINA', '2026-10-15', 400.00, true, '2026-10-19', '2026-10-15', 'Bill', NULL, 10, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '5cd1ad03-5a4f-4b7a-99b8-be03b525835d', 'SINERGIA LLC', '2026-10-16', 180.00, true, '2026-10-15', '2026-10-16', 'Bill', NULL, 11, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', 'eefe7234-b24d-4a83-9ba9-a909fa511175', 'Gabriel Manzanares - Auto', '2026-10-21', 1700.00, false, NULL, '2026-10-21', 'Bill', NULL, 12, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', 'f2fc3275-7bc3-4a47-ac79-8b50977289b5', 'NOMINA', '2026-10-22', 400.00, false, NULL, '2026-10-22', 'Bill', NULL, 13, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '7f2e6be7-2413-444e-aaff-bf01b0e16b18', 'SINERGIA LLC', '2026-10-23', 180.00, false, '2026-10-23', '2026-10-23', 'Bill', NULL, 14, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '744b366f-8359-4dcc-a61d-2b7fb3fcad6a', 'NOMINA', '2026-10-29', 400.00, false, NULL, '2026-10-29', 'Bill', NULL, 15, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '28a82ba4-d8b5-457b-b9d4-b22dffa8b020', 'SINERGIA LLC', '2026-10-30', 180.00, false, NULL, '2026-10-30', 'Bill', NULL, 16, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '4aa83bf3-4406-4388-b603-b4dfacdba058', 'PenFed - Jose Manzanares', '2026-10-01', 800.00, true, '2026-10-05', '2026-10-01', 'ACH', '724492-5025 PenFed', NULL, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', '757cc6b9-60eb-4dae-ad47-b2c155d5d6ab', 'Deposito Oriental Bank - Seg de vida - J Manzanares', '2026-10-01', 350.00, true, '2026-10-09', '2026-10-01', 'ACH', '1755670185 Scotiabank', NULL, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', 'a1a67ae8-750c-4fb9-8960-24aac6af9e26', 'SINERGIA LLC', '2026-10-09', 180.00, true, NULL, '2026-10-09', 'Bill', NULL, NULL, '2026-10-21'),
  ('0012f852-ab0f-47bb-b327-387e67151679', 'be837a74-3a73-4a5b-aa3e-aa953818fdb6', 'Liberty Movil', NULL, 284.39, true, '2026-10-08', NULL, NULL, NULL, NULL, '2026-10-21'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', 'b3629bc1-f384-46ac-8882-ce68d5846018', 'Caparra Country - Gabriel Manzanares', '2026-09-03', 692.00, false, NULL, '2026-09-03', 'Bill', NULL, 1, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', 'e34ee87b-6986-41eb-9ca9-9d3393459027', 'Juan Diaz', '2026-10-01', 150.00, false, NULL, '2026-10-01', 'Bill', NULL, 2, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '89de88cf-2ae2-4296-9d28-57f7f426180f', 'Deposito - Jose Manzanares', '2026-10-01', 1200.00, true, '2026-10-19', '2026-10-01', 'ACH', '3004592793 Plaza las Cumbres', 3, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '39c7e442-6e74-4670-a70f-709698fc153b', 'Caparra Country - Gabriel Manzanares', '2026-10-01', 692.00, false, NULL, '2026-10-01', 'Bill', NULL, 4, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '7f7ca800-7666-40db-9449-f264e8399cc9', 'CCC Logistic - Storage', '2026-10-02', 95.00, false, NULL, '2026-10-02', 'Bill', NULL, 5, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '6abfbaa8-d620-45a4-ae15-dca844ca9657', 'NOMINA', '2026-10-08', 400.00, true, '2026-10-19', '2026-10-08', 'Bill', NULL, 6, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '52502348-fa64-440b-b103-3b396ece7535', 'Internal Revenue Service', '2026-10-09', 600.00, true, '2026-10-14', '2026-09-30', 'Bill', 'SS Med Jul-26', 7, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '02ce92a0-3a11-427c-ae1b-895814cbfd87', 'Departamento de Hacienda', '2026-10-09', 180.00, true, '2026-10-15', '2026-09-30', 'Bill', 'Ret Jul-2026', 8, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', 'd9b58382-6ed1-472f-a7c4-7f0f5f22fd20', 'Carlos Mercado Seguros', NULL, 0.00, false, NULL, NULL, NULL, NULL, 9, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '9c25bedc-8c6c-42b6-bae0-b2e49f01f9d1', 'NOMINA', '2026-10-15', 400.00, true, '2026-10-19', '2026-10-15', 'Bill', NULL, 10, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '5cd1ad03-5a4f-4b7a-99b8-be03b525835d', 'SINERGIA LLC', '2026-10-16', 180.00, true, '2026-10-15', '2026-10-16', 'Bill', NULL, 11, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', 'eefe7234-b24d-4a83-9ba9-a909fa511175', 'Gabriel Manzanares - Auto', '2026-10-21', 1700.00, false, NULL, '2026-10-21', 'Bill', NULL, 12, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', 'f2fc3275-7bc3-4a47-ac79-8b50977289b5', 'NOMINA', '2026-10-22', 400.00, false, NULL, '2026-10-22', 'Bill', NULL, 13, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '7f2e6be7-2413-444e-aaff-bf01b0e16b18', 'SINERGIA LLC', '2026-10-23', 180.00, false, '2026-10-23', '2026-10-23', 'Bill', NULL, 14, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '744b366f-8359-4dcc-a61d-2b7fb3fcad6a', 'NOMINA', '2026-10-29', 400.00, false, NULL, '2026-10-29', 'Bill', NULL, 15, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '28a82ba4-d8b5-457b-b9d4-b22dffa8b020', 'SINERGIA LLC', '2026-10-30', 180.00, false, NULL, '2026-10-30', 'Bill', NULL, 16, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '4aa83bf3-4406-4388-b603-b4dfacdba058', 'PenFed - Jose Manzanares', '2026-10-01', 800.00, true, '2026-10-05', '2026-10-01', 'ACH', '724492-5025 PenFed', NULL, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', '757cc6b9-60eb-4dae-ad47-b2c155d5d6ab', 'Deposito Oriental Bank - Seg de vida - J Manzanares', '2026-10-01', 350.00, true, '2026-10-09', '2026-10-01', 'ACH', '1755670185 Scotiabank', NULL, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', 'a1a67ae8-750c-4fb9-8960-24aac6af9e26', 'SINERGIA LLC', '2026-10-09', 180.00, true, NULL, '2026-10-09', 'Bill', NULL, NULL, '2026-10-22'),
  ('a90984ab-bd89-4dda-854c-67872fcf8ce1', 'be837a74-3a73-4a5b-aa3e-aa953818fdb6', 'Liberty Movil', NULL, 284.39, true, '2026-10-08', NULL, NULL, NULL, NULL, '2026-10-22'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', 'b3629bc1-f384-46ac-8882-ce68d5846018', 'Caparra Country - Gabriel Manzanares', '2026-09-03', 692.00, false, NULL, '2026-09-03', 'Bill', NULL, 1, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', 'e34ee87b-6986-41eb-9ca9-9d3393459027', 'Juan Diaz', '2026-10-01', 150.00, false, NULL, '2026-10-01', 'Bill', NULL, 2, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '89de88cf-2ae2-4296-9d28-57f7f426180f', 'Deposito - Jose Manzanares', '2026-10-01', 1200.00, true, '2026-10-19', '2026-10-01', 'ACH', '3004592793 Plaza las Cumbres', 3, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '39c7e442-6e74-4670-a70f-709698fc153b', 'Caparra Country - Gabriel Manzanares', '2026-10-01', 692.00, false, NULL, '2026-10-01', 'Bill', NULL, 4, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '7f7ca800-7666-40db-9449-f264e8399cc9', 'CCC Logistic - Storage', '2026-10-02', 95.00, false, NULL, '2026-10-02', 'Bill', NULL, 5, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '6abfbaa8-d620-45a4-ae15-dca844ca9657', 'NOMINA', '2026-10-08', 400.00, true, '2026-10-19', '2026-10-08', 'Bill', NULL, 6, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '52502348-fa64-440b-b103-3b396ece7535', 'Internal Revenue Service', '2026-10-09', 600.00, true, '2026-10-14', '2026-09-30', 'Bill', 'SS Med Jul-26', 7, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '02ce92a0-3a11-427c-ae1b-895814cbfd87', 'Departamento de Hacienda', '2026-10-09', 180.00, true, '2026-10-15', '2026-09-30', 'Bill', 'Ret Jul-2026', 8, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', 'd9b58382-6ed1-472f-a7c4-7f0f5f22fd20', 'Carlos Mercado Seguros', NULL, 0.00, false, NULL, NULL, NULL, NULL, 9, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '9c25bedc-8c6c-42b6-bae0-b2e49f01f9d1', 'NOMINA', '2026-10-15', 400.00, true, '2026-10-19', '2026-10-15', 'Bill', NULL, 10, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '5cd1ad03-5a4f-4b7a-99b8-be03b525835d', 'SINERGIA LLC', '2026-10-16', 180.00, true, '2026-10-15', '2026-10-16', 'Bill', NULL, 11, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', 'eefe7234-b24d-4a83-9ba9-a909fa511175', 'Gabriel Manzanares - Auto', '2026-10-21', 1700.00, false, NULL, '2026-10-21', 'Bill', NULL, 12, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', 'f2fc3275-7bc3-4a47-ac79-8b50977289b5', 'NOMINA', '2026-10-22', 400.00, false, NULL, '2026-10-22', 'Bill', NULL, 13, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '7f2e6be7-2413-444e-aaff-bf01b0e16b18', 'SINERGIA LLC', '2026-10-23', 180.00, true, '2026-10-23', '2026-10-23', 'Bill', NULL, 14, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '744b366f-8359-4dcc-a61d-2b7fb3fcad6a', 'NOMINA', '2026-10-29', 400.00, false, NULL, '2026-10-29', 'Bill', NULL, 15, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '28a82ba4-d8b5-457b-b9d4-b22dffa8b020', 'SINERGIA LLC', '2026-10-30', 180.00, false, NULL, '2026-10-30', 'Bill', NULL, 16, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '4aa83bf3-4406-4388-b603-b4dfacdba058', 'PenFed - Jose Manzanares', '2026-10-01', 800.00, true, '2026-10-05', '2026-10-01', 'ACH', '724492-5025 PenFed', NULL, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', '757cc6b9-60eb-4dae-ad47-b2c155d5d6ab', 'Deposito Oriental Bank - Seg de vida - J Manzanares', '2026-10-01', 350.00, true, '2026-10-09', '2026-10-01', 'ACH', '1755670185 Scotiabank', NULL, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', 'a1a67ae8-750c-4fb9-8960-24aac6af9e26', 'SINERGIA LLC', '2026-10-09', 180.00, true, NULL, '2026-10-09', 'Bill', NULL, NULL, '2026-10-23'),
  ('0b70b0a7-6e13-4e4d-9fdf-5caac5f97583', 'be837a74-3a73-4a5b-aa3e-aa953818fdb6', 'Liberty Movil', NULL, 284.39, true, '2026-10-08', NULL, NULL, NULL, NULL, '2026-10-23'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', 'b3629bc1-f384-46ac-8882-ce68d5846018', 'Caparra Country - Gabriel Manzanares', '2026-09-03', 692.00, false, NULL, '2026-09-03', 'Bill', NULL, 1, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', 'e34ee87b-6986-41eb-9ca9-9d3393459027', 'Juan Diaz', '2026-10-01', 150.00, false, NULL, '2026-10-01', 'Bill', NULL, 2, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '89de88cf-2ae2-4296-9d28-57f7f426180f', 'Deposito - Jose Manzanares', '2026-10-01', 1200.00, true, '2026-10-19', '2026-10-01', 'ACH', '3004592793 Plaza las Cumbres', 3, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '39c7e442-6e74-4670-a70f-709698fc153b', 'Caparra Country - Gabriel Manzanares', '2026-10-01', 692.00, false, NULL, '2026-10-01', 'Bill', NULL, 4, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '7f7ca800-7666-40db-9449-f264e8399cc9', 'CCC Logistic - Storage', '2026-10-02', 95.00, false, NULL, '2026-10-02', 'Bill', NULL, 5, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '6abfbaa8-d620-45a4-ae15-dca844ca9657', 'NOMINA', '2026-10-08', 400.00, true, '2026-10-19', '2026-10-08', 'Bill', NULL, 6, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '52502348-fa64-440b-b103-3b396ece7535', 'Internal Revenue Service', '2026-10-09', 600.00, true, '2026-10-14', '2026-09-30', 'Bill', 'SS Med Jul-26', 7, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '02ce92a0-3a11-427c-ae1b-895814cbfd87', 'Departamento de Hacienda', '2026-10-09', 180.00, true, '2026-10-15', '2026-09-30', 'Bill', 'Ret Jul-2026', 8, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', 'd9b58382-6ed1-472f-a7c4-7f0f5f22fd20', 'Carlos Mercado Seguros', NULL, 0.00, false, NULL, NULL, NULL, NULL, 9, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '9c25bedc-8c6c-42b6-bae0-b2e49f01f9d1', 'NOMINA', '2026-10-15', 400.00, true, '2026-10-19', '2026-10-15', 'Bill', NULL, 10, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '5cd1ad03-5a4f-4b7a-99b8-be03b525835d', 'SINERGIA LLC', '2026-10-16', 180.00, true, '2026-10-15', '2026-10-16', 'Bill', NULL, 11, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', 'eefe7234-b24d-4a83-9ba9-a909fa511175', 'Gabriel Manzanares - Auto', '2026-10-21', 1700.00, false, NULL, '2026-10-21', 'Bill', NULL, 12, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', 'f2fc3275-7bc3-4a47-ac79-8b50977289b5', 'NOMINA', '2026-10-22', 400.00, false, NULL, '2026-10-22', 'Bill', NULL, 13, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '7f2e6be7-2413-444e-aaff-bf01b0e16b18', 'SINERGIA LLC', '2026-10-23', 180.00, true, '2026-10-23', '2026-10-23', 'Bill', NULL, 14, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '744b366f-8359-4dcc-a61d-2b7fb3fcad6a', 'NOMINA', '2026-10-29', 400.00, false, NULL, '2026-10-29', 'Bill', NULL, 15, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '28a82ba4-d8b5-457b-b9d4-b22dffa8b020', 'SINERGIA LLC', '2026-10-30', 180.00, false, NULL, '2026-10-30', 'Bill', NULL, 16, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '4aa83bf3-4406-4388-b603-b4dfacdba058', 'PenFed - Jose Manzanares', '2026-10-01', 800.00, true, '2026-10-05', '2026-10-01', 'ACH', '724492-5025 PenFed', NULL, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', '757cc6b9-60eb-4dae-ad47-b2c155d5d6ab', 'Deposito Oriental Bank - Seg de vida - J Manzanares', '2026-10-01', 350.00, true, '2026-10-09', '2026-10-01', 'ACH', '1755670185 Scotiabank', NULL, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', 'a1a67ae8-750c-4fb9-8960-24aac6af9e26', 'SINERGIA LLC', '2026-10-09', 180.00, true, NULL, '2026-10-09', 'Bill', NULL, NULL, '2026-10-26'),
  ('5a74b123-d615-48bf-b690-bf1550fd0a58', 'be837a74-3a73-4a5b-aa3e-aa953818fdb6', 'Liberty Movil', NULL, 284.39, true, '2026-10-08', NULL, NULL, NULL, NULL, '2026-10-26');

alter table public.cutmeat_daily_recurring_snapshot
  enable trigger cutmeat_daily_recurring_snapshot_block_closed_write;
