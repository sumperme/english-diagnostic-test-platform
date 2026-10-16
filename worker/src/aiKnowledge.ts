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
  complexTenses:
    'Complex tenses and aspect: choosing and combining tense/aspect forms accurately (perfect vs simple, progressive duration, future-in-the-past, sequence of tenses in extended text).',
  modalsStance:
    'Modals of stance and deduction: present and past logical deduction, possibility, advice, obligation, criticism, regret, and counterfactual stance.',
  adjectiveRelativeClauses:
    'Adjective (relative) clauses: relative pronoun choice and case, defining vs non-defining clauses, relative adverbs, preposition placement, quantitative/partitive/sentential relatives, and reduced relative clauses.',
  nounClausesNominalisation:
    'Noun clauses and nominalisation: sentence role and subordinator choice, embedded questions with statement word order, reported speech and sequence of tenses, subjunctive noun clauses, and nominal structures.',
  adverbialClausesConnectors:
    'Adverbial clauses and connectors: time, manner, place, cause, result, concession, contrast, real conditions, exception, provision, and discourse-marker reduction.',
  conditionalsUnrealistic:
    'Conditionals and unrealistic stance: zero/first/second/third and mixed conditionals, temporal shifts, inverted conditionals, and counterfactual or hypothetical stance.',
  reportedSpeech:
    'Reported speech and indirect discourse: backshifting, reported questions, commands/requests/offers, reporting-verb clause patterns, and deictic anchor shifts.',
  gerundsInfinitives:
    'Gerunds, infinitives and complementation: meaning-changing pairs, matrix-verb complementation, preposition complementation, complex structures, and adjectival/nominal complementation.',
  subjunctiveFormal:
    'Subjunctive mood and formal requests: mandative subjunctive, negation/voice/aspect, alternatives to the subjunctive, formulaic optative/concession, and formal request syntactic patterns.',
  inversionFronting:
    'Inversion and fronting: negative/restrictive adverbial inversion, correlative and additive inversion, place/directive fronting, conditional inversion, and stylistic fronting.',
  participleReducedClauses:
    'Participle and reduced clauses: present participles in active actions, past participles in passive actions, perfect participles, dangling modifiers, and reduced clauses with conjunctions.',
  dependentPrepositions:
    'Dependent prepositions and complement phrases: verb/adjective/noun + preposition, gerund vs infinitive after prepositions, and idiomatic complex phrases.',
};

/** Paper I Part B vocabulary (CEFR-tagged groups 061–090). */
export const PAPER1_VOCAB_KNOWLEDGE = {
  vocabCommon:
    'Vocabulary (B1/B2 groups): high-frequency academic and general collocations; recognising nuanced meaning and register in everyday and study contexts.',
  vocabSpecialized:
    'Vocabulary (C1/C2 groups): lower-frequency and specialised lexis across academic and professional fields, plus idiomatic and rhetorical language.',
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

/** Paper III part-level notes when dimensions are empty (band-only reports). */
export const PAPER3_PART_KNOWLEDGE = {
  speaking:
    'Part A Speaking: sustained turns on personal, abstract and persuasive topics; clarity, fluency, organisation, and appropriate register under one-shot recording conditions.',
  writing:
    'Part B Writing: summary/response and argumentative essay; coherent paragraphs, precise vocabulary, and controlled complex grammar for academic/professional purposes.',
};

/** Shared framing for both papers (from the test introductions). */
export const TEST_PURPOSE =
  'The English Diagnostic Test helps ESL/EFL learners near the end of secondary education diagnose weaknesses before pursuing university programmes delivered in English. Items align with CEFR C1 and C2; C2 is required in demanding academic and professional settings.';
