import { readFile } from 'node:fs/promises';
import {
  PerspectiveUnavailableError,
  analyseOrganizational,
  analysePerformance,
  analyseVariants,
  availableObjectTypes,
  detectCapabilities,
  buildDfg,
  checkConformance,
  compareCohorts,
  createDuckDBClient,
  cycleTimeHistogram,
  dottedChart,
  describeSignal,
  duckdbDialect,
  evaluateSignals,
  findRootCauses,
  formatDuration,
  formatPath,
  layoutCacheKey,
  layoutDfg,
  mineProcessTree,
  throughput,
  treeToBpmn,
  treeToPnml,
  allOf,
  businessCalendarSchema,
  CALENDAR_GRAMMAR,
  describeCalendar,
  describeFilter,
  FILTER_GRAMMAR,
  analyseRework,
  caseTimeline,
  dependencyGraph,
  footprint,
  lengthTwoLoopCounts,
  listCases,
  type CasePage,
  type CaseSort,
  type CaseTimeline,
  type DependencyGraph,
  type Footprint,
  type ReworkReport,
  type Perspective,
  parseCalendarSpec,
  parseFilterSpec,
  summariseLog,
  type LogSummary,
  parseOutcomeSpec,
  type CaseFilter,
  type CohortSpec,
  type ComparativeReport,
  type ConformanceReport,
  type OrganizationalReport,
  type PerformanceReport,
  type OutcomeSpec,
  type ProcessTree,
  type RootCauseReport,
  type SignalDefinition,
  type SignalReport,
  type SqlClient,
  type VariantReport,
  type BusinessCalendar,
} from '@malkom/mining-core';

/**
 * The four analysis commands. A pure client of the core — this file formats,
 * it does not compute.
 */

export type AnalyseCommand =
  | 'performance'
  | 'variants'
  | 'resources'
  | 'conformance'
  | 'compare'
  | 'rootcause'
  | 'layout'
  | 'chart'
  | 'export'
  | 'signals'
  | 'summary'
  | 'rework'
  | 'cases'
  | 'dependency'
  | 'footprint';

export const ANALYSE_COMMANDS: readonly AnalyseCommand[] = [
  'performance',
  'variants',
  'resources',
  'conformance',
  'compare',
  'rootcause',
  'layout',
  'chart',
  'export',
  'signals',
  'summary',
  'rework',
  'cases',
  'dependency',
  'footprint',
];

export interface AnalyseDeps {
  valueOf(args: readonly string[], flag: string): string | undefined;
  usage: string;
}

