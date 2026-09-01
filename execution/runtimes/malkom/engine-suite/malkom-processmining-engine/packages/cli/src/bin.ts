#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { ANALYSE_COMMANDS, runAnalyse, type AnalyseCommand } from './analyse.js';
import { serve } from './serve.js';
import {
  ConnectionRegistry,
  abstractNodes,
  availableObjectTypes,
  buildDfg,
  businessCalendarSchema,
  connectionProfileSchema,
  createDuckDBClient,
  duckdbDialect,
  groupRareActivities,
  importCsv,
  importXes,
  jsonConsoleLogger,
  mineProcessTree,
  noopLogger,
  parseCalendarSpec,
  profileBinding,
  streamDefinitionSchema,
  treeToString,
  validateStream,
  type BindingProfile,
  type BusinessCalendar,
  type Dfg,
  type ProfileFinding,
  type SqlClient,
} from '@malkom/mining-core';

/**
 * A pure client of the core. If the CLI can do it, the API can do it — no
 * engine logic lives here, only argument parsing and formatting.
 */

interface CliConfig {
  connections: unknown[];
  stream: unknown;
}

const USAGE = `malkom-mining — Malkom process mining engine

Bind a host database:
  malkom-mining validate <config.json> [--json]
  malkom-mining profile  <config.json> [--case-object <type>] [--json]

Offline mining, from a file:
  malkom-mining import   <log.csv|log.xes|log.xes.gz> --store <file.duckdb>
                         [--object-type <name>] [--case <col>] [--activity <col>]
                         [--timestamp <col>] [--resource <col>]
                         [--time-format <strptime>] [--timezone <IANA>]
  malkom-mining discover --store <file.duckdb> [--object-type <name>]
                         [--threshold <0..1>] [--nodes <0..1>] [--group]
                         [--lifecycle complete] [--calendar <spec>] [--json]

Serve the HTTP API:
  malkom-mining serve    --store <f.duckdb> [--store name=path ...]
                         [--port 4000] [--host 127.0.0.1] [--api-key <key>]
                         [--cors <origin>]

Analyse a mined log:
  malkom-mining summary     --store <f.duckdb> [--json]
  malkom-mining rework      --store <f.duckdb> [--top <n>] [--json]
  malkom-mining performance --store <f.duckdb> [--sla <seconds>] [--json]
  malkom-mining variants    --store <f.duckdb> [--top <n>] [--json]
  malkom-mining resources   --store <f.duckdb> [--json]
  malkom-mining conformance --store <f.duckdb> [--model <tree.json>] [--json]
  malkom-mining compare     --store <f.duckdb> --a <spec> [--b <spec>] [--json]
  malkom-mining rootcause   --store <f.duckdb> [--outcome <spec>] [--json]
  malkom-mining layout      --store <f.duckdb> [--direction DOWN|RIGHT] [--summary]
  malkom-mining chart       --store <f.duckdb> [--type dotted|histogram|throughput]
  malkom-mining signals     --store <f.duckdb> --signals <file.json> [--now <ISO>]
  malkom-mining cases       --store <f.duckdb> [--case <id>] [--sort duration|start|
                            end|events|cost] [--asc] [--top <n>] [--cursor <c>]
  malkom-mining dependency  --store <f.duckdb> [--threshold <0..1>]
                            [--min-support <n>] [--no-short-loops] [--json]
  malkom-mining footprint   --store <f.duckdb> [--top <n>] [--json]

  All analyse commands accept --object-type, --lifecycle, --filter,
  --perspective (activity | resource | attr:<key>) — what goes in the boxes —
  and --calendar, which measures durations in working time instead of
  wall-clock. Without it every duration is the wall-clock one.

  --calendar takes a zone and, optionally, hours, days and closed dates:
     Europe/London          09:00-17:00, Monday to Friday
     Europe/London@8-16     other hours   (09:30-18:00 for minutes)
     Europe/London@9-17/mon-sat          a six-day week
     Europe/London/mon,wed,fri           named days
     'Europe/London;2026-12-25'          closed on these dates (quote the ;)

  --filter selects whole CASES and may be repeated (all must hold):
     channel=web            case attribute equals (or =a,b for any of)
     activity:Approve       case does that activity   (!activity: never does)
     resource:alice         case involves that person (!resource: never does)
     slower-than:3600       cycle time at least N seconds
     faster-than:3600       cycle time at most N seconds
     length:3..5            trace length between
     from:ISO..ISO          case active in the window
     variant:A>B>C          follows exactly this path
     path:A>B               A led to B    (path!:A>B for immediately after)
     rework:3               some step ran 3+ times  (rework:Assess:3 names one)
  conformance without --model discovers one and checks the log against itself.
  signals reads { "openCases": {...}, "signals": [...] } and evaluates the
  cases that are still open at --now (default: this instant). A log is a
  snapshot, so openCases must say what "still open" means for your process.

The config file holds a { "connections": [...], "stream": {...} } object.
Profiling runs aggregate SQL against the host; no event rows are transferred.
Naive timestamps are read as UTC unless --timezone says otherwise.

Exit codes:
  0  success, no error-severity findings
  1  at least one error finding, a critical signal, or invalid configuration
  2  usage error
`;

