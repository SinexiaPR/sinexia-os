"use client";

import { useState, useTransition } from "react";

import { getSinexiaIntegrityReport } from "@/actions/integrity";
import type { IntegrityIssue } from "@/lib/intelligence/company-documents";
import { Button } from "@/components/ui/button";

export function AdminIntegrityCheck() {
  const [issues, setIssues] = useState<IntegrityIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Diagnóstico SinexIA
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verifica perfiles, company_id y procesamiento entre empresas.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await getSinexiaIntegrityReport();
              if (result.error) {
                setError(result.error);
                setIssues(null);
                return;
              }
              setIssues(result.issues);
            });
          }}
        >
          {isPending ? "Verificando…" : "Ejecutar verificación"}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {issues ? (
        issues.length ? (
          <ul className="space-y-2 text-sm">
            {issues.map((issue, index) => (
              <li
                key={`${issue.kind}-${issue.entityId ?? index}`}
                className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-950"
              >
                <span className="font-medium">{issue.kind}</span>
                {": "}
                {issue.detail}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-emerald-700">
            No se encontraron problemas de integridad.
          </p>
        )
      ) : null}
    </div>
  );
}
