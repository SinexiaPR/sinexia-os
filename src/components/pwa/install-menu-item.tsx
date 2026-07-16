"use client";

import { DownloadIcon } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useInstallPrompt } from "@/hooks/use-install-prompt";

export function InstallMenuItem() {
  const { canInstall, promptInstall } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <DropdownMenuItem onSelect={() => void promptInstall()}>
      <DownloadIcon />
      Instalar aplicación
    </DropdownMenuItem>
  );
}
