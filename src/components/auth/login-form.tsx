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
      <div className="space-y-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Iniciar sesión</h1>
        <p className="text-muted-foreground text-sm">
          Accede a tu portal de Sinexia
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
            placeholder="tu@empresa.com"
            required
            disabled={isPending}
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
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        {isPending ? "Iniciando sesión…" : "Iniciar sesión"}
      </Button>
    </form>
  );
}
