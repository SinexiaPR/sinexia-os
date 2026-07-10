import type { Metadata } from "next";

import { ContactSinexiaCard } from "@/components/contact/contact-sinexia-card";
import { updateProfile } from "@/actions/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SurfaceCard } from "@/components/ui/surface-card";
import { requireAuth } from "@/lib/auth/session";
import { getCompanyById } from "@/services/documents";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const profile = await requireAuth();

  const company =
    profile.company_id != null
      ? await getCompanyById(profile.company_id)
      : null;

  const isClient = profile.role === "client";

  return (
    <div className={isClient ? "space-y-10" : "space-y-12"}>
      {isClient ? (
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Perfil</h1>
          <p className="text-base text-muted-foreground">
            Su cuenta, empresa y contacto con Sinexia.
          </p>
        </header>
      ) : (
        <PageHeader
          eyebrow="Admin workspace"
          title="Profile"
          description="Your account details."
        />
      )}

      <div
        className={`grid gap-6 ${isClient ? "max-w-xl" : "lg:grid-cols-2"}`}
      >
        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            {isClient ? "Información personal" : "Personal information"}
          </h2>
          <form action={updateProfile} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full_name">
                {isClient ? "Nombre completo" : "Full name"}
              </Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile.full_name ?? ""}
                placeholder={isClient ? "Su nombre" : "Your name"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                value={profile.email}
                disabled
                readOnly
              />
            </div>

            <Button type="submit">
              {isClient ? "Guardar cambios" : "Save changes"}
            </Button>
          </form>
        </SurfaceCard>

        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            {isClient ? "Empresa" : "Workspace"}
          </h2>
          <dl className="mt-6 space-y-5">
            {!isClient ? (
              <div>
                <dt className="text-sm text-muted-foreground">Role</dt>
                <dd className="mt-1 font-medium capitalize">{profile.role}</dd>
              </div>
            ) : null}
            {company ? (
              <div>
                <dt className="text-sm text-muted-foreground">
                  {isClient ? "Empresa" : "Company"}
                </dt>
                <dd className="mt-1 font-medium">{company.name}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-muted-foreground">
                {isClient ? "Cliente desde" : "Member since"}
              </dt>
              <dd className="mt-1 font-medium">
                {new Intl.DateTimeFormat(isClient ? "es" : "en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(profile.created_at))}
              </dd>
            </div>
          </dl>
        </SurfaceCard>

        {isClient ? <ContactSinexiaCard /> : null}
      </div>
    </div>
  );
}
