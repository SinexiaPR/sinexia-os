"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { AdminNavLinks } from "@/components/layout/nav-link-with-badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { adminNavItems } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import type { NavBadgeCounts } from "@/types/notifications";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  badgeCounts: NavBadgeCounts;
  className?: string;
  /** Modo solo íconos (escritorio). */
  collapsed?: boolean;
  /** Si se pasa, muestra el botón para colapsar/expandir. */
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
};

export function AdminSidebar({
  badgeCounts,
  className,
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground flex h-full w-full flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "border-sidebar-border flex h-16 items-center gap-3 border-b px-5",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          aria-hidden
          className="bg-sidebar-primary text-sidebar-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
        >
          S
        </span>
        {collapsed ? (
          <span className="sr-only">{siteConfig.firmName}</span>
        ) : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {siteConfig.firmName}
            </p>
            <p className="text-sidebar-foreground/70 truncate text-xs">
              {siteConfig.firmTagline}
            </p>
          </div>
        )}
      </div>

      <AdminNavLinks
        items={adminNavItems}
        badgeCounts={badgeCounts}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />

      {onToggleCollapsed ? (
        <div
          className={cn(
            "border-sidebar-border border-t p-3",
            collapsed && "flex justify-center",
          )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                onClick={onToggleCollapsed}
                aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
                aria-expanded={!collapsed}
                className={cn(
                  "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground h-10",
                  collapsed ? "w-10 px-0" : "w-full justify-start gap-3 px-3",
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-[18px]" />
                ) : (
                  <>
                    <PanelLeftClose className="size-[18px]" />
                    <span>Colapsar menú</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            {collapsed ? (
              <TooltipContent side="right">Expandir menú</TooltipContent>
            ) : null}
          </Tooltip>
        </div>
      ) : null}
    </aside>
  );
}
