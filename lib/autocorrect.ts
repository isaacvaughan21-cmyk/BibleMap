/**
 * Lightweight, dependency-free autocorrect for the bubble editors.
 *
 * Desktop browsers offer spellcheck squiggles but never *fix* a typo, so this
 * fills that gap the way a phone keyboard would: as you finish a word (type a
 * space or punctuation), an unambiguous misspelling is swapped for the right
 * word, a lone "i" becomes "I", and the first letter of a sentence is
 * capitalised. It stays conservative on purpose — only known typos are
 * touched, so proper and biblical nouns ("Melchizedek", "Boaz") are left
 * exactly as typed.
 */

/**
 * Common English misspellings → their correction. Keys are lowercase and, to
 * avoid ever "correcting" something the writer meant, every key is a string
 * that is NOT itself a valid English word (so no "wont", "cant", "its").
 */
const TYPOS: Record<string, string> = {
  teh: "the",
  adn: "and",
  nad: "and",
  thn: "then",
  taht: "that",
  waht: "what",
  wich: "which",
  wih: "with",
  wiht: "with",
  woudl: "would",
  coudl: "could",
  shoudl: "should",
  becuase: "because",
  becasue: "because",
  beacuse: "because",
  recieve: "receive",
  recieved: "received",
  beleive: "believe",
  beleived: "believed",
  belive: "believe",
  seperate: "separate",
  seperated: "separated",
  definately: "definitely",
  definatly: "definitely",
  occured: "occurred",
  occuring: "occurring",
  untill: "until",
  wtih: "with",
  thier: "their",
  freind: "friend",
  freinds: "friends",
  goign: "going",
  doign: "doing",
  becomming: "becoming",
  begining: "beginning",
  beleif: "belief",
  greatful: "grateful",
  truely: "truly",
  arguement: "argument",
  enviroment: "environment",
  goverment: "government",
  neccessary: "necessary",
  neccesary: "necessary",
  accross: "across",
  agian: "again",
  agan: "again",
  alot: "a lot",
  allot: "a lot",
  amoung: "among",
  anser: "answer",
  becuse: "because",
  buisness: "business",
  calender: "calendar",
  cemetary: "cemetery",
  concious: "conscious",
  decsion: "decision",
  desicion: "decision",
  dissapoint: "disappoint",
  embarass: "embarrass",
  existance: "existence",
  familar: "familiar",
  foward: "forward",
  fufill: "fulfill",
  gaurd: "guard",
  happend: "happened",
  harrass: "harass",
  independant: "independent",
  intrest: "interest",
  knowlege: "knowledge",
  liason: "liaison",
  lisen: "listen",
  maintainance: "maintenance",
  maintenence: "maintenance",
  millenium: "millennium",
  miniscule: "minuscule",
  mispell: "misspell",
  noticable: "noticeable",
  occassion: "occasion",
  ocassion: "occasion",
  parliment: "parliament",
  peice: "piece",
  persistant: "persistent",
  posession: "possession",
  possesion: "possession",
  prefered: "preferred",
  privilage: "privilege",
  probaly: "probably",
  probly: "probably",
  publically: "publicly",
  realy: "really",
  reccomend: "recommend",
  recomend: "recommend",
  relevent: "relevant",
  religon: "religion",
  religous: "religious",
  remeber: "remember",
  rember: "remember",
  responsibile: "responsible",
  rythm: "rhythm",
  seige: "siege",
  succesful: "successful",
  sucessful: "successful",
  suprise: "surprise",
  supprise: "surprise",
  tommorow: "tomorrow",
  tommorrow: "tomorrow",
  tomorow: "tomorrow",
  twelth: "twelfth",
  unfortunatly: "unfortunately",
  usualy: "usually",
  vaccum: "vacuum",
  wierd: "weird",
  writen: "written",
  yeild: "yield",
  acheive: "achieve",
  acheived: "achieved",
  aparent: "apparent",
  apparant: "apparent",
  arent: "aren't",
  cant: "can't",
  couldnt: "couldn't",
  didnt: "didn't",
  doesnt: "doesn't",
  dont: "don't",
  hadnt: "hadn't",
  hasnt: "hasn't",
  havent: "haven't",
  isnt: "isn't",
  shouldnt: "shouldn't",
  wasnt: "wasn't",
  werent: "weren't",
  wont: "won't",
  wouldnt: "wouldn't",
  youre: "you're",
  theyre: "they're",
  im: "I'm",
  ive: "I've",
  ill: "I'll",
  cus: "because",
  cuz: "because",
  thru: "through",
  til: "till",
};

