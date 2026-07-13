-- Idempotent Tresbe-only employee preset sourced from the confirmed workbook.
-- Existing configured compensation is preserved; no company UUID or rate is inferred.

WITH tresbe_company AS (
  SELECT id FROM public.companies WHERE slug = 'tresbe' LIMIT 1
), employee_seed (
  first_name, last_name, source_name, area, receives_tips, payroll_rule, payment_method
) AS (
  VALUES
    ('Doel A.', 'Acosta', 'ACOSTA, DOEL A.', 'BOH', false, 'unconfigured', 'manual'),
    ('Bryan', 'Algarin', 'ALGARIN, BRYAN', 'BOH', false, 'unconfigured', 'manual'),
    ('Fernando', 'Almonte', 'ALMONTE, FERNANDO', 'BOH', false, 'unconfigured', 'manual'),
    ('Jesus', 'Amadeo', 'AMADEO, JESUS', 'BOH', false, 'unconfigured', 'manual'),
    ('Adrian', 'Bracero', 'BRACERO, ADRIAN', 'BOH', false, 'unconfigured', 'manual'),
    ('Joel', 'Brauer Cardin', 'BRAUER CARDIN, JOEL', 'BOH', false, 'unconfigured', 'manual'),
    ('Henry', 'Casiano', 'CASIANO, HENRY', 'BOH', false, 'unconfigured', 'manual'),
    ('Alberto L.', 'Chaves', 'Chaves, Alberto L.', 'BOH', false, 'unconfigured', 'manual'),
    ('Gil M.', 'Fernandez', 'FERNANDEZ, GIL M.', 'BOH', false, 'unconfigured', 'manual'),
    ('Joshua', 'Fontanez', 'FONTANEZ, JOSHUA', 'BOH', false, 'unconfigured', 'manual'),
    ('Oscar', 'Fortuno', 'FORTUNO, OSCAR', 'BOH', false, 'unconfigured', 'manual'),
    ('Krystal M.', 'Nieves', 'NIEVES, KRYSTAL M.', 'BOH', false, 'unconfigured', 'manual'),
    ('Mario', 'Ormaza Mercado', 'ORMAZA MERCADO, MARIO', 'BOH', false, 'unconfigured', 'manual'),
    ('Carlos', 'Ortiz', 'Ortiz, Carlos', 'BOH', false, 'unconfigured', 'manual'),
    ('Erwin', 'Pabon', 'PABON, ERWIN', 'BOH', false, 'unconfigured', 'manual'),
    ('Jezaiah L.', 'Perez Silvestre', 'Perez Silvestre, Jezaiah L.', 'BOH', false, 'unconfigured', 'manual'),
    ('Alejandro', 'Velez', 'VELEZ, ALEJANDRO', 'BOH', false, 'unconfigured', 'manual'),
    ('Lee', 'Pierre', 'LEE PIERRE', 'BOH', false, 'unconfigured', 'manual'),
    ('Jose', 'Almonte Rosas', 'JOSE ALMONTE ROSAS', 'BOH', false, 'unconfigured', 'manual'),
    ('Ramon Luis', 'Rivera', 'RAMON LUIS RIVERA', 'BOH', false, 'unconfigured', 'manual'),
    ('Vladimir', 'Guardia', 'Vladimir Guardia', 'BOH', false, 'unconfigured', 'manual'),
    ('Regino', 'Pizarro', 'PIZARRO, REGINO', 'BOH', false, 'unconfigured', 'manual'),
    ('Paola C.', 'Franco Negron', 'Franco Negron, Paola C.', 'FOH', true, 'unconfigured', 'manual'),
    ('Marc A.', 'Lopez', 'LOPEZ, MARC A.', 'FOH', true, 'unconfigured', 'manual'),
    ('Leslie A.', 'Ruiz Santiago', 'Ruiz Santiago, Leslie A', 'FOH', true, 'full_services', 'services'),
    ('Gustavo G.', 'Samot', 'SAMOT, GUSTAVO G.', 'FOH', true, 'unconfigured', 'manual'),
    ('Yohamid', 'Rodriguez', 'RODRIGUEZ, YOHAMID', 'FOH', true, 'unconfigured', 'manual'),
    ('Nashely', NULL, 'NASHELY', 'FOH', true, 'full_services', 'services'),
    ('Adalberto J.', 'Cuadrado', 'CUADRADO, ADALBERTO J.', 'CAFE CON CE', false, 'unconfigured', 'manual'),
    ('Alondra', 'Martinez', 'MARTINEZ, ALONDRA', 'CAFE CON CE', false, 'unconfigured', 'manual'),
    ('Tamara', 'Perez', 'PEREZ, TAMARA', 'CAFE CON CE', false, 'unconfigured', 'manual'),
    ('Alanies', 'Rivera Alomar', 'Rivera Alomar, Alanies', 'CAFE CON CE', false, 'unconfigured', 'manual'),
    ('Shaddai', 'Sanchez', 'SANCHEZ, SHADDAI', 'CAFE CON CE', false, 'unconfigured', 'manual'),
    ('Rocio del Mar', 'Sevilla Ortiz', 'SEVILLA ORTIZ, ROCIO DEL MAR', 'CAFE CON CE', false, 'unconfigured', 'manual'),
    ('Julian', 'Mateo', 'JULIAN MATEO', 'CAFE CON CE', false, 'full_services', 'services'),
    ('Yediel', NULL, 'YEDIEL', 'CAFE CON CE', false, 'full_services', 'services'),
    ('Sheila', 'Ortiz', 'Sheila Ortiz', 'CAFE CON CE', false, 'unconfigured', 'manual')
), normalized_seed AS (
  SELECT
    tc.id AS company_id,
    s.*,
    trim(s.first_name || COALESCE(' ' || s.last_name, '')) AS display_name,
    lower(regexp_replace(trim(s.first_name || COALESCE(' ' || s.last_name, '')), '\s+', ' ', 'g')) AS normalized_name
  FROM tresbe_company tc
  CROSS JOIN employee_seed s
)
INSERT INTO public.tresbe_employees (
  company_id, first_name, last_name, display_name, normalized_name, source_name,
  area, receives_proportional_tips, payroll_rule, payment_method
)
SELECT
  company_id, first_name, last_name, display_name, normalized_name, source_name,
  area, receives_tips, payroll_rule::public.tresbe_payroll_rule, payment_method