export async function runAnalyse(
  command: AnalyseCommand,
  args: string[],
  deps: AnalyseDeps,
): Promise<number> {
  const store = deps.valueOf(args, '--store');
  if (store === undefined) {
    process.stderr.write(`${command} needs --store <file.duckdb>\n\n${deps.usage}`);
    return 2;
  }
  const asJson = args.includes('--json');
  const lifecycleArg = deps.valueOf(args, '--lifecycle');
  const lifecycle = lifecycleArg
    ?.split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Read-only: none of these commands write, and taking the write lock would
  // stop the API server, another CLI session, or the refresh job from opening
  // the same store. DuckDB permits many concurrent readers and exactly one
  // writer.
  const client: SqlClient = await createDuckDBClient(store, { readOnly: true });
  try {
    const types = await availableObjectTypes(client, duckdbDialect);
    if (types.length === 0) {
      process.stderr.write(`no event log found in ${store} — import or refresh one first\n`);
      return 1;
    }
    const objectType = deps.valueOf(args, '--object-type') ?? types[0]!.objectType;
    if (!types.some((t) => t.objectType === objectType)) {
      process.stderr.write(
        `unknown object type ${JSON.stringify(objectType)} — available: ${types.map((t) => t.objectType).join(', ')}\n`,
      );
      return 2;
    }

    // --filter may be repeated; every one must hold.
    const filters = collectAll(args, '--filter')
      .map(parseFilter)
      .filter((f): f is CaseFilter => f !== undefined);
    const filter = allOf(...filters);
    if (filters.length !== collectAll(args, '--filter').length) {
      process.stderr.write(
        'a --filter could not be parsed. Forms:\n' +
          FILTER_GRAMMAR.map((f) => `  ${f.form.padEnd(18)} ${f.means}`).join('\n') +
          '\n',
      );
      return 2;
    }

    // 'activity' (the default), 'resource', or 'attr:<key>'. Re-projects the
    // same events onto a different notion of what a step is.
    const perspectiveArg = deps.valueOf(args, '--perspective');
    const perspective = readPerspective(perspectiveArg);
    if (perspectiveArg !== undefined && perspective === null) {
      process.stderr.write(
        `--perspective must be activity, resource, or attr:<key>\n`,
      );
      return 2;
    }

    // Measure in working time rather than wall-clock. Off unless asked for:
    // it changes figures the tool already prints, and a bottleneck ranking
    // that re-orders itself unbidden is not an improvement.
    const calendarArg = deps.valueOf(args, '--calendar');
    let calendar: BusinessCalendar | undefined;
    if (calendarArg !== undefined) {
      const spec = parseCalendarSpec(calendarArg);
      const parsed = spec === undefined ? undefined : businessCalendarSchema.safeParse(spec);
      if (parsed === undefined || !parsed.success) {
        process.stderr.write(
          `--calendar could not be read. Forms:\n` +
            CALENDAR_GRAMMAR.map((f) => `  ${f.form.padEnd(22)} ${f.means}`).join('\n') +
            '\n' +
            (parsed === undefined
              ? ''
              : `${parsed.error.issues.map((i) => `  ${i.path.join('.') || 'calendar'}: ${i.message}`).join('\n')}\n`),
        );
        return 2;
      }
      calendar = parsed.data;
    }

    const shared = {
      objectType,
      ...(lifecycle !== undefined && lifecycle.length > 0 ? { lifecycle } : {}),
      ...(filter !== undefined ? { filter } : {}),
      ...(perspective !== null && perspective !== undefined ? { perspective } : {}),
      ...(calendar !== undefined ? { calendar } : {}),
    };

    if (filter !== undefined && !asJson) {
      line(`\nfiltered to: ${describeFilter(filter)}`);
    }
    // Printed whenever it is on, so no duration on screen is ambiguous about
    // which clock produced it.
    if (calendar !== undefined && !asJson) {
      line(`measuring in ${describeCalendar(calendar)}`);
    }

    switch (command) {
      case 'performance': {
        const slaText = deps.valueOf(args, '--sla');
        const report = await analysePerformance(client, duckdbDialect, {
          ...shared,
          ...(slaText !== undefined ? { slaSeconds: Number(slaText) } : {}),
        });
        if (asJson) return emit(report);
        printPerformance(report);
        return 0;
      }
      case 'summary': {
        const report = await summariseLog(client, duckdbDialect, shared);
        if (asJson) return emit(report);
        printSummary(report);
        return 0;
      }
      case 'rework': {
        const topText = deps.valueOf(args, '--top');
        const report = await analyseRework(client, duckdbDialect, {
          ...shared,
          ...(topText !== undefined ? { limit: Number(topText) } : {}),
        });
        if (asJson) return emit(report);
        printRework(report);
        return 0;
      }
      case 'cases': {
        // One case with --case, a page of them without. Both read the same
        // selection every other command does, so a list and the analysis it
        // came from always describe the same population.
        const caseId = deps.valueOf(args, '--case');
        if (caseId !== undefined) {
          const timeline = await caseTimeline(client, duckdbDialect, caseId, shared);
          if (asJson) return emit(timeline);
          printCaseTimeline(timeline);
          return 0;
        }

        const topText = deps.valueOf(args, '--top');
        const sortText = deps.valueOf(args, '--sort');
        if (sortText !== undefined && !isCaseSort(sortText)) {
          process.stderr.write(
            `--sort must be one of start, end, duration, events, cost\n`,
          );
          return 2;
        }
        const page = await listCases(client, duckdbDialect, {
          ...shared,
          capabilities: await detectCapabilities(client, duckdbDialect),
          ...(sortText !== undefined && isCaseSort(sortText) ? { sort: sortText } : {}),
          ...(args.includes('--asc') ? { direction: 'asc' as const } : {}),
          ...(topText !== undefined ? { limit: Number(topText) } : {}),
          ...(deps.valueOf(args, '--cursor') !== undefined
            ? { cursor: deps.valueOf(args, '--cursor')! }
            : {}),
        });
        if (asJson) return emit(page);
        printCases(page);
        return 0;
      }
      case 'dependency': {
        const thresholdText = deps.valueOf(args, '--threshold');
        const dfg = await buildDfg(client, duckdbDialect, {
          ...shared,
          ...(thresholdText !== undefined ? { edgeThreshold: Number(thresholdText) } : {}),
        });
        // On by default: without the alternation pass every genuine
        // back-and-forth is misreported as two unrelated steps.
        const lengthTwoCounts = args.includes('--no-short-loops')
          ? undefined
          : await lengthTwoLoopCounts(client, duckdbDialect, shared);
        const graph = dependencyGraph(dfg, {
          ...(deps.valueOf(args, '--min-support') !== undefined
            ? { minSupport: Number(deps.valueOf(args, '--min-support')) }
            : {}),
          ...(lengthTwoCounts !== undefined ? { lengthTwoCounts } : {}),
        });
        if (asJson) return emit(graph);
        printDependency(graph);
        return 0;
      }
      case 'footprint': {
        const limitText = deps.valueOf(args, '--top');
        const grid = footprint(await buildDfg(client, duckdbDialect, shared), {
          ...(limitText !== undefined ? { limit: Number(limitText) } : {}),
        });
        if (asJson) return emit(grid);
        printFootprint(grid);
        return 0;
      }
      case 'variants': {
        const topText = deps.valueOf(args, '--top');
        const report = await analyseVariants(client, duckdbDialect, {
          ...shared,
          ...(topText !== undefined ? { limit: Number(topText) } : {}),
        });
        if (asJson) return emit(report);
        printVariants(report);
        return 0;
      }
      case 'resources': {
        try {
          const report = await analyseOrganizational(client, duckdbDialect, shared);
          if (asJson) return emit(report);
          printOrganizational(report);
          return 0;
        } catch (err) {
          if (!(err instanceof PerspectiveUnavailableError)) throw err;
          // The honest refusal, surfaced as the engine intends: what is
          // unavailable, why, and what would make it available.
          process.stdout.write(`\n${err.message}\n`);
          for (const remedy of err.remedies) process.stdout.write(`  -> ${remedy}\n`);
          process.stdout.write('\n');
          return 1;
        }
      }
      case 'layout': {
        const thresholdText = deps.valueOf(args, '--threshold');
        const dfg = await buildDfg(client, duckdbDialect, {
          ...shared,
          ...(thresholdText !== undefined ? { edgeThreshold: Number(thresholdText) } : {}),
        });
        const direction = deps.valueOf(args, '--direction') === 'RIGHT' ? 'RIGHT' : 'DOWN';
        const graph = await layoutDfg(dfg, { direction });
        // Layout exists to be rendered, so JSON is the useful default and the
        // text form is only a sanity check.
        if (!args.includes('--summary')) return emit(graph);
        line(`
layout  (object type: ${shared.objectType})`);
        line(`  size       ${Math.round(graph.width)} x ${Math.round(graph.height)} px`);
        line(`  nodes      ${graph.nodes.length}`);
        line(`  edges      ${graph.edges.length}  (${graph.edges.filter((e) => e.selfLoop).length} self-loops)`);
        line(`  cache key  ${layoutCacheKey(dfg, { direction })}`);
        line(`  payload    ${(JSON.stringify(graph).length / 1024).toFixed(0)} KB
`);
        return 0;
      }
      case 'chart': {
        const which = deps.valueOf(args, '--type') ?? 'dotted';
        if (which === 'dotted') {
          const chart = await dottedChart(client, duckdbDialect, {
            ...shared,
            ...numeric(deps.valueOf(args, '--x-bins'), 'xBins'),
            ...numeric(deps.valueOf(args, '--y-bins'), 'yBins'),
            ...(deps.valueOf(args, '--sort') !== undefined
              ? { sortBy: deps.valueOf(args, '--sort') as 'start' | 'duration' | 'end' }
              : {}),
          });
          if (!args.includes('--summary')) return emit(chart);
          line(`
dotted chart  (object type: ${shared.objectType})`);
          line(`  events     ${chart.eventCount.toLocaleString()}`);
          line(`  bins       ${chart.bins.length.toLocaleString()} of ${chart.xBins} x ${chart.yBins}`);
          line(`  reduction  ${(chart.eventCount / Math.max(1, chart.bins.length)).toFixed(1)}x`);
          line(`  sorted by  ${chart.sortedBy}
`);
          return 0;
        }
        if (which === 'histogram') {
          return emit(await cycleTimeHistogram(client, duckdbDialect, shared));
        }
        if (which === 'throughput') {
          const granularity = deps.valueOf(args, '--granularity');
          return emit(
            await throughput(client, duckdbDialect, {
              ...shared,
              ...(granularity !== undefined
                ? { granularity: granularity as 'hour' | 'day' | 'week' | 'month' }
                : {}),
            }),
          );
        }
        process.stderr.write(`unknown --type ${JSON.stringify(which)} — dotted, histogram or throughput
`);
        return 2;
      }
      case 'signals': {
        const defsPath = deps.valueOf(args, '--signals');
        if (defsPath === undefined) {
          process.stderr.write(
            `signals needs --signals <file.json> holding { "openCases": {...}, "signals": [...] }\n`,
          );
          return 2;
        }
        const config = JSON.parse(await readFile(defsPath, 'utf8')) as {
          openCases?: unknown;
          signals?: SignalDefinition[];
        };
        const nowText = deps.valueOf(args, '--now');
        const now = nowText === undefined ? new Date() : new Date(nowText);
        if (Number.isNaN(now.getTime())) {
          process.stderr.write(`--now must be an ISO timestamp\n`);
          return 2;
        }
        const report = await evaluateSignals(client, duckdbDialect, config.signals ?? [], {
          ...shared,
          now,
          openCases: (config.openCases ?? { kind: 'all' }) as never,
        });
        if (asJson) return emit(report);
        printSignals(report, config.signals ?? []);
        // Non-zero when anything critical fired, so a scheduler can react to
        // the exit code without parsing the output.
        return report.firings.some((f) => f.severity === 'critical') ? 1 : 0;
      }
      case 'export': {
        const format = (deps.valueOf(args, '--format') ?? 'bpmn').toLowerCase();
        const thresholdText = deps.valueOf(args, '--threshold');
        const dfg = await buildDfg(client, duckdbDialect, {
          ...shared,
          ...(thresholdText !== undefined ? { edgeThreshold: Number(thresholdText) } : {}),
        });
        const mined = mineProcessTree(dfg);
        if (mined.fallbacks > 0) {
          // Exporting a flower as a BPMN diagram hands someone a picture that
          // looks like a process and describes nothing.
          process.stderr.write(
            `warning: ${mined.fallbacks} part(s) of this model are a flower — the export will\n` +
              '         show structure the data does not support. Filter the log first.\n',
          );
        }
        const name = deps.valueOf(args, '--name') ?? `Discovered from ${shared.objectType}`;
        if (format === 'pnml') {
          process.stdout.write(treeToPnml(mined.tree, { name }));
          return 0;
        }
        if (format === 'bpmn') {
          process.stdout.write(await treeToBpmn(mined.tree, { name }));
          return 0;
        }
        if (format === 'tree' || format === 'json') {
          return emit(mined.tree);
        }
        process.stderr.write(`unknown --format ${JSON.stringify(format)} — bpmn, pnml or tree
`);
        return 2;
      }
      case 'compare': {
        const a = parseCohort(deps.valueOf(args, '--a'));
        const b = parseCohort(deps.valueOf(args, '--b')) ?? { kind: 'complement' as const };
        if (a === undefined) {
          process.stderr.write(
            'compare needs --a <spec>, e.g. --a channel=web, --a activity:Reject, --a from:2026-01-01..2026-04-01\n',
          );
          return 2;
        }
        const report = await compareCohorts(client, duckdbDialect, { ...shared, a, b });
        if (asJson) return emit(report);
        printComparative(report);
        return 0;
      }
      case 'rootcause': {
        const outcome = parseOutcome(deps.valueOf(args, '--outcome') ?? 'slowest:0.2');
        if (outcome === undefined) {
          process.stderr.write(
            'rootcause needs --outcome, e.g. --outcome slowest:0.2, --outcome contains:Reject, --outcome slower-than:604800\n',
          );
          return 2;
        }
        const report = await findRootCauses(client, duckdbDialect, { ...shared, outcome });
        if (asJson) return emit(report);
        printRootCause(report);
        return 0;
      }
      case 'conformance': {
        const modelPath = deps.valueOf(args, '--model');
        const topText = deps.valueOf(args, '--top');
        let model: ProcessTree;
        if (modelPath !== undefined) {
          model = JSON.parse(await readFile(modelPath, 'utf8')) as ProcessTree;
        } else {
          const dfg = await buildDfg(client, duckdbDialect, shared);
          model = mineProcessTree(dfg).tree;
          if (!asJson) {
            // Saying this matters: checking a log against a model discovered
            // from that same log measures how well the map explains the data.
            // It is not a compliance result, and reading it as one would be a
            // serious misinterpretation.
            process.stdout.write(
              '\nno --model given: discovering one from this log and checking the log against\n' +
                'itself. that measures how well the discovered map explains the data — it is NOT\n' +
                'a compliance check. pass --model <tree.json> to check against an intended process.\n',
            );
          }
        }
        const report = await checkConformance(client, duckdbDialect, {
          ...shared,
          model,
          ...(topText !== undefined ? { limit: Number(topText) } : {}),
        });
        if (asJson) return emit(report);
        printConformance(report);
        return 0;
      }
    }
  } finally {
    await client.close();
  }
}

