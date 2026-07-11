"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markDocumentViewed } from "@/actions/notifications";
import { cn } from "@/lib/utils";

type DocumentViewLinkProps = {
  documentId: string;
  href: string;
  children: React.ReactNode;
  className?: string;
  onViewed?: () => void;
};

export function DocumentViewLink({
  documentId,
  href,
  children,
  className,
  onViewed,
}: DocumentViewLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();

    startTransition(async () => {
      onViewed?.();
      const result = await markDocumentViewed(documentId);
      if (result.error) {
        console.error(result.error);
        return;
      }

      router.refresh();
      window.open(href, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={cn(className, isPending && "opacity-70")}
      aria-busy={isPending}
    >
      {children}
    </Link>
  );
}