type Command = 'profile' | 'validate' | 'import' | 'discover' | 'serve' | AnalyseCommand;

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (command === undefined || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return command === undefined ? 2 : 0;
  }
  const known: string[] = ['profile', 'validate', 'import', 'discover', 'serve', ...ANALYSE_COMMANDS];
  if (!known.includes(command)) {
    process.stderr.write(`unknown command ${JSON.stringify(command)}\n\n${USAGE}`);
    return 2;
  }
  if (command === 'serve') return runServe(rest);
  if (command === 'import') return runImport(rest);
  if (command === 'discover') return runDiscover(rest);
  if ((ANALYSE_COMMANDS as readonly string[]).includes(command)) {
    return runAnalyse(command as AnalyseCommand, rest, { valueOf, usage: USAGE });
  }
  return runConfigCommand(command as 'profile' | 'validate', rest);
}

// ---------------------------------------------------------------------------
// Serve
// ---------------------------------------------------------------------------

async function runServe(args: string[]): Promise<number> {
  const stores = collectValues(args, '--store');
  if (stores.length === 0) {
    process.stderr.write(`serve needs at least one --store <file.duckdb>

${USAGE}`);
    return 2;
  }
  const portText = valueOf(args, '--port');
  const port = portText === undefined ? 4000 : Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    process.stderr.write('--port must be an integer between 1 and 65535\n');
    return 2;
  }

  await serve({
    stores,
    port,
    ...maybeValue('host', valueOf(args, '--host')),
    ...maybeValue('apiKey', valueOf(args, '--api-key')),
    ...maybeValue('corsOrigin', valueOf(args, '--cors')),
  });
  // serve resolves once listening; the process stays alive on its own handles.
  return 0;
}

/** Every value given for a repeatable flag. */
function collectValues(args: readonly string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] !== flag) continue;
    const value = args[i + 1];
    if (value !== undefined && !value.startsWith('--')) out.push(value);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Offline mining
// ---------------------------------------------------------------------------

async function runImport(args: string[]): Promise<number> {
  const path = args[0];
  const store = valueOf(args, '--store');
  if (path === undefined || path.startsWith('--')) {
    process.stderr.write(`import needs a log file path\n\n${USAGE}`);
    return 2;
  }
  if (store === undefined) {
    process.stderr.write(`import needs --store <file.duckdb>\n\n${USAGE}`);
    return 2;
  }

  const objectType = valueOf(args, '--object-type') ?? 'case';
  const client = await createDuckDBClient(store);
  try {
    const isXes = /\.xes(\.gz)?$/i.test(path);
    if (isXes) {
      const result = await importXes(client, duckdbDialect, { path, objectType });
      process.stdout.write(
        `\nimported ${result.events.toLocaleString()} events from ${result.traces.toLocaleString()} traces\n` +
          `  activities   ${result.activities}\n` +
          `  object type  ${result.objectType}\n` +
          `  extensions   ${result.extensions.join(', ') || '(none declared)'}\n` +
          rangeLine(result.timeRange),
      );
      for (const warning of result.warnings) process.stdout.write(`  warning      ${warning}\n`);
    } else {
      const mapping = {
        ...maybe('caseId', valueOf(args, '--case')),
        ...maybe('activity', valueOf(args, '--activity')),
        ...maybe('timestamp', valueOf(args, '--timestamp')),
        ...maybe('resource', valueOf(args, '--resource')),
      };
      const result = await importCsv(client, duckdbDialect, {
        path,
        objectType,
        mapping,
        ...maybeValue('timestampFormat', valueOf(args, '--time-format')),
        ...maybeValue('timezone', valueOf(args, '--timezone')),
      });
      process.stdout.write(
        `\nimported ${result.events.toLocaleString()} events across ${result.cases.toLocaleString()} cases\n` +
          `  activities   ${result.activities}\n` +
          `  object type  ${result.objectType}\n` +
          `  case column  ${result.mapping.caseId}\n` +
          `  activity     ${result.mapping.activity}\n` +
          rangeLine(result.timeRange),
      );
      if (result.caseAttributes.length > 0) {
        process.stdout.write(`  case attrs   ${result.caseAttributes.join(', ')}\n`);
      }
      for (const warning of result.warnings) process.stdout.write(`  warning      ${warning}\n`);
    }
    process.stdout.write(`\nnow run:  malkom-mining discover --store ${store}\n`);
    return 0;
  } finally {
    await client.close();
  }
}

