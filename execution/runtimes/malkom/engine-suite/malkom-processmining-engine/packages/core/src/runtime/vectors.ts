/**
 * Sparse vectors, cosine distance, and agglomerative grouping.
 *
 * Two analyses need exactly this and would otherwise carry a copy each: trace
 * clustering groups ROUTES that behave alike, and the team picture groups
 * PEOPLE who do alike. The objects differ; the arithmetic does not, and two
 * copies of a distance function is two chances to drift apart on a tie-break
 * and produce groupings that quietly disagree.
 *
 * Kept deliberately small and free of any process-mining vocabulary. What a
 * feature MEANS is the caller's business — `a:Approve`, `p:A>B`, an activity
 * name — and nothing here needs to know.
 *
 * All of this runs in the application rather than in SQL, which is the right
 * place for it only because the inputs are already aggregated: a few dozen
 * vectors over a few hundred features. Counting the events that produce them
 * stays in the database, where the rows are.
 */

/**
 * Scale a count vector to unit length.
 *
 * The reason cosine distance can compare shape at all. Without it, a person
 * who handled ten thousand events and a person who handled forty sit far apart
 * for doing the same job at different volumes — which is the one thing this
 * measure exists not to say.
 */
export function unitVector(counts: ReadonlyMap<string, number>): Map<string, number> {
  let sumOfSquares = 0;
  for (const value of counts.values()) sumOfSquares += value * value;
  const length = Math.sqrt(sumOfSquares);
  if (length === 0) return new Map(counts);

  const scaled = new Map<string, number>();
  for (const [key, value] of counts) scaled.set(key, value / length);
  return scaled;
}

/**
 * Cosine distance between two UNIT vectors: 0 identical, 1 sharing nothing.
 *
 * Assumes both sides are already normalised — the dot product of two unit
 * vectors is the cosine, so no division is needed here and doing it per pair
 * would repeat the same square root O(n²) times.
 *
 * Walks the smaller map: a feature absent from one side contributes nothing to
 * a dot product, so there is no reason to visit it.
 */
export function cosineDistance(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>,
): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [key, value] of small) dot += value * (large.get(key) ?? 0);
  // Clamped: floating-point error can push a dot product a hair above 1 and
  // produce a negative distance, which every consumer would then have to guard.
  return Math.min(1, Math.max(0, 1 - dot));
}

/**
 * Merge the closest pair until `wanted` groups remain.
 *
 * Average linkage: the distance between two groups is the mean distance
 * between their members. Single linkage chains — one bridging member drags two
 * unrelated groups together — and complete linkage splits a genuinely broad
 * group for the sake of one outlier. Average sits between and is the usual
 * choice.
 *
 * The full pairwise matrix is computed once. Inputs here are dozens of
 * vectors, not thousands, so the matrix is small and recomputing distances on
 * every merge would cost far more than storing it.
 *
 * Ties break on index, so the same input always produces the same grouping. A
 * clustering that shuffles between runs cannot be built on, compared across
 * two periods, or cited in a report.
 */
export function agglomerate(
  vectors: readonly ReadonlyMap<string, number>[],
  wanted: number,
): number[][] {
  const groups: number[][] = vectors.map((_, index) => [index]);
  if (groups.length <= wanted) return groups;

  const between: number[][] = vectors.map((v, i) =>
    vectors.map((w, j) => (i === j ? 0 : cosineDistance(v, w))),
  );

  const linkage = (x: readonly number[], y: readonly number[]): number => {
    let total = 0;
    for (const i of x) for (const j of y) total += between[i]![j]!;
    return total / (x.length * y.length);
  };

  while (groups.length > Math.max(1, wanted)) {
    let bestA = 0;
    let bestB = 1;
    let bestDistance = Infinity;

    for (let i = 0; i < groups.length; i += 1) {
      for (let j = i + 1; j < groups.length; j += 1) {
        const d = linkage(groups[i]!, groups[j]!);
        // Strictly better by more than float noise, so the first of two equal
        // pairs wins and the result is reproducible.
        if (d < bestDistance - 1e-12) {
          bestDistance = d;
          bestA = i;
          bestB = j;
        }
      }
    }

    groups[bestA] = [...groups[bestA]!, ...groups[bestB]!].sort((a, b) => a - b);
    groups.splice(bestB, 1);
  }

  return groups;
}
