#!/usr/bin/env node
import { readFileSync } from 'node:fs';

/**
 * malkom-metrics — ops CLI. A pure client of the REST control plane: if the
 * CLI can do it, the API can do it. No engine logic lives here.
 *
 *   MALKOM_METRICS_URL   control plane base URL (default http://127.0.0.1:7072)
 *   MALKOM_METRICS_KEY   bearer key (admin or read scope)
 *
 * Global flags `--url` and `--key` override the environment.
 */

const USAGE = `malkom-metrics — process metrics & KPI engine CLI

Usage:
  malkom-metrics describe                                Discovery document
  malkom-metrics schemas                                 JSON Schemas for config documents
  malkom-metrics registry get                            Current registry document
  malkom-metrics registry apply -f <registry.json>       Apply a registry (bumps version, sweeps)
  malkom-metrics calendar list
  malkom-metrics calendar get <name>
  malkom-metrics calendar apply -f <calendar.json>       Upsert a calendar (content-hash versioned)
  malkom-metrics metric list
  malkom-metrics metric get <name>
  malkom-metrics metric create -f <metric.json> --actor a
  malkom-metrics metric update <name> -f <metric.json> --actor a
  malkom-metrics metric validate <name> | -f <metric.json> [--live]
  malkom-metrics metric submit <name> --actor a [--reason r]
  malkom-metrics metric activate <name> --actor a [--reason r]
  malkom-metrics metric reject <name> --actor a [--reason r]
  malkom-metrics metric retire <name> --actor a [--reason r]
  malkom-metrics metric versions <name>
  malkom-metrics metric backtest <name> --from <iso> --to <iso> [--scope <json>]
  malkom-metrics assignment list [--metric m]
  malkom-metrics assignment create -f <assignment.json>
  malkom-metrics assignment delete <id>
  malkom-metrics eval calculate --metric m [--scope <json>] [--at iso]
  malkom-metrics eval snapshot [--scope <json>] [--at iso] [--mode auto|live|points]
  malkom-metrics eval series --metric m --from <iso> --to <iso> [--grain g] [--scope <json>]
  malkom-metrics eval backfill --metric m --from <iso> --to <iso> [--scope <json>]
  malkom-metrics points query --metric m [--scope-hash h] [--grain g] [--from iso] [--to iso] [--limit n]
  malkom-metrics runs query [--metric m] [--status s] [--trigger t] [--limit n]
  malkom-metrics telemetry [--json]

Global flags: --url <base-url>, --key <bearer-key>
Environment:  MALKOM_METRICS_URL, MALKOM_METRICS_KEY`;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

const ARGV = process.argv.slice(2);
const BASE = (flag(ARGV, '--url') ?? process.env['MALKOM_METRICS_URL'] ?? 'http://127.0.0.1:7072').replace(/\/+$/, '');
const KEY = flag(ARGV, '--key') ?? process.env['MALKOM_METRICS_KEY'];

/** Positional id, required: a missing or flag-shaped first arg is a usage error. */
function requireId(rest: string[], usage: string): string {
  const id = rest[0];
  if (id === undefined || id.startsWith('-')) throw new Error(usage);
  return id;
}

function fileFlag(args: string[]): string | undefined {
  return flag(args, '-f') ?? flag(args, '--file');
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function scopeFlag(args: string[]): Record<string, unknown> | undefined {
  const raw = flag(args, '--scope');
  if (raw === undefined) return undefined;
  const parsed: unknown = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('--scope must be a JSON object, e.g. --scope \'{"region":"APAC"}\'');
  }
  return parsed as Record<string, unknown>;
}

async function call(method: string, path: string, payload?: unknown, raw = false): Promise<string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (KEY !== undefined && KEY !== '') headers['authorization'] = `Bearer ${KEY}`;
  if (payload !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    process.stderr.write(`HTTP ${res.status}\n${bodyText}\n`);
    process.exit(1);
  }
  if (raw) return bodyText;
  try {
    return JSON.stringify(JSON.parse(bodyText), null, 2);
  } catch {
    return bodyText;
  }
}

function q(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined);
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

