"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { markReportViewed } from "@/actions/notifications";
import { cn } from "@/lib/utils";

type ReportViewLinkProps = {
  reportId: string;
  href: string;
  children: React.ReactNode;
  className?: string;
  download?: boolean;
  onViewed?: () => void;
};

export function ReportViewLink({
  reportId,
  href,
  children,
  className,
  download,
  onViewed,
}: ReportViewLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await markReportViewed(reportId);
      onViewed?.();
      window.dispatchEvent(new Event("sinexia:report-viewed"));
      router.refresh();
    });
  }

  return (
    <Link
      href={href}
      target={download ? "_blank" : undefined}
      rel={download ? "noopener noreferrer" : undefined}
      download={download || undefined}
      onClick={handleClick}
      className={cn(className, isPending && "opacity-70")}
    >
      {children}
    </Link>
  );
}
