-- Repair invoice total recalculation permissions and configure confirmed weekly
-- defaults without changing existing drafts or issued invoice snapshots.

ALTER TABLE public.recurring_invoice_profiles
  ADD COLUMN IF NOT EXISTS template_key TEXT,
  ADD COLUMN IF NOT EXISTS default_currency TEXT NOT NULL DEFAULT 'USD'
    CHECK (default_currency ~ '^[A-Z]{3}$'),
  ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0
    CHECK (default_tax_rate BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS effective_date DATE NOT NULL DEFAULT CURRENT_DATE;

CREATE UNIQUE INDEX IF NOT EXISTS recurring_invoice_company_template_uq
  ON public.recurring_invoice_profiles(company_id, template_key);

CREATE TABLE IF NOT EXISTS public.invoice_template_match_reviews (
  template_key TEXT PRIMARY KEY,
  expected_company_name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(aliases) = 'array'),
  match_status TEXT NOT NULL CHECK (match_status IN ('matched', 'missing', 'ambiguous')),
  match_count INTEGER NOT NULL DEFAULT 0 CHECK (match_count >= 0),
  candidate_company_ids JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(candidate_company_ids) = 'array'),
  reason TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_template_match_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read invoice template match reviews"
  ON public.invoice_template_match_reviews;
CREATE POLICY "Admins read invoice template match reviews"
  ON public.invoice_template_match_reviews FOR SELECT TO authenticated
  USING (public.is_admin());
