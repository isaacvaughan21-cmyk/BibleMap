/**
 * Lightweight fuzzy matching for typo tolerance in the Ask assistant — no deps.
 *
 * Two tools for two jobs:
 *  • `dice` (Sørensen–Dice over character bigrams, 0..1) — lenient similarity for
 *    matching a misspelled name against a SMALL closed set (book/person names),
 *    e.g. "reveltino" → "revelation".
 *  • `osaDistance` (Damerau–Levenshtein / optimal string alignment) + `correctWord`
 *    — strict edit-distance correction against the LARGE corpus vocabulary, where a
 *    loose threshold would mangle real words, e.g. "graec" → "grace" (one swap).
 */

/** Optimal string alignment distance (Levenshtein + adjacent transposition). */
export function osaDistance(a: string, b: string, max = Infinity): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  if (Math.abs(al - bl) > max) return max + 1;

  let prevPrev = new Array<number>(bl + 1).fill(0);
  let prev = new Array<number>(bl + 1);
  let curr = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;

  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= bl; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (
        i > 1 &&
        j > 1 &&
        ai === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        v = Math.min(v, prevPrev[j - 2] + 1); // transposition
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1; // every path already exceeds the budget
    const tmp = prevPrev;
    prevPrev = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[bl];
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Dice coefficient over character bigrams (0..1). */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let sizeA = 0;
  let sizeB = 0;
  for (const c of A.values()) sizeA += c;
  for (const [g, c] of B) {
    sizeB += c;
    const a2 = A.get(g);
    if (a2) inter += Math.min(a2, c);
  }
  return (2 * inter) / (sizeA + sizeB);
}

/** Best fuzzy match of `word` among `candidates` by Dice, or null below `min`. */
export function bestDiceMatch(
  word: string,
  candidates: readonly string[],
  min: number,
): { value: string; score: number } | null {
  let best: { value: string; score: number } | null = null;
  for (const c of candidates) {
    const score = dice(word, c);
    if (score >= min && (!best || score > best.score))
      best = { value: c, score };
  }
  return best;
}

/**
 * Correct `word` to the closest entry in `vocabByFreq` (sorted most-common first)
 * within `maxDist` edits, or null if nothing is close. Ties prefer the more
 * common word (it's scanned first), which is almost always the intended one.
 */
export function correctWord(
  word: string,
  vocabByFreq: readonly string[],
  maxDist: number,
): string | null {
  let best: string | null = null;
  let bestDist = maxDist + 1;
  const wl = word.length;
  for (const cand of vocabByFreq) {
    if (Math.abs(cand.length - wl) > maxDist) continue;
    const d = osaDistance(word, cand, Math.min(bestDist - 1, maxDist));
    if (d < bestDist) {
      bestDist = d;
      best = cand;
      if (d <= 1) break; // most-common 1-edit match; can't do better for a typo
    }
  }
  return bestDist <= maxDist ? best : null;
}
