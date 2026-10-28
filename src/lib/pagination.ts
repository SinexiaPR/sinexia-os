export const DEFAULT_PAGE_SIZE = 25;

export type Page<T> = {
  items: T[];
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
};

/** Divide `items` en páginas; `page` se limita al rango válido (empieza en 1). */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize = DEFAULT_PAGE_SIZE,
): Page<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    totalPages,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    total: items.length,
  };
}
