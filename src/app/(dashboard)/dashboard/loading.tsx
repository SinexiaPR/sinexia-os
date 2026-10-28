import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto mientras carga cualquier pantalla del panel. */
export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Cargando">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
