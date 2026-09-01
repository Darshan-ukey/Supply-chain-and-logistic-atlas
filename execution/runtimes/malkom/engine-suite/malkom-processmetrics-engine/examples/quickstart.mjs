/**
 * Quickstart: the Booking-TAT SLA end-to-end against the BUILT core — plain
 * node, no TypeScript, no database. A memory state store holds the engine's
 * own records; a MemoryFactSource serves the host rows.
 *
 *   npm run build && npm run demo
 */
import {
  MemoryFactSource,
  MetricsEngine,
  noopLogger,
} from '../packages/core/dist/index.js';

// ── The HOST's rows — the engine reads them, never writes them ────────────
const bookings = [
  { id: 'b1', region: 'APAC', status: 'confirmed', createdAt: '2026-08-10T04:30:00Z', confirmedAt: '2026-08-10T06:30:00Z', customerTier: 'gold' },
  { id: 'b2', region: 'APAC', status: 'confirmed', createdAt: '2026-08-10T04:30:00Z', confirmedAt: '2026-08-10T11:30:00Z', customerTier: 'gold' },
  { id: 'b3', region: 'APAC', status: 'confirmed', createdAt: '2026-08-11T11:30:00Z', confirmedAt: '2026-08-12T04:30:00Z', customerTier: 'silver' },
  { id: 'b5', region: 'APAC', status: 'confirmed', createdAt: '2026-08-10T03:30:00Z', confirmedAt: '2026-08-10T12:30:00Z', customerTier: 'bronze' },
  { id: 'b6', region: 'APAC', status: 'new', createdAt: '2026-08-12T04:30:00Z', confirmedAt: null, customerTier: 'gold' },
  { id: 'b8', region: 'EMEA', status: 'confirmed', createdAt: '2026-08-10T04:30:00Z', confirmedAt: '2026-08-10T06:10:00Z', customerTier: 'gold' },
];

// ── The engine — configured entirely with metadata ────────────────────────
const engine = new MetricsEngine({
  state: { kind: 'memory' },
  factSource: new MemoryFactSource(bookings),
  logger: noopLogger,
  hooks: {
    onEvent: (e) => console.log(`  event: ${e.type}${e.metric !== undefined ? ` (${e.metric})` : ''}`),
  },
});
await engine.start();

// 1. The registry — the vocabulary metrics are written in.
await engine.applyRegistry({
  entities: [
    {
      id: 'booking',
      fields: [
        { id: 'region', type: 'string', valueSet: 'regions' },
        { id: 'status', type: 'string', values: ['new', 'confirmed', 'shipped', 'cancelled'] },
        { id: 'createdAt', type: 'date' },
        { id: 'confirmedAt', type: 'date' },
        { id: 'customerTier', type: 'string', values: ['gold', 'silver', 'bronze'] },
      ],
    },
  ],
  valueSets: [{ id: 'regions', values: ['APAC', 'EMEA', 'AMER'] }],
});

// 2. A calendar — business time is first-class and versioned.
await engine.upsertCalendar({
  name: 'india-ops',
  timezone: 'Asia/Kolkata',
  workweek: ['mon', 'tue', 'wed', 'thu', 'fri'],
  workingHours: { start: '09:00', end: '18:00' },
  holidays: [{ date: '2026-08-14', label: 'Independence Day (observed)' }],
});

// 3. The Booking-TAT SLA: share of bookings confirmed within 240 BUSINESS
//    minutes, weekly, per region, bronze migrations excluded.
await engine.createMetric(
  {
    name: 'booking-tat-sla',
    kind: 'sla',
    metricType: 'percent',
    scope: { dimensions: ['region'] },
    window: { kind: 'periodic', grain: 'week' },
    anchor: { kind: 'event', field: 'confirmedAt' },
    target: { value: 95, direction: 'higher_is_better', thresholds: { warn: 92, breach: 88 } },
    calendarRef: 'india-ops',
    derive: { tatMinutes: { fn: 'businessMinutesBetween', args: ['createdAt', 'confirmedAt'] } },
    formula: {
      kind: 'ratio',
      numerator: {
        agg: 'count',
        source: 'booking',
        where: {
          op: 'and',
          args: [
            { op: 'eq', field: 'status', value: 'confirmed' },
            { op: 'lte', field: 'tatMinutes', value: 240 },
          ],
        },
      },
      denominator: { agg: 'count', source: 'booking', where: { op: 'eq', field: 'status', value: 'confirmed' } },
    },
    exclusions: [
      {
        id: 'bronze-migration',
        reason: 'bronze accounts migrating to the new workflow are out of SLA scope',
        when: { op: 'eq', field: 'customerTier', value: 'bronze' },
        effectiveFrom: '2026-08-01T00:00:00Z',
        effectiveTo: '2026-09-01T00:00:00Z',
      },
    ],
  },
  { actor: 'money' },
);

// 4. Evidence, then lifecycle: draft → pending → active. WHO may approve is
//    the host's rule; the engine enforces legality and records who did what.
console.log('validate:', JSON.stringify((await engine.validateMetric('booking-tat-sla')).ok));
await engine.submit('booking-tat-sla', { actor: 'money' });
await engine.activate('booking-tat-sla', { actor: 'priya' });

// 5. Bind the metric to a concrete slice (with an optional target override).
await engine.assign({ metric: 'booking-tat-sla', scope: { region: 'APAC' } });

// 6. Calculate on demand — pure, replayable, nothing persisted.
const result = await engine.calculate({
  metric: 'booking-tat-sla',
  scope: { region: 'APAC' },
  at: '2026-08-12T10:00:00Z',
});
console.log('\nMetricResult:');
console.log(JSON.stringify(result, null, 2));

// 7. Snapshot: the current value of every active definition in one call.
const snapshot = await engine.snapshot({ at: '2026-08-12T10:00:00Z' });
console.log('\nSnapshot:');
for (const entry of snapshot) {
  console.log(
    `  ${entry.metric} ${JSON.stringify(entry.scope)} → ${entry.value}${entry.unit === 'percent' ? '%' : ''} (${entry.status}, ${entry.source}, window ${entry.window.key})`,
  );
}

await engine.stop();
