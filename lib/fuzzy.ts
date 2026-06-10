/**
 * Tiny fuzzy scorer for the command palette. Higher is better; -1 = no match.
 * Exact-prefix > substring > in-order subsequence.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;

  const idx = t.indexOf(q);
  if (idx === 0) return 100;
  if (idx > 0) return 80 - Math.min(idx, 30) * 0.5;

  // in-order subsequence with spread penalty
  let ti = -1;
  let spread = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti + 1);
    if (found < 0) return -1;
    spread += found - ti - 1;
    ti = found;
  }
  return Math.max(1, 40 - spread * 0.5);
}
