#!/usr/bin/env node
import { readFileSync } from 'node:fs';

/**
 * malkom-alloc — ops CLI. A pure client of the REST control plane: if the CLI
 * can do it, the API can do it. No engine logic lives here.
 *
 *   MALKOM_URL      control plane base URL (default http://127.0.0.1:7070)
 *   MALKOM_API_KEY  bearer key (admin or read scope)
 */

const BASE = (process.env['MALKOM_URL'] ?? 'http://127.0.0.1:7070').replace(/\/+$/, '');
const KEY = process.env['MALKOM_API_KEY'];

const USAGE = `malkom-alloc — work allocation engine CLI

Usage:
  malkom-alloc status                                 Discovery document
  malkom-alloc queues list
  malkom-alloc queues get <id>
  malkom-alloc queues apply -f <file.json>            PUT a queue definition (id from file)
  malkom-alloc queues delete <id>
  malkom-alloc queues pause <id> | resume <id>
  malkom-alloc validate <id>                          Three-tier validation
  malkom-alloc dry-run <id>                           Full pipeline, no writes
  malkom-alloc trigger <id>                           Run now
  malkom-alloc release <id> <itemId> [itemId...]      Release items back to the pool
  malkom-alloc provision <connectionRef> [--table name] [--schema s]   Create default workEvents table
  malkom-alloc schedules
  malkom-alloc runs [--queue q] [--status s] [--limit n] [--offset n]
  malkom-alloc runs summary [--queue q] [--since iso] [--until iso]
  malkom-alloc runs get <id>
  malkom-alloc coverage <connectionRef> [--table name]   Waiting work with no allocation rules
  malkom-alloc runs delete [--queue q] [--status s] [--before iso] | runs delete <id>
  malkom-alloc allocations [--queue q] [--worker w] [--item i] [--limit n]
  malkom-alloc metrics [--json]
  malkom-alloc config get
  malkom-alloc config apply -f <bundle.json> [--expect <version>]

Environment: MALKOM_URL, MALKOM_API_KEY`;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return undefined;
  return args[i + 1];
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

    case 'queues': {
      switch (sub) {
        case 'list':
          console.log(await call('GET', '/v1/queues'));
          return;
        case 'get':
          console.log(await call('GET', `/v1/queues/${encodeURIComponent(rest[0] ?? '')}`));
          return;
        case 'apply': {
          const file = flag(argv, '-f') ?? flag(argv, '--file');
          if (file === undefined) throw new Error('queues apply requires -f <file.json>');
          const def = JSON.parse(readFileSync(file, 'utf8')) as { id?: string };
          if (typeof def.id !== 'string') throw new Error('queue definition file must contain an "id"');
          console.log(await call('PUT', `/v1/queues/${encodeURIComponent(def.id)}`, def));
          return;
        }
        case 'delete':
          console.log(await call('DELETE', `/v1/queues/${encodeURIComponent(rest[0] ?? '')}`));
          return;
        case 'pause':
        case 'resume':
          console.log(await call('POST', `/v1/queues/${encodeURIComponent(rest[0] ?? '')}/${sub}`));
          return;
        default:
          throw new Error(`unknown queues subcommand ${JSON.stringify(sub)}`);
      }
    }

    case 'validate':
    case 'trigger':
      console.log(await call('POST', `/v1/queues/${encodeURIComponent(sub ?? '')}/${cmd === 'validate' ? 'validate' : 'trigger'}`));
      return;

    case 'dry-run':
      console.log(await call('POST', `/v1/queues/${encodeURIComponent(sub ?? '')}/dry-run`));
      return;

    case 'release': {
      if (sub === undefined || rest.length === 0) throw new Error('release <queueId> <itemId> [itemId...]');
      console.log(await call('POST', `/v1/queues/${encodeURIComponent(sub)}/release`, { itemIds: rest }));
      return;
    }

    case 'provision': {
      if (sub === undefined) throw new Error('provision <connectionRef> [--table name] [--schema s]');
      const table = flag(argv, '--table');
      const schema = flag(argv, '--schema');
      console.log(
        await call('POST', `/v1/connections/${encodeURIComponent(sub)}/provision-work-events`, {
          ...(table !== undefined ? { table } : {}),
          ...(schema !== undefined ? { schema } : {}),
        }),
      );
      return;
    }

    case 'schedules':
      console.log(await call('GET', '/v1/schedules'));
      return;

    case 'coverage': {
      if (sub === undefined) throw new Error('coverage <connectionRef> [--table name] [--schema s]');
      const query = q({
        connectionRef: sub,
        table: flag(argv, '--table'),
        schema: flag(argv, '--schema'),
      });
      console.log(await call('GET', `/v1/coverage${query}`));
      return;
    }

    case 'runs': {
      if (sub === 'summary') {
        const query = q({
          queueId: flag(argv, '--queue'),
          since: flag(argv, '--since'),
          until: flag(argv, '--until'),
        });
        console.log(await call('GET', `/v1/runs/summary${query}`));
        return;
      }
      if (sub === 'get') {
        console.log(await call('GET', `/v1/runs/${encodeURIComponent(rest[0] ?? '')}`));
        return;
      }
      if (sub === 'delete') {
        const first = rest[0];
        if (first !== undefined && !first.startsWith('--')) {
          console.log(await call('DELETE', `/v1/runs/${encodeURIComponent(first)}`));
          return;
        }
        const query = q({ queueId: flag(argv, '--queue'), status: flag(argv, '--status'), before: flag(argv, '--before') });
        if (query === '') throw new Error('runs delete requires an id or at least one of --queue/--status/--before');
        console.log(await call('DELETE', `/v1/runs${query}`));
        return;
      }
      const query = q({
        queueId: flag(argv, '--queue'),
        status: flag(argv, '--status'),
        limit: flag(argv, '--limit'),
        offset: flag(argv, '--offset'),
      });
      console.log(await call('GET', `/v1/runs${query}`));
      return;
    }

    case 'allocations': {
      const query = q({
        queueId: flag(argv, '--queue'),
        workerId: flag(argv, '--worker'),
        itemId: flag(argv, '--item'),
        limit: flag(argv, '--limit'),
      });
      console.log(await call('GET', `/v1/allocations${query}`));
      return;
    }

    case 'metrics':
      if (argv.includes('--json')) console.log(await call('GET', '/v1/metrics.json'));
      else console.log(await call('GET', '/v1/metrics', undefined, true));
      return;

    case 'config': {
      if (sub === 'get') {
        console.log(await call('GET', '/v1/config'));
        return;
      }
      if (sub === 'apply') {
        const file = flag(argv, '-f') ?? flag(argv, '--file');
        if (file === undefined) throw new Error('config apply requires -f <bundle.json>');
        const bundle = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
        const expect = flag(argv, '--expect');
        if (expect !== undefined) bundle['expectedVersion'] = Number(expect);
        console.log(await call('POST', '/v1/config/apply', bundle));
        return;
      }
      throw new Error(`unknown config subcommand ${JSON.stringify(sub)}`);
    }

    default:
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
