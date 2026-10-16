/**
 * Paper I rv3 report builder, checked against the Oct 2026 sample report and the
 * conversion grids seeded by migrations/0020_paper1_bank_and_feedback.sql.
 * Run: npx --yes tsx scripts/test-paper1-report.ts
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildPaper1Report,
  fillTemplate,
  paper1AdditionalKey,
  paper1AreaLabelKey,
  paper1AreaOverviewCode,
  paper1ConcludingCode,
  paper1FeedbackCodes,
  paper1GrammarPoints,
  paper1OverallStep,
  paper1PartBLevels,
  paper1Placement,
  type Paper1BandRow,
  type Paper1BandTables,
  type Paper1ScoredRow,
} from '../worker/src/paper1Report.ts';
import { formatPaper1Level } from '../worker/src/reportI18n.ts';
import type { FeedbackItem, Paper1Area } from '../worker/src/reportVariables.ts';

let failed = 0;

function assert(condition: unknown, message: string): void {
  if (condition) {
    console.log(`ok  ${message}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${message}`);
  }
}

function eq<T>(actual: T, expected: T, message: string): void {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  assert(same, same ? message : `${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
}

// --- Conversion grids from the seed migration ---

function loadBandTables(): Paper1BandTables {
  const sql = readFileSync(
    fileURLToPath(new URL('../migrations/0020_paper1_bank_and_feedback.sql', import.meta.url)),
    'utf8',
  );
  const tables: Paper1BandTables = { partA: [], partB: [], overall: [] };
  const re =
    /INSERT INTO score_conversion_bands \([^)]*\) VALUES \(1, (1|2|NULL), (\d+), (\d+), '([^']+)', '([^']+)', '([^']+)', (NULL|'[^']*'), (NULL|'[^']*'), \d+\);/g;
  const text = (value: string) => (value === 'NULL' ? null : value.slice(1, -1));
  for (const match of sql.matchAll(re)) {
    const row: Paper1BandRow = {
      min_correct: Number(match[2]),
      max_correct: Number(match[3]),
      band_key: match[4],
      cefr_label: match[5],
      level_label: match[6],
      ielts_indicative: text(match[7]),
      toefl_indicative: text(match[8]),
    };
    if (match[1] === '1') tables.partA.push(row);
    else if (match[1] === '2') tables.partB.push(row);
    else tables.overall.push(row);
  }
  return tables;
}

const BANDS = loadBandTables();
eq([BANDS.partA.length, BANDS.partB.length, BANDS.overall.length], [8, 5, 8], 'seeded grids: 8 Part A, 5 Part B, 8 overall rows');

// --- Attempt fixtures ---

const AREA_KEYS = [
  'complexTenses',
  'modalsStance',
  'adjectiveRelativeClauses',
  'nounClausesNominalisation',
  'adverbialClausesConnectors',
  'conditionalsUnrealistic',
  'reportedSpeech',
  'gerundsInfinitives',
  'subjunctiveFormal',
  'inversionFronting',
  'participleReducedClauses',
  'dependentPrepositions',
];
const pad = (n: number, width: number) => String(n).padStart(width, '0');

/** Area n answered with `score` of 5 correct; misses fall on the last categories (… D, E). */
function grammarRows(scores: number[]): Paper1ScoredRow[] {
  return scores.flatMap((score, areaIndex) =>
    Array.from({ length: 5 }, (_, i) => {
      const slot = areaIndex * 5 + i + 1;
      return {
        question_code: `01-01-${pad(areaIndex + 1, 2)}-${pad(slot, 3)}-01`,
        is_correct: i < score ? 1 : 0,
        canonical_number: slot,
        part_code: '01',
        dimension_key: AREA_KEYS[areaIndex],
        dimension_code: pad(areaIndex + 1, 2),
      };
    }),
  );
}

const PART_B_SIZES = { B1: 6, B2: 10, C1: 10, C2: 4 } as const;

