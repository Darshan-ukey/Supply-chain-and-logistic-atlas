import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function JsonPanel({ data, label = "Machine-readable JSON" }: { data: unknown; label?: string }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(data, null, 2);
  return <section className="json-panel"><div className="json-toolbar"><span>{label}</span><Button variant="ghost" size="sm" onClick={async () => { await navigator.clipboard.writeText(json); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy JSON"}</Button></div><pre>{json}</pre></section>;
}