import type { Metadata } from "next";

import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import { requireAuth } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Inicio",
};

export default async function DashboardPage() {
  const profile = await requireAuth();

  if (profile.role === "admin") {
    return <AdminDashboard />;
  }

  return <ClientDashboard profile={profile} />;
}
