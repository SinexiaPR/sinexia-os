import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: siteConfig.portalTitle,
  description: siteConfig.portalSubtitle,
};

export default function HomePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 sm:py-28">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
          {siteConfig.name}
        </p>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {siteConfig.portalTitle}
        </h1>

        <p className="mx-auto mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {siteConfig.portalSubtitle}
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="h-10 px-8 text-sm">
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-10 border-border/80 px-8 text-sm font-medium"
          >
            <a
              href={siteConfig.companyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Conocer Sinexia
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