const BOUNDARY_RE = /[\s.,;:!?)"'\]}’”]/;
const SENTENCE_END_RE = /[.!?][)"'’”]*\s*$/;

/** Is `ch` a character that ends a word (so the word before it can be fixed)? */
export function isWordBoundary(ch: string | undefined): boolean {
  return ch != null && BOUNDARY_RE.test(ch);
}

/** Re-apply the capitalisation shape of `sample` onto `replacement`. */
function matchCase(replacement: string, sample: string): string {
  // ALL CAPS (more than one letter) → shout the replacement too.
  if (sample.length > 1 && sample === sample.toUpperCase()) {
    return replacement.toUpperCase();
  }
  // Leading capital → capitalise the first letter only.
  if (sample[0] && sample[0] === sample[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function capitalizeFirst(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Correct one bare word (already stripped of surrounding punctuation).
 * `sentenceStart` capitalises the first letter when the word opens a sentence.
 * Returns the same string when nothing needs changing.
 */
export function correctWord(word: string, sentenceStart = false): string {
  if (!word || !/[a-z]/i.test(word)) return word;
  const lower = word.toLowerCase();
  let out = word;

  const fix = TYPOS[lower];
  if (fix) {
    out = matchCase(fix, word);
  } else if (lower === "i") {
    out = "I";
  } else if (/^i(?:'|’)(?:m|ve|ll|d|s)$/.test(lower)) {
    // i'm / i've / i'll / i'd / i's → capital I, keep the rest as typed
    out = "I" + out.slice(1);
  }

  if (sentenceStart) out = capitalizeFirst(out);
  return out;
}

/**
 * Given the whole text and a caret position that sits just after a freshly
 * typed word-boundary character, correct the word that ends right before that
 * boundary. Returns the rewritten text plus the new caret and the original
 * word (for a one-step revert), or null when nothing changed.
 */
export function correctAtBoundary(
  text: string,
  caret: number,
): {
  text: string;
  caret: number;
  from: string;
  to: string;
  at: number;
} | null {
  // The boundary char is at caret-1; the word ends at caret-1.
  const wordEnd = caret - 1;
  if (wordEnd <= 0) return null;

  let start = wordEnd;
  while (start > 0 && /[A-Za-z'’]/.test(text[start - 1])) start--;
  const word = text.slice(start, wordEnd);
  if (!word) return null;

  const before = text.slice(0, start);
  const sentenceStart = before.trim() === "" || SENTENCE_END_RE.test(before);
  const corrected = correctWord(word, sentenceStart);
  if (corrected === word) return null;

  const next = text.slice(0, start) + corrected + text.slice(wordEnd);
  const delta = corrected.length - word.length;
  return {
    text: next,
    caret: caret + delta,
    from: word,
    to: corrected,
    at: start,
  };
}

/**
 * Correct an entire string in one pass — used when a bubble is committed, so
 * the final word (which never got a trailing space) is caught too. Conservative
 * by the same rules as {@link correctWord}.
 */
export function correctText(text: string): string {
  let sawSentenceEnd = true; // start-of-text opens a sentence
  return text.replace(/[A-Za-z'’]+|[^A-Za-z'’]+/g, (chunk) => {
    if (/^[A-Za-z]/.test(chunk)) {
      const fixed = correctWord(chunk, sawSentenceEnd);
      sawSentenceEnd = false;
      return fixed;
    }
    // A run of non-word characters: does it close a sentence?
    if (/[.!?]/.test(chunk)) sawSentenceEnd = true;
    return chunk;
  });
}
