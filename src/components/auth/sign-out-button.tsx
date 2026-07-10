"use client";

import { signOut } from "@/actions/auth";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SignOutButtonProps = {
  variant?: "menu" | "button" | "sidebar";
  className?: string;
};

export function SignOutButton({
  variant = "menu",
  className,
}: SignOutButtonProps) {
  if (variant === "menu") {
    return (
      <DropdownMenuItem asChild>
        <form action={signOut} className="w-full">
          <button
            type="submit"
            className={cn(
              "w-full cursor-default text-left text-destructive",
              className,
            )}
          >
            Cerrar sesión
          </button>
        </form>
      </DropdownMenuItem>
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
