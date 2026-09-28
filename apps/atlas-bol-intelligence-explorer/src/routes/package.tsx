import { createFileRoute } from "@tanstack/react-router";
import { Box, Fingerprint, Layers3 } from "lucide-react";
import type { ReactNode } from "react";
import { AppShell } from "@/components/atlas/AppShell";
import { JsonPanel } from "@/components/atlas/JsonPanel";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { bolIntelligencePackage } from "@/data/bol-intelligence";

export const Route = createFileRoute("/package")({
  head: () => ({ meta: [
    { title: "Intelligence Package — Atlas BOL Intelligence Explorer" },
    { name: "description", content: "Inspect package metadata and the complete canonical BOL intelligence payload." },
    { property: "og:title", content: "Atlas BOL Intelligence Package" },
    { property: "og:description", content: "Complete machine-readable package for the 76-field BOL intelligence contract." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: PackagePage,
});
function PackagePage() { const pkg = bolIntelligencePackage; return <AppShell><main className="page-shell"><p className="eyebrow">Canonical machine-readable artifact</p><h1 className="page-title">Intelligence package</h1><p className="page-copy">The exact experimental POC package consumed by this interface and returned by the API, derived from the governed ATL-68 crosswalk and supplied evidence controls.</p>
  <section className="mt-6 grid gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-4"><Meta icon={<Box />} label="Package" value={pkg.package_id} /><Meta icon={<Layers3 />} label="Version" value={pkg.package_version} /><Meta icon={<Fingerprint />} label="Hash" value={pkg.package_hash} /><Meta icon={<Layers3 />} label="Lifecycle" value={pkg.lifecycle_status} /></section>
  <div className="my-5 flex flex-wrap items-center justify-between gap-3"><div><span className="text-sm font-semibold">{pkg.field_count} governed fields</span><span className="mx-2 text-muted-foreground">·</span><span className="text-sm text-muted-foreground">Deterministic {pkg.hash_algorithm} digest</span></div><StatusBadge value={pkg.lifecycle_status} /></div><JsonPanel data={pkg} label="Complete intelligence package" /></main></AppShell>; }
function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) { return <div className="min-w-0 bg-card p-5"><div className="mb-3 flex items-center gap-2 text-muted-foreground">{icon}<span className="detail-label mb-0">{label}</span></div><p className="break-words font-mono text-xs font-semibold">{value}</p></div>; }