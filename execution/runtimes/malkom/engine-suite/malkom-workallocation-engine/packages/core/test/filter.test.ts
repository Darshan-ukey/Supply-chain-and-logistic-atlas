import { describe, expect, it } from 'vitest';
import {
  buildCandidateSelect,
  buildClaimUpdate,
  evaluateFilter,
  filterExprSchema,
  postgresDialect,
  sqliteDialect,
  workSourceBindingSchema,
  type FilterExpr,
} from '../src/index.js';
import { parseQueue } from './helpers.js';
import { isAdapterRef } from '../src/config/schemas.js';

describe('evaluateFilter', () => {
  const row = { status: 'NEW', priority: 5, region: null, active: true, name: 'alpha' };

  it.each<[FilterExpr, boolean]>([
    [{ op: 'eq', column: 'status', value: 'NEW' }, true],
    [{ op: 'eq', column: 'status', value: 'OLD' }, false],
    [{ op: 'eq', column: 'region', value: null }, true],
    [{ op: 'neq', column: 'region', value: 'EU' }, false], // SQL: NULL <> x is not true
    [{ op: 'in', column: 'status', values: ['NEW', 'REOPENED'] }, true],
    [{ op: 'notIn', column: 'status', values: ['CLOSED'] }, true],
    [{ op: 'notIn', column: 'region', values: ['EU'] }, false], // NULL NOT IN is not true
    [{ op: 'isNull', column: 'region' }, true],
    [{ op: 'isNotNull', column: 'region' }, false],
    [{ op: 'gt', column: 'priority', value: 4 }, true],
    [{ op: 'lte', column: 'priority', value: 4 }, false],
    [{ op: 'gt', column: 'region', value: 1 }, false], // comparisons against NULL never true
    [{ op: 'and', args: [{ op: 'eq', column: 'status', value: 'NEW' }, { op: 'gt', column: 'priority', value: 1 }] }, true],
    [{ op: 'or', args: [{ op: 'eq', column: 'status', value: 'X' }, { op: 'eq', column: 'active', value: true }] }, true],
    [{ op: 'not', arg: { op: 'eq', column: 'status', value: 'NEW' } }, false],
  ])('%j → %s', (expr, expected) => {
    expect(evaluateFilter(expr, row)).toBe(expected);
  });

  it('tolerates driver stringification of numbers', () => {
    expect(evaluateFilter({ op: 'eq', column: 'n', value: 5 }, { n: '5' })).toBe(true);
    expect(evaluateFilter({ op: 'gt', column: 'n', value: 4 }, { n: '5' })).toBe(true);
  });
});

describe('filter schema safety', () => {
  it('rejects non-identifier column names', () => {
    expect(filterExprSchema.safeParse({ op: 'eq', column: 'a"; DROP TABLE x; --', value: 1 }).success).toBe(false);
    expect(filterExprSchema.safeParse({ op: 'eq', column: 'ok_col$1', value: 1 }).success).toBe(true);
  });

  it('rejects binding tables/columns with hostile identifiers at parse time', () => {
    const def = parseQueue();
    if (isAdapterRef(def.work)) throw new Error('unexpected');
    const bad = { ...def.work, fields: { ...def.work.fields, assignee: 'owner"; --' } };
    expect(workSourceBindingSchema.safeParse(bad).success).toBe(false);
  });
});

describe('SQL compiler', () => {
  const def = parseQueue();
  const work = isAdapterRef(def.work) ? (() => { throw new Error('unexpected'); })() : def.work;

  it('builds a guarded, fully parameterized claim for sqlite', () => {
    const sql = buildClaimUpdate(work, sqliteDialect, '42', 'agent-1', new Date('2026-08-12T10:00:00Z'));
    expect(sql.text).toContain('UPDATE "tasks" SET "owner" = ?');
    expect(sql.text).toContain(`"assigned_at" = strftime`);
    expect(sql.text).toContain('"status" = ?'); // onAssign.set
    expect(sql.text).toContain('WHERE "task_id" = ?');
    expect(sql.text).toContain('("owner" IS NULL)'); // unassigned guard
    expect(sql.text).toContain('"status" IN (?)'); // allocatable guard re-checked
    expect(sql.params).toEqual(['agent-1', 'ASSIGNED', '42', 'NEW']);
  });

  it('numbers postgres placeholders in emission order', () => {
    const sql = buildClaimUpdate(work, postgresDialect, '42', 'agent-1', new Date());
    const seen = [...sql.text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(Math.max(...seen)).toBe(sql.params.length);
  });

  it('orders and bounds the candidate select', () => {
    const sql = buildCandidateSelect(work, sqliteDialect, 200);
    expect(sql.text).toContain('ORDER BY "created_at" ASC');
    expect(sql.text).toContain('LIMIT ?');
    expect(sql.params).toContain(200);
    expect(sql.text).toContain('"task_id" AS __id');
  });

  it('escapes embedded quotes in identifiers by doubling', () => {
    expect(sqliteDialect.quoteIdent('we"ird')).toBe('"we""ird"');
  });
});
