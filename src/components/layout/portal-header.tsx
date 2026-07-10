import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

type PortalHeaderProps = {
  className?: string;
};

export function PortalHeader({ className }: PortalHeaderProps) {
  return (
    <header
      className={cn("w-full border-b border-border/60 bg-card/80", className)}
    >
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:h-[4.5rem] sm:px-8">
        <BrandLogo href="/" showSubtitle size="sm" />
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-navy-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Iniciar sesión
        </Link>
      </div>
    </header>
  );
}
