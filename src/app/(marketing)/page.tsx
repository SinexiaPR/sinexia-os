import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ShieldCheck, TrendingUp } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: siteConfig.portalTitle,
  description: siteConfig.portalSubtitle,
};

const benefits = [
  {
    icon: ShieldCheck,
    title: "Documentos seguros",
    description:
      "Envía facturas, recibos y estados bancarios desde tu teléfono o computadora.",
  },
  {
    icon: BarChart3,
    title: "Reportes al día",
    description:
      "Consulta los reportes que Sinexia publica para tu empresa en cuanto están listos.",
  },
  {
    icon: TrendingUp,
    title: "Seguimiento de tu empresa",
    description:
      "Mira el estado de tu nómina, facturas y pendientes sin llamar ni escribir.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16 sm:py-24">
      <div className="w-full max-w-md text-center">
        <BrandMark className="mx-auto size-24 rounded-2xl shadow-[var(--shadow-card)]" />

        <h1 className="text-foreground mt-6 text-3xl font-semibold tracking-tight sm:text-4xl">
          {siteConfig.portalTitle}
        </h1>

        <p className="text-muted-foreground mx-auto mt-4 max-w-sm text-base leading-relaxed">
          Tus documentos, reportes y el estado de tu empresa con Sinexia, en un
          solo lugar.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            asChild
            size="lg"
            className="h-11 w-full px-8 text-base sm:w-auto"
          >
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <a
            href={siteConfig.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-2 text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Conocer Sinexia en sinexiapr.com
          </a>
        </div>
      </div>

      <ul className="mt-16 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {benefits.map(({ icon: Icon, title, description }) => (
          <li
            key={title}
            className="border-border/80 bg-card rounded-lg border p-5 text-left shadow-[var(--shadow-card)]"
          >
            <span
              aria-hidden
              className="bg-info-soft text-info inline-flex size-10 items-center justify-center rounded-md"
            >
              <Icon className="size-5" />
            </span>
            <h2 className="mt-4 text-base font-semibold">{title}</h2>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {description}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
