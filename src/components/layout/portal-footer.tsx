import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type PortalFooterProps = {
  className?: string;
};

export function PortalFooter({ className }: PortalFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("w-full", className)}>
      <div className="text-muted-foreground mx-auto flex max-w-5xl flex-col items-center gap-1 px-6 py-8 text-center text-xs">
        <p>
          © {year} {siteConfig.firmName}. Todos los derechos reservados.
        </p>
        <p>Acceso seguro para clientes autorizados.</p>
      </div>
    </footer>
  );
}
