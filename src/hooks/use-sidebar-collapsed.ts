"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "sinexia:sidebar-collapsed";
const CHANGE_EVENT = "sinexia:sidebar-collapsed-change";

// Respaldo en memoria para navegadores sin `localStorage` (modo privado).
let memoryValue: boolean | null = null;

function readStored(): boolean {
  if (memoryValue !== null) return memoryValue;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  const onStorage = () => {
    memoryValue = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Estado del sidebar colapsable, persistido en `localStorage`. */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, readStored, () => false);

  const setCollapsed = useCallback((next: boolean) => {
    memoryValue = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Sin almacenamiento disponible: el estado vive solo en esta sesión.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return [collapsed, setCollapsed] as const;
}
