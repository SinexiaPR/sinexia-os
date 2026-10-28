/** Enlace para saltar la navegación y llegar directo al contenido (teclado). */
export function SkipLink() {
  return (
    <a
      href="#contenido"
      className="bg-primary text-primary-foreground focus-visible:ring-ring sr-only z-[70] rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      Saltar al contenido
    </a>
  );
}