FROM normalized_seed
ON CONFLICT (company_id, normalized_name) DO UPDATE
SET source_name = EXCLUDED.source_name,
    area = CASE
      WHEN tresbe_employees.source_name IS NULL THEN EXCLUDED.area
      ELSE tresbe_employees.area
    END,
    receives_proportional_tips = CASE
      WHEN tresbe_employees.source_name IS NULL
        THEN EXCLUDED.receives_proportional_tips
      ELSE tresbe_employees.receives_proportional_tips
    END,
    payment_method = CASE
      WHEN tresbe_employees.source_name IS NULL
        THEN EXCLUDED.payment_method
      ELSE tresbe_employees.payment_method
    END,
    payroll_rule = CASE
      WHEN tresbe_employees.source_name IS NULL
        THEN EXCLUDED.payroll_rule
      ELSE tresbe_employees.payroll_rule
    END;

DO $$
DECLARE
  v_company_id UUID;
  v_seeded_count INTEGER;
BEGIN
  SELECT id INTO v_company_id FROM public.companies WHERE slug = 'tresbe' LIMIT 1;
  IF v_company_id IS NULL THEN
    RAISE NOTICE 'Tresbe company is not present; employee preset was safely skipped';
    RETURN;
  END IF;

  SELECT count(*) INTO v_seeded_count
  FROM public.tresbe_employees
  WHERE company_id = v_company_id
    AND normalized_name IN (
      'doel a. acosta', 'bryan algarin', 'fernando almonte', 'jesus amadeo',
      'adrian bracero', 'joel brauer cardin', 'henry casiano', 'alberto l. chaves',
      'gil m. fernandez', 'joshua fontanez', 'oscar fortuno', 'krystal m. nieves',
      'mario ormaza mercado', 'carlos ortiz', 'erwin pabon',
      'jezaiah l. perez silvestre', 'alejandro velez', 'lee pierre',
      'jose almonte rosas', 'ramon luis rivera', 'vladimir guardia', 'regino pizarro',
      'paola c. franco negron', 'marc a. lopez', 'leslie a. ruiz santiago',
      'gustavo g. samot', 'yohamid rodriguez', 'nashely', 'adalberto j. cuadrado',
      'alondra martinez', 'tamara perez', 'alanies rivera alomar', 'shaddai sanchez',
      'rocio del mar sevilla ortiz', 'julian mateo', 'yediel', 'sheila ortiz'
    );
  IF v_seeded_count <> 37 THEN
    RAISE EXCEPTION 'Tresbe employee preset validation failed: expected 37, found %', v_seeded_count;
  END IF;
END;
$$;
