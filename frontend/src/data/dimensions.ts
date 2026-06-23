export type Dimension = {
  id: number;
  key: string;
  name: string;
  short: string;
  canonicalNumbers: number[];
  qids: string[];
};

export const DIMENSIONS: Dimension[] = [
  { id: 1, key: 'tenses', name: 'Tenses', short: 'Tenses', canonicalNumbers: [7, 8, 20, 27, 37], qids: ['A7', 'A8', 'A20', 'A27', 'A37'] },
  { id: 2, key: 'adjectiveClauses', name: 'Adjective Clauses', short: 'Adj. Cl.', canonicalNumbers: [4, 5, 6, 38, 39], qids: ['A4', 'A5', 'A6', 'A38', 'A39'] },
  { id: 3, key: 'nounClauses', name: 'Noun Clauses', short: 'Noun Cl.', canonicalNumbers: [26, 30, 40, 41, 42], qids: ['A26', 'A30', 'A40', 'A41', 'A42'] },
  { id: 4, key: 'adverbialClausesReasons', name: 'Adverbs/Adverbial Clauses I: Reasons, Purposes & Results', short: 'Adv. Cl. I', canonicalNumbers: [9, 11, 28, 43, 44], qids: ['A9', 'A11', 'A28', 'A43', 'A44'] },
  { id: 5, key: 'adverbialClausesMannerTimePlace', name: 'Adverbs/Adverbial Clauses II: Manners, Time & Place', short: 'Adv. Cl. II', canonicalNumbers: [10, 13, 25, 45, 46], qids: ['A10', 'A13', 'A25', 'A45', 'A46'] },
  { id: 6, key: 'adverbialClausesConcession', name: 'Adverbs/Adverbial Clauses III: Concession & Contrast', short: 'Adv. Cl. III', canonicalNumbers: [19, 31, 32, 55, 56], qids: ['A19', 'A31', 'A32', 'A55', 'A56'] },
  { id: 7, key: 'conditionals', name: 'Conditionals', short: 'Conditionals', canonicalNumbers: [16, 22, 23, 49, 50], qids: ['A16', 'A22', 'A23', 'A49', 'A50'] },
  { id: 8, key: 'activePassive', name: 'Active vs Passive', short: 'Act/Pass', canonicalNumbers: [1, 2, 3, 51, 52], qids: ['A1', 'A2', 'A3', 'A51', 'A52'] },
  { id: 9, key: 'gerundsInfinitives', name: 'Gerunds & Infinitives', short: 'Ger/Inf', canonicalNumbers: [21, 24, 29, 53, 54], qids: ['A21', 'A24', 'A29', 'A53', 'A54'] },
  { id: 10, key: 'reportedSpeech', name: 'Reported Speech & Reported Questions', short: 'Reported', canonicalNumbers: [17, 18, 36, 57, 58], qids: ['A17', 'A18', 'A36', 'A57', 'A58'] },
  { id: 11, key: 'collocationsPrepositions', name: 'Collocations & Prepositions', short: 'Coll/Prep', canonicalNumbers: [12, 14, 15, 47, 48], qids: ['A12', 'A14', 'A15', 'A47', 'A48'] },
  { id: 12, key: 'subjectVerbAgreement', name: 'Subject-verb Agreement', short: 'S-V Agr.', canonicalNumbers: [33, 34, 35, 59, 60], qids: ['A33', 'A34', 'A35', 'A59', 'A60'] },
];

export const OVERALL_ONLY_QIDS = [
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10',
  'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20',
  'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B28', 'B29', 'B30',
];
