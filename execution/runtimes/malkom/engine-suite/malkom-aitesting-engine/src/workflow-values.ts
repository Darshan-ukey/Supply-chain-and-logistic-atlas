/**
 * Single source of truth for workflow value names and references.
 *
 * A workflow value name is either a plain name such as `channelId` or a
 * step-scoped name such as `step_create_channel_1.channelId`. The scoped form
 * carries the identity of the exact step that produced the value, so two
 * steps that each create a channel can never be confused with each other —
 * in requests, in assertions, or in cleanup.
 */

/** One name segment: letters, digits, `_`, `$`, `-`; must not start with a digit. */
const SEGMENT = '[A-Za-z_$][A-Za-z0-9_$-]*';

/** A value name: one segment, optionally scoped by a producing step id segment. */
export const WORKFLOW_NAME_PATTERN = `${SEGMENT}(?:\\.${SEGMENT})?`;

/** Anchored form for validating a capture name exactly. */
export const WORKFLOW_NAME_EXACT = new RegExp(`^${WORKFLOW_NAME_PATTERN}$`);

const ANGLE_REFERENCE = new RegExp(`<(${WORKFLOW_NAME_PATTERN})>`, 'g');
const BRACE_REFERENCE = new RegExp(`\\{(${WORKFLOW_NAME_PATTERN})\\}`, 'g');

export function angleReferencePattern(): RegExp {
  return new RegExp(ANGLE_REFERENCE.source, 'g');
}

export function braceReferencePattern(): RegExp {
  return new RegExp(BRACE_REFERENCE.source, 'g');
}

/** Values the engine can always make up safely (they are never captured). */
export function isBuiltinWorkflowVariable(name: string): boolean {
  return ['unique', 'uuid', 'timestamp', 'now'].includes(name.toLowerCase());
}

/**
 * The capture name for a step output: `<stepId>.<semanticName>`.
 * Both the producing side (the capture) and the consuming side (the
 * placeholder) derive the name with this one function, so they always agree.
 */
export function scopedCaptureName(stepId: string, semanticType: string): string {
  return `${sanitizeNameSegment(stepId)}.${captureNameFromSemanticType(semanticType)}`;
}

/** Turn a semantic type such as `channel.id` into a camel name such as `channelId`. */
export function captureNameFromSemanticType(value: string): string {
  const parts = value.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return parts.map((part, index) => index === 0 ? part.toLowerCase() : `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join('') || 'value';
}

function sanitizeNameSegment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_$-]+/g, '_');
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

/**
 * Collect every `<name>` and `{name}` reference inside a value
 * (recursively through arrays and objects).
 */
export function collectWorkflowReferences(value: unknown): readonly string[] {
  const found = new Set<string>();
  collect(value, found);
  return [...found];
}

function collect(value: unknown, found: Set<string>): void {
  if (typeof value === 'string') {
    for (const match of value.matchAll(angleReferencePattern())) found.add(match[1]!);
    for (const match of value.matchAll(braceReferencePattern())) found.add(match[1]!);
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collect(entry, found);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) collect(entry, found);
  }
}
