import { PortalFooter } from "@/components/layout/portal-footer";
import { PortalHeader } from "@/components/layout/portal-header";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <PortalHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <PortalFooter />
    </div>
  );
}