function emit(value: unknown): number {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  return 0;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function line(text: string): void {
  process.stdout.write(`${text}\n`);
}

// ---------------------------------------------------------------------------

function printPerformance(r: PerformanceReport): void {
  line(`\nperformance  (object type: ${r.objectType})`);
  line(`  cases        ${r.caseCount.toLocaleString()}`);
  line(`  events       ${r.eventCount.toLocaleString()}`);
  line(
    `  cycle time   median ${formatDuration(r.cases.cycleTime.p50)}   p90 ${formatDuration(r.cases.cycleTime.p90)}   max ${formatDuration(r.cases.cycleTime.max)}`,
  );
  if (r.cases.handlingRatio !== null) {
    line(
      `  of that      ${pct(r.cases.handlingRatio)} being worked, ${pct(1 - r.cases.handlingRatio)} waiting`,
    );
  } else {
    // Never print "0% being worked" for a log that simply did not measure it.
    line('  of that      handling time not recorded in this log, so the split');
    line('               between working and waiting cannot be measured');
  }
  if (r.sla !== null) {
    line(
      `  SLA          ${r.sla.breached.toLocaleString()} of ${r.sla.total.toLocaleString()} breached (${pct(r.sla.breachRate)}), median overshoot ${formatDuration(r.sla.medianOvershoot)}`,
    );
  }

  line('\nwhere the time goes (worst first)');
  for (const b of r.bottlenecks.slice(0, 8)) {
    line(
      `  ${pct(b.share).padStart(6)}  ${formatDuration(b.totalSeconds).padStart(8)}  ${b.label}   (${b.occurrences.toLocaleString()}x, median ${formatDuration(b.medianSeconds)})`,
    );
    line(`          ${b.advice}`);
  }
  line('');
}

function printVariants(r: VariantReport): void {
  line(`\nvariants  (object type: ${r.objectType})`);
  line(`  cases            ${r.totalCases.toLocaleString()}`);
  line(`  distinct paths   ${r.totalVariants.toLocaleString()}`);
  line(
    `  80% of cases     covered by ${r.variantsFor80Percent.toLocaleString()} path${r.variantsFor80Percent === 1 ? '' : 's'}`,
  );
  line(
    `  one-off paths    ${r.singletonVariants.toLocaleString()} (${r.singletonCases.toLocaleString()} cases)`,
  );

  line('\ntop paths');
  for (const v of r.variants.slice(0, 12)) {
    line(
      `  ${String(v.rank).padStart(3)}. ${pct(v.share).padStart(6)}  ${String(v.cases).padStart(7)} cases  median ${formatDuration(v.medianCycleSeconds).padStart(7)}`,
    );
    line(`       ${formatPath(v.path, 10)}`);
  }
  if (r.remainder !== null) {
    line(
      `\n  plus ${r.remainder.variants.toLocaleString()} more paths covering ${r.remainder.cases.toLocaleString()} cases (${pct(r.remainder.share)}) - not shown`,
    );
  }
  line('');
}

function printOrganizational(r: OrganizationalReport): void {
  line(`\nresources  (object type: ${r.objectType})`);
  line(`  people           ${r.resourceCount.toLocaleString()}`);
  line(`  handovers/case   median ${r.medianHandoversPerCase ?? '-'}`);
  line(`  handled by one   ${r.singleHandlerCases.toLocaleString()} cases`);
  if (r.unattributedEvents > 0) {
    line(
      `  unattributed     ${r.unattributedEvents.toLocaleString()} events have no resource and are excluded`,
    );
  }

  line('\nworkload');
  for (const p of r.resources.slice(0, 10)) {
    const kind = p.specialisation < 0.4 ? 'specialist' : p.specialisation > 0.8 ? 'generalist' : 'mixed';
    line(
      `  ${pct(p.workloadShare).padStart(6)}  ${p.events.toLocaleString().padStart(8)} events  ${p.resource}   (${kind}, mostly ${p.primaryActivity ?? '-'})`,
    );
  }

  if (r.handovers.length > 0) {
    line('\nbusiest handovers');
    for (const h of r.handovers.slice(0, 8)) {
      line(
        `  ${h.count.toLocaleString().padStart(8)}x  ${h.from} -> ${h.to}   median wait ${formatDuration(h.medianWaitSeconds)}`,
      );
    }
  }

  const risks = r.activityOwnership.filter((a) => a.singlePointOfFailure);
  if (risks.length > 0) {
    line('\nkey-person risk (one person handles nearly all of it)');
    for (const a of risks.slice(0, 8)) {
      line(`  ${pct(a.topResourceShare).padStart(6)}  ${a.activity} - ${a.topResource}`);
    }
  }
  line('');
}

function printConformance(r: ConformanceReport): void {
  line(`\nconformance  (object type: ${r.objectType})`);
  line(`  cases              ${r.totalCases.toLocaleString()}`);
  line(
    `  replayed           ${r.casesReplayed.toLocaleString()} cases across ${r.variantsReplayed.toLocaleString()} paths (${pct(r.coverage)} of the log)`,
  );
  line(`  fitness            ${pct(r.logFitness)}   (can the model explain the log)`);
  line(`  precision          ${pct(r.precision.precision)}   (does the log use what the model allows)`);
  line(`  F-score            ${pct(r.fScore)}`);
  line(`  verdict            ${r.verdict}`);
  line(
    `  follow the model   ${r.perfectlyFittingCases.toLocaleString()} of ${r.casesReplayed.toLocaleString()} replayed (${pct(r.perfectlyFittingRate)})`,
  );

  // Both of these turn a headline number into a misleading one if unsaid.
  if (r.coverage < 1) {
    line('');
    line(`  NOTE: every rate above covers the ${pct(r.coverage)} of cases that were replayed,`);
    line('        not the whole log. Raise --top to replay more paths.');
  }
  if (r.modelIsPermissive) {
    line('');
    line(
      `  WARNING: ${pct(r.permissiveShare)} of this model's activities sit in a "flower" —`,
    );
    line('           accepted in any order, any number of times. A high fitness score');
    line('           against it is guaranteed and means nothing about compliance.');
    line('           It happens when discovery found no structure. Filter the log');
    line('           (--threshold, --lifecycle) or supply a real --model.');
    line(`           Precision of ${pct(r.precision.precision)} is the number that shows it.`);
  }

  if (r.unmodelledActivities.length > 0) {
    line(`\nhappening but not in the model\n  ${r.unmodelledActivities.join(', ')}`);
  }
  if (r.unusedModelActivities.length > 0) {
    line(`\nin the model but never happens\n  ${r.unusedModelActivities.join(', ')}`);
  }

  if (r.deviations.length > 0) {
    line('\ndeviations (most cases affected first)');
    for (const d of r.deviations.slice(0, 10)) {
      line(`  ${d.cases.toLocaleString().padStart(8)} cases  ${d.kind}: ${d.activity}`);
      line(`           ${d.explanation}`);
    }
  }

  if (r.precision.loosestStates.length > 0) {
    line('\nwhere the model is loosest (allows most that never happens)');
    for (const s of r.precision.loosestStates.slice(0, 5)) {
      const after = s.prefix.length > 0 ? formatPath(s.prefix, 4) : '(start)';
      line(`  ${s.weight.toLocaleString().padStart(8)} cases after ${after}`);
      line(`           model allows ${s.escaping.length} unused: ${s.escaping.slice(0, 6).join(', ')}`);
    }
  }

  if (r.worstVariants.length > 0) {
    line('\nworst-fitting paths');
    for (const v of r.worstVariants.slice(0, 5)) {
      line(`  fitness ${pct(v.fitness).padStart(6)}  ${v.cases.toLocaleString()} cases`);
      line(`       ${formatPath(v.path, 10)}`);
    }
  }
  line('');
}

// ---------------------------------------------------------------------------
// Cohort and outcome parsing
// ---------------------------------------------------------------------------

/**
 * Accepts `key=value`, `activity:Name`, `!activity:Name` and
 * `from:ISO..ISO`. Deliberately terse: these are typed at a prompt, and a
 * JSON blob on a command line is nobody's idea of usable.
 */

function parseCohort(spec: string | undefined): CohortSpec | undefined {
  if (spec === undefined) return undefined;
  if (spec === 'rest' || spec === 'complement') return { kind: 'complement' };
  // A cohort IS a filter — one grammar, so a selection made by exploring can
  // be pasted straight into a comparison.
  return parseFilter(spec);
}

// The selector grammar lives in the core so the CLI and the HTTP API cannot
// drift apart; two parsers for one grammar is how a selection that works in
// the terminal comes to mean something else over the wire.
const parseFilter = parseFilterSpec;
const parseOutcome = parseOutcomeSpec;

function printComparative(r: ComparativeReport): void {
  line(`
compare  (object type: ${r.objectType})`);
  line(`  A  ${r.labelA}  —  ${r.casesA.toLocaleString()} cases`);
  line(`  B  ${r.labelB}  —  ${r.casesB.toLocaleString()} cases`);
  line(`  ${r.comparisonsRun} comparisons, corrected together at FDR ${r.fdr}`);
  line(`
  ${r.summary}`);

  if (r.findings.length > 0) {
    line('\ndifferences that hold up');
    for (const f of r.findings.slice(0, 10)) {
      const dir = (f.difference ?? 0) > 0 ? 'slower' : 'faster';
      line(
        `  ${f.metric}: A is ${formatDuration(Math.abs(f.difference ?? 0))} ${dir}`,
      );
      line(
        `           median ${formatDuration(f.medianA)} vs ${formatDuration(f.medianB)}   n=${f.nA}/${f.nB}` +
          `   ${f.effect.magnitude} effect (delta ${f.effect.delta.toFixed(2)})   q=${f.adjustedP.toFixed(4)}`,
      );
    }
  }

  const notable = r.suppressed.filter((s) => s.pValue < 0.05).slice(0, 5);
  if (notable.length > 0) {
    // Showing these is the point: they are what a naive tool would have
    // reported as findings.
    line('\nlooked significant, did not survive');
    for (const f of notable) {
      line(`  ${f.metric}: ${f.reason}`);
    }
  }
  line('');
}

function printRootCause(r: RootCauseReport): void {
  line(`
root cause  (object type: ${r.objectType})`);
  line(`  outcome      ${r.outcome}`);
  line(
    `  matched      ${r.outcomeCases.toLocaleString()} of ${r.totalCases.toLocaleString()} cases (${pct(r.baseRate)})`,
  );
  line(`  factors      ${r.factorsTested} tested, corrected together at FDR ${r.fdr}`);
  line(`
  ${r.summary}`);

  if (r.factors.length > 0) {
    line('\nassociated factors');
    for (const f of r.factors.slice(0, 12)) {
      const arrow = f.lift >= 1 ? 'MORE' : 'LESS';
      const ratio = f.lift >= 1 ? f.lift : 1 / f.lift;
      line(
        `  ${ratio.toFixed(1)}x ${arrow}  ${f.kind === 'attribute' ? `${f.name} = ${f.value}` : f.name}`,
      );
      line(
        `           ${pct(f.outcomeRateWith)} vs ${pct(f.outcomeRateWithout)} otherwise` +
          `   ${f.cases.toLocaleString()} cases   q=${f.adjustedP.toFixed(4)}`,
      );
    }
  }
  line(`
  ${r.caveat}`);
  line('');
}

function collectAll(args: readonly string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== flag) continue;
    const value = args[i + 1];
    if (value !== undefined && !value.startsWith('--')) out.push(value);
  }
  return out;
}