async function runDiscover(args: string[]): Promise<number> {
  const store = valueOf(args, '--store');
  if (store === undefined) {
    process.stderr.write(`discover needs --store <file.duckdb>\n\n${USAGE}`);
    return 2;
  }
  const asJson = args.includes('--json');
  const thresholdText = valueOf(args, '--threshold');
  const threshold = thresholdText === undefined ? 0 : Number(thresholdText);
  if (Number.isNaN(threshold) || threshold < 0 || threshold >= 1) {
    process.stderr.write('--threshold must be a number in [0, 1)\n');
    return 2;
  }

  // discover only reads. Taking the write lock would stop the API server or
  // another session from opening the same store; DuckDB allows many readers
  // and exactly one writer.
  const client: SqlClient = await createDuckDBClient(store, { readOnly: true });
  try {
    const types = await availableObjectTypes(client, duckdbDialect);
    if (types.length === 0) {
      process.stderr.write(`no event log found in ${store} — import one first\n`);
      return 1;
    }
    const objectType = valueOf(args, '--object-type') ?? types[0]!.objectType;
    if (!types.some((t) => t.objectType === objectType)) {
      process.stderr.write(
        `unknown object type ${JSON.stringify(objectType)} — available: ${types.map((t) => t.objectType).join(', ')}\n`,
      );
      return 2;
    }

    const lifecycleArg = valueOf(args, '--lifecycle');
    const lifecycle = lifecycleArg?.split(',').map((s) => s.trim()).filter((s) => s.length > 0);

    // A discovered map carries the delay on every arc, so it has a clock too.
    const calendarArg = valueOf(args, '--calendar');
    let calendar: BusinessCalendar | undefined;
    if (calendarArg !== undefined) {
      const spec = parseCalendarSpec(calendarArg);
      const parsed = spec === undefined ? undefined : businessCalendarSchema.safeParse(spec);
      if (parsed === undefined || !parsed.success) {
        process.stderr.write(`--calendar could not be read; see --help for the forms\n`);
        return 2;
      }
      calendar = parsed.data;
    }

    const full = await buildDfg(client, duckdbDialect, {
      objectType,
      edgeThreshold: threshold,
      ...(lifecycle !== undefined && lifecycle.length > 0 ? { lifecycle } : {}),
      ...(calendar !== undefined ? { calendar } : {}),
    });

    // --threshold thins ARCS; --nodes thins STEPS. They are different controls
    // and a dense map usually needs both.
    const nodesText = valueOf(args, '--nodes');
    const keep = nodesText === undefined ? 1 : Number(nodesText);
    if (Number.isNaN(keep) || keep <= 0 || keep > 1) {
      process.stderr.write('--nodes must be a number in (0, 1]\n');
      return 2;
    }

    const dfg =
      keep >= 1
        ? full
        : args.includes('--group')
          ? groupRareActivities(full, { keep })
          : abstractNodes(full, { keep });

    const mined = mineProcessTree(dfg);

    if (asJson) {
      process.stdout.write(
        `${JSON.stringify(
          {
            objectType,
            caseCount: dfg.caseCount,
            eventCount: dfg.eventCount,
            activities: dfg.activities,
            edges: dfg.edges,
            starts: Object.fromEntries(dfg.starts),
            ends: Object.fromEntries(dfg.ends),
            tree: mined.tree,
            treeText: treeToString(mined.tree),
            cuts: mined.cuts,
            fallbacks: mined.fallbacks,
            ...(dfg.groups !== undefined ? { groups: dfg.groups } : {}),
          },
          null,
          2,
        )}\n`,
      );
      return 0;
    }

    printDiscovery(objectType, types, dfg, mined, threshold, lifecycle !== undefined);
    if (dfg.groups?.length === 0) {
      // Ran and found nothing. Said out loud, because silence here reads as a
      // broken control rather than as an answer.
      process.stdout.write(
        '  grouping: nothing to collapse — the quiet steps here sit among the busy\n' +
          '            ones rather than beside each other, so each stays visible\n',
      );
    }
    for (const group of dfg.groups ?? []) {
      // Named, not merely counted: a box a reader cannot open is a box they
      // have to take on trust.
      process.stdout.write(
        `  grouped: ${group.id}  (${group.frequency.toLocaleString()} executions)\n` +
          `           ${group.activities.join(', ')}\n`,
      );
    }
    return 0;
  } finally {
    await client.close();
  }
}

