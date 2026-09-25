import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export async function loadEnvFiles(options?: {
  readonly cwd?: string;
  readonly packageDir?: string;
}): Promise<readonly string[]> {
  const cwd = resolve(options?.cwd ?? process.cwd());
  const packageDir = options?.packageDir ?? resolve(cwd, 'packages/brisk-aitesting');
  const candidates = unique([
    join(cwd, '.env.brisk-aitesting.local'),
    join(cwd, '.env.brisk-aitesting'),
    join(cwd, '.env.local'),
    join(packageDir, '.env.brisk-aitesting.local'),
    join(packageDir, '.env.brisk-aitesting'),
    join(packageDir, '.env.local'),
  ]);
  const loaded: string[] = [];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    await loadEnvFile(path);
    loaded.push(path);
  }
  return loaded;
}

async function loadEnvFile(path: string): Promise<void> {
  const content = await readFile(path, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match === null) continue;
    const [, key, rawValue] = match;
    if (key === undefined || rawValue === undefined || process.env[key] !== undefined) continue;
    process.env[key] = unquote(rawValue.trim());
  }
}

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}