async function main(): Promise<void> {
  const argv = ARGV;
  const [cmd, sub, ...rest] = argv;

  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      return;

    case 'describe':
      console.log(await call('GET', '/v1'));
      return;

    case 'schemas':
      console.log(await call('GET', '/v1/schemas'));
      return;

    case 'registry': {
      if (sub === 'get') {
        console.log(await call('GET', '/v1/registry'));
        return;
      }
      if (sub === 'apply') {
        const file = fileFlag(argv);
        if (file === undefined) throw new Error('registry apply requires -f <registry.json>');
        console.log(await call('PUT', '/v1/registry', readJson(file)));
        return;
      }
      throw new Error(`unknown registry subcommand ${JSON.stringify(sub)}`);
    }

    case 'calendar': {
      if (sub === 'list') {
        console.log(await call('GET', '/v1/calendars'));
        return;
      }
      if (sub === 'get') {
        const name = requireId(rest, 'calendar get <name>');
        console.log(await call('GET', `/v1/calendars/${encodeURIComponent(name)}`));
        return;
      }
      if (sub === 'apply') {
        const file = fileFlag(argv);
        if (file === undefined) throw new Error('calendar apply requires -f <calendar.json>');
        console.log(await call('PUT', '/v1/calendars', readJson(file)));
        return;
      }
      throw new Error(`unknown calendar subcommand ${JSON.stringify(sub)}`);
    }

    case 'metric': {
      switch (sub) {
        case 'list':
          console.log(await call('GET', '/v1/metrics'));
          return;

        case 'get':
          console.log(
            await call('GET', `/v1/metrics/${encodeURIComponent(requireId(rest, 'metric get <name>'))}`),
          );
          return;

        case 'create': {
          const file = fileFlag(argv);
          if (file === undefined) throw new Error('metric create requires -f <metric.json>');
          const actor = flag(argv, '--actor');
          if (actor === undefined) throw new Error('metric create requires --actor <name>');
          console.log(await call('POST', '/v1/metrics', { definition: readJson(file), actor }));
          return;
        }

        case 'update': {
          const name = requireId(rest, 'metric update <name> -f <metric.json> --actor a');
          const file = fileFlag(argv);
          if (file === undefined) throw new Error('metric update requires -f <metric.json>');
          const actor = flag(argv, '--actor');
          if (actor === undefined) throw new Error('metric update requires --actor <name>');
          console.log(
            await call('PATCH', `/v1/metrics/${encodeURIComponent(name)}`, { definition: readJson(file), actor }),
          );
          return;
        }

        case 'validate': {
          const live = argv.includes('--live');
          const file = fileFlag(argv);
          if (file !== undefined) {
            // The per-name validate route accepts an inline definition in the
            // body (which then wins over the path); the doc's own name — or a
            // placeholder — anchors the URL.
            const definition = readJson(file) as { name?: string };
            const name = definition.name ?? 'definition';
            console.log(
              await call('POST', `/v1/metrics/${encodeURIComponent(name)}/validate`, { definition, ...(live ? { live } : {}) }),
            );
            return;
          }
          const name = requireId(rest, 'metric validate <name> | -f <metric.json> [--live]');
          console.log(
            await call('POST', `/v1/metrics/${encodeURIComponent(name)}/validate`, live ? { live } : {}),
          );
          return;
        }

        case 'submit':
        case 'activate':
        case 'reject':
        case 'retire': {
          const name = requireId(rest, `metric ${sub} <name> --actor <name> [--reason r]`);
          const actor = flag(argv, '--actor');
          if (actor === undefined) throw new Error(`metric ${sub} requires --actor <name>`);
          const reason = flag(argv, '--reason');
          console.log(
            await call('POST', `/v1/metrics/${encodeURIComponent(name)}/${sub}`, {
              actor,
              ...(reason !== undefined ? { reason } : {}),
            }),
          );
          return;
        }

        case 'versions':
          console.log(
            await call(
              'GET',
              `/v1/metrics/${encodeURIComponent(requireId(rest, 'metric versions <name>'))}/versions`,
            ),
          );
          return;

        case 'backtest': {
          const name = requireId(rest, 'metric backtest <name> --from <iso> --to <iso> [--scope json]');
          const fromIso = flag(argv, '--from');
          const toIso = flag(argv, '--to');
          if (fromIso === undefined || toIso === undefined) {
            throw new Error('metric backtest requires --from <iso> and --to <iso>');
          }
          const scope = scopeFlag(argv);
          console.log(
            await call('POST', `/v1/metrics/${encodeURIComponent(name)}/backtest`, {
              range: { fromIso, toIso },
              ...(scope !== undefined ? { scope } : {}),
            }),
          );
          return;
        }

        default:
          throw new Error(`unknown metric subcommand ${JSON.stringify(sub)}`);
      }
    }

    case 'assignment': {
      if (sub === 'list') {
        console.log(await call('GET', `/v1/assignments${q({ metric: flag(argv, '--metric') })}`));
        return;
      }
      if (sub === 'create') {
        const file = fileFlag(argv);
        if (file === undefined) throw new Error('assignment create requires -f <assignment.json>');
        console.log(await call('POST', '/v1/assignments', readJson(file)));
        return;
      }
      if (sub === 'delete') {
        const id = requireId(rest, 'assignment delete <id>');
        console.log(await call('DELETE', `/v1/assignments/${encodeURIComponent(id)}`));
        return;
      }
      throw new Error(`unknown assignment subcommand ${JSON.stringify(sub)}`);
    }

    case 'eval': {
      if (sub === 'calculate') {
        const metric = flag(argv, '--metric');
        if (metric === undefined) throw new Error('eval calculate requires --metric <name>');
        const scope = scopeFlag(argv);
        const at = flag(argv, '--at');
        console.log(
          await call('POST', '/v1/eval/calculate', {
            metric,
            ...(scope !== undefined ? { scope } : {}),
            ...(at !== undefined ? { at } : {}),
          }),
        );
        return;
      }
      if (sub === 'snapshot') {
        const scope = scopeFlag(argv);
        const at = flag(argv, '--at');
        const mode = flag(argv, '--mode');
        console.log(
          await call('POST', '/v1/eval/snapshot', {
            ...(scope !== undefined ? { scope } : {}),
            ...(at !== undefined ? { at } : {}),
            ...(mode !== undefined ? { mode } : {}),
          }),
        );
        return;
      }
      if (sub === 'series' || sub === 'backfill') {
        const metric = flag(argv, '--metric');
        if (metric === undefined) throw new Error(`eval ${sub} requires --metric <name>`);
        const fromIso = flag(argv, '--from');
        const toIso = flag(argv, '--to');
        if (fromIso === undefined || toIso === undefined) {
          throw new Error(`eval ${sub} requires --from <iso> and --to <iso>`);
        }
        const scope = scopeFlag(argv);
        if (sub === 'series') {
          const grain = flag(argv, '--grain');
          console.log(
            await call('POST', '/v1/eval/series', {
              metric,
              fromIso,
              toIso,
              ...(grain !== undefined ? { grain } : {}),
              ...(scope !== undefined ? { scope } : {}),
            }),
          );
          return;
        }
        console.log(
          await call('POST', '/v1/eval/backfill', {
            metric,
            range: { fromIso, toIso },
            ...(scope !== undefined ? { scope } : {}),
          }),
        );
        return;
      }
      throw new Error('eval calculate|snapshot|series|backfill …');
    }

    case 'points': {
      if (sub !== 'query') throw new Error(`unknown points subcommand ${JSON.stringify(sub)}`);
      const metric = flag(argv, '--metric');
      if (metric === undefined) throw new Error('points query requires --metric <name>');
      const query = q({
        metric,
        scopeHash: flag(argv, '--scope-hash'),
        grain: flag(argv, '--grain'),
        fromIso: flag(argv, '--from'),
        toIso: flag(argv, '--to'),
        limit: flag(argv, '--limit'),
        order: flag(argv, '--order'),
      });
      console.log(await call('GET', `/v1/points${query}`));
      return;
    }

    case 'runs': {
      if (sub !== 'query') throw new Error(`unknown runs subcommand ${JSON.stringify(sub)}`);
      const query = q({
        metric: flag(argv, '--metric'),
        status: flag(argv, '--status'),
        trigger: flag(argv, '--trigger'),
        scopeHash: flag(argv, '--scope-hash'),
        windowKey: flag(argv, '--window-key'),
        limit: flag(argv, '--limit'),
        order: flag(argv, '--order'),
      });
      console.log(await call('GET', `/v1/runs${query}`));
      return;
    }

    case 'telemetry':
      if (argv.includes('--json')) console.log(await call('GET', '/v1/telemetry.json'));
      else console.log(await call('GET', '/v1/telemetry', undefined, true));
      return;

    default:
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
