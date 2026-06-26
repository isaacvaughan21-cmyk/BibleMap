/**
 * Curated biblical-figure metadata.
 *
 * Hand-authored and verse-referenced (every figure points at real passages that
 * describe them) — a "who was X" question aggregates these. Several figures
 * deliberately share a `primaryName` (three Marys, two Johns, two Jameses, two
 * Josephs): a query for that name returns ALL of them so the answer can surface
 * the distinct people rather than collapse them.
 *
 * `aka` holds alternate names AND distinctive single-word tags (e.g. "Magdalene",
 * "Baptist") used to disambiguate — see lib/qa/route.ts. Every `keyRefs` entry
 * is corpus-validated before display, so a mistaken reference is simply dropped.
 */
export type PersonMeta = {
  id: string;
  primaryName: string;
  aka: string[];
  /** Short eyebrow label, e.g. "Tax collector · Disciple". */
  role: string;
  keyRefs: string[];
  /** Neutral summary, grounded in keyRefs. */
  summary: string;
};

export const PERSON_META: PersonMeta[] = [
  {
    id: "matthew-disciple",
    primaryName: "Matthew",
    aka: ["Levi"],
    role: "Tax collector · Disciple of Jesus",
    keyRefs: ["Matthew 9:9", "Mark 2:14", "Luke 5:27", "Matthew 10:3"],
    summary:
      "A tax collector, also called Levi, whom Jesus called to follow him; he is listed among the twelve apostles.",
  },
  {
    id: "paul-apostle",
    primaryName: "Paul",
    aka: ["Saul"],
    role: "Apostle to the Gentiles",
    keyRefs: ["Acts 9:3-6", "Acts 13:9", "Romans 1:1", "Philippians 3:5"],
    summary:
      "Once Saul, a persecutor of the church, he met the risen Jesus on the road to Damascus and became an apostle who wrote many of the New Testament letters.",
  },
  {
    id: "peter-apostle",
    primaryName: "Peter",
    aka: ["Simon", "Cephas"],
    role: "Fisherman · Apostle",
    keyRefs: ["Matthew 4:18", "Matthew 16:16", "John 1:42", "1 Peter 1:1"],
    summary:
      "A fisherman called Simon whom Jesus named Peter (Cephas); a leading apostle who confessed Jesus as the Christ.",
  },
  {
    id: "john-apostle",
    primaryName: "John",
    aka: ["son of Zebedee", "Zebedee"],
    role: "Apostle · Son of Zebedee",
    keyRefs: ["Matthew 4:21", "John 13:23", "John 21:20", "Revelation 1:9"],
    summary:
      "A fisherman, son of Zebedee and brother of James, one of the twelve apostles and traditionally the disciple whom Jesus loved.",
  },
  {
    id: "john-baptist",
    primaryName: "John",
    aka: ["Baptist", "the Baptist"],
    role: "Prophet · Forerunner of Christ",
    keyRefs: ["Matthew 3:1-3", "Mark 1:4", "Luke 1:13", "John 1:29"],
    summary:
      "John the Baptist, who preached repentance in the wilderness and prepared the way for Jesus, baptizing in the Jordan.",
  },
  {
    id: "james-zebedee",
    primaryName: "James",
    aka: ["son of Zebedee"],
    role: "Apostle · Son of Zebedee",
    keyRefs: ["Matthew 4:21", "Mark 1:19", "Acts 12:2"],
    summary:
      "A fisherman, son of Zebedee and brother of John, one of the twelve apostles; he was put to death by Herod.",
  },
  {
    id: "james-brother",
    primaryName: "James",
    aka: ["the Lord's brother", "the Just"],
    role: "Brother of Jesus · Leader in Jerusalem",
    keyRefs: ["Acts 15:13", "Galatians 1:19", "James 1:1"],
    summary:
      "A brother of Jesus who became a leader of the church in Jerusalem and is traditionally credited with the letter of James.",
  },
  {
    id: "mary-mother",
    primaryName: "Mary",
    aka: ["mother of Jesus"],
    role: "Mother of Jesus",
    keyRefs: ["Luke 1:30-31", "Matthew 1:18", "John 19:26-27"],
    summary:
      "The mother of Jesus, told by the angel Gabriel that she would bear the Son of God.",
  },
  {
    id: "mary-magdalene",
    primaryName: "Mary",
    aka: ["Magdalene"],
    role: "Follower of Jesus · First witness of the resurrection",
    keyRefs: ["Luke 8:2", "John 20:1", "John 20:16"],
    summary:
      "Mary Magdalene, freed by Jesus from seven demons, who followed him and was among the first to see him risen.",
  },
  {
    id: "mary-bethany",
    primaryName: "Mary",
    aka: ["Bethany"],
    role: "Sister of Martha and Lazarus",
    keyRefs: ["Luke 10:39", "John 11:1-2", "John 12:3"],
    summary:
      "Mary of Bethany, who sat at Jesus' feet to listen to him and later anointed him with costly perfume.",
  },
  {
    id: "moses",
    primaryName: "Moses",
    aka: [],
    role: "Prophet · Lawgiver",
    keyRefs: ["Exodus 2:10", "Exodus 3:4-10", "Deuteronomy 34:10"],
    summary:
      "Drawn from the Nile as a baby, called by God at the burning bush to lead Israel out of Egypt; the prophet through whom the law was given.",
  },
  {
    id: "david",
    primaryName: "David",
    aka: [],
    role: "Shepherd · King of Israel",
    keyRefs: ["1 Samuel 16:13", "1 Samuel 17:49", "2 Samuel 5:4"],
    summary:
      "A shepherd anointed king of Israel, who struck down Goliath and reigned forty years; many psalms are ascribed to him.",
  },
  {
    id: "abraham",
    primaryName: "Abraham",
    aka: ["Abram"],
    role: "Patriarch",
    keyRefs: ["Genesis 12:1-3", "Genesis 15:6", "Genesis 17:5"],
    summary:
      "Called by God to leave his country for a land he would be shown; he believed God and was promised to become a great nation.",
  },
  {
    id: "joseph-jacob",
    primaryName: "Joseph",
    aka: ["son of Jacob"],
    role: "Son of Jacob · Ruler in Egypt",
    keyRefs: ["Genesis 37:3-4", "Genesis 41:41", "Genesis 45:4"],
    summary:
      "Jacob's favored son, sold into Egypt by his brothers, who rose to rule under Pharaoh and later preserved his family.",
  },
  {
    id: "joseph-mary",
    primaryName: "Joseph",
    aka: ["husband of Mary", "carpenter"],
    role: "Husband of Mary · Earthly father of Jesus",
    keyRefs: ["Matthew 1:18-19", "Matthew 1:24", "Luke 2:4"],
    summary:
      "A carpenter of Nazareth, betrothed to Mary, who took her as his wife and raised Jesus.",
  },
  {
    id: "joshua",
    primaryName: "Joshua",
    aka: [],
    role: "Successor of Moses · Leader of Israel",
    keyRefs: ["Numbers 27:18-19", "Joshua 1:1-2", "Joshua 24:15"],
    summary:
      "Moses' assistant, commissioned to lead Israel into the promised land; he called the people to serve the LORD.",
  },
  {
    id: "solomon",
    primaryName: "Solomon",
    aka: [],
    role: "King of Israel · Builder of the temple",
    keyRefs: ["2 Samuel 12:24", "1 Kings 3:12", "1 Kings 6:1"],
    summary:
      "Son of David who succeeded him as king and was granted exceptional wisdom; he built the temple in Jerusalem.",
  },
  {
    id: "elijah",
    primaryName: "Elijah",
    aka: [],
    role: "Prophet",
    keyRefs: ["1 Kings 17:1", "1 Kings 18:36-39", "2 Kings 2:11"],
    summary:
      "A prophet who confronted the worship of Baal and was taken up to heaven in a whirlwind.",
  },
  {
    id: "daniel",
    primaryName: "Daniel",
    aka: [],
    role: "Prophet · Exile in Babylon",
    keyRefs: ["Daniel 1:6", "Daniel 6:16", "Daniel 6:22"],
    summary:
      "A young man of Judah taken to Babylon who served in the royal court and was kept safe in the lions' den.",
  },
  {
    id: "jonah",
    primaryName: "Jonah",
    aka: [],
    role: "Prophet",
    keyRefs: ["Jonah 1:1-3", "Jonah 1:17", "Jonah 2:10"],
    summary:
      "A prophet who fled God's call to Nineveh, was swallowed by a great fish, and then delivered God's message.",
  },
  {
    id: "ruth",
    primaryName: "Ruth",
    aka: [],
    role: "Moabite · Ancestor of David",
    keyRefs: ["Ruth 1:16", "Ruth 4:13", "Ruth 4:17"],
    summary:
      "A Moabite widow who stayed with her mother-in-law Naomi, married Boaz, and became an ancestor of David.",
  },
  {
    id: "isaiah",
    primaryName: "Isaiah",
    aka: [],
    role: "Prophet",
    keyRefs: ["Isaiah 1:1", "Isaiah 6:8"],
    summary:
      "A prophet in Judah who saw a vision of the LORD and answered the call, 'Here am I. Send me.'",
  },
  {
    id: "jeremiah",
    primaryName: "Jeremiah",
    aka: [],
    role: "Prophet",
    keyRefs: ["Jeremiah 1:5", "Jeremiah 1:9"],
    summary:
      "A prophet appointed before birth to speak God's word to the nations in the years before Judah's exile.",
  },
  {
    id: "judas-iscariot",
    primaryName: "Judas",
    aka: ["Iscariot"],
    role: "Disciple · Betrayer of Jesus",
    keyRefs: ["Matthew 10:4", "Matthew 26:14-15", "Matthew 27:3-5"],
    summary:
      "One of the twelve who betrayed Jesus for thirty pieces of silver and afterward despaired.",
  },
  {
    id: "thomas",
    primaryName: "Thomas",
    aka: ["Didymus"],
    role: "Apostle",
    keyRefs: ["John 11:16", "John 20:25", "John 20:27-28"],
    summary:
      "An apostle who doubted the resurrection until he saw the risen Jesus and confessed, 'My Lord and my God!'",
  },
  {
    id: "luke",
    primaryName: "Luke",
    aka: ["the physician"],
    role: "Physician · Companion of Paul",
    keyRefs: ["Colossians 4:14", "2 Timothy 4:11"],
    summary:
      "A beloved physician and companion of Paul, traditionally the author of the Gospel of Luke and Acts.",
  },
  {
    id: "mark",
    primaryName: "Mark",
    aka: ["John Mark"],
    role: "Companion of Paul and Barnabas",
    keyRefs: ["Acts 12:25", "Acts 15:37-39", "2 Timothy 4:11"],
    summary:
      "John Mark, a companion on early missionary journeys, traditionally the author of the Gospel of Mark.",
  },
  {
    id: "timothy",
    primaryName: "Timothy",
    aka: [],
    role: "Companion of Paul",
    keyRefs: ["Acts 16:1", "1 Timothy 1:2", "Philippians 2:19-22"],
    summary:
      "A young disciple from Lystra who became Paul's trusted companion and the recipient of two of his letters.",
  },
  {
    id: "barnabas",
    primaryName: "Barnabas",
    aka: [],
    role: "Apostle · Companion of Paul",
    keyRefs: ["Acts 4:36-37", "Acts 11:25-26", "Acts 13:2"],
    summary:
      "A generous Levite nicknamed 'son of encouragement' who vouched for Paul and traveled with him on mission.",
  },
  {
    id: "stephen",
    primaryName: "Stephen",
    aka: [],
    role: "Deacon · First martyr",
    keyRefs: ["Acts 6:5", "Acts 6:8", "Acts 7:59-60"],
    summary:
      "A man full of faith chosen to serve, who performed wonders and became the first Christian to be killed for his testimony.",
  },
  {
    id: "nicodemus",
    primaryName: "Nicodemus",
    aka: [],
    role: "Pharisee · Member of the council",
    keyRefs: ["John 3:1-2", "John 7:50-51", "John 19:39"],
    summary:
      "A Pharisee and ruler who came to Jesus by night and later helped bury him.",
  },
  {
    id: "lazarus",
    primaryName: "Lazarus",
    aka: [],
    role: "Friend of Jesus · Raised from the dead",
    keyRefs: ["John 11:1", "John 11:43-44", "John 12:1-2"],
    summary:
      "A friend of Jesus from Bethany whom Jesus raised from the dead after four days in the tomb.",
  },
  {
    id: "martha",
    primaryName: "Martha",
    aka: [],
    role: "Sister of Mary and Lazarus",
    keyRefs: ["Luke 10:38-40", "John 11:5", "John 11:24"],
    summary:
      "A sister of Mary and Lazarus who welcomed Jesus into her home and professed faith in the resurrection.",
  },
  {
    id: "andrew",
    primaryName: "Andrew",
    aka: [],
    role: "Fisherman · Apostle",
    keyRefs: ["Matthew 4:18", "John 1:40-42", "John 6:8-9"],
    summary:
      "Simon Peter's brother, a fisherman and apostle, who first brought Peter to Jesus.",
  },
];
