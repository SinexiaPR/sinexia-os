"use client";

import { useRef } from "react";

import { signOut } from "@/actions/auth";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  variant?: "menu" | "button" | "sidebar";
  className?: string;
};

/**
 * Shared sign-out control for admin/client desktop and mobile.
 * Always submits the same server action via a form (never a plain link).
 */
export function SignOutButton({
  variant = "menu",
  className,
}: SignOutButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);

  if (variant === "menu") {
    return (
      <>
        <form ref={formRef} action={signOut} className="hidden" aria-hidden>
          <button type="submit" tabIndex={-1} />
        </form>
        <DropdownMenuItem
          variant="destructive"
          className={cn("cursor-pointer", className)}
          onSelect={(event) => {
            // Keep the menu from unmounting before the form posts the action.
            event.preventDefault();
            formRef.current?.requestSubmit();
          }}
        >
          Cerrar sesión
        </DropdownMenuItem>
      </>
    );
  }

  return (
    <form action={signOut} className={cn("w-full", className)}>
      <button
        type="submit"
        className={cn(
          "flex min-h-11 w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          variant === "sidebar"
            ? "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            : "text-destructive hover:bg-red-50",
        )}
      >
        Cerrar sesión
      </button>
    </form>
  );
}
