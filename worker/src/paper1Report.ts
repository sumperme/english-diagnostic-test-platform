// Paper I diagnostic scoring (rv3, layout-free). Report copy lives in feedback_items and is
// resolved by feedback code at render time.
// Client source: Client_Feedback/Updated Paper 1 information-Oct2026/ (Overall Score Scheme,
// Comments for Part A / Part B, Concluding Comments).

import type {
  BandRef,
  FeedbackItem,
  Paper1AdditionalKey,
  Paper1Area,
  Paper1AreaLabelKey,
  Paper1LadderBand,
  Paper1PartBLevel,
  Paper1PlacementLevel,
  Paper1Report,
  Paper1VocabLevel,
  ReportDimension,
  ReportVariablesV1,
} from './reportVariables';

export { PAPER1_REPORT_VARIABLES_VERSION } from './reportVariables';

export const PAPER1_VOCAB_LEVELS: Paper1VocabLevel[] = ['B1', 'B2', 'C1', 'C2'];
export const PAPER1_AREA_MAX = 5;
export const PAPER1_PRIORITY_MAX_SCORE = 3;

/** Part A band keys in ladder order: index = step. */
const PART_A_LADDER = ['a2OrBelow', 'b1', 'b1Plus', 'b2', 'b2Plus', 'c1', 'c1Plus', 'c2'];
const PART_B_STEP: Record<Paper1PlacementLevel, number> = { A2: 0, B1: 1, B2: 3, C1: 5, C2: 7 };

/** Linking sentences from the sample report ({n} = count, {areas} = area/areas). */
export const PAPER1_TEMPLATE_CODES = {
  strengthsIntro: '01-01-00-000-01-01',
  strengthsClosing: '01-01-00-000-01-02',
  roadmapIntro: '01-01-00-000-01-03',
} as const;

export type Paper1ScoredRow = {
  question_code: string;
  is_correct: number | null;
  canonical_number: number;
  part_code: string;
  dimension_key: string | null;
  dimension_code: string | null;
  cefr_level?: string | null;
};

export type Paper1BandRow = {
  min_correct: number;
  max_correct: number;
  band_key: string;
  cefr_label: string;
  level_label: string | null;
  ielts_indicative: string | null;
  toefl_indicative: string | null;
};

export type Paper1BandTables = {
  partA: Paper1BandRow[];
  partB: Paper1BandRow[];
  overall: Paper1BandRow[];
};

const toLadderBand = (row: Paper1BandRow, step: number): Paper1LadderBand => ({
  bandKey: row.band_key,
  cefrLabel: row.cefr_label,
  levelLabel: row.level_label ?? '',
  ielts: row.ielts_indicative,
  toefl: row.toefl_indicative,
  step,
});

/** One decimal, 0–100. */
export const percentOf = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;

/** Whole numbers without a decimal (75%), otherwise one decimal (75.6%). */
export function formatReportPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function paper1AreaLabelKey(score: number): Paper1AreaLabelKey {
  if (score >= 5) return 'proficient';
  if (score === 4) return 'advanced';
  if (score === 3) return 'approaching';
  if (score === 2) return 'emerging';
  return 'foundation';
}

/** Area overview AA: 01 = 5/5, 02 = 4/5, 03 = 3–2/5, 04 = 1–0/5. */
export function paper1AreaOverviewCode(dimensionCode: string, score: number): string {
  const aa = score >= 5 ? '01' : score === 4 ? '02' : score >= 2 ? '03' : '04';
  return `01-01-${dimensionCode}-000-00-${aa}`;
}

/** Concluding comment AA by priority-area count: 00 none, 01 = 1–2, 02 = 3–4, 03 = 5+. */
export function paper1ConcludingCode(priorityCount: number): string {
  const aa = priorityCount === 0 ? '00' : priorityCount <= 2 ? '01' : priorityCount <= 4 ? '02' : '03';
  return `01-01-00-000-00-${aa}`;
}

