"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signOut, type SignOutState } from "@/actions/auth";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const initialState: SignOutState = { error: null };

type SignOutControlProps = {
  variant?: "menu" | "nav" | "button";
  className?: string;
};

function SignOutSubmitButton({
  className,
  disabled,
}: {
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const label = pending ? "Cerrando sesión…" : "Cerrar sesión";

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={className}
    >
      {label}
    </button>
  );
}

function SignOutError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export function SignOutControl({
  variant = "menu",
  className,
}: SignOutControlProps) {
  const [state, formAction] = useActionState(signOut, initialState);

  if (variant === "nav") {
    return (
      <div className={cn("space-y-1", className)}>
        <form action={formAction}>
          <SignOutSubmitButton className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60" />
        </form>
        <SignOutError message={state.error} />
      </div>
    );
  }

  if (variant === "button") {
    return (
      <div className={cn("space-y-2", className)}>
        <form action={formAction}>
          <SignOutSubmitButton className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border px-5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60 sm:w-auto" />
        </form>
        {state.error ? (
          <p className="text-sm text-destructive">{state.error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <DropdownMenuItem asChild variant="destructive">
        <form action={formAction} className="w-full">
          <SignOutSubmitButton className="w-full cursor-default text-left text-sm text-destructive disabled:opacity-60" />
        </form>
      </DropdownMenuItem>
      {state.error ? (
        <p className={cn("px-2 py-1 text-xs text-destructive", className)}>
          {state.error}
        </p>
      ) : null}
    </>
  );
}
