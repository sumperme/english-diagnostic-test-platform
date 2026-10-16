export type Dimension = {
  id: number;
  key: string;
  name: string;
  short: string;
  canonicalNumbers: number[];
  qids: string[];
};

function areaSlots(area: number): { canonicalNumbers: number[]; qids: string[] } {
  const start = (area - 1) * 5 + 1;
  const canonicalNumbers = [start, start + 1, start + 2, start + 3, start + 4];
  return { canonicalNumbers, qids: canonicalNumbers.map((n) => `A${n}`) };
}

export const DIMENSIONS: Dimension[] = [
  { id: 1, key: 'complexTenses', name: 'Tenses & Time Expressions', short: 'Tenses', ...areaSlots(1) },
  { id: 2, key: 'modalsStance', name: 'Modal Verbs: Certainty, Possibility & Advice', short: 'Modals', ...areaSlots(2) },
  { id: 3, key: 'adjectiveRelativeClauses', name: 'Adjective (Relative) Clauses', short: 'Relative Cl.', ...areaSlots(3) },
  { id: 4, key: 'nounClausesNominalisation', name: 'Noun Clauses & Formal Academic Expressions', short: 'Noun Cl.', ...areaSlots(4) },
  { id: 5, key: 'adverbialClausesConnectors', name: 'Linking Ideas & Sentence Relationships', short: 'Linking', ...areaSlots(5) },
  { id: 6, key: 'conditionalsUnrealistic', name: 'Conditionals & Unreal Situations', short: 'Conditionals', ...areaSlots(6) },
  { id: 7, key: 'reportedSpeech', name: 'Reported Speech', short: 'Reported', ...areaSlots(7) },
  { id: 8, key: 'gerundsInfinitives', name: 'Gerunds & Infinitives', short: 'Ger./Inf.', ...areaSlots(8) },
  { id: 9, key: 'subjunctiveFormal', name: 'Formal Grammar & Official Language', short: 'Formal', ...areaSlots(9) },
  { id: 10, key: 'inversionFronting', name: 'Inversion & Emphasis', short: 'Inversion', ...areaSlots(10) },
  { id: 11, key: 'participleReducedClauses', name: 'Participial Phrases & Reduced Clauses', short: 'Participles', ...areaSlots(11) },
  { id: 12, key: 'dependentPrepositions', name: 'Prepositions & Common Word Combinations', short: 'Prepositions', ...areaSlots(12) },
];

export const OVERALL_ONLY_QIDS = [
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10',
  'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20',
  'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B28', 'B29', 'B30',
];