function printSignals(r: SignalReport, defs: readonly SignalDefinition[]): void {
  line(`\nsignals  (object type: ${r.objectType})`);
  line(`  evaluated at   ${r.evaluatedAt.toISOString()}`);
  line(`  open cases     ${r.openCases.toLocaleString()} of ${r.totalCases.toLocaleString()}`);
  // The definition of "open" decides everything below it, so it is never left
  // implicit — a log is a snapshot, and finished-but-unrecorded cases look
  // exactly like live ones.
  line(`  open means     ${r.openCaseRule}`);

  if (defs.length > 0) {
    line(`\ndefinitions`);
    for (const def of defs) {
      line(`  ${def.id}  [${def.severity}]  ${describeSignal(def)}`);
    }
  }

  if (r.firings.length === 0) {
    line(`\nnothing fired.\n`);
    return;
  }

  line(`\nfirings`);
  const order = { critical: 0, warning: 1, info: 2 } as const;
  const sorted = [...r.firings].sort((a, b) => order[a.severity] - order[b.severity]);
  for (const firing of sorted.slice(0, 25)) {
    // 'mined' versus 'threshold' is shown on every line: a threshold needed no
    // process model, and presenting the two alike overstates what was found.
    const tag = firing.mined ? 'mined' : 'threshold';
    line(`  [${firing.severity}] ${firing.caseId}  (${firing.signalName}, ${tag})`);
    line(`      ${firing.reason}`);
    if (firing.action !== null) {
      line(`      action: ${firing.action.kind} -> ${firing.action.ref}`);
    }
  }
  if (sorted.length > 25) line(`\n  ... and ${sorted.length - 25} more`);

  for (const summary of r.bySignal) {
    if (summary.truncated) line(`\n  ${summary.signalId}: ${summary.note}`);
  }
  line('');
}

