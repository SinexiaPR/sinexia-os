import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
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
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          <BrandMark className="size-8 text-sm" />
          {siteConfig.firmName}
        </Link>
        <Link
          href="/login"
          className="text-primary hover:text-primary/80 focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Iniciar sesión
        </Link>
      </div>
    </header>
  );
}
