#!/usr/bin/env node
/**
 * Writes examples/purchase-orders.csv — a synthetic but realistic purchase-to-pay
 * log in the XES CSV convention, for the offline mining demo.
 *
 * The process it encodes, so the discovered model can be checked against it:
 *
 *   Create PO -> Approve -> ( Goods Receipt || Receive Invoice ) -> Pay
 *
 * with a rework loop on rejected approvals, and a small minority of orders
 * cancelled after approval.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, 'purchase-orders.csv');

// Deterministic PRNG so the demo output is stable run to run.
let seed = 20260813;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

const buyers = ['priya', 'sam', 'ravi', 'lena'];
const clerks = ['tom', 'ana', 'joe'];

const rows = [];
let clock = Date.parse('2026-05-04T08:00:00Z');

for (let i = 1; i <= 400; i += 1) {
  const caseId = `PO-${String(1000 + i)}`;
  const buyer = buyers[Math.floor(rnd() * buyers.length)];
  const clerk = clerks[Math.floor(rnd() * clerks.length)];
  const channel = rnd() < 0.6 ? 'catalogue' : 'free-text';

  // Cases arrive through the working week.
  clock += Math.floor(rnd() * 5 + 1) * 3_600_000;
  let t = clock;
  const step = (activity, resource, minMinutes, maxMinutes) => {
    t += Math.floor((minMinutes + rnd() * (maxMinutes - minMinutes)) * 60_000);
    rows.push([caseId, activity, new Date(t).toISOString(), resource, channel]);
  };

  step('Create PO', buyer, 5, 40);

  // Rework loop: some orders bounce between approval and revision.
  let rejections = 0;
  for (;;) {
    step('Approve PO', clerk, 30, 600);
    if (rejections < 2 && rnd() < 0.22) {
      step('Revise PO', buyer, 20, 180);
      rejections += 1;
      continue;
    }
    break;
  }

  if (rnd() < 0.07) {
    step('Cancel PO', clerk, 10, 120);
    continue; // cancelled orders never reach payment
  }

  // Genuinely concurrent: receipt and invoice arrive independently, so both
  // orderings appear in the log. That interleaving is the only evidence of
  // concurrency a miner ever gets.
  if (rnd() < 0.5) {
    step('Goods Receipt', clerk, 60, 2880);
    step('Receive Invoice', clerk, 30, 1440);
  } else {
    step('Receive Invoice', clerk, 60, 2880);
    step('Goods Receipt', clerk, 30, 1440);
  }

  step('Pay Invoice', clerk, 120, 4320);
}

const header = 'case:concept:name,concept:name,time:timestamp,org:resource,case:channel';
await writeFile(outPath, `${header}\n${rows.map((r) => r.join(',')).join('\n')}\n`, 'utf8');

console.log(`wrote ${rows.length} events across 400 cases to ${outPath}`);
console.log('now run:');
console.log('  node packages/cli/dist/bin.js import examples/purchase-orders.csv --store examples/po.duckdb');
console.log('  node packages/cli/dist/bin.js discover --store examples/po.duckdb');