function numeric(value: string | undefined, key: string): Record<string, number> {
  if (value === undefined) return {};
  const n = Number(value);
  return Number.isFinite(n) ? { [key]: n } : {};
}

/**
 * The header figures, in the order a reader wants them: how much work, how
 * many shapes it took, how long it ran, over what period.
 */
function printSummary(s: LogSummary): void {
  line(`
summary  (object type: ${s.objectType})`);
  line(`  cases          ${s.cases.toLocaleString()}`);
  line(`  events         ${s.events.toLocaleString()}`);
  line(`  activities     ${s.activities.toLocaleString()}`);
  line(`  variants       ${s.variants.toLocaleString()}`);
  line(
    `  resources      ${s.resources.toLocaleString()}` +
      (s.resourceCoverage < 1
        ? `  (named on ${(s.resourceCoverage * 100).toFixed(0)}% of events)`
        : ''),
  );

  const from = s.timeframe.from;
  const to = s.timeframe.to;
  if (from !== null && to !== null) {
    line(`  timeframe      ${from.toISOString()} .. ${to.toISOString()}`);
  }

  const d = s.duration;
  if (d.medianSeconds !== null) {
    line(`\n  case duration`);
    line(`    min          ${duration(d.minSeconds)}`);
    line(`    median       ${duration(d.medianSeconds)}`);
    line(`    average      ${duration(d.meanSeconds)}`);
    line(`    max          ${duration(d.maxSeconds)}`);
  }

  if (s.lifecycles.length > 1) {
    // Worth showing whenever there is more than one: a log mixing granularities
    // needs --lifecycle before its map means anything.
    line(`\n  lifecycle transitions`);
    for (const l of s.lifecycles) {
      line(`    ${(l.transition ?? '(none)').padEnd(12)} ${l.events.toLocaleString()}`);
    }
  }
}

