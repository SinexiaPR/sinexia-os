import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  BarChart3,
  Building2,
  CalendarDays,
  FileText,
  Folder,
  Home,
  Receipt,
} from "lucide-react";

export type NavBadgeKey = "inbox" | "reports";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: NavBadgeKey;
  /** Rutas adicionales que mantienen activo este ítem (además de `href`). */
  matchPrefixes?: string[];
};

/** Ítem activo si la ruta coincide con `href` o con alguno de `matchPrefixes`. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (pathname === item.href) return true;
  const prefixes = [item.href, ...(item.matchPrefixes ?? [])];
  return prefixes.some(
    (prefix) => prefix !== "/dashboard" && pathname.startsWith(prefix),
  );
}

// Cliente: máximo 5 ítems, solo los módulos activos de su empresa.
// SinexIA y Perfil viven en el encabezado / menú del avatar.
export const clientHomeNavItem: NavItem = {
  title: "Inicio",
  href: "/dashboard",
  icon: Home,
};

export const clientDocumentsNavItem: NavItem = {
  title: "Documentos",
  href: "/dashboard/inbox",
  icon: Folder,
  badgeKey: "inbox",
};

export const clientReportsNavItem: NavItem = {
  title: "Reportes",
  href: "/dashboard/reports",
  icon: BarChart3,
  badgeKey: "reports",
};

export const tresbePayrollNavItem: NavItem = {
  title: "Nóminas",
  href: "/dashboard/payroll",
  icon: Banknote,
};

export const clientInvoicesNavItem: NavItem = {
  title: "Facturas",
  href: "/dashboard/invoices",
  icon: Receipt,
};

export const CLIENT_NAV_MAX_ITEMS = 5;

/** Menú del cliente: solo los módulos activos de su empresa (máximo 5). */
export function getClientNavItems({
  companySlug,
  invoicesEnabled = false,
}: {
  companySlug?: string | null;
  invoicesEnabled?: boolean;
}): NavItem[] {
  return [
    clientHomeNavItem,
    clientDocumentsNavItem,
    clientReportsNavItem,
    ...(companySlug === "tresbe" ? [tresbePayrollNavItem] : []),
    ...(invoicesEnabled ? [clientInvoicesNavItem] : []),
  ];
}

// Admin: máximo 6 ítems. Nómina y Vacaciones y enfermedad viven dentro de la
// ficha de cada cliente.
export const adminNavItems: NavItem[] = [
  { title: "Inicio", href: "/dashboard", icon: Home },
  {
    title: "Clientes",
    href: "/dashboard/admin/companies",
    icon: Building2,
    matchPrefixes: ["/dashboard/payroll", "/dashboard/admin/leave-accrual"],
  },
  {
    title: "Facturación",
    href: "/dashboard/admin/invoices",
    icon: FileText,
    matchPrefixes: ["/dashboard/admin/settings/billing"],
  },
  {
    title: "Documentos",
    href: "/dashboard/inbox",
    icon: Folder,
    badgeKey: "inbox",
  },
  { title: "Reportes", href: "/dashboard/reports", icon: BarChart3 },
  { title: "Calendario", href: "/dashboard/calendar", icon: CalendarDays },
];
