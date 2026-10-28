"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  options: ComboboxOption[];
  /** Valor inicial (modo no controlado). */
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  /** Con `name`, el valor viaja en formularios nativos (GET/POST). */
  name?: string;
  /** Texto de la opción vacía ("Todas las empresas"). Si falta, no hay opción vacía. */
  allLabel?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  "aria-label": string;
  className?: string;
};

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Selector con búsqueda (por ejemplo, de empresa). Accesible por teclado. */
export function Combobox({
  options,
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  name,
  allLabel,
  placeholder = "Seleccionar…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Sin resultados.",
  "aria-label": ariaLabel,
  className,
}: ComboboxProps) {
  const [internal, setInternal] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const value = controlledValue ?? internal;

  const all = useMemo<ComboboxOption[]>(
    () => (allLabel ? [{ value: "", label: allLabel }, ...options] : options),
    [allLabel, options],
  );
  const visible = useMemo(() => {
    const term = normalize(query.trim());
    return all.filter(
      (option) => !term || normalize(option.label).includes(term),
    );
  }, [all, query]);

  const selected = all.find((option) => option.value === value);

  function select(next: string) {
    if (controlledValue === undefined) setInternal(next);
    onValueChange?.(next);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = visible[active];
      if (option) select(option.value);
    }
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
          setActive(0);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={ariaLabel}
            className={cn(
              "h-10 w-full justify-between font-normal",
              !selected && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-56 p-0">
          <div className="border-border flex items-center gap-2 border-b px-3">
            <Search aria-hidden className="text-muted-foreground size-4" />
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-controls={listId}
              aria-activedescendant={
                visible[active] ? `${listId}-${active}` : undefined
              }
              className="h-10 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-60 overflow-y-auto p-1"
          >
            {visible.map((option, index) => (
              <li
                key={option.value || "__all"}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                onMouseMove={() => setActive(index)}
                onClick={() => select(option.value)}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm",
                  index === active && "bg-accent",
                )}
              >
                <Check
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    option.value === value ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className="truncate">{option.label}</span>
              </li>
            ))}
            {!visible.length ? (
              <li
                role="presentation"
                className="text-muted-foreground px-2 py-6 text-center text-sm"
              >
                {emptyMessage}
              </li>
            ) : null}
          </ul>
        </PopoverContent>
      </Popover>
    </>
  );
}
