import Link from "next/link";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type PortalHeaderProps = {
  className?: string;
};

export function PortalHeader({ className }: PortalHeaderProps) {
  return (
    <header className={cn("w-full", className)}>
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-[13px] font-semibold tracking-[0.18em] text-foreground uppercase"
        >
          {siteConfig.name}
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
        >
          Iniciar sesión
        </Link>
      </div>
    </header>
  );
}