function printDiscovery(
  objectType: string,
  types: { objectType: string; events: number; objects: number }[],
  dfg: Dfg,
  mined: ReturnType<typeof mineProcessTree>,
  threshold: number,
  lifecycleApplied: boolean,
): void {
  process.stdout.write(`\nevent log  (object type: ${objectType})\n`);
  process.stdout.write(`  cases        ${dfg.caseCount.toLocaleString()}\n`);
  process.stdout.write(`  events       ${dfg.eventCount.toLocaleString()}\n`);
  process.stdout.write(`  activities   ${dfg.activities.length}\n`);
  process.stdout.write(`  arcs         ${dfg.edges.length}${threshold > 0 ? ` (filtered at ${threshold})` : ''}\n`);
  if (types.length > 1) {
    process.stdout.write(
      `  other views  ${types
        .filter((t) => t.objectType !== objectType)
        .map((t) => `${t.objectType} (${t.objects.toLocaleString()} objects)`)
        .join(', ')}\n`,
    );
  }

  process.stdout.write('\ntop activities\n');
  for (const a of dfg.activities.slice(0, 10)) {
    process.stdout.write(
      `  ${a.frequency.toLocaleString().padStart(9)}  ${a.activity}${a.medianDurationSeconds !== null ? `   (median ${fmtSeconds(a.medianDurationSeconds)})` : ''}\n`,
    );
  }

  process.stdout.write('\nslowest transitions\n');
  const slowest = [...dfg.edges]
    .filter((e) => e.medianSeconds !== null)
    .sort((x, y) => (y.medianSeconds ?? 0) - (x.medianSeconds ?? 0))
    .slice(0, 5);
  for (const e of slowest) {
    process.stdout.write(
      `  ${fmtSeconds(e.medianSeconds ?? 0).padStart(9)}  ${e.from} -> ${e.to}   (${e.frequency.toLocaleString()}x)\n`,
    );
  }

  process.stdout.write('\ndiscovered model\n');
  process.stdout.write(`  ${treeToString(mined.tree)}\n`);
  process.stdout.write(`  cuts: ${mined.cuts.join(' > ') || '(none)'}\n`);
  if (mined.fallbacks > 0) {
    // Suggest only what the caller has not already tried, or the advice reads
    // as though it had not noticed the flags on its own command line.
    const suggestions: string[] = [];
    if (threshold === 0) suggestions.push('--threshold 0.05 drops rare arcs');
    else suggestions.push(`raise --threshold above ${threshold}`);
    if (!lifecycleApplied) {
      suggestions.push('--lifecycle complete puts every activity on one granularity');
    }
    suggestions.push('or mine a finer object type');

    process.stdout.write(
      `\n  warning: ${mined.fallbacks} sub-graph${mined.fallbacks === 1 ? '' : 's'} fell back to a flower model.\n` +
        '           That part of the log has no structure the miner can justify — the model\n' +
        '           stays sound but is imprecise there, and should not be presented as\n' +
        '           discovered structure.\n' +
        `           Try: ${suggestions.join('; ')}.\n`,
    );
  }
  process.stdout.write('\n');
}

