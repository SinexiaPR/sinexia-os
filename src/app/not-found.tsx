import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-primary text-sm font-medium">404</p>
      <h1 className="text-xl font-semibold tracking-tight">
        Página no encontrada
      </h1>
      <p className="text-muted-foreground max-w-md">
        La página que buscas no existe o fue movida.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
