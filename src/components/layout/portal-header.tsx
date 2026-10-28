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
      <div className="mx-auto flex h-16 max-w-5xl items-center px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          <BrandMark className="size-9" />
          {siteConfig.firmName}
        </Link>
      </div>
    </header>
  );
}
