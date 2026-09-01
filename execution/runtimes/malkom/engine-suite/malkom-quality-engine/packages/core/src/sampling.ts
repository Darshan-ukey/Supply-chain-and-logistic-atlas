import { createHash } from 'node:crypto';

/**
 * Deterministic per-item sampling. The same item always gets the same
 * decision for the same percentage, so retries and replays never flip an
 * audit verdict. Buckets are 0..9999 from a SHA-256 of stream + item.
 */

export const sampleBucket = (streamId: string, itemId: string): number => {
  const digest = createHash('sha256').update(`${streamId}:${itemId}`).digest();
  return digest.readUInt32BE(0) % 10_000;
};

export const sampled = (streamId: string, itemId: string, samplingPercent: number): boolean =>
  sampleBucket(streamId, itemId) < Math.round(samplingPercent * 100);

export const missingMandatory = (fields: Record<string, unknown>, mandatory: string[]): string[] =>
  mandatory.filter((key) => {
    const value = fields[key];
    return value === undefined || value === null || value === '';
  });
