import type { FieldDefinition } from './schemas.js';

/**
 * Pattern knowledge. Two passes per field:
 *   1. typed patterns — shipping-standard shapes (UN/LOCODE, ISO 6346,
 *      booking refs, AWB, incoterms, weights, dates) with honest confidences
 *   2. label proximity — "Port of Loading: INNSA" style declarations
 * A per-field hint (label alias or /regex/ capture) takes precedence over
 * both. Only missing fields are filled; existing values are never touched.
 */

const INCOTERMS = ['EXW', 'FCA', 'FAS', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const CONTAINER_TYPES = ['20GP', '40GP', '40HC', '45HC', '20RF', '40RF', '20OT', '40OT'];

export interface Hit {
  value: string | number;
  confidence: number;
}

export const typedPattern = (key: string, type: string, text: string): Hit | null => {
  const lower = key.toLowerCase();

  if (lower.includes('bookingnumber') || lower.includes('bookingref') || lower === 'shipmentref') {
    // must contain digits — words like "REQUEST" after "booking" are not refs
    const m = text.match(/\b((?:BKG|BK|CRN)[A-Z0-9]*\d[A-Z0-9]*)\b/i)
      ?? text.match(/\bbooking\s+(?:number|ref(?:erence)?)?\s*[:#-]?\s*([A-Z]*\d[A-Z0-9-]{3,13})\b/i);
    if (m?.[1]) return { value: m[1].toUpperCase(), confidence: 0.9 };
  }
  if (lower.includes('blnumber')) {
    const m = text.match(/\b([A-Z]{4}[A-Z0-9]{6,12})\b.{0,20}\b(?:b\/?l|bill of lading)\b/i)
      ?? text.match(/\b(?:b\/?l|bill of lading)[\s#:-]*([A-Z0-9]{6,16})\b/i);
    if (m?.[1]) return { value: m[1].toUpperCase(), confidence: 0.88 };
  }
  if (lower.includes('awbnumber')) {
    const m = text.match(/\b(\d{3}[- ]?\d{8})\b/);
    if (m?.[1]) return { value: m[1].replace(/[- ]/g, ''), confidence: 0.9 };
  }
  if (lower.includes('containernumber')) {
    const m = text.match(/\b([A-Z]{4}\d{7})\b/); // ISO 6346
    if (m?.[1]) return { value: m[1], confidence: 0.95 };
  }
  if (lower.includes('containertype') || lower.includes('equipment')) {
    const m = CONTAINER_TYPES.find((t) => new RegExp(`\\b(?:\\d+\\s*x\\s*)?${t}\\b`, 'i').test(text));
    if (m !== undefined) return { value: m, confidence: 0.9 };
  }
  if (lower.includes('portofloading') || lower.includes('originport') || lower === 'pol') {
    const m = text.match(/\b(?:from|ex|pol|origin|loading)\s*[:\s]\s*([A-Z]{5})\b/i) ?? text.match(/\b([A-Z]{5})\b\s*(?:to|->|→)/);
    if (m?.[1] && /^[A-Z]{2}[A-Z0-9]{3}$/.test(m[1].toUpperCase())) return { value: m[1].toUpperCase(), confidence: 0.82 };
  }
  if (lower.includes('portofdischarge') || lower.includes('destinationport') || lower === 'pod') {
    const m = text.match(/\b(?:to|pod|destination|discharge)\s*[:\s]\s*([A-Z]{5})\b/i) ?? text.match(/(?:to|->|→)\s*\b([A-Z]{5})\b/);
    if (m?.[1] && /^[A-Z]{2}[A-Z0-9]{3}$/.test(m[1].toUpperCase())) return { value: m[1].toUpperCase(), confidence: 0.82 };
  }
  if (lower.includes('incoterm')) {
    const m = INCOTERMS.find((term) => new RegExp(`\\b${term}\\b`, 'i').test(text));
    if (m !== undefined) return { value: m, confidence: 0.92 };
  }
  if (lower.includes('weight')) {
    const m = text.match(/\b([\d,.]+)\s*(?:kgs?|kilograms?)\b/i);
    if (m?.[1]) return { value: Number(m[1].replace(/,/g, '')), confidence: 0.88 };
  }
  if (type === 'date' || lower.includes('etd') || lower.includes('eta') || lower.includes('date')) {
    const m = text.match(/\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
    if (m?.[1]) return { value: m[1], confidence: 0.75 };
  }
  return null;
};

/** "Label: value" / "Label - value" declarations near the field's label words. */
export const labelProximity = (label: string, text: string): Hit | null => {
  const words = label.replace(/[^a-zA-Z ]/g, '').trim();
  if (words.length < 3) return null;
  const pattern = new RegExp(`${words.replace(/\s+/g, '\\s+')}\\s*[:\\-–]\\s*([^\\n,;.]{2,60})`, 'i');
  const m = text.match(pattern);
  if (m?.[1]) return { value: m[1].trim(), confidence: 0.7 };
  return null;
};

const hintHit = (hint: string, text: string): Hit | null => {
  if (hint.startsWith('/') && hint.endsWith('/') && hint.length > 2) {
    try {
      const m = text.match(new RegExp(hint.slice(1, -1), 'i'));
      if (m) return { value: (m[1] ?? m[0]).trim(), confidence: 0.9 };
    } catch {
      return null; // invalid custom regex — fall through to defaults
    }
    return null;
  }
  return labelProximity(hint, text);
};

export const extractFields = (
  text: string,
  fields: FieldDefinition[],
  existing: Record<string, unknown>,
  fieldHints: Record<string, string>,
  confidenceFloor: number,
): { fields: Record<string, string | number>; confidence: Record<string, number>; extracted: number } => {
  const out: Record<string, string | number> = {};
  const confidence: Record<string, number> = {};
  let extracted = 0;
  for (const field of fields) {
    const current = existing[field.key];
    if (current !== undefined && current !== null && current !== '') continue; // never overwrite
    const hint = fieldHints[field.key];
    const hit = (hint !== undefined ? hintHit(hint, text) : null)
      ?? typedPattern(field.key, field.type, text)
      ?? labelProximity(field.label, text);
    if (hit !== null && hit.confidence >= confidenceFloor) {
      out[field.key] = hit.value;
      confidence[field.key] = hit.confidence;
      extracted += 1;
    }
  }
  return { fields: out, confidence, extracted };
};
