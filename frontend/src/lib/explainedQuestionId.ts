import { DIMENSIONS } from '../data/dimensions';

const QID_TO_DIMENSION = new Map<string, { id: number; name: string }>(
  DIMENSIONS.flatMap((dimension) =>
    dimension.qids.map((qid) => [qid, { id: dimension.id, name: dimension.name }] as const),
  ),
);

function partBCefr(canonicalNumber: number): string {
  if (canonicalNumber <= 66) return 'B1';
  if (canonicalNumber <= 76) return 'B2';
  if (canonicalNumber <= 86) return 'C1';
  return 'C2';
}

/** Human-readable business key for teacher dashboard question IDs. */
export function explainedQuestionId(qid: string, canonicalNumber: number, part: 'A' | 'B'): string {
  const ggg = String(canonicalNumber).padStart(3, '0');
  if (part === 'A') {
    const dimension = QID_TO_DIMENSION.get(qid);
    if (!dimension) return `Test1-PartA-Qs${ggg}`;
    return `Test1-PartA-Dimension${dimension.id}(${dimension.name})-Qs${ggg}`;
  }
  return `Test1-PartB-Vocabulary(${partBCefr(canonicalNumber)})-Qs${ggg}`;
}
