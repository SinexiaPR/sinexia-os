import Link from "next/link";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  href?: string | null;
  showSubtitle?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  markOnly?: boolean;
  inverted?: boolean;
};

const sizeMap = {
  sm: { mark: 28, text: "text-base" },
  md: { mark: 36, text: "text-lg" },
  lg: { mark: 48, text: "text-2xl" },
} as const;

export function BrandLogo({
  href = "/",
  showSubtitle = false,
  size = "md",
  className,
  markOnly = false,
  inverted = false,
}: BrandLogoProps) {
  const dims = sizeMap[size];

  const content = (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={inverted ? "/sinexia-mark-light.svg" : "/sinexia-mark.svg"}
        alt=""
        width={dims.mark}
        height={dims.mark}
        className="shrink-0"
      />
      {markOnly ? (
        <span className="sr-only">{siteConfig.name}</span>
      ) : (
        <span className="min-w-0 text-left">
          <span
            className={cn(
              "font-display block font-semibold tracking-[0.14em] uppercase",
              dims.text,
              inverted ? "text-white" : "text-primary",
            )}
          >
            {siteConfig.name}
          </span>
          {showSubtitle ? (
            <span
              className={cn(
                "mt-0.5 block text-xs font-medium tracking-wide",
                inverted ? "text-white/70" : "text-muted-foreground",
              )}
            >
              {siteConfig.portalTitle}
            </span>
          ) : null}
        </span>
      )}
    </span>
  );

  if (!href) {
    return content;
  }

  return (
    <Link
      href={href}
      className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {content}
    </Link>
  );
}
