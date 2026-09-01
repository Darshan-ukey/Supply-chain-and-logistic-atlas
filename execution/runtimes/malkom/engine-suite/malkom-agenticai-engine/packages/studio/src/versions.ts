import { versionSchema } from "@malkom/agenticai-contract";

/**
 * Versions.
 *
 * Every save creates a draft version. Every publish creates a numbered
 * version. Versions never change after publishing — an upgrade is a new
 * version. Publishing puts the version in the shop as "pending": it cannot
 * reach a customer until it has passed testing on that customer's UAT.
 *
 * The rules live here as pure functions; the Command's studio stores the
 * records and runs git underneath.
 */

/** A published version's standing in the shop. Publishing starts at pending. */
export type PublishedStatus = "pending";

export const compareVersions = (a: string, b: string): number => {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
};

/** The next version a publish would default to: the last one, minor bumped. */
export const nextVersion = (published: readonly string[]): string => {
  if (published.length === 0) return "1.0.0";
  const last = [...published].sort(compareVersions).at(-1) ?? "1.0.0";
  const [major, minor] = last.split(".").map(Number);
  return `${major ?? 1}.${(minor ?? 0) + 1}.0`;
};

/**
 * May this publish happen? A version that already exists is refused —
 * published versions never change — and a version below the latest is
 * refused so the numbering only moves forward.
 */
export const checkPublish = (
  published: readonly string[],
  version: string,
): { ok: true } | { ok: false; problems: string[] } => {
  const problems: string[] = [];
  if (!versionSchema.safeParse(version).success) {
    problems.push(`"${version}" is not a version like 1.0.0`);
  } else {
    if (published.includes(version)) {
      problems.push(`version ${version} is already published — published versions never change`);
    }
    const latest = [...published].sort(compareVersions).at(-1);
    if (latest !== undefined && compareVersions(version, latest) < 0) {
      problems.push(`version ${version} is below the latest published version ${latest}`);
    }
  }
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
};
