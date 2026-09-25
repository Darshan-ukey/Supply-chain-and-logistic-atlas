import { Cron } from 'croner';
import { filterColumns, IDENTIFIER_RE } from '../domain/filter.js';
import { isAdapterRef, type QueueDefinition } from './schemas.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isValidCron(expr: string): boolean {
  try {
    const job = new Cron(expr, { paused: true });
    job.stop();
    return true;
  } catch {
    return false;
  }
}

/**
 * Tier-1 static validation — cross-field rules zod cannot express. Tier-2
 * (live schema introspection) and tier-3 (sample query) live in the engine,
 * because they need a connection.
 */
export function validateQueueDefinition(def: QueueDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Schedule
  const t = def.schedule.trigger;
  if (t.kind === 'cron') {
    if (!isValidCron(t.expr)) errors.push(`schedule.trigger.expr: not a valid cron expression: ${JSON.stringify(t.expr)}`);
    if (t.tz !== undefined && !isValidTimezone(t.tz)) errors.push(`schedule.trigger.tz: unknown IANA timezone: ${JSON.stringify(t.tz)}`);
  }

  // Work binding
  if (!isAdapterRef(def.work)) {
    const w = def.work;
    const f = w.fields;
    const knownColumns = new Set<string>([
      f.id,
      f.assignee,
      f.state,
      ...(f.subQueue ? [f.subQueue.column] : []),
      ...(f.assignedAt ? [f.assignedAt.column] : []),
      ...(f.createdAt ? [f.createdAt] : []),
      ...(f.priority ? [f.priority] : []),
      ...f.attributes,
    ]);

    if (f.assignedAt?.timezone !== undefined) {
      if (!isValidTimezone(f.assignedAt.timezone)) {
        errors.push(`work.fields.assignedAt.timezone: unknown IANA timezone: ${JSON.stringify(f.assignedAt.timezone)}`);
      } else {
        warnings.push(
          'work.fields.assignedAt.timezone is set: the column is treated as a NAIVE local datetime. ' +
            'Naive columns are ambiguous during the DST fold — prefer a UTC/timestamptz column and omit timezone.',
        );
      }
    }

    for (const col of filterColumns(w.allocatableWhen)) {
      if (!IDENTIFIER_RE.test(col)) errors.push(`work.allocatableWhen: invalid column identifier ${JSON.stringify(col)}`);
    }
    for (const term of w.ordering) {
      if (!knownColumns.has(term.column) && !IDENTIFIER_RE.test(term.column)) {
        errors.push(`work.ordering: invalid column identifier ${JSON.stringify(term.column)}`);
      }
    }
    if (w.onAssign?.set) {
      for (const col of Object.keys(w.onAssign.set)) {
        if (col === f.id) errors.push('work.onAssign.set must not write the id column');
        if (col === f.assignee) errors.push('work.onAssign.set must not write the assignee column (the engine owns it)');
        if (f.assignedAt && col === f.assignedAt.column) errors.push('work.onAssign.set must not write the assignedAt column (the engine owns it)');
      }
    }
    if (w.onRelease?.set) {
      for (const col of Object.keys(w.onRelease.set)) {
        if (col === f.id) errors.push('work.onRelease.set must not write the id column');
        if (col === f.assignee) errors.push('work.onRelease.set must not write the assignee column (release clears it)');
      }
    }

    // Matching rules must reference mapped item fields.
    const itemFields = new Set<string>(['id', ...f.attributes]);
    for (const rule of def.matching) {
      if (!itemFields.has(rule.itemField)) {
        errors.push(
          `matching.itemField ${JSON.stringify(rule.itemField)} is not a mapped work attribute — add it to work.fields.attributes`,
        );
      }
    }

    if (def.staleAfter && !f.assignedAt) {
      errors.push('staleAfter requires work.fields.assignedAt (the sweep compares against the stamp column)');
    }
    if (def.staleAfter && !w.onRelease?.set) {
      warnings.push(
        'staleAfter is set but work.onRelease.set is not: released items keep their current state value. ' +
          'If onAssign.set moved them out of an allocatable state, set onRelease.set to restore it.',
      );
    }
  } else if (def.staleAfter) {
    warnings.push('staleAfter on a custom adapter queue requires the adapter to implement releaseStale(); otherwise the sweep is skipped');
  }

  // Worker binding
  if (!isAdapterRef(def.workers)) {
    const wk = def.workers;
    if (wk.fields.eligibleWhen) {
      for (const col of filterColumns(wk.fields.eligibleWhen)) {
        if (!IDENTIFIER_RE.test(col)) errors.push(`workers.fields.eligibleWhen: invalid column identifier ${JSON.stringify(col)}`);
      }
    }
    const workerAttrs = new Set<string>(['id', ...wk.fields.attributes]);
    for (const rule of def.matching) {
      if (!workerAttrs.has(rule.workerAttr)) {
        errors.push(
          `matching.workerAttr ${JSON.stringify(rule.workerAttr)} is not a mapped worker attribute — add it to workers.fields.attributes`,
        );
      }
    }
    if (wk.fields.capacity && wk.fields.capacity.column === undefined && wk.fields.capacity.default === undefined) {
      errors.push('workers.fields.capacity: provide a column, a default, or omit capacity entirely (unbounded)');
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
