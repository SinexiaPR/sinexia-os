import type { Metadata } from "next";
import Link from "next/link";

import { ContactSinexiaCard } from "@/components/contact/contact-sinexia-card";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { siteConfig } from "@/config/site";
import { requireAuth } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Ayuda",
};

export default async function AyudaPage() {
  const profile = await requireAuth();
  const isAdmin = profile.role === "admin";

  return (
    <div className="space-y-8 sm:space-y-10">
      {isAdmin ? (
        <PageHeader
          eyebrow="Administración"
          title="Ayuda"
          description="Recursos de soporte y contacto con Sinexia."
        />
      ) : (
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Ayuda
          </h1>
          <p className="text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            Guías rápidas y contacto directo con el equipo de Sinexia.
          </p>
        </header>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            Enviar documentos
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Desde Documentos puede tomar una foto, elegir de la galería o
            adjuntar PDF, Word o Excel. Complete los datos y pulse Enviar
            documento.
          </p>
          {!isAdmin ? (
            <Link
              href="/dashboard/inbox"
              className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline"
            >
              Ir a Documentos →
            </Link>
          ) : null}
        </SurfaceCard>

        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            Consultar reportes
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Los reportes publicados por Sinexia aparecen en Reportes. Los
            nuevos se marcan como Nuevo hasta que los revise.
          </p>
          <Link
            href="/dashboard/reports"
            className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline"
          >
            Ir a Reportes →
          </Link>
        </SurfaceCard>

        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            Estados de documentos
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Recibido</span> —
              Sinexia lo tiene en su bandeja.
            </li>
            <li>
              <span className="font-medium text-foreground">En revisión</span> —
              El equipo lo está revisando.
            </li>
            <li>
              <span className="font-medium text-foreground">Procesado</span> —
              Completado.
            </li>
            <li>
              <span className="font-medium text-foreground">
                Falta información
              </span>{" "}
              — Se requiere corrección o datos adicionales.
            </li>
            <li>
              <span className="font-medium text-foreground">Rechazado</span> —
              El documento no fue aceptado; envíe uno nuevo si aplica.
            </li>
          </ul>
        </SurfaceCard>

        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            Sitio web de Sinexia
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Conozca más sobre nuestros servicios en el sitio oficial.
          </p>
          <a
            href={siteConfig.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline"
          >
            Visitar sinexiapr.com →
          </a>
        </SurfaceCard>
      </div>

      <ContactSinexiaCard />
    </div>
  );
}
