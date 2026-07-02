import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flight Glitch Watch",
  description: "Personal flight price glitch detector",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <header className="border-b border-[var(--hairline)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ✈️ Flight Glitch Watch
            </Link>
            <nav className="ml-auto flex gap-5 text-sm text-[var(--ink-secondary)]">
              <Link href="/" className="hover:text-[var(--ink)]">
                Routes
              </Link>
              <Link href="/routes/new" className="hover:text-[var(--ink)]">
                Add route
              </Link>
              <Link href="/settings" className="hover:text-[var(--ink)]">
                Settings
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