function vocabRows(counts: { B1: number; B2: number; C1: number; C2: number }): Paper1ScoredRow[] {
  const rows: Paper1ScoredRow[] = [];
  let slot = 61;
  (['B1', 'B2', 'C1', 'C2'] as const).forEach((level, levelIndex) => {
    for (let i = 0; i < PART_B_SIZES[level]; i++) {
      rows.push({
        question_code: `01-02-${pad(levelIndex + 1, 2)}-${pad(slot, 3)}-01`,
        is_correct: i < counts[level] ? 1 : 0,
        canonical_number: slot++,
        part_code: '02',
        dimension_key: null,
        dimension_code: null,
        cefr_level: level,
      });
    }
  });
  return rows;
}

// --- Sample report: Part A 44/60 B2+, Part B 24/30 C1, overall 68/90 C1 ---

const SAMPLE_AREAS = [5, 4, 4, 3, 5, 4, 4, 3, 2, 2, 4, 4];
const SAMPLE_VOCAB = { B1: 6, B2: 10, C1: 7, C2: 1 };
const sample = buildPaper1Report([...grammarRows(SAMPLE_AREAS), ...vocabRows(SAMPLE_VOCAB)], BANDS);

eq([sample.partA.correct, sample.partA.total], [44, 60], 'sample Part A score 44 / 60');
eq(sample.partA.band.cefrLabel, 'B2+', 'sample Part A placement B2+');
eq(formatPaper1Level(sample.partA.band), 'B2+ (Upper Intermediate, upper range)', 'plus level displays the upper-range label');
eq([sample.partB.correct, sample.partB.total], [24, 30], 'sample Part B score 24 / 30');
eq(sample.partB.placement, 'C1', 'sample Part B placement C1');
eq(formatPaper1Level(sample.partB.band), 'C1 (Advanced)', 'Part B C1 label is Advanced (sample "Proficient" is a typo)');
eq(sample.partB.levels.map((level) => level.percent), [100, 100, 70, 25], 'sample Part B percentages 100 / 100 / 70 / 25');
eq([sample.overall.correct, sample.overall.total, sample.overall.percent], [68, 90, 75.6], 'sample overall 68 / 90 (75.6%)');
eq([sample.overall.band.cefrLabel, sample.overall.band.levelLabel], ['C1', 'Advanced'], 'sample overall CEFR C1 (Advanced)');
eq([sample.overall.band.ielts, sample.overall.band.toefl], ['7.0–8.0', '95–113'], 'sample IELTS 7.0–8.0, TOEFL iBT 95–113');

const areaNumbers = (keys: string[]) => keys.map((key) => AREA_KEYS.indexOf(key) + 1);
eq(areaNumbers(sample.partA.strengthKeys), [1, 5, 2, 3, 6, 7, 11, 12], 'sample strengths: 8 areas in sample order');
eq(areaNumbers(sample.partA.growthKeys), [9, 10, 4, 8], 'sample growth roadmap: 4 areas in sample order');
eq(
  sample.partA.areas.map((area) => area.labelKey),
  ['proficient', 'advanced', 'advanced', 'approaching', 'proficient', 'advanced', 'advanced', 'approaching', 'emerging', 'emerging', 'advanced', 'advanced'],
  'sample area labels follow the score scheme',
);
eq(sample.partA.areas.filter((area) => area.priority).length, 4, 'sample marks 4 priority areas');
eq(sample.partA.concludingCode, '01-01-00-000-00-02', 'sample concluding comment: 3–4 priority areas');
eq(sample.partB.placementCode, '01-02-00-000-00-03', 'sample Part B overall comment: C1');
eq(sample.partB.roadmapCode, '01-02-00-000-02-03', 'sample Part B roadmap: C1');
eq(sample.partB.additional, { key: 'weakerAtTop', code: '01-02-00-000-01-03', level: 'C1' }, 'sample additional sentence: weaker at the top');

