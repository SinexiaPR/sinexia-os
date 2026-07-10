import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CircleHelp,
  FileText,
  LayoutDashboard,
  User,
} from "lucide-react";

export type NavBadgeKey = "inbox" | "reports";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: NavBadgeKey;
  /** Show in mobile bottom navigation */
  mobile?: boolean;
};

export const clientNavItems: NavItem[] = [
  {
    title: "Inicio",
    href: "/dashboard",
    icon: LayoutDashboard,
    mobile: true,
  },
  {
    title: "Documentos",
    href: "/dashboard/inbox",
    icon: FileText,
    badgeKey: "inbox",
    mobile: true,
  },
  {
    title: "Reportes",
    href: "/dashboard/reports",
    icon: BarChart3,
    badgeKey: "reports",
    mobile: true,
  },
  {
    title: "Ayuda",
    href: "/dashboard/ayuda",
    icon: CircleHelp,
    mobile: true,
  },
  {
    title: "Mi cuenta",
    href: "/dashboard/profile",
    icon: User,
    mobile: true,
  },
];

export const adminNavItems: NavItem[] = [
  {
    title: "Inicio",
    href: "/dashboard",
    icon: LayoutDashboard,
    mobile: true,
  },
  {
    title: "Documentos",
    href: "/dashboard/inbox",
    icon: FileText,
    badgeKey: "inbox",
    mobile: true,
  },
  {
    title: "Reportes",
    href: "/dashboard/reports",
    icon: BarChart3,
    mobile: true,
  },
  {
    title: "Empresas",
    href: "/dashboard/empresas",
    icon: Building2,
    mobile: true,
  },
  {
    title: "Ayuda",
    href: "/dashboard/ayuda",
    icon: CircleHelp,
    mobile: true,
  },
  {
    title: "Mi cuenta",
    href: "/dashboard/profile",
    icon: User,
  },
];

export function getPageTitle(pathname: string, items: NavItem[]): string {
  const match = items.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href)),
  );

  return match?.title ?? "Inicio";
}
