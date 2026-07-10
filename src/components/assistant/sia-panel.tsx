"use client";

import { useState, useTransition } from "react";

import { askSia } from "@/actions/assistant";
import { assistantConfig } from "@/config/assistant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { cn } from "@/lib/utils";

type ChatEntry = {
  role: "user" | "assistant";
  content: string;
  disclaimer?: string;
};

export function SiaPanel() {
  const [input, setInput] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isPending) return;

    setError(null);
    setInput("");
    setEntries((prev) => [...prev, { role: "user", content: trimmed }]);

    startTransition(async () => {
      const result = await askSia(trimmed);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.data) {
        setEntries((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.data.message,
            disclaimer: result.data.disclaimer,
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
          <p className="text-sm leading-relaxed text-muted-foreground">
            Asistente orientativo basado en la información de su portal: Inbox,
            documentos pendientes y reportes disponibles.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {assistantConfig.suggestedPrompts.map((prompt) => (
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
                    <p className="text-foreground">{entry.content}</p>
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
            placeholder="Pregunte sobre sus documentos o reportes…"
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
