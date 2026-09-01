import { describe, expect, it } from 'vitest';
import { kindOf, suggestBindings, type SchemaMap } from '../src/runtime/discover-schema.js';

/**
 * Reading a host schema so nobody has to type a table name.
 *
 * The property that matters is not that a guess is right — a person confirms
 * it — but that every guess arrives with a REASON they can check. A suggestion
 * nobody can verify is worse than none, because it gets accepted and the map
 * is then quietly wrong.
 */

const schema: SchemaMap = {
  tables: [
    {
      schema: 'public',
      name: 'task_events',
      approxRows: 15830,
      columns: [
        { name: 'id', dataType: 'uuid', nullable: false, kind: 'text' },
        { name: 'task_id', dataType: 'uuid', nullable: false, kind: 'text' },
        { name: 'type', dataType: 'character varying', nullable: false, kind: 'text' },
        { name: 'actor', dataType: 'character varying', nullable: false, kind: 'text' },
        { name: 'created_at', dataType: 'timestamp with time zone', nullable: false, kind: 'timestamp' },
      ],
      foreignKeys: [{ column: 'task_id', toSchema: 'public', toTable: 'tasks', toColumn: 'id' }],
    },
    {
      schema: 'public',
      name: 'countries',
      approxRows: 195,
      columns: [
        { name: 'code', dataType: 'character varying', nullable: false, kind: 'text' },
        { name: 'name', dataType: 'character varying', nullable: false, kind: 'text' },
      ],
      foreignKeys: [],
    },
  ],
};

describe('proposing a binding', () => {
  it('picks the table that looks like an event log', () => {
    const [best] = suggestBindings(schema);
    expect(best?.table).toBe('task_events');
    expect(best?.caseKey?.column).toBe('task_id');
    expect(best?.timestamp?.column).toBe('created_at');
    expect(best?.activity?.column).toBe('type');
    expect(best?.resource?.column).toBe('actor');
  });

  it('offers the join the foreign key implies', () => {
    const [best] = suggestBindings(schema);
    expect(best?.joinTo).toEqual({
      schema: 'public',
      table: 'tasks',
      localColumn: 'task_id',
      foreignColumn: 'id',
    });
  });

  it('explains every guess in words a non-specialist can check', () => {
    const [best] = suggestBindings(schema);
    expect(best?.reasons.length).toBeGreaterThanOrEqual(4);
    // No jargon in the justification — that is the whole point of it.
    for (const reason of best?.reasons ?? []) {
      expect(reason).not.toMatch(/directly-follows|conformance|heuristic|entropy/i);
    }
    expect(best?.reasons.join(' ')).toContain('that is what a case is');
  });

  it('ignores a table with no time in it', () => {
    // A list of countries is not a process, whatever else it has.
    expect(suggestBindings(schema).some((s) => s.table === 'countries')).toBe(false);
  });

  it('says what is missing rather than quietly guessing', () => {
    const thin: SchemaMap = {
      tables: [
        {
          schema: 'public',
          name: 'pings',
          approxRows: 10,
          columns: [
            { name: 'at', dataType: 'timestamp with time zone', nullable: false, kind: 'timestamp' },
          ],
          foreignKeys: [],
        },
      ],
    };
    const [only] = suggestBindings(thin);
    expect(only?.caseKey).toBeNull();
    expect(only?.missing.join(' ')).toContain('groups rows into one case');
    expect(only?.confidence).toBeLessThan(0.5);
  });
});

describe('a camelCase schema', () => {
  /**
   * The bug this pins down: `workEvents` was discovered, listed, and then
   * never offered. Every case and resource hint is written snake_case, and
   * lowercasing `caseId` gives `caseid`, which does not contain `case_id` —
   * so half the columns scored zero and the table sank below the cut. Nothing
   * on screen said the table had been considered and dropped.
   */
  const camel: SchemaMap = {
    tables: [
      {
        schema: 'public',
        name: 'workEvents',
        approxRows: null,
        columns: [
          { name: 'id', dataType: 'text', nullable: false, kind: 'text' },
          { name: 'workItemId', dataType: 'text', nullable: false, kind: 'text' },
          { name: 'eventType', dataType: 'text', nullable: false, kind: 'text' },
          { name: 'performedBy', dataType: 'text', nullable: true, kind: 'text' },
          { name: 'createdAt', dataType: 'timestamp with time zone', nullable: false, kind: 'timestamp' },
        ],
        foreignKeys: [],
      },
    ],
  };

  it('is read as readily as a snake_case one', () => {
    const [only] = suggestBindings(camel);
    expect(only?.table).toBe('workEvents');
    expect(only?.timestamp?.column).toBe('createdAt');
    expect(only?.activity?.column).toBe('eventType');
    expect(only?.resource?.column).toBe('performedBy');
  });

  it('takes a column ending in id as the case, but never the row own id', () => {
    const [only] = suggestBindings(camel);
    expect(only?.caseKey?.column).toBe('workItemId');
  });

  it('matches caseId against the hint written case_id', () => {
    const withCaseId: SchemaMap = {
      tables: [
        {
          schema: 'public',
          name: 'events',
          approxRows: null,
          columns: [
            { name: 'caseId', dataType: 'text', nullable: false, kind: 'text' },
            { name: 'workItemId', dataType: 'text', nullable: false, kind: 'text' },
            { name: 'at', dataType: 'timestamp with time zone', nullable: false, kind: 'timestamp' },
          ],
          foreignKeys: [],
        },
      ],
    };
    // Both columns end in id; the one a hint NAMES has to win.
    expect(suggestBindings(withCaseId)[0]?.caseKey?.column).toBe('caseId');
  });

  it('still catches a hint glued into a longer word', () => {
    const glued: SchemaMap = {
      tables: [
        {
          schema: 'public',
          name: 'events',
          approxRows: null,
          columns: [
            { name: 'username', dataType: 'text', nullable: false, kind: 'text' },
            { name: 'at', dataType: 'timestamp with time zone', nullable: false, kind: 'timestamp' },
          ],
          foreignKeys: [],
        },
      ],
    };
    expect(suggestBindings(glued)[0]?.resource?.column).toBe('username');
  });
});

describe('how many are offered', () => {
  it('returns every table that could be an event log, not a top few', () => {
    const many: SchemaMap = {
      tables: Array.from({ length: 9 }, (_, i) => ({
        schema: 'public',
        name: `log_${i}`,
        approxRows: i,
        columns: [
          { name: 'at', dataType: 'timestamp with time zone', nullable: false, kind: 'timestamp' as const },
        ],
        foreignKeys: [],
      })),
    };
    expect(suggestBindings(many)).toHaveLength(9);
    // A caller that wants fewer asks for fewer.
    expect(suggestBindings(many, 3)).toHaveLength(3);
  });
});

describe('column kinds', () => {
  it('recognises the types a role can be played by', () => {
    expect(kindOf('timestamp with time zone')).toBe('timestamp');
    expect(kindOf('character varying')).toBe('text');
    expect(kindOf('bigint')).toBe('number');
    expect(kindOf('jsonb')).toBe('json');
    expect(kindOf('boolean')).toBe('boolean');
  });
});
