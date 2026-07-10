import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: siteConfig.portalTitle,
  description: siteConfig.portalSubtitle,
};

export default function HomePage() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#e8eef5_0%,_transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-border/80"
      />

      <div className="relative mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <BrandLogo href={null} size="lg" showSubtitle />

          <h1 className="font-display mt-10 text-[1.75rem] leading-tight font-semibold tracking-tight text-foreground sm:text-4xl">
            Acceso seguro para su empresa
          </h1>

          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {siteConfig.portalSubtitle}
          </p>

          <div className="mt-10 flex w-full flex-col gap-3 sm:mx-auto sm:max-w-sm">
            <Button
              asChild
              size="lg"
              className="h-12 w-full rounded-xl text-[15px] font-semibold"
            >
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-xl border-border bg-card text-[15px] font-medium"
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
    </div>
  );
}
