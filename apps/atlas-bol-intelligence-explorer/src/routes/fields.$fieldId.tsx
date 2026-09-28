import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Braces, CircleAlert, FileText } from "lucide-react";
import { AppShell } from "@/components/atlas/AppShell";
import { JsonPanel } from "@/components/atlas/JsonPanel";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { Button } from "@/components/ui/button";
import { getBolField } from "@/data/bol-intelligence";

export const Route = createFileRoute("/fields/$fieldId")({
  loader: ({ params }) => { const field = getBolField(params.fieldId); if (!field) throw notFound(); return field; },
  head: ({ loaderData }) => ({ meta: [
    { title: loaderData ? `${loaderData.field_id} — Atlas BOL Intelligence Explorer` : "Field unavailable — Atlas BOL Intelligence Explorer" },
    { name: "description", content: "Human and machine-readable inspection of one BOL field intelligence record." },
    { property: "og:title", content: loaderData ? `${loaderData.field_id} Field Intelligence` : "Field unavailable" },
    { property: "og:description", content: "Inspect semantics, rules, dependencies, provenance, and sufficiency for a BOL field." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: FieldDetail,
});

const empty = (label: string) => <div className="empty-state">No field-specific governed {label.toLowerCase()} supplied.</div>;
function List({ values, label }: { values: string[]; label: string }) { return values.length ? <ul className="space-y-2 text-sm">{values.map((value) => <li key={value}>{value}</li>)}</ul> : empty(label); }

function FieldDetail() {
  const field = Route.useLoaderData();
  const [view, setView] = useState<"human" | "json">("human");
  return <AppShell><main className="page-shell">
    <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />All fields</Link>
    <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 lg:flex-row lg:items-end"><div><p className="eyebrow">Field {String(field.field_number).padStart(2, "0")} · {field.field_id}</p><h1 className="page-title">{field.field_name}</h1><p className="page-copy">{field.source_classification} · {field.canonical_object}</p></div><div className="flex flex-wrap gap-2"><StatusBadge value={field.support_status} />{field.gap_flag ? <span className="status-badge status-pending"><CircleAlert className="size-3" />GAP</span> : <span className="status-badge">NO GAP</span>}</div></div>
    <div className="mt-6 flex w-fit rounded-md border border-border bg-muted p-1" role="tablist" aria-label="Field inspection view"><Button role="tab" aria-selected={view === "human"} variant={view === "human" ? "default" : "ghost"} size="sm" onClick={() => setView("human")}><FileText />Human view</Button><Button role="tab" aria-selected={view === "json"} variant={view === "json" ? "default" : "ghost"} size="sm" onClick={() => setView("json")}><Braces />Machine JSON view</Button></div>
      {view === "human" ? <div className="detail-grid mt-5">
        <section className="detail-cell md:col-span-2"><h2 className="detail-label">Semantic definition / governed rationale</h2><p className="text-sm leading-6">{field.semantic_definition}</p></section>
        <section className="detail-cell"><h2 className="detail-label">Aliases / representations</h2><List values={field.aliases} label="Aliases" /></section>
        <section className="detail-cell"><h2 className="detail-label">Hierarchy / ownership / cardinality</h2>{field.hierarchy.status === "NOT_ASSESSED" ? empty("Hierarchy") : <dl className="text-sm"><dt>Owner</dt><dd>{field.hierarchy.owner_object}</dd></dl>}</section>
        <section className="detail-cell"><h2 className="detail-label">Relationships · {field.relationships.length}</h2>{field.relationships.length ? <pre>{JSON.stringify(field.relationships, null, 2)}</pre> : empty("Relationships")}</section>
        <section className="detail-cell"><h2 className="detail-label">Business rules · {field.rules.length}</h2>{field.rules.length ? <pre>{JSON.stringify(field.rules, null, 2)}</pre> : empty("Rules")}</section>
        <section className="detail-cell"><h2 className="detail-label">Applicability conditions</h2><List values={field.applicability_conditions} label="Applicability" /></section>
        <section className="detail-cell"><h2 className="detail-label">Validations</h2>{field.validations.length ? <pre>{JSON.stringify(field.validations, null, 2)}</pre> : empty("Validations")}</section>
        <section className="detail-cell"><h2 className="detail-label">Precedence</h2><List values={field.precedence} label="Precedence" /></section>
        <section className="detail-cell"><h2 className="detail-label">Exceptions</h2><List values={field.exceptions} label="Exceptions" /></section>
        <section className="detail-cell"><h2 className="detail-label">Dependencies</h2>{field.dependencies.length ? <pre>{JSON.stringify(field.dependencies, null, 2)}</pre> : empty("Dependencies")}</section>
        <section className="detail-cell"><h2 className="detail-label">Evidence / provenance</h2>{field.provenance.length ? <pre>{JSON.stringify(field.provenance, null, 2)}</pre> : empty("Provenance")}</section>
        <section className="detail-cell"><h2 className="detail-label">Support / gap status</h2><div className="flex flex-wrap gap-2"><StatusBadge value={field.support_status} /><span className={field.gap_flag ? "status-badge status-pending" : "status-badge"}>GAP: {String(field.gap_flag).toUpperCase()}</span></div></section>
        <section className="detail-cell"><h2 className="detail-label">Sufficiency assessment</h2><StatusBadge value={field.sufficiency.classification} /><p className="mt-3 text-sm leading-6">{field.sufficiency.rationale}</p></section>
        <section className="detail-cell"><h2 className="detail-label">Present components</h2><List values={field.sufficiency.present_components} label="Present components" /></section>
        <section className="detail-cell"><h2 className="detail-label">Missing components · {field.sufficiency.missing_components.length}</h2><div className="flex flex-wrap gap-2">{field.sufficiency.missing_components.map((item) => <span key={item} className="status-badge status-pending">{item}</span>)}</div></section>
      </div> : <div className="mt-5"><JsonPanel data={field} label={`${field.field_id} canonical intelligence object`} /></div>}
  </main></AppShell>;
}