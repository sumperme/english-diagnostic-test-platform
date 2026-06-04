export type Dimension = {
  id: number;
  key: string;
  name: string;
  short: string;
  canonicalNumbers: number[];
  qids: string[];
};

export const DIMENSIONS: Dimension[] = [
  { id: 1, key: 'nounsArticles', name: 'Nouns and Articles', short: 'Nouns', canonicalNumbers: [1, 13, 25, 37, 49], qids: ['A1', 'A13', 'A25', 'B1', 'B13'] },
  { id: 2, key: 'pronouns', name: 'Pronouns', short: 'Pronouns', canonicalNumbers: [2, 14, 26, 38, 50], qids: ['A2', 'A14', 'A26', 'B2', 'B14'] },
  { id: 3, key: 'verbsTenses', name: 'Verbs and Tenses', short: 'Tenses', canonicalNumbers: [3, 15, 27, 39, 51], qids: ['A3', 'A15', 'A27', 'B3', 'B15'] },
  { id: 4, key: 'subjectVerbAgreement', name: 'Subject-Verb Agreement', short: 'Agreement', canonicalNumbers: [4, 16, 28, 40, 52], qids: ['A4', 'A16', 'A28', 'B4', 'B16'] },
  { id: 5, key: 'adjectivesAdverbs', name: 'Adjectives and Adverbs', short: 'Adj/Adv', canonicalNumbers: [5, 17, 29, 41, 53], qids: ['A5', 'A17', 'A29', 'B5', 'B17'] },
  { id: 6, key: 'prepositions', name: 'Prepositions', short: 'Preps', canonicalNumbers: [6, 18, 30, 42, 54], qids: ['A6', 'A18', 'A30', 'B6', 'B18'] },
  { id: 7, key: 'conjunctions', name: 'Conjunctions', short: 'Conj.', canonicalNumbers: [7, 19, 31, 43, 55], qids: ['A7', 'A19', 'A31', 'B7', 'B19'] },
  { id: 8, key: 'sentenceStructure', name: 'Sentence Structure', short: 'Structure', canonicalNumbers: [8, 20, 32, 44, 56], qids: ['A8', 'A20', 'A32', 'B8', 'B20'] },
  { id: 9, key: 'vocabSynonymsAntonyms', name: 'Vocabulary (Synonyms/Antonyms)', short: 'Vocab I', canonicalNumbers: [9, 21, 33, 45, 57], qids: ['A9', 'A21', 'A33', 'B9', 'B21'] },
  { id: 10, key: 'vocabContextual', name: 'Vocabulary (Contextual)', short: 'Vocab II', canonicalNumbers: [10, 22, 34, 46, 58], qids: ['A10', 'A22', 'A34', 'B10', 'B22'] },
  { id: 11, key: 'readingMainIdea', name: 'Reading Comprehension (Main Idea)', short: 'Main Idea', canonicalNumbers: [11, 23, 35, 47, 59], qids: ['A11', 'A23', 'A35', 'B11', 'B23'] },
  { id: 12, key: 'readingInference', name: 'Reading Comprehension (Inference)', short: 'Inference', canonicalNumbers: [12, 24, 36, 48, 60], qids: ['A12', 'A24', 'A36', 'B12', 'B24'] },
];

export const OVERALL_ONLY_QIDS = ['B25', 'B26', 'B27', 'B28', 'B29', 'B30', 'B31', 'B32', 'B33', 'B34', 'B35', 'B36'];
