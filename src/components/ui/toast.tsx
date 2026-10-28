"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "danger" | "info";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Milisegundos antes de desaparecer; 0 = permanece hasta cerrarlo. */
  duration?: number;
};

type ToastItem = Required<Pick<ToastInput, "title" | "tone">> &
  Pick<ToastInput, "description"> & { id: number };

const toneStyles: Record<ToastTone, string> = {
  success: "border-success/30 bg-success-soft text-success",
  danger: "border-danger/30 bg-danger-soft text-danger",
  info: "border-info/30 bg-info-soft text-info",
};
const toneIcon = {
  success: CheckCircle2,
  danger: TriangleAlert,
  info: Info,
} as const;

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

/** Muestra una notificación breve. Debe usarse dentro de `ToastProvider`. */
export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast requiere ToastProvider");
  return toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  // La región se monta en <body> después de hidratar, para no desajustar el
  // HTML del servidor (Next inserta sus scripts justo después de los hijos).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, tone = "info", duration = 5000 }: ToastInput) => {
      const id = nextId.current++;
      setItems((current) => [
        ...current.slice(-3),
        { id, title, description, tone },
      ]);
      if (duration > 0) window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted
        ? createPortal(
            <div
              role="region"
              aria-label="Notificaciones"
              className="pointer-events-none fixed top-4 right-4 left-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
            >
              {items.map((item) => {
                const Icon = toneIcon[item.tone];
                return (
                  <div
                    key={item.id}
                    role={item.tone === "danger" ? "alert" : "status"}
                    className={cn(
                      "pointer-events-auto flex w-full items-start gap-3 rounded-lg border px-4 py-3 shadow-[var(--shadow-popover)]",
                      toneStyles[item.tone],
                    )}
                  >
                    <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">{item.title}</p>
                      {item.description ? (
                        <p className="mt-0.5 opacity-90">{item.description}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => dismiss(item.id)}
                      aria-label="Cerrar notificación"
                      className="focus-visible:ring-ring -m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
