import Link from "next/link";

import { siteConfig } from "@/config/site";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/20">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-primary"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
            S
          </span>
          {siteConfig.name}
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
