import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Banknote,
  CalendarClock,
  CalendarDays,
  FileText,
  Inbox,
  LayoutDashboard,
  Sparkles,
  User,
} from "lucide-react";

export type NavBadgeKey = "inbox" | "reports";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: NavBadgeKey;
};

export const clientNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    title: "Inbox",
    href: "/dashboard/inbox",
    icon: Inbox,
    badgeKey: "inbox",
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    badgeKey: "reports",
  },
  { title: "SinexIA", href: "/dashboard/sia", icon: Sparkles },
  { title: "Profile", href: "/dashboard/profile", icon: User },
];

export const tresbePayrollNavItem: NavItem = {
  title: "Nóminas",
  href: "/dashboard/payroll",
  icon: Banknote,
};

export const clientInvoicesNavItem: NavItem = {
  title: "Facturas",
  href: "/dashboard/invoices",
  icon: FileText,
};

export const adminNavItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Calendario", href: "/dashboard/calendar", icon: CalendarDays },
  {
    title: "Facturación",
    href: "/dashboard/admin/invoices",
    icon: FileText,
  },
  {
    title: "Vacaciones y enfermedad",
    href: "/dashboard/admin/leave-accrual",
    icon: CalendarClock,
  },
  {
    title: "Inbox",
    href: "/dashboard/inbox",
    icon: Inbox,
    badgeKey: "inbox",
  },
  { title: "Reports", href: "/dashboard/reports", icon: BarChart3 },
  { title: "Profile", href: "/dashboard/profile", icon: User },
];

export function getPageTitle(pathname: string, items: NavItem[]): string {
  const match = items.find(
    (item) =>
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href)),
  );

  return match?.title ?? "Dashboard";
}
