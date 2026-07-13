import Link from "next/link";
import {
  BarChart3,
  Banknote,
  MessageCircle,
  Sparkles,
  Upload,
} from "lucide-react";

import { ClientRecentActivity } from "@/components/dashboard/client-recent-activity";
import { MetricCard, SurfaceCard } from "@/components/ui/surface-card";
import { sinexiaContact } from "@/config/contact";
import { getCompanyById } from "@/services/documents";
import { getClientDashboardData } from "@/services/client-dashboard";
import type { Profile } from "@/types";

type ClientDashboardProps = {
  profile: Profile;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("es", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

const baseQuickActions = [
  {
    label: "Subir documento",
    description: "Enviar a Inbox",
    href: "/dashboard/inbox#upload",
    icon: Upload,
  },
  {
    label: "Reportes",
    description: "Ver publicados",
    href: "/dashboard/reports",
    icon: BarChart3,
  },
  {
    label: "Preguntar a SinexIA",
    description: "Consultas con datos",
    href: "/dashboard/sia",
    icon: Sparkles,
  },
  {
    label: "Contactar Sinexia",
    description: "WhatsApp",
    href: sinexiaContact.whatsappHref,
    icon: MessageCircle,
    external: true,
  },
] as const;

export async function ClientDashboard({ profile }: ClientDashboardProps) {
  if (!profile.company_id) {
    return (
      <div className="space-y-2 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
        <p className="text-muted-foreground">
          Su cuenta no está vinculada a una empresa. Contacte a Sinexia.
        </p>
      </div>
    );
  }

  const [{ stats, activity }, company] = await Promise.all([
    getClientDashboardData(profile.company_id),
    getCompanyById(profile.company_id),
  ]);

  const firstName = profile.full_name?.split(" ")[0] ?? "cliente";
  const quickActions =
    company?.slug === "sibarita" || company?.slug === "tresbe"
      ? [
          {
            label: company.slug === "tresbe" ? "Nóminas" : "Nómina semanal",
            description:
              company.slug === "tresbe" ? "Ver enviadas" : "Horas y pagos",
            href: "/dashboard/payroll",
            icon: Banknote,
          },
          ...baseQuickActions,
        ]
      : baseQuickActions;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-muted-foreground text-sm">
          {company?.name ?? "Su empresa"}
        </p>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          Hola, {firstName}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-relaxed">
          Resumen ejecutivo de reportes, documentos y actividad reciente.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Reportes publicados"
          value={stats.publishedReports}
          hint="Disponibles para consulta"
        />
        <MetricCard
          label="Documentos pendientes"
          value={stats.pendingDocuments}
          hint="Recibidos o en revisión"
        />
        <MetricCard
          label="Documentos analizados"
          value={stats.analyzedDocuments}
          hint="Procesados por SinexIA"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SurfaceCard padding="lg" className="flex flex-col">
          <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
            Último reporte
          </p>
          {stats.lastReport ? (
            <div className="mt-4 flex flex-1 flex-col">
              <p className="text-foreground text-lg font-semibold tracking-tight">
                {stats.lastReport.title}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                {stats.lastReport.category} · {stats.lastReport.period}
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Publicado el {formatDate(stats.lastReport.createdAt)}
              </p>
              <Link
                href="/dashboard/reports"
                className="text-primary mt-auto pt-6 text-sm font-medium hover:underline"
              >
                Ver reportes →
              </Link>
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm">
              Sinexia publicará reportes aquí cuando estén listos.
            </p>
          )}
        </SurfaceCard>

        <SurfaceCard padding="lg" className="flex flex-col">
          <p className="text-muted-foreground text-[13px] font-medium tracking-wide uppercase">
            Última actualización
          </p>
          {stats.lastUpdate ? (
            <div className="mt-4 flex flex-1 flex-col">
              <p className="text-foreground text-lg font-semibold tracking-tight">
                {formatDateTime(stats.lastUpdate)}
              </p>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Fecha más reciente entre reportes, envíos y análisis de SinexIA.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground mt-4 text-sm">
              Aún no hay actividad registrada en su cuenta.
            </p>
          )}
        </SurfaceCard>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">
          Acciones rápidas
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const card = (
              <SurfaceCard
                padding="md"
                className="hover:bg-muted/30 flex h-full flex-col transition-colors"
              >
                <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-xl">
                  <Icon className="size-4" />
                </div>
                <p className="text-foreground mt-4 text-sm font-semibold">
                  {action.label}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {action.description}
                </p>
              </SurfaceCard>
            );

            if ("external" in action && action.external) {
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {card}
                </Link>
              );
            }

            return (
              <Link key={action.label} href={action.href} className="block">
                {card}
              </Link>
            );
          })}
        </div>
      </div>

      <ClientRecentActivity items={activity} />
    </div>
  );
}
