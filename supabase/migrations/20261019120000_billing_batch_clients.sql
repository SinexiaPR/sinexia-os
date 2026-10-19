-- Facturación semanal en lote: tabla de configuración de "clientes
-- facturables" (monto fijo o del sistema) + columnas de período en
-- invoices para el anti-duplicado atómico + función que crea los
-- borradores del lote en una sola transacción (todo o nada) y reutiliza
-- public.issue_invoice() para la numeración -- nunca una secuencia
-- nueva, nunca se reimplementa la asignación atómica de número que ya
-- existe (public.invoice_sequences / 'sinexia_global_invoice').

DO $$ BEGIN
  CREATE TYPE public.billing_batch_amount_type AS ENUM ('fixed', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.billing_batch_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE RESTRICT,
  amount_type public.billing_batch_amount_type NOT NULL DEFAULT 'fixed',
  -- "system": todavía no existe ningún cálculo automático reutilizable
  -- (confirmado explorando el repo) -- un cliente con este tipo se
  -- muestra "pendiente de monto" en la vista previa hasta que exista un
  -- resolver real; no se inventa ningún número.
  fixed_amount NUMERIC(14,2) CHECK (fixed_amount IS NULL OR fixed_amount >= 0),
  line_description TEXT NOT NULL
    CHECK (char_length(trim(line_description)) BETWEEN 1 AND 500),
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CHECK (
    (amount_type = 'fixed' AND fixed_amount IS NOT NULL) OR
    (amount_type = 'system' AND fixed_amount IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS billing_batch_clients_active_idx
  ON public.billing_batch_clients(active, display_order);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_batch_client_id UUID
    REFERENCES public.billing_batch_clients(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS billing_period_start DATE,
  ADD COLUMN IF NOT EXISTS billing_period_end DATE;

-- Anti-duplicado atómico: nunca 2 facturas no-canceladas del mismo
-- "cliente facturable" para el mismo período -- lo hace cumplir el
-- motor, no solo una verificación previa en la app (a prueba de doble
-- clic o dos sesiones). Una factura cancelada libera el período para
-- "regenerar".
CREATE UNIQUE INDEX IF NOT EXISTS invoices_billing_batch_period_uq
  ON public.invoices(billing_batch_client_id, billing_period_start)
  WHERE billing_batch_client_id IS NOT NULL AND status <> 'cancelled';

CREATE OR REPLACE FUNCTION public.create_weekly_invoice_drafts(p_requests JSONB)
RETURNS SETOF public.invoices
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req JSONB;
  v_client public.billing_batch_clients%ROWTYPE;
  v_billing public.company_billing_profiles%ROWTYPE;
  v_company_name TEXT;
  v_legal_name TEXT;
  v_amount NUMERIC(14,2);
  v_invoice_id UUID;
  v_period_start DATE;
  v_period_end DATE;
  v_cancel_id UUID;
  v_address TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede generar facturas en lote';
  END IF;

  IF jsonb_typeof(p_requests) <> 'array' OR jsonb_array_length(p_requests) = 0 THEN
    RAISE EXCEPTION 'La solicitud de lote no tiene líneas';
  END IF;

  FOR v_req IN SELECT * FROM jsonb_array_elements(p_requests) LOOP
    v_period_start := (v_req->>'periodStart')::DATE;
    v_period_end := (v_req->>'periodEnd')::DATE;
    IF v_period_start IS NULL OR v_period_end IS NULL OR v_period_end < v_period_start THEN
      RAISE EXCEPTION 'Periodo inválido en la solicitud de lote';
    END IF;

    -- FOR UPDATE: bloquea la fila del cliente facturable mientras dura
    -- esta iteración -- si dos clics/sesiones piden el mismo lote a la
    -- vez, el segundo espera y luego choca con el índice único de abajo
    -- en vez de crear un duplicado.
    SELECT * INTO v_client FROM public.billing_batch_clients
      WHERE id = (v_req->>'billingBatchClientId')::UUID AND active
      FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El cliente facturable % no existe o está inactivo', v_req->>'billingBatchClientId';
    END IF;

    SELECT name INTO v_company_name FROM public.companies WHERE id = v_client.company_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La empresa de % no existe', v_client.line_description;
    END IF;

    -- Mismo fallback que el formulario manual (invoice-editor.tsx):
    -- billing_legal_name si está configurado, si no el nombre de la
    -- empresa -- Magol y Cut Meat Distributors hoy no tienen
    -- billing_legal_name propio, igual que en el flujo manual.
    SELECT * INTO v_billing FROM public.company_billing_profiles
      WHERE company_id = v_client.company_id;
    v_legal_name := COALESCE(v_billing.billing_legal_name, v_company_name);

    v_cancel_id := NULLIF(v_req->>'cancelInvoiceId', '')::UUID;
    IF v_cancel_id IS NOT NULL THEN
      UPDATE public.invoices
      SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
          cancellation_reason = 'Regenerada desde el lote semanal'
      WHERE id = v_cancel_id AND billing_batch_client_id = v_client.id
        AND status <> 'cancelled';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'No se pudo cancelar la factura % para regenerarla', v_cancel_id;
      END IF;
    ELSIF EXISTS (
      SELECT 1 FROM public.invoices
      WHERE billing_batch_client_id = v_client.id
        AND billing_period_start = v_period_start
        AND status <> 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Ya existe una factura para % en este periodo -- confirmá "regenerar" para repetirla', v_client.line_description;
    END IF;

    v_amount := CASE
      WHEN (v_req ? 'amountOverride') AND v_req->>'amountOverride' IS NOT NULL
        THEN (v_req->>'amountOverride')::NUMERIC
      WHEN v_client.amount_type = 'fixed' THEN v_client.fixed_amount
      ELSE NULL
    END;
    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'No hay un monto válido para % -- debe excluirse del lote como "pendiente de monto"', v_client.line_description;
    END IF;

    v_address := NULLIF(trim(concat_ws(', ',
      v_billing.address_line_1, v_billing.address_line_2,
      v_billing.city, v_billing.region, v_billing.postal_code
    )), '');

    INSERT INTO public.invoices (
      company_id, billing_batch_client_id, billing_period_start, billing_period_end,
      invoice_date, due_date, currency,
      billing_name_snapshot, billing_contact_snapshot, billing_email_snapshot,
      billing_cc_snapshot, billing_address_snapshot,
      language, created_by, updated_by
    ) VALUES (
      v_client.company_id, v_client.id, v_period_start, v_period_end,
      v_period_start, v_period_start, 'USD',
      v_legal_name, v_billing.billing_contact_name, v_billing.billing_email,
      v_billing.billing_cc, v_address,
      COALESCE(v_billing.default_language, 'es'), auth.uid(), auth.uid()
    ) RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_items (invoice_id, position, description, quantity, unit_price)
    VALUES (v_invoice_id, 0, v_client.line_description, 1, v_amount);

    INSERT INTO public.invoice_events(invoice_id, user_id, event_type, details)
    VALUES (v_invoice_id, auth.uid(), 'draft_created', jsonb_build_object('source', 'weekly_batch'));

    RETURN QUERY SELECT * FROM public.invoices WHERE id = v_invoice_id;
  END LOOP;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.create_weekly_invoice_drafts(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_weekly_invoice_drafts(JSONB) TO authenticated;

ALTER TABLE public.billing_batch_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage billing batch clients" ON public.billing_batch_clients;
CREATE POLICY "Admins manage billing batch clients" ON public.billing_batch_clients
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed: los 5 clientes facturables confirmados con el usuario.
-- Baldonny Management ya existía como empresa (con plantilla semanal de
-- $200 y 6 facturas ya emitidas) -- no se crea una empresa nueva.
-- Sibarita sube de $250 (plantilla vieja, sin tocar) a $300 (confirmado).
INSERT INTO public.billing_batch_clients
  (company_id, amount_type, fixed_amount, line_description, display_order)
SELECT c.id, 'fixed', v.amount, v.description, v.display_order
FROM (VALUES
  ('magol', 130.00, 'Paquete Sinexia Pro', 1),
  ('baldonny-management', 200.00, 'Paquete Sinexia', 2),
  ('sibarita', 300.00, 'Paquete Sinexia Pro', 3),
  ('cut', 320.00, 'Paquete Sinexia Pro + Servicios adicionales', 4),
  ('cut-meat-distributors', 180.00, 'Paquete Sinexia Pro + Servicios adicionales', 5)
) AS v(slug, amount, description, display_order)
JOIN public.companies c ON c.slug = v.slug
ON CONFLICT (company_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
