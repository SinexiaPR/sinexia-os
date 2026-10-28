"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  askSinexIA,
  getSinexIASuggestions,
  getSinexIADocumentHistory,
} from "@/actions/sinexia-chat";
import { Sparkles, SlidersHorizontal } from "lucide-react";

import { assistantConfig } from "@/config/assistant";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FilterPanel } from "@/components/ui/filter-panel";
import { getReportCategoryMeta } from "@/lib/constants/reports";
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

type HistoryEntry = {
  id: string;
  title: string;
  documentType: string | null;
  period: string | null;
  summary: string | null;
  reportId: string | null;
  uploadDate: string | null;
};

type SinexIAPanelProps = {
  reports: FilterOption[];
};

export function SinexIAPanel({ reports }: SinexIAPanelProps) {
  const searchParams = useSearchParams();
  const initialReportId = searchParams.get("reportId") ?? "";
  const initialQuestion = searchParams.get("q") ?? "";

  const [input, setInput] = useState(initialQuestion);
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [suggestions, setSuggestions] = useState<string[]>([
    ...assistantConfig.suggestedPrompts,
  ]);
  const [reportId, setReportId] = useState(initialReportId);
  const [category, setCategory] = useState("");
  const [period, setPeriod] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [autoAsked, setAutoAsked] = useState(false);

  useEffect(() => {
    void getSinexIASuggestions().then((res) => {
      if (res.suggestions?.length) {
        setSuggestions(res.suggestions);
      }
    });
    void getSinexIADocumentHistory().then((res) => {
      if (res.history?.length) {
        setHistory(res.history);
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

  useEffect(() => {
    if (autoAsked || !initialQuestion.trim()) return;
    setAutoAsked(true);
    submitQuestion(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ask once from deep link
  }, [initialQuestion, autoAsked]);

  const activeFilters = [reportId, category, period].filter(Boolean).length;
  const selectClass =
    "h-11 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPanel
          title="Filtros"
          align="start"
          trigger={
            <Button variant="outline" className="h-10">
              <SlidersHorizontal className="size-4" />
              Filtros
              {activeFilters > 0 ? (
                <span className="bg-primary text-primary-foreground ml-1 flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums">
                  {activeFilters}
                </span>
              ) : null}
            </Button>
          }
        >
          <p className="text-muted-foreground text-sm">
            Limite las respuestas a un documento, categoría o periodo.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="sia-documento" className="text-sm font-medium">
              Documento
            </label>
            <select
              id="sia-documento"
              className={selectClass}
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
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sia-categoria" className="text-sm font-medium">
              Categoría
            </label>
            <select
              id="sia-categoria"
              className={selectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {getReportCategoryMeta(c)?.clientLabel ?? c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sia-periodo" className="text-sm font-medium">
              Periodo
            </label>
            <select
              id="sia-periodo"
              className={selectClass}
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
          </div>
          {activeFilters > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setReportId("");
                setCategory("");
                setPeriod("");
              }}
            >
              Limpiar filtros
            </Button>
          ) : null}
        </FilterPanel>
        {activeFilters > 0 ? (
          <p className="text-muted-foreground text-sm">
            Las respuestas se limitan a la selección.
          </p>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <SurfaceCard padding="md" className="space-y-3">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Sparkles aria-hidden className="text-primary size-4" />
            Preguntas para empezar
          </h2>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isPending}
                onClick={() => submitQuestion(prompt)}
                className="border-border/80 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground focus-visible:ring-ring min-h-11 rounded-full border px-4 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </SurfaceCard>
      ) : (
        <SurfaceCard padding="md" className="space-y-5">
          <div role="log" aria-live="polite" className="space-y-5">
            {entries.map((entry, index) => (
              <div
                key={`${entry.role}-${index}`}
                className={cn(
                  "max-w-[92%] text-sm leading-relaxed",
                  entry.role === "user"
                    ? "bg-muted text-foreground ml-auto rounded-lg px-4 py-3"
                    : "space-y-3",
                )}
              >
                {entry.role === "assistant" ? (
                  <>
                    <p className="text-foreground whitespace-pre-wrap">
                      {entry.content}
                    </p>
                    {entry.sources?.length ? (
                      <div className="border-border/70 bg-muted/40 text-muted-foreground space-y-1 rounded-md border px-3 py-2 text-xs">
                        <p className="text-foreground font-medium">Fuentes</p>
                        {entry.sources.map((source, i) => (
                          <div
                            key={`${source.reportId ?? source.title}-${i}`}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <span>
                              {source.title}
                              {source.period ? ` · ${source.period}` : ""}
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
                      <p className="border-warning/30 bg-warning-soft text-warning rounded-md border px-3 py-2 text-xs leading-relaxed">
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
          {isPending ? (
            <p className="text-muted-foreground text-sm" role="status">
              SinexIA está respondiendo…
            </p>
          ) : null}
          <div className="border-border/60 border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Otras preguntas
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.slice(0, 4).map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isPending}
                  onClick={() => submitQuestion(prompt)}
                  className="border-border/80 bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground focus-visible:ring-ring min-h-10 rounded-full border px-3 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </SurfaceCard>
      )}

      {history.length > 0 ? (
        <SurfaceCard padding="sm" className="p-0">
          <Accordion type="single" collapsible>
            <AccordionItem value="historial" className="border-b-0">
              <AccordionTrigger>
                <span className="flex-1">
                  Documentos analizados recientes ({history.length})
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {history.map((item) => (
                    <li
                      key={item.id}
                      className="border-border/70 bg-muted/30 rounded-lg border px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-foreground font-medium">
                          {item.title}
                        </span>
                        {item.period ? (
                          <span className="text-muted-foreground text-xs">
                            {item.period}
                          </span>
                        ) : null}
                      </div>
                      {item.summary ? (
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                          {item.summary}
                        </p>
                      ) : null}
                      {item.reportId ? (
                        <button
                          type="button"
                          className="text-primary mt-2 inline-flex min-h-10 items-center text-sm hover:underline"
                          onClick={() => {
                            setReportId(item.reportId!);
                            if (item.period) setPeriod(item.period);
                          }}
                        >
                          Preguntar sobre este documento
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </SurfaceCard>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="bg-danger-soft text-danger rounded-md px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submitQuestion(input);
        }}
        className="bg-background/95 sticky bottom-16 z-20 -mx-4 flex gap-2 border-t px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:bottom-0"
      >
        <label htmlFor="sia-pregunta" className="sr-only">
          Su pregunta
        </label>
        <Input
          id="sia-pregunta"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Escriba su pregunta…"
          disabled={isPending}
          className="h-11"
        />
        <Button
          type="submit"
          className="h-11 px-5"
          disabled={isPending || !input.trim()}
        >
          {isPending ? "…" : "Enviar"}
        </Button>
      </form>
    </div>
  );
}

/** @deprecated */
export { SinexIAPanel as SiaPanel };