const PLACEMENT_AA: Record<Paper1PlacementLevel, string> = { A2: '00', B1: '01', B2: '02', C1: '03', C2: '04' };
const ADDITIONAL_AA: Record<Paper1AdditionalKey, string> = { uneven: '01', closeToNext: '02', weakerAtTop: '03', even: '04' };

export const paper1PlacementCode = (level: Paper1PlacementLevel) => `01-02-00-000-00-${PLACEMENT_AA[level]}`;
export const paper1RoadmapCode = (level: Paper1PlacementLevel) => `01-02-00-000-02-${PLACEMENT_AA[level]}`;
export const paper1AdditionalCode = (key: Paper1AdditionalKey) => `01-02-00-000-01-${ADDITIONAL_AA[key]}`;

export function buildPaper1Areas(rows: Paper1ScoredRow[]): Paper1Area[] {
  const byArea = new Map<string, { code: string; rows: Paper1ScoredRow[] }>();
  for (const row of rows) {
    if (row.part_code !== '01' || !row.dimension_key || !row.dimension_code) continue;
    const entry = byArea.get(row.dimension_key) ?? { code: row.dimension_code, rows: [] };
    entry.rows.push(row);
    byArea.set(row.dimension_key, entry);
  }
  return [...byArea.entries()]
    .map(([key, { code, rows: areaRows }]) => {
      const ordered = [...areaRows].sort((a, b) => a.canonical_number - b.canonical_number);
      const score = ordered.filter((row) => row.is_correct === 1).length;
      return {
        key,
        dimensionCode: code,
        score,
        max: ordered.length,
        labelKey: paper1AreaLabelKey(score),
        priority: score <= PAPER1_PRIORITY_MAX_SCORE,
        overviewCode: paper1AreaOverviewCode(code, score),
        missedQuestionCodes: ordered.filter((row) => row.is_correct !== 1).map((row) => row.question_code),
      };
    })
    .sort((a, b) => a.dimensionCode.localeCompare(b.dimensionCode));
}

export function paper1StrengthAndGrowth(areas: Paper1Area[]): { strengthKeys: string[]; growthKeys: string[] } {
  const strengths = areas
    .filter((area) => !area.priority)
    .sort((a, b) => b.score - a.score || a.dimensionCode.localeCompare(b.dimensionCode));
  const growth = areas
    .filter((area) => area.priority)
    .sort((a, b) => a.score - b.score || a.dimensionCode.localeCompare(b.dimensionCode));
  return { strengthKeys: strengths.map((area) => area.key), growthKeys: growth.map((area) => area.key) };
}

function partABand(correct: number, bands: Paper1BandRow[]): Paper1LadderBand {
  const row = bands.find((band) => correct >= band.min_correct && correct <= band.max_correct);
  if (!row) throw new Error(`No Paper I Part A band for ${correct}`);
  const step = PART_A_LADDER.indexOf(row.band_key);
  if (step < 0) throw new Error(`Unknown Paper I Part A band key ${row.band_key}`);
  return toLadderBand(row, step);
}

export function paper1PartBLevels(rows: Paper1ScoredRow[], bands: Paper1BandRow[]): Paper1PartBLevel[] {
  return PAPER1_VOCAB_LEVELS.map((level) => {
    const levelRows = rows.filter((row) => row.part_code === '02' && row.cefr_level === level);
    const correct = levelRows.filter((row) => row.is_correct === 1).length;
    const band = bands.find((b) => b.band_key === level.toLowerCase());
    if (!band) throw new Error(`No Paper I Part B threshold for ${level}`);
    return {
      level,
      correct,
      total: levelRows.length,
      threshold: band.min_correct,
      met: correct >= band.min_correct,
      percent: percentOf(correct, levelRows.length),
    };
  });
}

