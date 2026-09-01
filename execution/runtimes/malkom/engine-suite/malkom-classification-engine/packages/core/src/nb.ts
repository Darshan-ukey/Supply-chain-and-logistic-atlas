/**
 * Online multinomial naive bayes. Learning is a count increment — one
 * labelled answer in, weights updated, no epochs. The artifact is plain
 * counts, trivially serialisable and mergeable.
 */

export interface NbArtifact {
  classes: string[];
  /** tokenCounts[class][token] */
  tokenCounts: Record<string, Record<string, number>>;
  classTotals: Record<string, number>;
  docCounts: Record<string, number>;
}

export const emptyArtifact = (): NbArtifact => ({ classes: [], tokenCounts: {}, classTotals: {}, docCounts: {} });

export const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1);

/** One answer in — a NEW artifact out (never mutates). */
export const learn = (artifact: NbArtifact, text: string, label: string): NbArtifact => {
  const next: NbArtifact = {
    classes: artifact.classes.includes(label) ? [...artifact.classes] : [...artifact.classes, label],
    tokenCounts: { ...artifact.tokenCounts, [label]: { ...(artifact.tokenCounts[label] ?? {}) } },
    classTotals: { ...artifact.classTotals },
    docCounts: { ...artifact.docCounts, [label]: (artifact.docCounts[label] ?? 0) + 1 },
  };
  const bucket = next.tokenCounts[label] as Record<string, number>;
  let added = 0;
  for (const token of tokenize(text)) {
    bucket[token] = (bucket[token] ?? 0) + 1;
    added += 1;
  }
  next.classTotals[label] = (next.classTotals[label] ?? 0) + added;
  return next;
};

export const predict = (artifact: NbArtifact, text: string): { label: string; confidence: number } => {
  if (artifact.classes.length === 0) return { label: 'unknown', confidence: 0 };
  const tokens = tokenize(text);
  const vocabulary = new Set<string>();
  for (const bucket of Object.values(artifact.tokenCounts)) {
    for (const token of Object.keys(bucket)) vocabulary.add(token);
  }
  const vocabSize = Math.max(1, vocabulary.size);
  const totalDocs = Object.values(artifact.docCounts).reduce((a, b) => a + b, 0) || 1;
  const scores = artifact.classes.map((cls) => {
    const bucket = artifact.tokenCounts[cls] ?? {};
    const classTotal = artifact.classTotals[cls] ?? 0;
    let score = Math.log((artifact.docCounts[cls] ?? 0.5) / totalDocs);
    for (const token of tokens) {
      score += Math.log(((bucket[token] ?? 0) + 1) / (classTotal + vocabSize));
    }
    return score;
  });
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  const best = exps.indexOf(Math.max(...exps));
  return {
    label: artifact.classes[best] ?? 'unknown',
    confidence: Math.round(((exps[best] ?? 0) / sum) * 1000) / 10,
  };
};

export const answersLearned = (artifact: NbArtifact): number =>
  Object.values(artifact.docCounts).reduce((a, b) => a + b, 0);
