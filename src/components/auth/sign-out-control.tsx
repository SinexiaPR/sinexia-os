"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signOutSession } from "@/actions/auth";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type SignOutControlProps = {
  variant?: "menu" | "nav" | "button";
  className?: string;
  onSignedOut?: () => void;
};

export function SignOutControl({
  variant = "menu",
  className,
  onSignedOut,
}: SignOutControlProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    if (status === "loading") return;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "global" });

      const result = await signOutSession();
      if (result.error) {
        setStatus("error");
        setErrorMessage(result.error);
        return;
      }

      onSignedOut?.();
      router.refresh();
      window.location.replace("/login");
    } catch {
      setStatus("error");
      setErrorMessage("No se pudo cerrar sesión. Intente de nuevo.");
    }
  }

  const label =
    status === "loading" ? "Cerrando sesión…" : "Cerrar sesión";

  if (variant === "nav") {
    return (
      <div className={cn("space-y-1", className)}>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={status === "loading"}
          className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
        >
          {label}
        </button>
        {errorMessage ? (
          <p className="px-3 text-xs text-destructive">{errorMessage}</p>
        ) : null}
      </div>
    );
  }

  if (variant === "button") {
    return (
      <div className={cn("space-y-2", className)}>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={status === "loading"}
          className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
        >
          {label}
        </button>
        {errorMessage ? (
          <p className="text-sm text-destructive">{errorMessage}</p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <DropdownMenuItem
        variant="destructive"
        disabled={status === "loading"}
        onSelect={(event) => {
          event.preventDefault();
          void handleSignOut();
        }}
      >
        {label}
      </DropdownMenuItem>
      {errorMessage ? (
        <p className={cn("px-2 py-1 text-xs text-destructive", className)}>
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}
