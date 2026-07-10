import Link from "next/link";

import { BrandLogo } from "@/components/brand/brand-logo";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex h-16 items-center border-b border-border/60 bg-card/80 px-4 sm:px-6">
        <BrandLogo href="/" showSubtitle size="sm" />
      </header>
      <main className="flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="px-4 py-6 text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Volver al inicio
        </Link>
      </footer>
    </div>
  );
}
