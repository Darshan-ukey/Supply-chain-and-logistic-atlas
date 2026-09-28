import { Link } from "@tanstack/react-router";
import { Blocks, Database, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex min-h-16 max-w-[1600px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Atlas BOL Intelligence Explorer home">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground"><Blocks className="size-5" /></span>
            <span><strong className="block text-sm">Atlas BOL Intelligence Explorer</strong><span className="block text-xs text-muted-foreground">Internal proof of concept</span></span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Primary navigation">
            <Link to="/" activeOptions={{ exact: true }} className="nav-link" activeProps={{ className: "nav-link nav-link-active" }}><Database className="size-4" />Fields</Link>
            <Link to="/package" className="nav-link" activeProps={{ className: "nav-link nav-link-active" }}><ShieldCheck className="size-4" />Package</Link>
          </nav>
        </div>
      </header>
      <div className="border-b border-warning-border bg-warning-subtle text-warning-foreground">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 text-sm font-semibold sm:px-6 lg:px-8"><ShieldCheck className="size-4 shrink-0" />Pre-execution knowledge sufficiency assessment — not runtime accuracy proof.</div>
      </div>
      {children}
    </div>
  );
}