import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Database, Filter, Search } from "lucide-react";
import { AppShell } from "@/components/atlas/AppShell";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bolIntelligencePackage, SUFFICIENCY_STATES, sufficiencyCounts } from "@/data/bol-intelligence";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Field Overview — Atlas BOL Intelligence Explorer" },
    { name: "description", content: "Review pre-execution knowledge sufficiency across the 76-field SEFL/Malkom Bill of Lading manifestation." },
    { property: "og:title", content: "Field Overview — Atlas BOL Intelligence Explorer" },
    { property: "og:description", content: "Internal review of governed BOL field intelligence before transaction execution." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: Index,
});

function Index() {
  const [query, setQuery] = useState("");
  const [gapsOnly, setGapsOnly] = useState(false);
  const fields = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return bolIntelligencePackage.fields.filter((field) => (!gapsOnly || field.gap_flag) && (!normalized || `${field.field_id} ${field.field_number} ${field.field_name} ${field.source_classification} ${field.canonical_object}`.toLowerCase().includes(normalized)));
  }, [query, gapsOnly]);

  return <AppShell><main className="page-shell">
    <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><p className="eyebrow">SEFL / Malkom Bill of Lading · Governed ATL-68 crosswalk</p><h1 className="page-title">Field intelligence overview</h1><p className="page-copy">Evidence-backed Atlas intelligence inspection before transaction execution. Sufficiency is conservative and does not establish runtime accuracy.</p></div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground"><Database className="size-4" /><span>Package <strong className="text-foreground">{bolIntelligencePackage.package_version}</strong></span><span className="h-4 w-px bg-border" /><span>76 fields registered</span></div>
    </div>

    <section className="metric-strip" aria-label="Knowledge sufficiency summary">
      {SUFFICIENCY_STATES.map((state) => <div className="metric" key={state}><div className="mb-3 flex items-start justify-between gap-3"><span className="min-w-0 break-words font-mono text-[10px] font-semibold text-muted-foreground">{state}</span><span className="size-2 shrink-0 rounded-full bg-info" /></div><div className="text-xl font-semibold">{sufficiencyCounts[state]}</div><p className="mt-1 text-xs text-muted-foreground">Governed pre-execution assessment</p></div>)}
    </section>

    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xl"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search field number, ID, name, classification or object" aria-label="Search fields" /></div>
      <Button variant={gapsOnly ? "default" : "outline"} onClick={() => setGapsOnly((current) => !current)}><Filter />Gaps only <span className="font-mono text-xs">{bolIntelligencePackage.fields.filter((field) => field.gap_flag).length}</span></Button>
    </div>

    <div className="mt-4 flex items-center justify-between"><p className="text-sm text-muted-foreground"><strong className="text-foreground">{fields.length}</strong> of 76 fields</p><div className="flex items-center gap-2 text-xs text-warning-foreground"><AlertTriangle className="size-4" />Experimental POC assessment</div></div>

    <section className="data-panel mt-3" aria-label="BOL fields">
      <div className="overflow-x-auto"><table className="w-full min-w-[1450px] border-collapse text-left text-xs"><thead className="bg-muted"><tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
        <th className="px-3 py-3">No.</th><th className="px-3 py-3">Field name</th><th className="px-3 py-3">Atlas classification</th><th className="px-3 py-3">Canonical target / object</th><th className="px-3 py-3">Knowledge sufficiency</th><th className="px-3 py-3 text-center">Rules</th><th className="px-3 py-3 text-center">Relations</th><th className="px-3 py-3">Dependencies</th><th className="px-3 py-3">Evidence</th><th className="px-3 py-3">Gap</th><th className="px-3 py-3"><span className="sr-only">Open</span></th>
      </tr></thead><tbody>{fields.map((field) => <tr key={field.field_id} className="border-b border-border last:border-b-0 hover:bg-muted/60">
        <td className="px-3 py-3 font-mono text-muted-foreground">{String(field.field_number).padStart(2, "0")}</td><td className="max-w-xs px-3 py-3"><Link to="/fields/$fieldId" params={{ fieldId: field.field_id }} className="font-semibold text-primary hover:underline">{field.field_name}</Link><div className="mt-1 font-mono text-[10px] text-muted-foreground">{field.field_id}</div></td><td className="px-3 py-3"><StatusBadge value={field.source_classification} /></td><td className="px-3 py-3"><span className="text-xs leading-5">{field.canonical_object}</span></td><td className="px-3 py-3"><StatusBadge value={field.sufficiency.classification} /></td><td className="px-3 py-3 text-center font-mono">{field.rules.length}</td><td className="px-3 py-3 text-center font-mono">{field.relationships.length}</td><td className="px-3 py-3"><StatusBadge value={field.dependencies.length ? "DEPENDENCY_BOUND" : "NONE_DECLARED"} /></td><td className="px-3 py-3"><span className="font-mono text-[10px]">{field.provenance.length} SOURCE{field.provenance.length === 1 ? "" : "S"}</span></td><td className="px-3 py-3">{field.gap_flag ? <span className="status-badge status-pending"><AlertTriangle className="size-3" />GAP</span> : <span className="status-badge">CLEAR</span>}</td><td className="px-3 py-3"><Link to="/fields/$fieldId" params={{ fieldId: field.field_id }} aria-label={`Inspect ${field.field_id}`}><ArrowRight className="size-4 text-muted-foreground" /></Link></td>
      </tr>)}</tbody></table></div>
    </section>
  </main></AppShell>;
}