const areaOf = (n: number) => sample.partA.areas[n - 1];
eq(areaOf(9).missedQuestionCodes, ['01-01-09-043-01', '01-01-09-044-01', '01-01-09-045-01'], 'Area 9 lists its 3 missed items in A–E order');
eq(areaOf(4).overviewCode, '01-01-04-000-00-03', 'Area 4 (3/5) uses the 3–2/5 overview');
eq(areaOf(1).overviewCode, '01-01-01-000-00-01', 'Area 1 (5/5) uses the 5/5 overview');
const codes = paper1FeedbackCodes(sample);
eq(codes.length, 3 + 12 + 10 + 4, 'feedback codes: 3 templates + 12 overviews + 10 missed items + 4 comments');
eq(areaOf(2).missedQuestionCodes, ['01-01-02-010-01'], 'Area 2 (4/5) has one missed item');
assert(!codes.includes('01-01-02-010-01-00'), 'a missed item in a strength area does not request micro-feedback');

// Grammar points: one card per missed item, de-duplicated by type, A–E order.
const item = (code: string, typeRef: string): FeedbackItem => ({
  code,
  kind: 'micro_feedback',
  typeRef,
  heading: typeRef,
  body: '',
  fields: [],
});
const area9 = areaOf(9);
const feedback: Record<string, FeedbackItem> = {
  '01-01-09-043-01-00': item('01-01-09-043-01-00', 'A09-T01'),
  '01-01-09-044-01-00': item('01-01-09-044-01-00', 'A09-T05'),
  '01-01-09-045-01-00': item('01-01-09-045-01-00', 'A09-T09'),
};
eq(paper1GrammarPoints(area9, feedback).map((point) => point.typeRef), ['A09-T01', 'A09-T05', 'A09-T09'], 'three distinct types give three grammar points');
feedback['01-01-09-045-01-00'] = item('01-01-09-045-01-00', 'A09-T01');
eq(paper1GrammarPoints(area9, feedback).map((point) => point.typeRef), ['A09-T01', 'A09-T05'], 'a repeated type is shown once');
const noFeedback: Paper1Area = { ...area9, missedQuestionCodes: ['01-01-09-099-01'] };
eq(paper1GrammarPoints(noFeedback, feedback).length, 0, 'missing feedback rows are skipped');

// --- Part A bands and area labels ---

const partABandAt = (score: number) => {
  const scores = Array.from({ length: 12 }, (_, i) => Math.min(5, Math.max(0, score - i * 5)));
  return buildPaper1Report([...grammarRows(scores), ...vocabRows(SAMPLE_VOCAB)], BANDS).partA.band.cefrLabel;
};
eq([20, 21, 26, 27, 33, 39, 44, 45, 51, 55, 56, 60].map(partABandAt), ['A2 or below', 'B1', 'B1', 'B1+', 'B2', 'B2+', 'B2+', 'C1', 'C1+', 'C1+', 'C2', 'C2'], 'Part A grid boundaries');
eq([0, 1, 2, 3, 4, 5].map(paper1AreaLabelKey), ['foundation', 'foundation', 'emerging', 'approaching', 'advanced', 'proficient'], 'area labels 0–5');
eq([5, 4, 3, 2, 1, 0].map((score) => paper1AreaOverviewCode('07', score).slice(-2)), ['01', '02', '03', '03', '04', '04'], 'area overview bands 5, 4, 3–2, 1–0');

// --- Concluding buckets ---

eq([0, 1, 2, 3, 4, 5, 12].map((n) => paper1ConcludingCode(n).slice(-2)), ['00', '01', '01', '02', '02', '03', '03'], 'concluding buckets none / 1–2 / 3–4 / 5+');

// --- Part B thresholds, A2 and additional sentences ---

