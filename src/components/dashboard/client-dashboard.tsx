import { ClientHomeView } from "@/components/dashboard/client-home-view";
import { getClientDashboardData } from "@/services/client-dashboard";
import { getCompanyById } from "@/services/documents";
import type { Profile } from "@/types";

type ClientDashboardProps = {
  profile: Profile;
};

export async function ClientDashboard({ profile }: ClientDashboardProps) {
  if (!profile.company_id) {
    return (
      <div className="space-y-2 py-12">
        <h1 className="text-xl font-semibold tracking-tight">Inicio</h1>
        <p className="text-muted-foreground">
          Su cuenta no está vinculada a una empresa. Contacte a Sinexia.
        </p>
      </div>
    );
  }

  const [{ stats, activity }, company] = await Promise.all([
    getClientDashboardData(profile.company_id),
    getCompanyById(profile.company_id),
  ]);

  return (
    <ClientHomeView
      firstName={profile.full_name?.split(" ")[0] ?? "cliente"}
      companyName={company?.name ?? "Su empresa"}
      stats={stats}
      activity={activity}
    />
  );
}
