import { AlertTriangle, Clock3 } from "lucide-react";

export function StatusBadge({ value }: { value: string }) {
  const pending = value === "NOT_ASSESSED" || value === "UNRESOLVED_OR_NA";
  return <span className={pending ? "status-badge status-pending" : "status-badge"}>{pending ? <Clock3 className="size-3" /> : <AlertTriangle className="size-3" />}{value}</span>;
}