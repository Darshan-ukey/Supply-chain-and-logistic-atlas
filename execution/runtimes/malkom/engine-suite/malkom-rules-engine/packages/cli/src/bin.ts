#!/usr/bin/env node
import { readFileSync } from 'node:fs';

/**
 * malkom-rules — ops CLI. A pure client of the REST control plane: if the CLI
 * can do it, the API can do it. No engine logic lives here.
 *
 *   MALKOM_RULES_URL      control plane base URL (default http://127.0.0.1:7071)
 *   MALKOM_RULES_API_KEY  bearer key (admin or read scope)
 */

const BASE = (process.env['MALKOM_RULES_URL'] ?? 'http://127.0.0.1:7071').replace(/\/+$/, '');
const KEY = process.env['MALKOM_RULES_API_KEY'];

const USAGE = `malkom-rules — business rules engine CLI

Usage:
  malkom-rules status                                    Discovery document
  malkom-rules schemas                                   JSON Schemas for config documents
  malkom-rules registry get                              Current registry document
  malkom-rules registry push -f <registry.json>          Apply a registry (bumps version)
  malkom-rules groups list
  malkom-rules groups query [--entity e] [--state s] [--touches-field f] [--text t] [--expiring-before iso]
  malkom-rules groups get <id>
  malkom-rules groups push -f <group.json> [--id <id>] [--actor a]   Create a draft (or update with --id)
  malkom-rules groups validate <id> | -f <group.json>    Tiered validation
  malkom-rules groups backtest <id> | -f <group.json> [--sample n]   Read-only replay against host rows
  malkom-rules groups submit <id> --actor a [--reason r]
  malkom-rules groups activate <id> --actor a [--reason r]
  malkom-rules groups reject <id> --actor a [--reason r]
  malkom-rules groups retire <id> --actor a [--reason r]
  malkom-rules eval applicable --entity e -f <props.json> [--as-of iso]
  malkom-rules eval explain --entity e -f <row.json> [--as-of iso]
  malkom-rules eval apply --entity e -f <row.json> [--as-of iso]
  malkom-rules decisions list [--entity e] [--entity-id id] [--limit n]
  malkom-rules consistency                               Pairwise overlapping-write analysis
  malkom-rules metrics [--json]

Environment: MALKOM_RULES_URL, MALKOM_RULES_API_KEY`;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
}

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
  const argv = process.argv.slice(2);
  const [cmd, sub, ...rest] = argv;

  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      return;

    case 'status':
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
      if (sub === 'push') {
        const file = fileFlag(argv);
        if (file === undefined) throw new Error('registry push requires -f <registry.json>');
        console.log(await call('PUT', '/v1/registry', readJson(file)));
        return;
      }
      throw new Error(`unknown registry subcommand ${JSON.stringify(sub)}`);
    }

    case 'groups': {
      switch (sub) {
        case 'list':
          console.log(await call('GET', '/v1/groups'));
          return;

        case 'query': {
          const query = q({
            entity: flag(argv, '--entity'),
            state: flag(argv, '--state'),
            touchesField: flag(argv, '--touches-field'),
            text: flag(argv, '--text'),
            expiringBefore: flag(argv, '--expiring-before'),
          });
          console.log(await call('GET', `/v1/groups${query}`));
          return;
        }

        case 'get':
          console.log(
            await call('GET', `/v1/groups/${encodeURIComponent(requireId(rest, 'groups get <id>'))}`),
          );
          return;

        case 'push': {
          const file = fileFlag(argv);
          if (file === undefined) throw new Error('groups push requires -f <group.json>');
          const actor = flag(argv, '--actor');
          const payload = { definition: readJson(file), ...(actor !== undefined ? { actor } : {}) };
          const id = flag(argv, '--id');
          if (id !== undefined) {
            console.log(await call('PUT', `/v1/groups/${encodeURIComponent(id)}`, payload));
          } else {
            console.log(await call('POST', '/v1/groups', payload));
          }
          return;
        }

        case 'validate': {
          const file = fileFlag(argv);
          if (file !== undefined) {
            console.log(await call('POST', '/v1/validate', { definition: readJson(file) }));
            return;
          }
          const id = requireId(rest, 'groups validate <id> | -f <group.json>');
          console.log(await call('POST', `/v1/groups/${encodeURIComponent(id)}/validate`));
          return;
        }

        case 'backtest': {
          const sample = flag(argv, '--sample');
          const opts = sample !== undefined ? { sample: Number(sample) } : {};
          const file = fileFlag(argv);
          if (file !== undefined) {
            console.log(await call('POST', '/v1/backtest', { definition: readJson(file), ...opts }));
            return;
          }
          const id = requireId(rest, 'groups backtest <id> | -f <group.json> [--sample n]');
          console.log(await call('POST', `/v1/groups/${encodeURIComponent(id)}/backtest`, opts));
          return;
        }

        case 'submit':
        case 'activate':
        case 'reject':
        case 'retire': {
          const id = requireId(rest, `groups ${sub} <id> --actor <name> [--reason r]`);
          const actor = flag(argv, '--actor');
          if (actor === undefined) throw new Error(`groups ${sub} requires --actor <name>`);
          const reason = flag(argv, '--reason');
          console.log(
            await call('POST', `/v1/groups/${encodeURIComponent(id)}/${sub}`, {
              actor,
              ...(reason !== undefined ? { reason } : {}),
            }),
          );
          return;
        }

        default:
          throw new Error(`unknown groups subcommand ${JSON.stringify(sub)}`);
      }
    }

    case 'eval': {
      if (sub !== 'applicable' && sub !== 'explain' && sub !== 'apply') {
        throw new Error('eval applicable|explain|apply --entity <e> -f <json-file> [--as-of iso]');
      }
      const entity = flag(argv, '--entity');
      if (entity === undefined) throw new Error(`eval ${sub} requires --entity <entity>`);
      const file = fileFlag(argv);
      if (file === undefined) throw new Error(`eval ${sub} requires -f <json-file>`);
      const data = readJson(file);
      const asOf = flag(argv, '--as-of');
      const payload = {
        entity,
        [sub === 'applicable' ? 'props' : 'row']: data,
        ...(asOf !== undefined ? { asOf } : {}),
      };
      console.log(await call('POST', `/v1/eval/${sub}`, payload));
      return;
    }

    case 'decisions': {
      if (sub !== 'list') throw new Error(`unknown decisions subcommand ${JSON.stringify(sub)}`);
      const query = q({
        entity: flag(argv, '--entity'),
        entityId: flag(argv, '--entity-id'),
        limit: flag(argv, '--limit'),
      });
      console.log(await call('GET', `/v1/decisions${query}`));
      return;
    }

    case 'consistency':
      console.log(await call('GET', '/v1/consistency'));
      return;

    case 'metrics':
      if (argv.includes('--json')) console.log(await call('GET', '/v1/metrics.json'));
      else console.log(await call('GET', '/v1/metrics', undefined, true));
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