function fmtSeconds(s: number): string {
  if (s < 60) return `${s.toFixed(0)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

function rangeLine(range: { from: Date; to: Date } | null): string {
  return range === null
    ? ''
    : `  time span    ${range.from.toISOString()} -> ${range.to.toISOString()}\n`;
}

function maybe(key: string, value: string | undefined): Record<string, string> {
  return value === undefined ? {} : { [key]: value };
}

function maybeValue(key: string, value: string | undefined): Record<string, string> {
  return value === undefined ? {} : { [key]: value };
}

// ---------------------------------------------------------------------------
// Host-bound commands
// ---------------------------------------------------------------------------

async function runConfigCommand(command: 'profile' | 'validate', args: string[]): Promise<number> {
  const [configPath, ...rest] = args;
  if (configPath === undefined) {
    process.stderr.write(`${command} needs a config file path\n\n${USAGE}`);
    return 2;
  }

  const asJson = rest.includes('--json');
  const caseObject = valueOf(rest, '--case-object');

  const raw = JSON.parse(await readFile(configPath, 'utf8')) as CliConfig;
  const profiles = (raw.connections ?? []).map((c) => connectionProfileSchema.parse(c));
  const stream = streamDefinitionSchema.parse(raw.stream);

  const validation = validateStream(stream, {
    knownConnections: new Set(profiles.map((p) => p.id)),
  });

  if (asJson && command === 'validate') {
    process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
    return validation.errors.length > 0 ? 1 : 0;
  }

  if (command === 'validate' || validation.errors.length > 0) {
    printValidation(stream.id, validation);
    if (validation.errors.length > 0) return 1;
    if (command === 'validate') return 0;
  }

  // --- profile -------------------------------------------------------------
  const registry = new ConnectionRegistry({
    profiles,
    logger: asJson ? noopLogger : jsonConsoleLogger,
  });

  const results: BindingProfile[] = [];
  try {
    for (const binding of stream.bindings) {
      const connection = await registry.resolve(binding.connectionRef);
      results.push(
        await profileBinding(connection.client, connection.dialect, binding, {
          ...(caseObject !== undefined ? { caseObject } : {}),
        }),
      );
    }
  } finally {
    await registry.closeAll();
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    for (const profile of results) printProfile(profile);
  }

  return results.some((p) => p.findings.some((f) => f.severity === 'error')) ? 1 : 0;
}

function valueOf(args: readonly string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? undefined : v;
}

function printValidation(
  streamId: string,
  result: ReturnType<typeof validateStream>,
): void {
  process.stdout.write(`\nstream ${streamId}\n`);
  process.stdout.write(
    `  object types      ${result.objectTypes.length > 0 ? result.objectTypes.join(', ') : '(none declared)'}\n`,
  );
  process.stdout.write(`  control flow      ${result.canDiscoverControlFlow ? 'available' : 'UNAVAILABLE'}\n`);
  for (const e of result.errors) process.stdout.write(`  ERROR   ${e.path}: ${e.message}\n`);
  for (const w of result.warnings) process.stdout.write(`  warning ${w.path}: ${w.message}\n`);
  if (result.errors.length === 0 && result.warnings.length === 0) {
    process.stdout.write('  no issues\n');
  }
  process.stdout.write('\n');
}

function printProfile(p: BindingProfile): void {
  const n = (v: number | null | undefined): string =>
    v === null || v === undefined ? '—' : v.toLocaleString();

  process.stdout.write(`\nbinding ${p.bindingId}  (${p.grain} grain, ${p.table})\n`);
  process.stdout.write(`  case key          ${p.caseColumn ?? '—'}${p.caseObject !== undefined ? `  [object: ${p.caseObject}]` : ''}\n`);
  process.stdout.write(`  rows              ${n(p.rowCount)}\n`);
  process.stdout.write(`  events            ${n(p.eventCount)}\n`);
  process.stdout.write(`  cases             ${n(p.caseCount)}\n`);
  process.stdout.write(`  activities        ${n(p.activityCount)}\n`);
  process.stdout.write(`  resources         ${n(p.resourceCount)}\n`);
  process.stdout.write(
    `  events/case       median ${n(p.eventsPerCase.median)}, mean ${p.eventsPerCase.mean?.toFixed(1) ?? '—'}, longest ${n(p.eventsPerCase.max)}\n`,
  );
  if (p.timeRange !== null) {
    process.stdout.write(
      `  time span         ${p.timeRange.from.toISOString()} → ${p.timeRange.to.toISOString()}\n`,
    );
  }
  if (p.findings.length > 0) process.stdout.write('\n');
  for (const f of p.findings) printFinding(f);
}

function printFinding(f: ProfileFinding): void {
  const label = { error: 'ERROR  ', warning: 'warning', info: 'info   ' }[f.severity];
  process.stdout.write(`  ${label} ${f.code}: ${f.message}\n`);
  if (f.remedy !== undefined) process.stdout.write(`          → ${f.remedy}\n`);
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
