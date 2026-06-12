/**
 * Word definitions for the definition bubble.
 *
 * Uses the free, keyless dictionaryapi.dev (no account, no API key — same
 * spirit as the CC-BY cross-reference data). It only knows common English
 * words, so proper/biblical nouns ("Melchizedek") come back empty; callers
 * show a graceful "no definition found" in that case.
 */

const cache = new Map<string, Promise<string | null>>();

type Entry = {
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string }[];
  }[];
};

/** First sensible definition for a word, or null if none is found. */
export function lookupDefinition(word: string): Promise<string | null> {
  // Look up the first word only; trim punctuation.
  const w = word
    .trim()
    .toLowerCase()
    .replace(/[^a-z'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)[0];
  if (!w) return Promise.resolve(null);

  const hit = cache.get(w);
  if (hit) return hit;

  // A 404 (genuinely no entry) and a real result are cacheable; a network /
  // server error is transient and must be evicted so a retry actually retries.
  const settled = fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`,
  )
    .then((r) => {
      if (r.status === 404) return { def: null, keep: true };
      if (!r.ok) return { def: null, keep: false };
      return r.json().then((data: unknown) => {
        if (!Array.isArray(data)) return { def: null, keep: true };
        const entry = data[0] as Entry | undefined;
        const meaning = entry?.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition;
        if (!def) return { def: null, keep: true };
        return {
          def: meaning?.partOfSpeech ? `(${meaning.partOfSpeech}) ${def}` : def,
          keep: true,
        };
      });
    })
    .catch(() => ({ def: null as string | null, keep: false }));

  const p = settled.then(({ def, keep }) => {
    if (!keep) cache.delete(w);
    return def;
  });
  cache.set(w, p);
  return p;
}
