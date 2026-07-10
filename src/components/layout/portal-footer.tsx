import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type PortalFooterProps = {
  className?: string;
};

export function PortalFooter({ className }: PortalFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("w-full", className)}>
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-6 py-8 text-center">
        <p className="text-xs text-muted-foreground">
          © {year} {siteConfig.name}. Todos los derechos reservados.
        </p>
        <p className="text-xs text-muted-foreground/80">
          Acceso seguro para clientes autorizados.
        </p>
      </div>
    </footer>
  );
}
