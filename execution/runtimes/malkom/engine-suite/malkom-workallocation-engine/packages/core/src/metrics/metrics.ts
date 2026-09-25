/**
 * In-process metrics, allocation-free on the hot path: counters and gauges are
 * Map<flattenedKey, number>; histograms use fixed bucket arrays. Exposed as
 * Prometheus text and as a JSON snapshot; reset() supports the control plane's
 * metrics-delete endpoint.
 */

type Labels = Readonly<Record<string, string>>;

interface HistogramDef {
  buckets: readonly number[];
  help: string;
}

interface HistogramState {
  counts: number[]; // one per bucket + overflow
  sum: number;
  count: number;
}

const HISTOGRAMS: Record<string, HistogramDef> = {
  malkom_run_duration_ms: {
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 15000, 60000],
    help: 'Allocation run duration in milliseconds',
  },
  malkom_item_wait_seconds: {
    buckets: [1, 5, 15, 60, 300, 900, 3600, 14400, 86400, 604800],
    help: 'Item age at assignment (createdAt to assignment), seconds',
  },
};

const COUNTER_HELP: Record<string, string> = {
  malkom_runs_total: 'Allocation runs by queue and final status',
  malkom_assignments_total: 'Assignment outcomes by queue and outcome',
  malkom_released_total: 'Items released back to the pool (stale sweep + manual)',
  malkom_overlap_skips_total: 'Scheduler ticks skipped because the previous run was still active',
};

const GAUGE_HELP: Record<string, string> = {
  malkom_candidate_pool_size: 'Allocatable items seen by the last run, per queue',
  malkom_eligible_workers: 'Eligible workers seen by the last run, per queue',
  malkom_oldest_unassigned_seconds: 'Age of the oldest unassigned candidate — the starvation alarm',
  malkom_unconfigured_items: 'Unallocated items whose (queueId, subqueueId) has NO enabled queue definition',
};

function key(name: string, labels: Labels): string {
  const parts = Object.keys(labels)
    .sort()
    .map((k) => `${k}="${labels[k]!.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`);
  return parts.length > 0 ? `${name}{${parts.join(',')}}` : name;
}

export class MetricsRegistry {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, HistogramState>();
  private startedAt = Date.now();

  increment(name: string, labels: Labels, by = 1): void {
    const k = key(name, labels);
    this.counters.set(k, (this.counters.get(k) ?? 0) + by);
  }

  setGauge(name: string, labels: Labels, value: number): void {
    this.gauges.set(key(name, labels), value);
  }

  observe(name: string, labels: Labels, value: number): void {
    const def = HISTOGRAMS[name];
    if (!def) return;
    const k = key(name, labels);
    let h = this.histograms.get(k);
    if (!h) {
      h = { counts: new Array<number>(def.buckets.length + 1).fill(0), sum: 0, count: 0 };
      this.histograms.set(k, h);
    }
    let i = def.buckets.findIndex((b) => value <= b);
    if (i === -1) i = def.buckets.length;
    h.counts[i] = (h.counts[i] ?? 0) + 1;
    h.sum += value;
    h.count += 1;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.startedAt = Date.now();
  }

  toPrometheus(): string {
    const lines: string[] = [];
    const emitted = new Set<string>();

    const header = (name: string, type: string, help: string) => {
      if (emitted.has(name)) return;
      emitted.add(name);
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`);
    };

    for (const [k, v] of [...this.counters.entries()].sort()) {
      const name = k.split('{')[0]!;
      header(name, 'counter', COUNTER_HELP[name] ?? name);
      lines.push(`${k} ${v}`);
    }
    for (const [k, v] of [...this.gauges.entries()].sort()) {
      const name = k.split('{')[0]!;
      header(name, 'gauge', GAUGE_HELP[name] ?? name);
      lines.push(`${k} ${v}`);
    }
    for (const [k, h] of [...this.histograms.entries()].sort()) {
      const name = k.split('{')[0]!;
      const def = HISTOGRAMS[name]!;
      header(name, 'histogram', def.help);
      const labelPart = k.includes('{') ? k.slice(k.indexOf('{') + 1, -1) : '';
      const withLe = (le: string) => (labelPart ? `${name}_bucket{${labelPart},le="${le}"}` : `${name}_bucket{le="${le}"}`);
      let cumulative = 0;
      def.buckets.forEach((b, i) => {
        cumulative += h.counts[i] ?? 0;
        lines.push(`${withLe(String(b))} ${cumulative}`);
      });
      cumulative += h.counts[def.buckets.length] ?? 0;
      lines.push(`${withLe('+Inf')} ${cumulative}`);
      const suffix = labelPart ? `{${labelPart}}` : '';
      lines.push(`${name}_sum${suffix} ${h.sum}`, `${name}_count${suffix} ${h.count}`);
    }
    lines.push(
      `# HELP malkom_metrics_uptime_seconds Seconds since metrics were started or reset`,
      `# TYPE malkom_metrics_uptime_seconds gauge`,
      `malkom_metrics_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`,
    );
    return lines.join('\n') + '\n';
  }

  toJSON(): Record<string, unknown> {
    return {
      sinceEpochMs: this.startedAt,
      counters: Object.fromEntries([...this.counters.entries()].sort()),
      gauges: Object.fromEntries([...this.gauges.entries()].sort()),
      histograms: Object.fromEntries(
        [...this.histograms.entries()].sort().map(([k, h]) => [k, { sum: h.sum, count: h.count, counts: h.counts }]),
      ),
    };
  }
}
