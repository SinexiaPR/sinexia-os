-- cutmeat_daily_variance_lines.section: separa las líneas de Variación
-- Diaria propiamente dicha ('variance') de los depósitos sin cobrar
-- puntuales que hoy se cargan ahí mezclados (p. ej. "The Butcher - Costco
-- (depósito sin cobrar)") ('uncollected_deposit'). El total de Variación
-- Diaria sigue siendo la suma de todas las líneas sin importar la
-- sección -- esto es solo para que la pantalla y el PDF los muestren en
-- bloques separados en vez de una sola lista mezclada.
--
-- DEFAULT 'variance' para que las filas existentes (todas cargadas antes
-- de que existiera esta columna) queden clasificadas como Variación
-- Diaria, que es lo que eran en la práctica.

ALTER TABLE public.cutmeat_daily_variance_lines
  ADD COLUMN section TEXT NOT NULL DEFAULT 'variance'
    CHECK (section IN ('variance', 'uncollected_deposit'));
