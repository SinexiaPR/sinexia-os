export const siteConfig = {
  name: "SINEXIA",
  description:
    "Portal de clientes para cargar documentos, consultar reportes y comunicarse con Sinexia.",
  portalTitle: "Portal de Clientes",
  portalSubtitle:
    "Acceda para cargar documentos, consultar reportes y seguir el estado de su empresa.",
  companyUrl:
    process.env.NEXT_PUBLIC_SINEXIA_URL ?? "https://www.sinexiapr.com",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;
