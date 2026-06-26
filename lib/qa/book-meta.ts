/**
 * Curated book authorship + audience metadata.
 *
 * A small, hand-authored, verse-referenced routing/grounding aid — the same
 * spirit as lib/verse-referents.ts (no AI, every claim tied to the text or
 * labeled as tradition). Pure verse retrieval can't cleanly answer "Who wrote
 * Romans?", so this layer supplies the attribution; every `*Refs` entry is run
 * through the same corpus validation gate as any other citation before display.
 *
 * `attribution`:
 *   - "stated"      → the book names its author in the text (cite the verse).
 *   - "traditional" → authorship is church tradition, not stated in the text
 *                      (the answer must say "traditionally attributed to …").
 *
 * Keyed by OSIS code (matches BOOKS[].code). Coverage is the full New Testament
 * plus the most-asked Old Testament books; extend incrementally.
 */
export type BookMeta = {
  code: string;
  author: string;
  attribution: "stated" | "traditional";
  /** Verses that state/support the attribution (may be empty for anonymous books). */
  authorEvidenceRefs: string[];
  audience?: string;
  audienceRefs?: string[];
  /** One neutral sentence — no theology, no interpretation. */
  summary: string;
};

export const BOOK_META: Record<string, BookMeta> = {
  // ---- Pentateuch (traditionally Moses) ----
  Gen: {
    code: "Gen",
    author: "Moses",
    attribution: "traditional",
    authorEvidenceRefs: ["Deuteronomy 31:9"],
    summary:
      "The book of beginnings, traditionally attributed to Moses; Deuteronomy records that Moses wrote down the law.",
  },
  Exod: {
    code: "Exod",
    author: "Moses",
    attribution: "traditional",
    authorEvidenceRefs: ["Deuteronomy 31:9", "Exodus 24:4"],
    summary:
      "The account of Israel's deliverance from Egypt, traditionally attributed to Moses, who is said to have written the words of the LORD.",
  },
  Lev: {
    code: "Lev",
    author: "Moses",
    attribution: "traditional",
    authorEvidenceRefs: ["Deuteronomy 31:9"],
    summary: "Israel's priestly law, traditionally attributed to Moses.",
  },
  Num: {
    code: "Num",
    author: "Moses",
    attribution: "traditional",
    authorEvidenceRefs: ["Deuteronomy 31:9", "Numbers 33:2"],
    summary:
      "Israel's wilderness journey, traditionally attributed to Moses, who is said to have recorded their stages.",
  },
  Deut: {
    code: "Deut",
    author: "Moses",
    attribution: "traditional",
    authorEvidenceRefs: ["Deuteronomy 31:9"],
    summary:
      "Moses' final addresses to Israel; the book itself reports that Moses wrote down this law.",
  },

  // ---- History / Wisdom / Prophets (selected) ----
  Josh: {
    code: "Josh",
    author: "Joshua",
    attribution: "traditional",
    authorEvidenceRefs: ["Joshua 24:26"],
    summary:
      "Israel's entry into the promised land, traditionally attributed to Joshua, who recorded these things in the Book of the Law of God.",
  },
  Ps: {
    code: "Ps",
    author: "David and others",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "A collection of 150 songs and prayers; many are traditionally ascribed to David, with others by Asaph, the sons of Korah, Solomon, and more.",
  },
  Prov: {
    code: "Prov",
    author: "Solomon",
    attribution: "stated",
    authorEvidenceRefs: ["Proverbs 1:1"],
    summary:
      "A collection of wisdom sayings; its opening verse names them the proverbs of Solomon son of David.",
  },
  Eccl: {
    code: "Eccl",
    author: "the Preacher (traditionally Solomon)",
    attribution: "traditional",
    authorEvidenceRefs: ["Ecclesiastes 1:1"],
    summary:
      "Reflections of 'the Preacher, the son of David, king in Jerusalem' — traditionally identified as Solomon.",
  },
  Isa: {
    code: "Isa",
    author: "Isaiah",
    attribution: "stated",
    authorEvidenceRefs: ["Isaiah 1:1"],
    summary: "The visions of Isaiah son of Amoz, named in the opening verse.",
  },
  Jer: {
    code: "Jer",
    author: "Jeremiah",
    attribution: "stated",
    authorEvidenceRefs: ["Jeremiah 1:1"],
    summary:
      "The words of Jeremiah son of Hilkiah, named in the opening verse.",
  },
  Dan: {
    code: "Dan",
    author: "Daniel",
    attribution: "traditional",
    authorEvidenceRefs: ["Daniel 7:1"],
    summary:
      "The narrative and visions of Daniel in Babylon, traditionally attributed to Daniel, who is said to have written down his dream.",
  },
  Jonah: {
    code: "Jonah",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "The account of the prophet Jonah sent to Nineveh; the book itself does not name its author.",
  },

  // ---- Remaining Old Testament: history ----
  Judg: {
    code: "Judg",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "Israel's cycle of judges between Joshua and the monarchy; the book is anonymous (traditionally associated with Samuel).",
  },
  Ruth: {
    code: "Ruth",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "The story of Ruth the Moabite, an ancestor of David; the book does not name its author.",
  },
  "1Sam": {
    code: "1Sam",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "Israel's move to monarchy under Samuel, Saul, and David; traditionally linked to Samuel, Nathan, and Gad.",
  },
  "2Sam": {
    code: "2Sam",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "The reign of David; traditionally linked to the prophets Nathan and Gad.",
  },
  "1Kgs": {
    code: "1Kgs",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "From Solomon through the divided kingdom; the book is anonymous (traditionally associated with Jeremiah).",
  },
  "2Kgs": {
    code: "2Kgs",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "The kingdoms of Israel and Judah down to the exile; the book is anonymous (traditionally associated with Jeremiah).",
  },
  "1Chr": {
    code: "1Chr",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "Genealogies and the reign of David retold for the returned exiles; traditionally associated with Ezra.",
  },
  "2Chr": {
    code: "2Chr",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "The reign of Solomon and the kings of Judah retold; traditionally associated with Ezra.",
  },
  Ezra: {
    code: "Ezra",
    author: "Ezra",
    attribution: "traditional",
    authorEvidenceRefs: ["Ezra 7:6"],
    summary:
      "The return from exile and rebuilding of the temple; traditionally attributed to Ezra the scribe, who appears in the book.",
  },
  Neh: {
    code: "Neh",
    author: "Nehemiah",
    attribution: "stated",
    authorEvidenceRefs: ["Nehemiah 1:1"],
    summary:
      "The rebuilding of Jerusalem's walls; the book opens, 'The words of Nehemiah son of Hacaliah.'",
  },
  Esth: {
    code: "Esth",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "How Esther saved her people in Persia; the book does not name its author.",
  },

  // ---- Remaining Old Testament: wisdom ----
  Job: {
    code: "Job",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "Job's suffering and God's reply out of the whirlwind; the book does not name its author.",
  },
  Song: {
    code: "Song",
    author: "Solomon",
    attribution: "stated",
    authorEvidenceRefs: ["Song of Solomon 1:1"],
    summary:
      "A poetic celebration of love; its opening line ascribes it to Solomon.",
  },
  Lam: {
    code: "Lam",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "Laments over the fall of Jerusalem; anonymous, traditionally attributed to Jeremiah.",
  },

  // ---- Remaining Old Testament: prophets (each names the prophet) ----
  Ezek: {
    code: "Ezek",
    author: "Ezekiel",
    attribution: "stated",
    authorEvidenceRefs: ["Ezekiel 1:3"],
    summary:
      "Visions and oracles of Ezekiel the priest during the exile; the word of the LORD came to Ezekiel by name.",
  },
  Hos: {
    code: "Hos",
    author: "Hosea",
    attribution: "stated",
    authorEvidenceRefs: ["Hosea 1:1"],
    summary:
      "The prophecies of Hosea son of Beeri, named in the opening verse.",
  },
  Joel: {
    code: "Joel",
    author: "Joel",
    attribution: "stated",
    authorEvidenceRefs: ["Joel 1:1"],
    summary: "The word of the LORD that came to Joel son of Pethuel.",
  },
  Amos: {
    code: "Amos",
    author: "Amos",
    attribution: "stated",
    authorEvidenceRefs: ["Amos 1:1"],
    summary:
      "The words of Amos, a shepherd of Tekoa, named in the opening verse.",
  },
  Obad: {
    code: "Obad",
    author: "Obadiah",
    attribution: "stated",
    authorEvidenceRefs: ["Obadiah 1:1"],
    summary:
      "The vision of Obadiah concerning Edom, named in the opening verse.",
  },
  Mic: {
    code: "Mic",
    author: "Micah",
    attribution: "stated",
    authorEvidenceRefs: ["Micah 1:1"],
    summary: "The word of the LORD that came to Micah of Moresheth.",
  },
  Nah: {
    code: "Nah",
    author: "Nahum",
    attribution: "stated",
    authorEvidenceRefs: ["Nahum 1:1"],
    summary: "The vision of Nahum the Elkoshite concerning Nineveh.",
  },
  Hab: {
    code: "Hab",
    author: "Habakkuk",
    attribution: "stated",
    authorEvidenceRefs: ["Habakkuk 1:1"],
    summary:
      "The oracle received by Habakkuk the prophet, named in the opening verse.",
  },
  Zeph: {
    code: "Zeph",
    author: "Zephaniah",
    attribution: "stated",
    authorEvidenceRefs: ["Zephaniah 1:1"],
    summary:
      "The word of the LORD that came to Zephaniah, named in the opening verse.",
  },
  Hag: {
    code: "Hag",
    author: "Haggai",
    attribution: "stated",
    authorEvidenceRefs: ["Haggai 1:1"],
    summary: "The word of the LORD delivered through Haggai the prophet.",
  },
  Zech: {
    code: "Zech",
    author: "Zechariah",
    attribution: "stated",
    authorEvidenceRefs: ["Zechariah 1:1"],
    summary: "The word of the LORD that came to Zechariah son of Berechiah.",
  },
  Mal: {
    code: "Mal",
    author: "Malachi",
    attribution: "stated",
    authorEvidenceRefs: ["Malachi 1:1"],
    summary: "An oracle of the word of the LORD to Israel through Malachi.",
  },

  // ---- The Gospels + Acts (anonymous; traditional attributions) ----
  Matt: {
    code: "Matt",
    author: "Matthew",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "An account of the life of Jesus, traditionally attributed to Matthew (Levi) the tax collector; the text itself does not name its author.",
  },
  Mark: {
    code: "Mark",
    author: "Mark",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "An account of the life of Jesus, traditionally attributed to John Mark; the text itself does not name its author.",
  },
  Luke: {
    code: "Luke",
    author: "Luke",
    attribution: "traditional",
    authorEvidenceRefs: ["Luke 1:1-4"],
    summary:
      "An orderly account of Jesus written for Theophilus, traditionally attributed to Luke; the author addresses his reader but does not name himself.",
  },
  John: {
    code: "John",
    author: "John",
    attribution: "traditional",
    authorEvidenceRefs: ["John 21:24"],
    summary:
      "An account of the life of Jesus, traditionally attributed to John, 'the disciple who testifies to these things and has written them down.'",
  },
  Acts: {
    code: "Acts",
    author: "Luke",
    attribution: "traditional",
    authorEvidenceRefs: ["Acts 1:1"],
    summary:
      "The acts of the apostles, a sequel addressed again to Theophilus, traditionally attributed to Luke.",
  },

  // ---- Pauline epistles (Paul names himself in the opening) ----
  Rom: {
    code: "Rom",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["Romans 1:1"],
    audience: "the believers in Rome",
    audienceRefs: ["Romans 1:7"],
    summary:
      "A letter from Paul, a servant of Christ Jesus, written to all in Rome who are loved by God and called to be saints.",
  },
  "1Cor": {
    code: "1Cor",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["1 Corinthians 1:1"],
    audience: "the church of God in Corinth",
    audienceRefs: ["1 Corinthians 1:2"],
    summary: "Paul's letter to the church of God in Corinth.",
  },
  "2Cor": {
    code: "2Cor",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["2 Corinthians 1:1"],
    audience: "the church of God in Corinth",
    audienceRefs: ["2 Corinthians 1:1"],
    summary: "Paul's follow-up letter to the church of God in Corinth.",
  },
  Gal: {
    code: "Gal",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["Galatians 1:1"],
    audience: "the churches of Galatia",
    audienceRefs: ["Galatians 1:2"],
    summary: "Paul's letter to the churches of Galatia.",
  },
  Eph: {
    code: "Eph",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["Ephesians 1:1"],
    audience: "the saints in Ephesus",
    audienceRefs: ["Ephesians 1:1"],
    summary:
      "Paul's letter to the saints in Ephesus, the faithful in Christ Jesus.",
  },
  Phil: {
    code: "Phil",
    author: "Paul (with Timothy)",
    attribution: "stated",
    authorEvidenceRefs: ["Philippians 1:1"],
    audience: "the saints in Philippi",
    audienceRefs: ["Philippians 1:1"],
    summary:
      "A letter from Paul and Timothy to all the saints in Christ Jesus at Philippi.",
  },
  Col: {
    code: "Col",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["Colossians 1:1"],
    audience: "the saints in Colossae",
    audienceRefs: ["Colossians 1:2"],
    summary:
      "Paul's letter to the holy and faithful brothers in Christ at Colossae.",
  },
  "1Thess": {
    code: "1Thess",
    author: "Paul (with Silvanus and Timothy)",
    attribution: "stated",
    authorEvidenceRefs: ["1 Thessalonians 1:1"],
    audience: "the church of the Thessalonians",
    audienceRefs: ["1 Thessalonians 1:1"],
    summary:
      "A letter from Paul, Silvanus, and Timothy to the church of the Thessalonians.",
  },
  "2Thess": {
    code: "2Thess",
    author: "Paul (with Silvanus and Timothy)",
    attribution: "stated",
    authorEvidenceRefs: ["2 Thessalonians 1:1"],
    audience: "the church of the Thessalonians",
    audienceRefs: ["2 Thessalonians 1:1"],
    summary:
      "A second letter from Paul, Silvanus, and Timothy to the church of the Thessalonians.",
  },
  "1Tim": {
    code: "1Tim",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["1 Timothy 1:1"],
    audience: "Timothy",
    audienceRefs: ["1 Timothy 1:2"],
    summary: "Paul's letter to Timothy, his true child in the faith.",
  },
  "2Tim": {
    code: "2Tim",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["2 Timothy 1:1"],
    audience: "Timothy",
    audienceRefs: ["2 Timothy 1:2"],
    summary: "Paul's final letter to Timothy, his beloved child.",
  },
  Titus: {
    code: "Titus",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["Titus 1:1"],
    audience: "Titus",
    audienceRefs: ["Titus 1:4"],
    summary: "Paul's letter to Titus, his true child in their common faith.",
  },
  Phlm: {
    code: "Phlm",
    author: "Paul",
    attribution: "stated",
    authorEvidenceRefs: ["Philemon 1:1"],
    audience: "Philemon",
    audienceRefs: ["Philemon 1:1"],
    summary:
      "A short, personal letter from Paul to Philemon concerning Onesimus.",
  },

  // ---- General epistles + Revelation ----
  Heb: {
    code: "Heb",
    author: "unknown",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "A letter urging perseverance in Christ; the book is anonymous and its author is unknown.",
  },
  Jas: {
    code: "Jas",
    author: "James",
    attribution: "stated",
    authorEvidenceRefs: ["James 1:1"],
    audience: "the twelve tribes scattered among the nations",
    audienceRefs: ["James 1:1"],
    summary:
      "A letter from James, a servant of God and of the Lord Jesus Christ, to the twelve tribes in the Dispersion.",
  },
  "1Pet": {
    code: "1Pet",
    author: "Peter",
    attribution: "stated",
    authorEvidenceRefs: ["1 Peter 1:1"],
    audience: "elect exiles scattered across Asia Minor",
    audienceRefs: ["1 Peter 1:1"],
    summary:
      "A letter from Peter, an apostle of Jesus Christ, to the elect exiles of the Dispersion.",
  },
  "2Pet": {
    code: "2Pet",
    author: "Peter",
    attribution: "stated",
    authorEvidenceRefs: ["2 Peter 1:1"],
    summary:
      "A second letter from Simon Peter, a servant and apostle of Jesus Christ.",
  },
  "1John": {
    code: "1John",
    author: "John",
    attribution: "traditional",
    authorEvidenceRefs: [],
    summary:
      "A letter on fellowship and love; anonymous, traditionally attributed to John.",
  },
  "2John": {
    code: "2John",
    author: "the elder (traditionally John)",
    attribution: "traditional",
    authorEvidenceRefs: ["2 John 1:1"],
    summary:
      "A short letter from 'the elder' to the chosen lady, traditionally attributed to John.",
  },
  "3John": {
    code: "3John",
    author: "the elder (traditionally John)",
    attribution: "traditional",
    authorEvidenceRefs: ["3 John 1:1"],
    summary:
      "A short letter from 'the elder' to Gaius, traditionally attributed to John.",
  },
  Jude: {
    code: "Jude",
    author: "Jude",
    attribution: "stated",
    authorEvidenceRefs: ["Jude 1:1"],
    summary:
      "A letter from Jude, a servant of Jesus Christ and brother of James, urging contention for the faith.",
  },
  Rev: {
    code: "Rev",
    author: "John",
    attribution: "stated",
    authorEvidenceRefs: ["Revelation 1:1", "Revelation 1:9"],
    audience: "the seven churches in the province of Asia",
    audienceRefs: ["Revelation 1:4"],
    summary:
      "The revelation of Jesus Christ given to John, written to the seven churches in the province of Asia.",
  },
};