export function paper1Placement(levels: Paper1PartBLevel[]): Paper1PlacementLevel {
  let placement: Paper1PlacementLevel = 'A2';
  for (const level of levels) {
    if (!level.met) break;
    placement = level.level;
  }
  return placement;
}

/**
 * At most one extra sentence, first match wins:
 * uneven (a level above the placement meets its threshold) → close to next band (next level is
 * one correct answer short) → even (all four percentages within 20 points; never for an A2
 * placement, where "well balanced" would describe uniformly low scores) → weaker at top
 * (placement B1–C1).
 */
export function paper1AdditionalKey(levels: Paper1PartBLevel[], placement: Paper1PlacementLevel): Paper1AdditionalKey | null {
  const placedIndex = PAPER1_VOCAB_LEVELS.indexOf(placement as Paper1VocabLevel);
  if (levels.some((level, i) => i > placedIndex && level.met)) return 'uneven';
  const next = levels[placedIndex + 1];
  if (next && next.correct === next.threshold - 1) return 'closeToNext';
  const percents = levels.map((level) => level.percent);
  if (placement !== 'A2' && Math.max(...percents) - Math.min(...percents) <= 20) return 'even';
  if (placement === 'B1' || placement === 'B2' || placement === 'C1') return 'weakerAtTop';
  return null;
}

function partBBand(placement: Paper1PlacementLevel, bands: Paper1BandRow[]): Paper1LadderBand {
  const key = placement === 'A2' ? 'a2OrBelow' : placement.toLowerCase();
  const row = bands.find((band) => band.band_key === key);
  if (!row) throw new Error(`No Paper I Part B band for ${placement}`);
  return toLadderBand(row, PART_B_STEP[placement]);
}

/** Overall step = average of the two part steps, half steps rounded up. */
export function paper1OverallStep(partAStep: number, partBStep: number): number {
  return Math.ceil((partAStep + partBStep) / 2);
}

function overallBand(step: number, bands: Paper1BandRow[]): Paper1LadderBand {
  const row = bands.find((band) => band.min_correct === step);
  if (!row) throw new Error(`No Paper I overall band for step ${step}`);
  return toLadderBand(row, step);
}

export function buildPaper1Report(rows: Paper1ScoredRow[], bands: Paper1BandTables): Paper1Report {
  const areas = buildPaper1Areas(rows);
  const { strengthKeys, growthKeys } = paper1StrengthAndGrowth(areas);
  const partARows = rows.filter((row) => row.part_code === '01');
  const partBRows = rows.filter((row) => row.part_code === '02');
  const partACorrect = partARows.filter((row) => row.is_correct === 1).length;
  const partBCorrect = partBRows.filter((row) => row.is_correct === 1).length;

  const aBand = partABand(partACorrect, bands.partA);
  const levels = paper1PartBLevels(rows, bands.partB);
  const placement = paper1Placement(levels);
  const bBand = partBBand(placement, bands.partB);
  const additionalKey = paper1AdditionalKey(levels, placement);

  const correct = partACorrect + partBCorrect;
  const total = partARows.length + partBRows.length;
  return {
    overall: {
      correct,
      total,
      percent: percentOf(correct, total),
      band: overallBand(paper1OverallStep(aBand.step, bBand.step), bands.overall),
    },
    partA: {
      correct: partACorrect,
      total: partARows.length,
      band: aBand,
      areas,
      strengthKeys,
      growthKeys,
      concludingCode: paper1ConcludingCode(growthKeys.length),
    },
    partB: {
      correct: partBCorrect,
      total: partBRows.length,
      levels,
      placement,
      band: bBand,
      placementCode: paper1PlacementCode(placement),
      additional: additionalKey
        ? { key: additionalKey, code: paper1AdditionalCode(additionalKey), level: additionalKey === 'weakerAtTop' ? placement : null }
        : null,
      roadmapCode: paper1RoadmapCode(placement),
    },
  };
}

