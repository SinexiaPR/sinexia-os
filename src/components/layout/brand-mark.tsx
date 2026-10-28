import Image from "next/image";

import { cn } from "@/lib/utils";

/** Logo de Sinexia (símbolo del infinito con flechas). Decorativo: el nombre va al lado. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo-sinexia.svg"
      alt=""
      width={96}
      height={96}
      priority
      className={cn("size-9 shrink-0 rounded-lg", className)}
    />
  );
}
