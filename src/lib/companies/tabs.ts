export type CompanyTabId =
  | "resumen"
  | "facturas"
  | "nomina"
  | "presupuesto"
  | "informes"
  | "documentos"
  | "reportes"
  | "actividad";

export type CompanyTab = {
  id: CompanyTabId;
  label: string;
  href: string;
};

type CompanyRef = { id: string; slug: string };

/**
 * Pestañas de la ficha de una empresa. Solo aparecen las de módulos activos:
 * Nómina, Presupuesto e Informes dependen de la empresa; el resto es común.
 */
export function getCompanyTabs({ id, slug }: CompanyRef): CompanyTab[] {
  const base = `/dashboard/admin/companies/${id}`;
  const tabs: CompanyTab[] = [
    { id: "resumen", label: "Resumen", href: base },
    { id: "facturas", label: "Facturas", href: `${base}/invoices` },
  ];

  if (slug === "tresbe") {
    tabs.push({ id: "nomina", label: "Nómina", href: `${base}/payroll` });
    tabs.push({
      id: "presupuesto",
      label: "Presupuesto",
      href: `${base}/budget`,
    });
  } else if (slug === "sibarita") {
    tabs.push({
      id: "nomina",
      label: "Nómina",
      href: `/dashboard/payroll?company=${id}`,
    });
  } else if (slug === "cut") {
    tabs.push({ id: "nomina", label: "Nómina", href: `${base}/nomina` });
  } else if (slug === "cut-meat-distributors") {
    tabs.push({ id: "informes", label: "Informes", href: `${base}/informes` });
  }

  tabs.push(
    { id: "documentos", label: "Documentos", href: `${base}/documentos` },
    { id: "reportes", label: "Reportes", href: `${base}/reportes` },
    { id: "actividad", label: "Actividad", href: `${base}?tab=actividad` },
  );
  return tabs;
}

// Subrutas de Cut Meat que cuelgan de la pestaña Informes.
const INFORMES_SUBROUTES = [
  "informes",
  "daily-reports",
  "historial-diario",
  "recurrentes",
  "paquete-dueno",
];

/**
 * Pestaña activa según la ruta y el parámetro `tab`. Las categorías operativas
 * (`/[category]`) y la ficha sin parámetro cuentan como Resumen.
 */
export function getActiveCompanyTab(
  company: CompanyRef,
  pathname: string,
  tabParam: string | null,
): CompanyTabId {
  if (pathname.startsWith("/dashboard/payroll")) return "nomina";
  const base = `/dashboard/admin/companies/${company.id}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";
  const segment = rest.split("/").filter(Boolean)[0];

  if (!segment) return tabParam === "actividad" ? "actividad" : "resumen";
  if (segment === "invoices") return "facturas";
  if (segment === "payroll" || segment === "nomina") return "nomina";
  if (segment === "budget") return "presupuesto";
  if (segment === "documentos") return "documentos";
  if (segment === "reportes") return "reportes";
  if (INFORMES_SUBROUTES.includes(segment)) return "informes";
  return "resumen";
}
