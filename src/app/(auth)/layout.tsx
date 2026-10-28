import Link from "next/link";

import { BrandMark } from "@/components/layout/brand-mark";
import { siteConfig } from "@/config/site";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring flex items-center gap-2.5 rounded-md text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
        >
          <BrandMark className="size-8" />
          {siteConfig.firmName}
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="text-muted-foreground px-4 py-6 text-center text-xs">
        Acceso seguro para clientes autorizados.
      </footer>
    </div>
  );
}
