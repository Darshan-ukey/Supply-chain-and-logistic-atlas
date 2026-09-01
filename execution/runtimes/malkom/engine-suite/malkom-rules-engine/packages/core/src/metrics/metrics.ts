/**
 * In-process metrics, allocation-free on the hot path — same design as the
 * sibling engine. Counters and gauges are flat maps keyed by name + sorted
 * labels; histograms are fixed-bucket arrays. Exposed as Prometheus text and
 * JSON via the router.
 */

/**
 * Metric names as shared constants — the registry silently ignores unknown
 * names, so call sites must reference these rather than retype the strings.
 */
export const METRIC = {
  evaluations: 'malkom_rules_evaluations_total',
  assertions: 'malkom_rules_assertions_total',
  conflicts: 'malkom_rules_conflicts_total',
  activations: 'malkom_rules_activations_total',
  retirements: 'malkom_rules_retirements_total',
  transitions: 'malkom_rules_transitions_total',
  activeGroups: 'malkom_rules_active_groups',
  brokenGroups: 'malkom_rules_broken_groups',
  evalDurationMs: 'malkom_rules_eval_duration_ms',
} as const;

const COUNTERS: Record<string, string> = {
  [METRIC.evaluations]: 'Evaluations run, labeled by mode',
  [METRIC.assertions]: 'Assertion violations produced',
  [METRIC.conflicts]: 'Conflicts surfaced (same-field-write and unique-violated)',
  [METRIC.activations]: 'Group versions activated',
  [METRIC.retirements]: 'Groups retired',
  [METRIC.transitions]: 'Lifecycle events fired, labeled by event type',
};

const GAUGES: Record<string, string> = {
  [METRIC.activeGroups]: 'Groups currently active',
  [METRIC.brokenGroups]: 'Groups marked broken by the last revalidation sweep',
  malkom_rules_metrics_uptime_seconds: 'Seconds since this registry was created',
};

const HISTOGRAMS: Record<string, { help: string; buckets: number[] }> = {
  [METRIC.evalDurationMs]: {
    help: 'Wall-clock per evaluation, milliseconds',
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 25, 50, 100, 250],
  },
};

type Labels = Record<string, string>;

function flatKey(name: string, labels: Labels): string {
  const keys = Object.keys(labels);
  if (keys.length === 0) return name; // hot-path fast exit: no allocation
  const parts = keys
    .sort()
    .map((k) => `${k}="${labels[k]!.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);
  return `${name}{${parts.join(',')}}`;
}

interface Histogram {
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly histograms = new Map<string, Histogram>();
  private readonly startedAt = Date.now();

  increment(name: string, labels: Labels = {}, by = 1): void {
    if (!(name in COUNTERS)) return;
    const key = flatKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  setGauge(name: string, value: number, labels: Labels = {}): void {
    if (!(name in GAUGES)) return;
    this.gauges.set(flatKey(name, labels), value);
  }

  observe(name: string, value: number): void {
    const spec = HISTOGRAMS[name];
    if (!spec) return;
    let h = this.histograms.get(name);
    if (!h) {
      h = { buckets: spec.buckets, counts: spec.buckets.map(() => 0), sum: 0, count: 0 };
      this.histograms.set(name, h);
    }
    h.sum += value;
    h.count += 1;
    for (let i = 0; i < h.buckets.length; i += 1) {
      if (value <= h.buckets[i]!) h.counts[i] = h.counts[i]! + 1;
    }
  }

  /** Supports the control plane's metrics-delete endpoint. */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  private uptimeSeconds(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000);
  }

  toPrometheus(): string {
    const lines: string[] = [];
    for (const [name, help] of Object.entries(COUNTERS)) {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} counter`);
      for (const [key, value] of [...this.counters].filter(([k]) => k.startsWith(name)).sort()) {
        lines.push(`${key} ${value}`);
      }
    }
    for (const [name, help] of Object.entries(GAUGES)) {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`);
      if (name === 'malkom_rules_metrics_uptime_seconds') {
        lines.push(`${name} ${this.uptimeSeconds()}`);
        continue;
      }
      for (const [key, value] of [...this.gauges].filter(([k]) => k.startsWith(name)).sort()) {
        lines.push(`${key} ${value}`);
      }
    }
    for (const [name, spec] of Object.entries(HISTOGRAMS)) {
      lines.push(`# HELP ${name} ${spec.help}`, `# TYPE ${name} histogram`);
      const h = this.histograms.get(name);
      if (!h) continue;
      for (let i = 0; i < h.buckets.length; i += 1) {
        lines.push(`${name}_bucket{le="${h.buckets[i]}"} ${h.counts[i]}`);
      }
      lines.push(`${name}_bucket{le="+Inf"} ${h.count}`);
      lines.push(`${name}_sum ${h.sum}`);
      lines.push(`${name}_count ${h.count}`);
    }
    return `${lines.join('\n')}\n`;
  }

  toJSON(): Record<string, unknown> {
    return {
      counters: Object.fromEntries([...this.counters].sort()),
      gauges: {
        ...Object.fromEntries([...this.gauges].sort()),
        malkom_rules_metrics_uptime_seconds: this.uptimeSeconds(),
      },
      histograms: Object.fromEntries(
        [...this.histograms].map(([name, h]) => [
          name,
          { buckets: h.buckets, counts: h.counts, sum: h.sum, count: h.count },
        ]),
      ),
    };
  }
}
