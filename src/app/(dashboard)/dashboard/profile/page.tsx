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
  title: "Mi cuenta",
};

export default async function ProfilePage() {
  const profile = await requireAuth();

  const company =
    profile.company_id != null
      ? await getCompanyById(profile.company_id)
      : null;

  const isClient = profile.role === "client";

  return (
    <div className={isClient ? "space-y-8 sm:space-y-10" : "space-y-10"}>
      {isClient ? (
        <header className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Mi cuenta
          </h1>
          <p className="text-[15px] text-muted-foreground sm:text-base">
            Su cuenta, empresa y contacto con Sinexia.
          </p>
        </header>
      ) : (
        <PageHeader
          eyebrow="Administración"
          title="Mi cuenta"
          description="Datos de su cuenta de administrador."
        />
      )}

      <div
        className={`grid gap-6 ${isClient ? "max-w-xl" : "lg:grid-cols-2"}`}
      >
        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            Información personal
          </h2>
          <form action={updateProfile} className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile.full_name ?? ""}
                placeholder="Su nombre"
                className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                name="email"
                value={profile.email}
                disabled
                readOnly
                className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
              />
            </div>

            <Button type="submit" className="h-11 rounded-xl">
              Guardar cambios
            </Button>
          </form>
        </SurfaceCard>

        <SurfaceCard padding="lg">
          <h2 className="text-base font-semibold tracking-tight">
            {isClient ? "Empresa" : "Espacio de trabajo"}
          </h2>
          <dl className="mt-6 space-y-5">
            {!isClient ? (
              <div>
                <dt className="text-sm text-muted-foreground">Rol</dt>
                <dd className="mt-1 font-medium">Administrador</dd>
              </div>
            ) : null}
            {company ? (
              <div>
                <dt className="text-sm text-muted-foreground">Empresa</dt>
                <dd className="mt-1 font-medium">{company.name}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-muted-foreground">
                {isClient ? "Cliente desde" : "Miembro desde"}
              </dt>
              <dd className="mt-1 font-medium">
                {new Intl.DateTimeFormat("es", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(profile.created_at))}
              </dd>
            </div>
          </dl>
        </SurfaceCard>

        <ContactSinexiaCard className={isClient ? undefined : "lg:col-span-2"} />
      </div>
    </div>
  );
}
