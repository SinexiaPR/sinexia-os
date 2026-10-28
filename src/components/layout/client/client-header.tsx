"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

import { BrandMark } from "@/components/layout/brand-mark";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";

type ClientHeaderProps = {
  profile: Profile;
  companyName?: string | null;
  notificationUnreadCount: number;
  className?: string;
};

/**
 * Encabezado del cliente. En móvil los accesos viven en la barra inferior, así
 * que aquí solo van la empresa, SinexIA y el menú del avatar.
 */
export function ClientHeader({
  profile,
  companyName,
  notificationUnreadCount,
  className,
}: ClientHeaderProps) {
  return (
    <header
      className={cn(
        "border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <BrandMark className="size-8 md:hidden" />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground max-md:text-foreground truncate text-sm font-medium max-md:font-semibold">
            {companyName ?? siteConfig.name}
          </p>
        </div>

        <Button asChild variant="outline" className="h-10 gap-2">
          <Link href="/dashboard/sia">
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">Preguntar a SinexIA</span>
            <span className="sr-only sm:hidden">SinexIA</span>
          </Link>
        </Button>

        <UserMenu
          profile={profile}
          subtitle={companyName}
          notificationUnreadCount={notificationUnreadCount}
        />
      </div>
    </header>
  );
}
