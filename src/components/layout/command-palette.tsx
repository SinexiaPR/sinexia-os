"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  FileText,
  Folder,
  Plus,
  Search,
  Settings,
  User,
  type LucideIcon,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { searchWorkspace, type SearchResult } from "@/actions/search";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminNavItems } from "@/config/navigation";
import { cn } from "@/lib/utils";

type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  href: string;
  icon: LucideIcon;
  group: string;
};

const quickActions: PaletteItem[] = [
  {
    id: "action-new-invoice",
    label: "Nueva factura",
    href: "/dashboard/admin/invoices/new",
    icon: Plus,
    group: "Acciones",
  },
  {
    id: "action-weekly-batch",
    label: "Generar facturas de la semana",
    href: "/dashboard/admin/invoices/batch",
    icon: FileText,
    group: "Acciones",
  },
  {
    id: "action-billing-clients",
    label: "Clientes facturables",
    href: "/dashboard/admin/invoices/billing-clients",
    icon: Building2,
    group: "Acciones",
  },
  {
    id: "action-billing-settings",
    label: "Configuración de facturación",
    href: "/dashboard/admin/settings/billing",
    icon: Settings,
    group: "Acciones",
  },
  {
    id: "action-profile",
    label: "Mi perfil",
    href: "/dashboard/profile",
    icon: User,
    group: "Acciones",
  },
];

const pageItems: PaletteItem[] = adminNavItems.map((item) => ({
  id: `page-${item.href}`,
  label: item.title,
  hint: "Ir a la sección",
  href: item.href,
  icon: item.icon,
  group: "Secciones",
}));

const resultIcon: Record<SearchResult["kind"], LucideIcon> = {
  client: Building2,
  invoice: FileText,
  document: Folder,
};

const resultGroup: Record<SearchResult["kind"], string> = {
  client: "Clientes",
  invoice: "Facturas",
  document: "Documentos",
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type PaletteContextValue = { open: () => void };

const PaletteContext = createContext<PaletteContextValue | null>(null);

/** Abre la paleta desde cualquier botón del encabezado. */
export function useCommandPalette() {
  return useContext(PaletteContext);
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const requestId = useRef(0);
  const listId = useId();

  const openPalette = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Búsqueda remota con retardo; se descartan respuestas de consultas viejas.
  useEffect(() => {
    const term = query.trim();
    if (!open || term.length < 2) {
      requestId.current += 1;
      setRemote([]);
      setSearching(false);
      return;
    }
    const current = ++requestId.current;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const { results } = await searchWorkspace(term);
        if (current === requestId.current) setRemote(results);
      } catch {
        if (current === requestId.current) setRemote([]);
      } finally {
        if (current === requestId.current) setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  const items = useMemo<PaletteItem[]>(() => {
    const term = normalize(query.trim());
    const local = [...pageItems, ...quickActions].filter(
      (item) => !term || normalize(item.label).includes(term),
    );
    const found = remote.map<PaletteItem>((result) => ({
      id: result.id,
      label: result.title,
      hint: result.subtitle,
      href: result.href,
      icon: resultIcon[result.kind],
      group: resultGroup[result.kind],
    }));
    return [...found, ...local];
  }, [query, remote]);

  useEffect(() => {
    setActive(0);
  }, [items.length, query]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setRemote([]);
    }
  }

  function go(item: PaletteItem) {
    handleOpenChange(false);
    router.push(item.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (items.length ? (index + 1) % items.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) =>
        items.length ? (index - 1 + items.length) % items.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = items[active];
      if (item) go(item);
    }
  }

  useEffect(() => {
    document
      .getElementById(`${listId}-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const value = useMemo(() => ({ open: openPalette }), [openPalette]);
  let lastGroup = "";

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showClose={false}
          className="top-[15%] max-w-xl translate-y-0 gap-0 p-0"
        >
          <DialogTitle className="sr-only">Buscar</DialogTitle>
          <DialogDescription className="sr-only">
            Busca clientes, facturas y documentos, o salta a una sección.
          </DialogDescription>
          <div className="border-border flex items-center gap-2 border-b px-4">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Buscar clientes, facturas, documentos…"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={
                items[active] ? `${listId}-${active}` : undefined
              }
              aria-label="Buscar"
              className="placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
            />
            <kbd className="text-muted-foreground hidden rounded border px-1.5 py-0.5 text-[10px] sm:block">
              Esc
            </kbd>
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label="Resultados"
            className="max-h-[min(24rem,60svh)] overflow-y-auto p-2"
          >
            {items.map((item, index) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <li key={item.id} role="presentation">
                  {showGroup ? (
                    <p className="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide uppercase">
                      {item.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseMove={() => setActive(index)}
                    onClick={() => go(item)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                      index === active && "bg-accent",
                    )}
                  >
                    <Icon className="text-muted-foreground size-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {item.label}
                      </span>
                      {item.hint ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {item.hint}
                        </span>
                      ) : null}
                    </span>
                    {index === active ? (
                      <ArrowRight className="text-muted-foreground size-3.5" />
                    ) : null}
                  </button>
                </li>
              );
            })}
            {!items.length ? (
              <li
                role="presentation"
                className="text-muted-foreground px-2 py-8 text-center text-sm"
              >
                {searching ? "Buscando…" : "Sin resultados para esa búsqueda."}
              </li>
            ) : null}
          </ul>
          <div className="text-muted-foreground border-border flex items-center justify-between border-t px-4 py-2 text-[11px]">
            <span>
              {searching ? "Buscando…" : "↑↓ para moverte · Enter para abrir"}
            </span>
            <span>Ctrl/⌘ + K</span>
          </div>
        </DialogContent>
      </Dialog>
    </PaletteContext.Provider>
  );
}

/** Botón del encabezado que abre la paleta. */
export function CommandPaletteTrigger({ className }: { className?: string }) {
  const palette = useCommandPalette();
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => palette?.open()}
      aria-label="Buscar (Ctrl o Cmd + K)"
      className={cn(
        "text-muted-foreground h-10 justify-start gap-2 font-normal md:w-64",
        className,
      )}
    >
      <Search className="size-4" />
      <span className="hidden flex-1 text-left md:inline">Buscar…</span>
      <kbd className="hidden rounded border px-1.5 py-0.5 text-[10px] md:inline">
        Ctrl K
      </kbd>
    </Button>
  );
}
