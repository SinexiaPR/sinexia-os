-- Removes the 5 calendar_items rows manually created around the
-- "Preparación recurrente" recurring-billing flow (4 tasks + 1 reminder,
-- one per company: Cut Meat Distributors, Cut, Sibarita, Tresbe, Magol).
-- Confirmed with the user ("Sí, borrar las 5") before dropping. Their
-- calendar_item_occurrence_status override rows (33 total) cascade-delete
-- automatically via the FK on that table. Dropped as part of removing the
-- "Preparación recurrente" feature from Facturación.
delete from public.calendar_items
where id in (
  'a9e4c6ea-7202-45c5-be98-561ac7c466f4', -- FACTURA CUT MEAT (task, Cut Meat Distributors)
  '258276cb-7c8f-4d4a-8f36-f088e6b24a03', -- FACTURA CUT (task, Cut)
  '08b91c2b-940d-4b48-b0a7-22a17e070811', -- FACTURA SIBARITA (task, Sibarita)
  '802a8945-3ff2-4013-b929-44fcfe1f8a35', -- FACTURA TRESBE (task, Tresbe)
  'd52a576f-ad94-43de-a24d-ce7b17d9f704'  -- FATURA / HACER FACTURA MAGOL (reminder, Magol)
);