const partB = (counts: { B1: number; B2: number; C1: number; C2: number }) => {
  const levels = paper1PartBLevels(vocabRows(counts), BANDS.partB);
  const placement = paper1Placement(levels);
  return { placement, additional: paper1AdditionalKey(levels, placement) };
};
eq(partB({ B1: 4, B2: 0, C1: 0, C2: 0 }).placement, 'B1', 'B1 threshold 4/6 is met at exactly 4');
eq(partB({ B1: 3, B2: 0, C1: 0, C2: 0 }), { placement: 'A2', additional: 'closeToNext' }, 'B1 3/6 places A2 or below, one short of B1');
eq(partB({ B1: 1, B2: 1, C1: 1, C2: 1 }).placement, 'A2', 'below every threshold places A2 or below');
eq(partB({ B1: 6, B2: 6, C1: 0, C2: 0 }).placement, 'B2', 'B2 threshold 6/10 is met at exactly 6');
eq(partB({ B1: 6, B2: 10, C1: 6, C2: 3 }).placement, 'C2', 'C2 threshold 3/4 with every lower level met places C2');
eq(partB({ B1: 6, B2: 5, C1: 10, C2: 4 }).placement, 'B1', 'placement is sequential: a missed B2 caps it at B1');
eq(partB({ B1: 3, B2: 7, C1: 0, C2: 0 }), { placement: 'A2', additional: 'uneven' }, 'uneven: a higher level met while a lower one is missed');
eq(partB({ B1: 6, B2: 5, C1: 0, C2: 0 }), { placement: 'B1', additional: 'closeToNext' }, 'close to next band: B2 one answer short');
eq(partB({ B1: 5, B2: 8, C1: 7, C2: 3 }), { placement: 'C2', additional: 'even' }, 'even: all four levels within 20 points');
eq(partB({ B1: 6, B2: 8, C1: 3, C2: 0 }), { placement: 'B2', additional: 'weakerAtTop' }, 'weaker at the top for a B2 placement');
eq(partB({ B1: 6, B2: 10, C1: 6, C2: 3 }).additional, null, 'C2 placement with uneven percentages has no additional sentence');
eq(partB({ B1: 0, B2: 0, C1: 0, C2: 0 }), { placement: 'A2', additional: null }, 'all-zero Part B gets no "even" sentence');
eq(partB({ B1: 1, B2: 1, C1: 1, C2: 0 }), { placement: 'A2', additional: null }, 'uniformly low A2 profile gets no "even" sentence');
const bLow = buildPaper1Report([...grammarRows(SAMPLE_AREAS), ...vocabRows({ B1: 3, B2: 0, C1: 0, C2: 0 })], BANDS);
eq([bLow.partB.band.cefrLabel, bLow.partB.placementCode, bLow.partB.roadmapCode], ['A2 or below', '01-02-00-000-00-00', '01-02-00-000-02-00'], 'A2 or below uses AA 00 comments');

// --- Overall ladder (average of steps, half steps round up) ---

eq(
  [
    [4, 5],
    [3, 0],
    [0, 1],
    [6, 5],
    [7, 7],
    [0, 0],
  ].map(([a, b]) => paper1OverallStep(a, b)),
  [5, 2, 1, 6, 7, 0],
  'overall step = ceil((Part A step + Part B step) / 2)',
);
const mixed = buildPaper1Report([...grammarRows([5, 5, 5, 5, 5, 5, 4, 0, 0, 0, 0, 0]), ...vocabRows({ B1: 2, B2: 0, C1: 0, C2: 0 })], BANDS);
eq([mixed.partA.band.cefrLabel, mixed.partB.band.cefrLabel, mixed.overall.band.cefrLabel], ['B2', 'A2 or below', 'B1/B2'], 'B2 + A2 or below rounds up to B1/B2');
eq(formatPaper1Level(mixed.overall.band), 'B1/B2 (Intermediate / Upper Intermediate)', 'split overall level label');

// --- Template sentences ---

eq(fillTemplate('in the following {n} grammar {areas}:', { n: 1 }), 'in the following 1 grammar area:', '{n} {areas} singular');
eq(fillTemplate('in the following {n} grammar {areas}:', { n: 8 }), 'in the following 8 grammar areas:', '{n} {areas} plural');
eq(fillTemplate('secure up to [level];', { level: 'B2' }), 'secure up to B2;', '[level] placeholder');

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll Paper I report checks passed');
