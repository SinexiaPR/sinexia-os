import type { ReactNode } from "react";

import { PortalFooter } from "@/components/layout/portal-footer";
import { PortalHeader } from "@/components/layout/portal-header";

type PortalShellProps = {
  children: ReactNode;
};

export function PortalShell({ children }: PortalShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-white">
      <PortalHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <PortalFooter />
    </div>
  );
}