REVOKE INSERT, UPDATE, DELETE ON public.invoice_template_match_reviews
  FROM authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_invoice_totals(value UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  invoice_row public.invoices%ROWTYPE;
  calculated_subtotal NUMERIC(14,2);
  calculated_discount NUMERIC(14,2);
  taxable_subtotal NUMERIC(14,2);
  calculated_tax NUMERIC(14,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can recalculate invoice totals'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO invoice_row
  FROM public.invoices
  WHERE id = value
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF invoice_row.status <> 'draft' THEN RETURN; END IF;

  SELECT round(COALESCE(sum(round(item.quantity * item.unit_price, 2)), 0), 2)
  INTO calculated_subtotal
  FROM public.invoice_items item
  WHERE item.invoice_id = value;

  calculated_discount := CASE invoice_row.discount_type
    WHEN 'fixed' THEN LEAST(calculated_subtotal, round(invoice_row.discount_value, 2))
    WHEN 'percentage' THEN round(
      calculated_subtotal * invoice_row.discount_value / 100,
      2
    )
    ELSE 0
  END;
  taxable_subtotal := GREATEST(calculated_subtotal - calculated_discount, 0);
  calculated_tax := round(taxable_subtotal * invoice_row.tax_rate / 100, 2);

  UPDATE public.invoices
  SET subtotal = calculated_subtotal,
      discount_amount = calculated_discount,
      tax_amount = calculated_tax,
      total = round(taxable_subtotal + calculated_tax, 2),
      updated_at = now()
  WHERE id = value;
END;
$$;

ALTER FUNCTION public.recalculate_invoice_totals(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.recalculate_invoice_totals(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalculate_invoice_totals(UUID)
  TO authenticated;

-- Trigger helpers remain unavailable as direct RPCs. They invoke the protected
-- exact signature above in the authenticated administrator's transaction.
REVOKE ALL ON FUNCTION public.recalculate_invoice_after_item_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalculate_invoice_after_header_change()
  FROM PUBLIC, anon, authenticated;

DROP TABLE IF EXISTS pg_temp.confirmed_weekly_invoice_templates;
CREATE TEMP TABLE confirmed_weekly_invoice_templates (
  template_key TEXT PRIMARY KEY,
  expected_company_name TEXT NOT NULL,
  normalized_aliases TEXT[] NOT NULL,
  slug_aliases TEXT[] NOT NULL,
  default_items JSONB NOT NULL,
  default_note TEXT,
  expected_total NUMERIC(14,2) NOT NULL
) ON COMMIT DROP;

INSERT INTO confirmed_weekly_invoice_templates VALUES
  (
    'weekly-tresbe', 'Tresbe',
    ARRAY['tresbe', 'tresbe inc'], ARRAY['tresbe'],
    '[{"description":"Paquete Sinexia Pro","quantity":1,"unitPrice":250.00}]'::JSONB,
    NULL, 250.00
  ),
  (
    'weekly-sibarita', 'Sibarita',
    ARRAY['sibarita', 'sibarita llc'], ARRAY['sibarita'],
    '[{"description":"Paquete Sinexia Pro","quantity":1,"unitPrice":250.00}]'::JSONB,
    NULL, 250.00
  ),
  (
    'weekly-cut-meat-distributors', 'Cut Meat Distributors',
    ARRAY['cut meat distributors'], ARRAY['cut-meat-distributors'],
    '[{"description":"Paquete Sinexia Pro","quantity":1,"unitPrice":130.00},{"description":"Servicios adicionales","quantity":1,"unitPrice":50.00}]'::JSONB,
    'Reportes específicos solicitados por el cliente.', 180.00
  ),
  (
    'weekly-cut-butcher-shop', 'Cut Butcher Shop / Cut',
    ARRAY['cut butcher shop', 'cut'], ARRAY['cut', 'cut-butcher-shop'],
    '[{"description":"Paquete Sinexia Pro","quantity":1,"unitPrice":130.00},{"description":"Servicios adicionales","quantity":1,"unitPrice":190.00}]'::JSONB,
    'Cálculo de nóminas, reportes específicos solicitados por el cliente, visitas presenciales y otras solicitudes.',
    320.00
  ),
  (
    'weekly-magol', 'Empresas Magol / Magol',
    ARRAY['empresas magol', 'magol'], ARRAY['empresas-magol', 'magol'],
    '[{"description":"Paquete Sinexia Pro","quantity":1,"unitPrice":130.00}]'::JSONB,
    NULL, 130.00
  );

WITH company_matches AS (
  SELECT template.template_key, company.id AS company_id
  FROM confirmed_weekly_invoice_templates template
  JOIN public.companies company ON (
    lower(company.slug) = ANY(template.slug_aliases)
    OR lower(regexp_replace(
      regexp_replace(trim(company.name), '[^[:alnum:]]+', ' ', 'g'),
      '\s+', ' ', 'g'
    )) = ANY(template.normalized_aliases)
  )
), match_summary AS (
  SELECT
    template.template_key,
    template.expected_company_name,
    to_jsonb(template.normalized_aliases || template.slug_aliases) AS aliases,
    count(company_matches.company_id)::INTEGER AS match_count,
    COALESCE(
      jsonb_agg(company_matches.company_id) FILTER (
        WHERE company_matches.company_id IS NOT NULL
      ),
      '[]'::JSONB
    ) AS candidate_company_ids
  FROM confirmed_weekly_invoice_templates template
  LEFT JOIN company_matches USING (template_key)
  GROUP BY template.template_key, template.expected_company_name,
           template.normalized_aliases, template.slug_aliases
)
INSERT INTO public.invoice_template_match_reviews(
  template_key, expected_company_name, aliases, match_status, match_count,
  candidate_company_ids, reason, resolved_at, updated_at
)
SELECT
  summary.template_key,
  summary.expected_company_name,
  summary.aliases,
  CASE summary.match_count
    WHEN 0 THEN 'missing'
    WHEN 1 THEN 'matched'
    ELSE 'ambiguous'
  END,
  summary.match_count,
  summary.candidate_company_ids,
  CASE
    WHEN summary.match_count = 0 THEN 'No existing company matched the confirmed aliases.'
    WHEN summary.match_count > 1 THEN 'More than one existing company matched the confirmed aliases.'
    ELSE NULL
  END,
  CASE WHEN summary.match_count = 1 THEN now() ELSE NULL END,
  now()
FROM match_summary summary
ON CONFLICT (template_key) DO UPDATE
SET expected_company_name = EXCLUDED.expected_company_name,
    aliases = EXCLUDED.aliases,
    match_status = EXCLUDED.match_status,
    match_count = EXCLUDED.match_count,
    candidate_company_ids = EXCLUDED.candidate_company_ids,
    reason = EXCLUDED.reason,
    resolved_at = EXCLUDED.resolved_at,
    updated_at = now();

WITH company_matches AS (
  SELECT template.*, company.id AS company_id
  FROM confirmed_weekly_invoice_templates template
  JOIN public.companies company ON (
    lower(company.slug) = ANY(template.slug_aliases)
    OR lower(regexp_replace(
      regexp_replace(trim(company.name), '[^[:alnum:]]+', ' ', 'g'),
      '\s+', ' ', 'g'
    )) = ANY(template.normalized_aliases)
  )
), unambiguous AS (
  SELECT matches.*
  FROM company_matches matches
  WHERE 1 = (
    SELECT count(*) FROM company_matches candidate
    WHERE candidate.template_key = matches.template_key
  )
)
INSERT INTO public.company_billing_profiles(
  company_id, invoices_enabled, default_payment_terms_days,
  default_language, default_note, default_invoice_items
)
SELECT
  template.company_id, true, 15, 'es', template.default_note,
  template.default_items
FROM unambiguous template
ON CONFLICT (company_id) DO UPDATE
SET invoices_enabled = true,
    default_payment_terms_days = 15,
    default_note = COALESCE(EXCLUDED.default_note,
                            company_billing_profiles.default_note),
    default_invoice_items = EXCLUDED.default_invoice_items,
    updated_at = now();

WITH company_matches AS (
  SELECT template.*, company.id AS company_id
  FROM confirmed_weekly_invoice_templates template
  JOIN public.companies company ON (
    lower(company.slug) = ANY(template.slug_aliases)
    OR lower(regexp_replace(
      regexp_replace(trim(company.name), '[^[:alnum:]]+', ' ', 'g'),
      '\s+', ' ', 'g'
    )) = ANY(template.normalized_aliases)
  )
), unambiguous AS (
  SELECT matches.*
  FROM company_matches matches
  WHERE 1 = (
    SELECT count(*) FROM company_matches candidate
    WHERE candidate.template_key = matches.template_key
  )
)
INSERT INTO public.recurring_invoice_profiles(
  company_id, template_key, name, frequency, weekday,
  next_generation_date, default_items, default_terms_days,
  billing_email, default_currency, default_tax_rate,
  enabled, effective_date
)
SELECT
  template.company_id,
  template.template_key,
  'Facturación semanal confirmada',
  'weekly',
  NULL,
  NULL,
  template.default_items,
  15,
  billing.billing_email,
  'USD',
  0,
  true,
  DATE '2026-07-14'
FROM unambiguous template
LEFT JOIN public.company_billing_profiles billing
  ON billing.company_id = template.company_id
ON CONFLICT (company_id, template_key) DO UPDATE
SET name = EXCLUDED.name,
    frequency = 'weekly',
    weekday = NULL,
    next_generation_date = NULL,
    default_items = EXCLUDED.default_items,
    default_terms_days = EXCLUDED.default_terms_days,
    billing_email = COALESCE(
      recurring_invoice_profiles.billing_email,
      EXCLUDED.billing_email
    ),
    default_currency = EXCLUDED.default_currency,
    default_tax_rate = EXCLUDED.default_tax_rate,
    enabled = true,
    effective_date = EXCLUDED.effective_date,
    updated_at = now();

DO $$
DECLARE
  invalid_template_count INTEGER;
BEGIN
  SELECT count(*) INTO invalid_template_count
  FROM public.recurring_invoice_profiles profile
  JOIN confirmed_weekly_invoice_templates template
    ON template.template_key = profile.template_key
  CROSS JOIN LATERAL (
    SELECT round(sum(
      (item->>'quantity')::NUMERIC * (item->>'unitPrice')::NUMERIC
    ), 2) AS total
    FROM jsonb_array_elements(profile.default_items) item
  ) calculated
  WHERE profile.frequency <> 'weekly'
     OR profile.default_currency <> 'USD'
     OR profile.default_tax_rate <> 0
     OR calculated.total <> template.expected_total;

  IF invalid_template_count > 0 THEN
    RAISE EXCEPTION 'Confirmed weekly invoice template validation failed';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
