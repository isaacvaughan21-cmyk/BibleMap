/**
 * Synonym expansion for topical retrieval — a recall aid, NOT a citation
 * source. When a query token matches a key below, the listed terms are added
 * to the BM25 query so verses that phrase the idea differently still surface
 * (e.g. "anxiety" reaching Philippians 4:6, which says "anxious"). Every verse
 * that comes back is still retrieved from the real corpus and validated; none
 * of these words inject a guaranteed citation.
 */
export const TOPIC_SEEDS: Record<string, string[]> = {
  grace: ["grace", "favor", "gift", "freely", "undeserved", "kindness"],
  faith: ["faith", "believe", "believed", "trust", "faithful"],
  love: ["love", "loved", "beloved", "compassion", "kindness"],
  forgiveness: ["forgive", "forgiven", "forgiveness", "pardon", "mercy"],
  forgive: ["forgive", "forgiven", "forgiveness", "pardon", "mercy"],
  mercy: ["mercy", "merciful", "compassion", "lovingkindness"],
  hope: ["hope", "hoped", "expectation", "wait"],
  salvation: [
    "salvation",
    "saved",
    "save",
    "redeemed",
    "redemption",
    "deliver",
  ],
  saved: ["salvation", "saved", "save", "redeemed", "redemption"],
  fear: ["fear", "afraid", "fearful", "dread", "terror"],
  anxiety: ["anxious", "worry", "worried", "care", "troubled", "afraid"],
  anxious: ["anxious", "worry", "worried", "care", "troubled"],
  worry: ["anxious", "worry", "worried", "care", "troubled"],
  prayer: ["pray", "prayer", "prayed", "supplication", "intercession"],
  pray: ["pray", "prayer", "prayed", "supplication"],
  peace: ["peace", "peaceful", "rest", "quiet"],
  wisdom: ["wisdom", "wise", "understanding", "knowledge", "prudent"],
  joy: ["joy", "joyful", "rejoice", "glad", "delight"],
  patience: ["patience", "patient", "endurance", "longsuffering", "wait"],
  humility: ["humble", "humility", "lowly", "meek"],
  pride: ["pride", "proud", "haughty", "arrogant"],
  sin: ["sin", "sins", "sinned", "transgression", "iniquity", "wickedness"],
  repentance: ["repent", "repentance", "repented", "turn"],
  righteousness: ["righteous", "righteousness", "just", "justified", "upright"],
  judgment: ["judge", "judgment", "judged", "condemn", "condemnation"],
  heaven: ["heaven", "heavens", "heavenly", "kingdom"],
  death: ["death", "die", "died", "dead", "perish", "grave"],
  eternal: ["eternal", "everlasting", "forever", "immortal"],
  marriage: ["marriage", "marry", "married", "husband", "wife", "wedding"],
  money: ["money", "riches", "wealth", "mammon", "treasure", "rich"],
  suffering: ["suffer", "suffering", "affliction", "tribulation", "trials"],
  comfort: ["comfort", "comforted", "consolation", "encourage"],
  obedience: ["obey", "obedience", "obeyed", "keep", "commandment"],
  worship: ["worship", "worshiped", "praise", "praised", "exalt", "glorify"],
  generosity: ["give", "giving", "generous", "cheerful", "offering"],
  temptation: ["temptation", "tempt", "tempted", "trial", "tested"],
};

/** Tokens we never use as a topic key on their own (too generic to expand). */
const NON_TOPIC = new Set(["god", "lord", "jesus", "christ", "man", "people"]);

/** Extra query terms for any seeded topic present in the token list. */
export function expandTopics(tokens: string[]): string[] {
  const extra = new Set<string>();
  for (const t of tokens) {
    if (NON_TOPIC.has(t)) continue;
    const seeds = TOPIC_SEEDS[t];
    if (seeds) for (const s of seeds) extra.add(s);
  }
  return [...extra];
}