export function paper1Dimensions(report: Paper1Report): ReportDimension[] {
  return report.partA.areas.map((area) => ({
    key: area.key,
    dimensionCode: area.dimensionCode,
    partCode: '01',
    score: area.score,
    max: area.max,
    levelKey: area.labelKey,
  }));
}

const bandRef = (band: Paper1LadderBand): BandRef => ({
  bandKey: band.bandKey,
  cefrLabel: band.cefrLabel,
  ielts: band.ielts,
  toefl: band.toefl,
});

/** Generic band view for consumers shared with Papers II/III (teacher dashboard, AI prompts). */
export function paper1Bands(report: Paper1Report): ReportVariablesV1['bands'] {
  return {
    overall: bandRef(report.overall.band),
    parts: [
      { ...bandRef(report.partA.band), partCode: '01' },
      { ...bandRef(report.partB.band), partCode: '02' },
    ],
  };
}

export const microFeedbackCode = (questionCode: string) => `${questionCode}-00`;

/** Every feedback code a rendered Paper I report needs. */
export function paper1FeedbackCodes(report: Paper1Report): string[] {
  const growth = new Set(report.partA.growthKeys);
  const codes = new Set<string>(Object.values(PAPER1_TEMPLATE_CODES));
  for (const area of report.partA.areas) {
    codes.add(area.overviewCode);
    if (growth.has(area.key)) for (const code of area.missedQuestionCodes) codes.add(microFeedbackCode(code));
  }
  codes.add(report.partA.concludingCode);
  codes.add(report.partB.placementCode);
  codes.add(report.partB.roadmapCode);
  if (report.partB.additional) codes.add(report.partB.additional.code);
  return [...codes];
}

type FeedbackRow = {
  feedback_code: string;
  kind: string;
  type_ref: string | null;
  heading: string | null;
  body: string;
  fields_json: string | null;
};

/** Resolves the report's feedback codes against feedback_items (D1 caps bound parameters at 100). */
export async function loadPaper1Feedback(db: D1Database, report: Paper1Report): Promise<Record<string, FeedbackItem>> {
  const codes = paper1FeedbackCodes(report);
  const out: Record<string, FeedbackItem> = {};
  for (let i = 0; i < codes.length; i += 50) {
    const chunk = codes.slice(i, i + 50);
    const result = await db
      .prepare(
        `SELECT feedback_code, kind, type_ref, heading, body, fields_json FROM feedback_items
         WHERE feedback_code IN (${chunk.map(() => '?').join(',')})`,
      )
      .bind(...chunk)
      .all<FeedbackRow>();
    for (const row of result.results ?? []) {
      let fields: unknown = null;
      try {
        fields = row.fields_json ? JSON.parse(row.fields_json) : null;
      } catch {
        fields = null;
      }
      out[row.feedback_code] = {
        code: row.feedback_code,
        kind: row.kind,
        typeRef: row.type_ref,
        heading: row.heading,
        body: row.body,
        fields,
      };
    }
  }
  return out;
}

/** Grammar-point cards for one growth area: one per missed item, de-duplicated by type, A–E order. */
export function paper1GrammarPoints(area: Paper1Area, feedback: Record<string, FeedbackItem>): FeedbackItem[] {
  const seen = new Set<string>();
  const out: FeedbackItem[] = [];
  for (const code of area.missedQuestionCodes) {
    const item = feedback[microFeedbackCode(code)];
    if (!item) continue;
    const dedupeKey = item.typeRef ?? item.code;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(item);
  }
  return out;
}

/** Fills the {n} / {areas} / [level] placeholders in stored template sentences. */
export function fillTemplate(text: string, values: { n?: number; level?: string | null }): string {
  let out = text;
  if (values.n != null) {
    out = out.replace(/\{n\}/g, String(values.n)).replace(/\{areas\}/g, values.n === 1 ? 'area' : 'areas');
  }
  if (values.level) out = out.replace(/\[level\]/g, values.level);
  return out;
}
