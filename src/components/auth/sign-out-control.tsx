"use client";

import { useState } from "react";

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
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSignOut() {
    if (status === "loading") return;

    setStatus("loading");
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setStatus("error");
        setErrorMessage("No se pudo cerrar sesión. Intente de nuevo.");
        return;
      }

      onSignedOut?.();
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
          onClick={handleSignOut}
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
          onClick={handleSignOut}
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
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={status === "loading"}
        className="w-full cursor-default text-left text-sm text-destructive disabled:opacity-60"
      >
        {label}
      </button>
      {errorMessage ? (
        <p className="mt-1 text-xs text-destructive">{errorMessage}</p>
      ) : null}
    </div>
  );
}
