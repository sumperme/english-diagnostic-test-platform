import { DIMENSIONS } from '../data/dimensions';

const QID_TO_DIMENSION = new Map<string, { id: number; name: string }>(
  DIMENSIONS.flatMap((dimension) =>
    dimension.qids.map((qid) => [qid, { id: dimension.id, name: dimension.name }] as const),
  ),
);

/** Human-readable business key for teacher dashboard question IDs. */
export function explainedQuestionId(qid: string, canonicalNumber: number, part: 'A' | 'B'): string {
  const ggg = String(canonicalNumber).padStart(3, '0');
  if (part === 'A') {
    const dimension = QID_TO_DIMENSION.get(qid);
    if (!dimension) return `Test1-PartA-Qs${ggg}-Var1`;
    return `Test1-PartA-Dimension${dimension.id}(${dimension.name})-Qs${ggg}-Var1`;
  }
  const vocabLabel = canonicalNumber <= 75 ? 'Vocabulary(Common)' : 'Vocabulary(Specialized Terms)';
  return `Test1-PartB-${vocabLabel}-Qs${ggg}-Var1`;
}
