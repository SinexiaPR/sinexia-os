"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  askSinexIA,
  getSinexIASuggestions,
} from "@/actions/sinexia-chat";
import { assistantConfig } from "@/config/assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

type ChatEntry = {
  role: "user" | "assistant";
  content: string;
  disclaimer?: string;
  sources?: Array<{
    reportId?: string;
    title: string;
    period: string | null;
    pageNumber?: number | null;
    sheetName?: string | null;
    downloadPath?: string;
  }>;
};

type FilterOption = {
  id: string;
  title: string;
  category: string;
  period: string;
};

type SinexIAPanelProps = {
  reports: FilterOption[];
};

export function SinexIAPanel({ reports }: SinexIAPanelProps) {
  const searchParams = useSearchParams();
  const initialReportId = searchParams.get("reportId") ?? "";

  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<string[]>([
    ...assistantConfig.suggestedPrompts,
  ]);
  const [reportId, setReportId] = useState(initialReportId);
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("");

  useEffect(() => {
    void getSinexIASuggestions().then((res) => {
      if (res.suggestions?.length) {
        setSuggestions(res.suggestions);
      }
    });
  }, []);

  const categories = useMemo(
    () => [...new Set(reports.map((r) => r.category))],
    [reports],
  );
  const periods = useMemo(
    () => [...new Set(reports.map((r) => r.period))],
    [reports],
  );

  function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isPending) return;

    setError(null);
    setInput("");
    setEntries((prev) => [...prev, { role: "user", content: trimmed }]);

    startTransition(async () => {
      const result = await askSinexIA({
        message: trimmed,
        reportId: reportId || null,
        category: category || null,
        period: period || null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.data) {
        setEntries((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.data!.message,
            disclaimer: result.data!.disclaimer,
            sources: result.data!.sources,
          },
        ]);
      }
    });
  }

  return (
    <div className="space-y-6">
      <SurfaceCard padding="lg" className="space-y-6">
        <div className="space-y-1">
          <p className="text-[13px] font-medium tracking-wide text-primary uppercase">
            {assistantConfig.name}
          </p>
          <p className="text-sm font-medium text-foreground">
            {assistantConfig.tagline}
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {assistantConfig.description}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            Documento
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
            >
              <option value="">Todos</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Categoría
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Periodo
            <select
              className="h-10 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="">Todos</option>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isPending}
              onClick={() => submitQuestion(prompt)}
              className="rounded-full border border-border/80 bg-background px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        {entries.length > 0 ? (
          <div className="space-y-5 border-t border-border/60 pt-6">
            {entries.map((entry, index) => (
              <div
                key={`${entry.role}-${index}`}
                className={cn(
                  "max-w-[92%] text-sm leading-relaxed",
                  entry.role === "user"
                    ? "ml-auto rounded-2xl bg-muted px-4 py-3 text-foreground"
                    : "space-y-3",
                )}
              >
                {entry.role === "assistant" ? (
                  <>
                    <p className="whitespace-pre-wrap text-foreground">
                      {entry.content}
                    </p>
                    {entry.sources?.length ? (
                      <div className="space-y-1 rounded-xl border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">Fuentes</p>
                        {entry.sources.map((source, i) => (
                          <div
                            key={`${source.reportId ?? source.title}-${i}`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span>
                              {source.title}
                              {source.period
                                ? ` · ${source.period}`
                                : ""}
                              {source.pageNumber != null
                                ? ` · pág. ${source.pageNumber}`
                                : ""}
                              {source.sheetName
                                ? ` · hoja ${source.sheetName}`
                                : ""}
                            </span>
                            {source.reportId ? (
                              <Link
                                href={`/api/reports/${source.reportId}/download`}
                                className="text-primary underline-offset-2 hover:underline"
                              >
                                Descargar
                              </Link>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {entry.disclaimer ? (
                      <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-relaxed text-amber-900">
                        {entry.disclaimer}
                      </p>
                    ) : null}
                  </>
                ) : (
                  entry.content
                )}
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitQuestion(input);
          }}
          className="flex gap-2 border-t border-border/60 pt-6"
        >
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask anything about your business…"
            disabled={isPending}
            className="h-11"
          />
          <Button type="submit" disabled={isPending || !input.trim()}>
            {isPending ? "…" : "Enviar"}
          </Button>
        </form>
      </SurfaceCard>
    </div>
  );
}

/** @deprecated */
export { SinexIAPanel as SiaPanel };
