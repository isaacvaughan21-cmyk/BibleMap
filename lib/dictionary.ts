/**
 * Word definitions for the definition bubble.
 *
 * Uses the free, keyless dictionaryapi.dev (no account, no API key — same
 * spirit as the CC-BY cross-reference data). It only knows common English
 * words, so proper/biblical nouns ("Melchizedek") come back empty; callers
 * show a graceful "no definition found" in that case.
 *
 * The API returns multiple senses per word, and its FIRST sense is sometimes
 * an archaic one (e.g. "care" → "Grief; sorrow."). So we surface a short list
 * of candidates and let the reader pick the meaning they want, rather than
 * silently committing to whatever happened to come back first.
 */

export type DefinitionCandidate = {
  partOfSpeech?: string;
  /** The meaning, with a "(noun) " style part-of-speech prefix when known. */
  text: string;
};

const cache = new Map<string, Promise<DefinitionCandidate[]>>();

type Entry = {
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string }[];
  }[];
};

const MAX_CANDIDATES = 6;

/** Normalize to a single lowercase word (first word only, punctuation stripped). */
function normalize(word: string): string | null {
  return (
    word
      .trim()
      .toLowerCase()
      .replace(/[^a-z'-]/g, " ")
      .split(/\s+/)
      .filter(Boolean)[0] ?? null
  );
}

/** Format a candidate's display text with its part of speech, when known. */
function format(partOfSpeech: string | undefined, def: string): string {
  return partOfSpeech ? `(${partOfSpeech}) ${def}` : def;
}

/**
 * Candidate meanings for a word — up to {@link MAX_CANDIDATES}, drawn across
 * the word's senses (its different parts of speech) so the reader can choose.
 * An empty array means no entry was found.
 */
export function lookupDefinitions(
  word: string,
): Promise<DefinitionCandidate[]> {
  const w = normalize(word);
  if (!w) return Promise.resolve([]);

  const hit = cache.get(w);
  if (hit) return hit;

  const settled: Promise<{ candidates: DefinitionCandidate[]; keep: boolean }> =
    fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`,
    )
      .then((r) => {
        // A 404 (genuinely no entry) is cacheable; a network / server error is
        // transient and must be evicted so a retry actually retries.
        if (r.status === 404) return { candidates: [], keep: true };
        if (!r.ok) return { candidates: [], keep: false };
        return r.json().then((data: unknown) => {
          if (!Array.isArray(data)) return { candidates: [], keep: true };
          const out: DefinitionCandidate[] = [];
          const seen = new Set<string>();
          // Take a sense or two from each meaning so the list spans the word's
          // parts of speech rather than burying everything under the first one.
          for (const entry of data as Entry[]) {
            for (const meaning of entry?.meanings ?? []) {
              let taken = 0;
              for (const d of meaning.definitions ?? []) {
                const def = d.definition?.trim();
                if (!def) continue;
                const text = format(meaning.partOfSpeech, def);
                if (seen.has(text)) continue;
                seen.add(text);
                out.push({ partOfSpeech: meaning.partOfSpeech, text });
                if (++taken >= 2 || out.length >= MAX_CANDIDATES) break;
              }
              if (out.length >= MAX_CANDIDATES) break;
            }
            if (out.length >= MAX_CANDIDATES) break;
          }
          return { candidates: out, keep: true };
        });
      })
      .catch(() => ({ candidates: [], keep: false }));

  const p = settled.then(({ candidates, keep }) => {
    if (!keep) cache.delete(w);
    return candidates;
  });
  cache.set(w, p);
  return p;
}

/** First sensible definition for a word, or null if none is found. */
export function lookupDefinition(word: string): Promise<string | null> {
  return lookupDefinitions(word).then((c) => c[0]?.text ?? null);
}
