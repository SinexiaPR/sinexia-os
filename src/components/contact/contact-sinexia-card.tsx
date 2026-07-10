import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { sinexiaContact } from "@/config/contact";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type ContactSinexiaCardProps = {
  className?: string;
  compact?: boolean;
};

export function ContactSinexiaCard({
  className,
  compact = false,
}: ContactSinexiaCardProps) {
  return (
    <SurfaceCard
      padding={compact ? "md" : "lg"}
      className={cn("border-primary/15 bg-navy-soft/40", className)}
    >
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white">
          <MessageCircle className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {sinexiaContact.whatsappLabel}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {sinexiaContact.whatsappDescription}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild className="h-11 gap-2 rounded-xl">
              <Link
                href={sinexiaContact.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="size-4" />
                Abrir WhatsApp
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl bg-card">
              <Link
                href={siteConfig.companyUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visitar sinexiapr.com
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
