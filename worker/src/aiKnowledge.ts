// Question-to-knowledge snippets for AI feedback prompts (RAG source).
//
// Transcribed from the client design documents:
//   Client_Feedback/20260623Paper 1_..._Grammar and Vocabulary_Design and Overview.docx
//   Client_Feedback/20260706Paper 2_..._Listening and Reading_Design and Overview.docx
//
// Keys match `dimensions.key` in D1 (see migrations/0007 + 0008), so a weak
// dimension in the stored rv1 report variables maps directly to the snippet
// that grounds the model's advice. Keep snippets short: they are prompt
// context, not user-facing copy.

/** Paper I (test 01) — 12 applied-grammar dimensions, 5 MCQs each. */
export const PAPER1_DIMENSION_KNOWLEDGE: Record<string, string> = {
  tenses:
    'Tenses: choosing and combining tense/aspect forms accurately (perfect vs simple, sequence of tenses in extended text). C1 expects rare, hard-to-spot errors even in complex structures.',
  adjectiveClauses:
    'Adjective (relative) clauses: relative pronoun choice, defining vs non-defining clauses, reduced relative clauses, and preposition + relative pronoun patterns.',
  nounClauses:
    'Noun clauses: that-clauses and wh-clauses as subjects/objects/complements, embedded questions with statement word order, and subjunctive after verbs of demand or suggestion.',
  adverbialClausesReasons:
    'Adverbs and adverbial clauses I (reasons, purposes, results): connectors such as because/since/as, so that, such...that, therefore; distinguishing purpose from result and cause.',
  adverbialClausesMannerTimePlace:
    'Adverbs and adverbial clauses II (manner, time, place): connectors like as/as if, when/while/once/until, wherever; tense restrictions inside time clauses.',
  adverbialClausesConcession:
    'Adverbs and adverbial clauses III (concession and contrast): although/though/even though, despite/in spite of + noun or gerund, whereas/while, however/nevertheless.',
  conditionals:
    'Conditionals: real, unreal and mixed conditionals, inverted conditionals (had/were/should), and alternatives such as unless, provided that, but for.',
  activePassive:
    'Active vs passive voice: forming passives across tenses, verbs that resist the passive, and choosing voice for emphasis and formal register.',
  gerundsInfinitives:
    'Gerunds and infinitives: verbs and expressions that select gerund vs infinitive (sometimes with meaning change, e.g. remember/stop/regret), and gerunds after prepositions.',
  reportedSpeech:
    'Reported speech and reported questions: backshifting tense, pronoun and time-expression changes, statement word order in reported questions, reporting verbs and their patterns.',
  collocationsPrepositions:
    'Collocations and prepositions: fixed verb/noun/adjective + preposition combinations and natural word partnerships that must be recalled as chunks rather than derived by rule.',
  subjectVerbAgreement:
    'Subject-verb agreement: agreement with intervening phrases, quantities and fractions, either/neither, collective nouns, and clauses or gerund phrases as subjects.',
};

/** Paper I Part B vocabulary bands (canonical Q61-75 vs Q76-90). */
export const PAPER1_VOCAB_KNOWLEDGE = {
  vocabCommon:
    'Vocabulary (common), Q61-75: common collocations, idiomatic expressions, colloquial phrases and less common words; recognising nuanced meaning and formal vs informal register (CEFR C1).',
  vocabSpecialized:
    'Vocabulary (specialized terms), Q76-90: highly nuanced vocabulary including specialized terms across fields such as science, literature and business, plus idiomatic and rhetorical language (CEFR C2).',
};

/** Paper II (test 02) — difficulty-band dimensions used in the rv1 variables. */
export const PAPER2_DIMENSION_KNOWLEDGE: Record<string, string> = {
  listeningB2:
    'Listening B2 items (Q1-6): clear, structured announcements, instructions and short explanations; understanding main ideas, key factual details (times, days), step sequences, simple preferences and fairly clear attitudes.',
  listeningC1C2:
    'Listening C1/C2 items (Q7-20): loosely structured speeches, conversations and panel discussions; identifying key messages, inferring attitudes and stance, idiomatic expressions in context, irony and self-deprecating humour, hedged criticism, and shifts between formal and informal register or public and private tone.',
  readingB2:
    'Reading B2 items (Q21-30): narrative writing, notices, promotional materials and an open business letter; identifying purpose, theme, intended audience, gist, specific information, underlying meaning and tone.',
  readingC1C2:
    'Reading C1/C2 items (Q31-45): expository writing (magazine feature and blog); identifying main ideas at passage and paragraph level, the author\u2019s view, global view of the passage, summarising, and synthesising information across the text to infer meaning.',
};

/** Skill descriptions used when a whole part (rather than a dimension) is weak. */
export const PAPER2_PART_KNOWLEDGE = {
  listening:
    'Part A Listening: extracts of speeches, dialogues and discussions; comprehending key messages, tone, speaker attitudes, shifts in register, and nuanced meanings. Recordings play once only, so real-time processing matters.',
  reading:
    'Part B Reading: texts of various genres; understanding specific information, text organization features, implication, tone and text structure.',
};

/** Shared framing for both papers (from the test introductions). */
export const TEST_PURPOSE =
  'The English Diagnostic Test helps ESL/EFL learners near the end of secondary education diagnose weaknesses before pursuing university programmes delivered in English. Items align with CEFR C1 and C2; C2 is required in demanding academic and professional settings.';
