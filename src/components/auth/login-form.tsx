"use client";

import { useActionState } from "react";

import { signIn } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState = { error: "" };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await signIn(formData);
      return result ?? initialState;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2 text-center sm:text-left">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Iniciar sesión
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Acceda al portal de clientes de Sinexia
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="usted@empresa.com"
            required
            disabled={isPending}
            className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            disabled={isPending}
            className="h-12 rounded-xl text-base sm:h-11 sm:text-sm"
          />
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="h-12 w-full rounded-xl text-[15px] font-semibold"
        size="lg"
        disabled={isPending}
      >
        {isPending ? "Ingresando…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