function duration(seconds: number | null): string {
  if (seconds === null) return 'not recorded';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(1)}h`;
  if (seconds < 2_592_000) return `${(seconds / 86_400).toFixed(1)}d`;
  return `${(seconds / 2_592_000).toFixed(1)} months`;
}

/** undefined = not given, null = given but unparseable. */
function readPerspective(raw: string | undefined): Perspective | null | undefined {
  if (raw === undefined || raw === 'activity') return undefined;
  if (raw === 'resource') return { kind: 'resource' };
  if (raw.startsWith('attr:')) {
    const key = raw.slice(5);
    return key === '' ? null : { kind: 'attribute', key };
  }
  return null;
}

/**
 * Rework, ordered by how much repeated work each activity caused.
 *
 * The effort share leads because it is the number that makes the case: a
 * process where a third of all recorded work is repetition is a different
 * conversation from one where it is two percent.
 */
function printRework(r: ReworkReport): void {
  line(`\nrework  (object type: ${r.objectType})`);
  line(`  ${r.summary}`);
  line(
    `  cases with rework  ${r.casesWithRework.toLocaleString()} of ${r.totalCases.toLocaleString()}` +
      `  (${(r.reworkRate * 100).toFixed(0)}%)`,
  );
  line(
    `  repeated effort    ${r.repeatEvents.toLocaleString()} of ${r.totalEvents.toLocaleString()} events` +
      `  (${(r.effortShare * 100).toFixed(0)}%)`,
  );
  if (!r.handlingTimesRecorded) {
    // Said plainly rather than shown as a zero: this log records no handling
    // times, so the repeats can be counted but not costed.
    line(`  cost of rework     not measurable — this log records no handling times`);
  }

  if (r.activities.length === 0) return;
  line(`\n  activity                          cases  repeated    rate   extra   loop  revisit`);
  for (const a of r.activities) {
    line(
      `  ${a.activity.slice(0, 32).padEnd(32)} ${String(a.cases).padStart(6)}` +
        ` ${String(a.casesWithRepeat).padStart(9)} ${(a.repeatRate * 100).toFixed(0).padStart(6)}%` +
        ` ${String(a.repeatExecutions).padStart(7)} ${String(a.selfLoops).padStart(6)}` +
        ` ${String(a.revisits).padStart(8)}`,
    );
  }
}

/** Narrow a --sort value to a key the case list understands. */
function isCaseSort(value: string): value is CaseSort {
  return (
    value === 'start' ||
    value === 'end' ||
    value === 'duration' ||
    value === 'events' ||
    value === 'cost'
  );
}

function printCases(page: CasePage): void {
  line(`\ncases  (object type: ${page.objectType})`);
  line(
    `  ${page.cases.length.toLocaleString()} of ${page.total.toLocaleString()}` +
      `, ordered by ${page.sortedBy} ${page.direction === 'asc' ? 'ascending' : 'descending'}`,
  );

  if (page.cases.length === 0) {
    line('  nothing matches this selection');
    return;
  }

  line(`\n  case                          took     steps  activities  people        cost`);
  for (const row of page.cases) {
    line(
      `  ${row.caseId.slice(0, 28).padEnd(28)} ${duration(row.cycleSeconds).padStart(8)}` +
        ` ${String(row.events).padStart(6)} ${String(row.activities).padStart(11)}` +
        ` ${String(row.resources).padStart(7)}` +
        // A dash, not a zero: the log records no cost, which is a different
        // claim from the work having been free.
        ` ${(row.cost === null ? '—' : row.cost.toFixed(2)).padStart(11)}`,
    );
  }

  if (page.nextCursor !== null) {
    line(`\n  more: --cursor ${page.nextCursor}`);
  }
}

function printCaseTimeline(t: CaseTimeline): void {
  line(`\ncase ${t.caseId}  (object type: ${t.objectType})`);
  line(
    `  ${t.events.toLocaleString()} steps over ${duration(t.cycleSeconds)}` +
      (t.handlingSeconds === null ? '' : `, ${duration(t.handlingSeconds)} of it being worked on`),
  );
  if (t.handlingSeconds === null) {
    line('  handling time     not recorded by this log');
  }

  for (const attribute of t.attributes) {
    line(`  ${attribute.key.slice(0, 18).padEnd(18)}${attribute.value ?? '—'}`);
  }

  if (t.steps.length === 0) {
    line('\n  no steps in this selection');
    return;
  }

  line(`\n  when                  waited      step                             worked  who`);
  for (const step of t.steps) {
    line(
      `  ${step.at.toISOString().slice(0, 19).replace('T', ' ')}` +
        // Null on the first step: nothing preceded it, which is not a wait of
        // zero and must not print as one.
        ` ${(step.waitingSeconds === null ? '—' : duration(step.waitingSeconds)).padStart(10)}` +
        `  ${step.activity.slice(0, 30).padEnd(30)}` +
        ` ${(step.handlingSeconds === null ? '—' : duration(step.handlingSeconds)).padStart(8)}` +
        `  ${step.resource ?? '—'}`,
    );
  }

  if (t.truncated) {
    line(`\n  showing ${t.steps.length.toLocaleString()} of ${t.events.toLocaleString()} steps`);
  }
}

function printDependency(g: DependencyGraph): void {
  line(`\ndependency strength  (object type: ${g.objectType})`);
  line(
    `  an arc is called a dependency above ${g.thresholds.dependency.toFixed(2)},` +
      ` and reliable at ${g.thresholds.minSupport} observations`,
  );
  if (!g.lengthTwoLoopsMeasured) {
    // Absence of a measurement is not absence of loops.
    line('  alternating pairs  not measured (--no-short-loops was passed)');
  }

  const coincidence = g.edges.filter((e) => e.kind === 'co-occurrence' && e.reliable);
  line(
    `  ${g.edges.length.toLocaleString()} arcs, of which ${coincidence.length.toLocaleString()}` +
      ' are not orderings at all — those two steps both happen, in either order',
  );

  if (g.edges.length === 0) return;
  line(`\n  from                      to                          dep   forward  reverse  reading`);
  for (const edge of [...g.edges].sort((a, b) => b.dependency - a.dependency)) {
    line(
      `  ${edge.from.slice(0, 24).padEnd(24)}  ${edge.to.slice(0, 24).padEnd(24)}` +
        ` ${edge.dependency.toFixed(2).padStart(5)} ${String(edge.frequency).padStart(9)}` +
        ` ${String(edge.reverseFrequency).padStart(8)}  ${edge.kind}` +
        (edge.reliable ? '' : ' (too few to say)'),
    );
  }

  for (const loop of g.lengthTwoLoops) {
    line(`  alternates: ${loop.a} <-> ${loop.b}  ${loop.occurrences.toLocaleString()} times`);
  }
}

const RELATION_MARK: Record<string, string> = {
  follows: '->',
  precedes: '<-',
  parallel: '||',
};

function printFootprint(f: Footprint): void {
  line(`\nfootprint  (object type: ${f.objectType})`);
  line(`  ${f.activities.length} activities; a blank cell means the two never met`);
  if (f.omitted > 0) line(`  ${f.omitted} quieter activities not shown — raise --top to include them`);

  if (f.activities.length === 0) return;

  const relation = new Map(f.cells.map((c) => [`${c.from}\u0000${c.to}`, c.relation]));

  // Columns are NUMBERED, not abbreviated. Real activity names share prefixes —
  // "Nabellen offertes" and "Nabellen incomplete dossiers" both truncate to the
  // same three letters — and a grid whose columns cannot be told apart is worse
  // than no grid.
  const width = 28;
  const index = new Map(f.activities.map((a, i) => [a, i + 1]));
  const header = f.activities.map((a) => String(index.get(a)).padStart(3)).join(' ');
  line(`\n  ${''.padEnd(width)} ${header}`);

  for (const from of f.activities) {
    const row = f.activities
      .map((to) => (RELATION_MARK[relation.get(`${from}\u0000${to}`) ?? ''] ?? '  ').padStart(3))
      .join(' ');
    line(`  ${`${index.get(from)}. ${from}`.slice(0, width).padEnd(width)} ${row}`);
  }
  line(`\n  -> leads to   <- follows   || both orders seen`);
}
