import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { sinexiaContact } from "@/config/contact";
import { siteConfig } from "@/config/site";

export function ContactSinexiaCard() {
  return (
    <SurfaceCard padding="lg" className="max-w-xl">
      <h2 className="text-base font-semibold tracking-tight">
        Contactar a Sinexia
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        ¿Tiene preguntas sobre sus documentos o reportes? Escríbanos por
        WhatsApp o visite nuestro sitio web.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button asChild className="h-11 gap-2">
          <Link
            href={sinexiaContact.whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle className="size-4" />
            WhatsApp
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-11">
          <Link
            href={siteConfig.companyUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visitar sinexiapr.com
          </Link>
        </Button>
      </div>
    </SurfaceCard>
  );
}
