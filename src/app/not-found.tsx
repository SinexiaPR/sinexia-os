import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Página no encontrada
      </h1>
      <p className="max-w-md text-muted-foreground">
        La página que busca no existe o fue movida.
      </p>
      <Button asChild className="h-11 rounded-xl">
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
