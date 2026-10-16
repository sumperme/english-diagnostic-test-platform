// Paper I report rendering helpers. Mirrors worker/src/paper1Report.ts (rendering side only):
// scoring happens server-side and arrives as rv3 variables; comments arrive as feedback rows.

import { REPORT_MESSAGES } from '../i18n/reportMessages';
import type { FeedbackItem, Paper1Area } from '../types';

/** Linking sentences from the sample report ({n} = count, {areas} = area/areas). */
export const PAPER1_TEMPLATE_CODES = {
  strengthsIntro: '01-01-00-000-01-01',
  strengthsClosing: '01-01-00-000-01-02',
  roadmapIntro: '01-01-00-000-01-03',
} as const;

export const microFeedbackCode = (questionCode: string) => `${questionCode}-00`;

/** Whole numbers without a decimal (75%), otherwise one decimal (75.6%). */
export function formatReportPercent(percent: number): string {
  const rounded = Math.round(percent * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "B2+ (Upper Intermediate, upper range)", "C1 (Advanced)", "A2 or below (Foundation)". */
export function formatPaper1Level(band: { cefrLabel: string; levelLabel: string }): string {
  if (!band.levelLabel) return band.cefrLabel;
  const suffix = band.cefrLabel.endsWith('+') ? `, ${REPORT_MESSAGES.paper1.upperRange}` : '';
  return `${band.cefrLabel} (${band.levelLabel}${suffix})`;
}

/** "13 September 2026" in Hong Kong time, matching the PDF. */
export function formatLongDate(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  }).format(new Date(ms));
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

export type FeedbackField = { label: string; text: string };

/** Grammar-point fields from fields_json, falling back to "Label: text" body lines. */
export function grammarFields(item: FeedbackItem): FeedbackField[] {
  if (Array.isArray(item.fields)) {
    return (item.fields as Array<Partial<FeedbackField>>)
      .filter((field) => typeof field?.label === 'string' && typeof field?.text === 'string')
      .map((field) => ({ label: field.label as string, text: field.text as string }));
  }
  return item.body
    .split('\n')
    .map((line) => {
      const at = line.indexOf(':');
      return at > 0 ? { label: line.slice(0, at).trim(), text: line.slice(at + 1).trim() } : { label: '', text: line.trim() };
    })
    .filter((field) => field.text);
}

export type ConcludingFields = { intro?: string; steps?: FeedbackField[]; closing?: string };

export function concludingFields(item: FeedbackItem): ConcludingFields | null {
  const fields = item.fields as ConcludingFields | null;
  if (fields && (fields.intro || fields.steps?.length || fields.closing)) return fields;
  return null;
}

export function roadmapBullets(item: FeedbackItem): string[] {
  const bullets = (item.fields as { bullets?: unknown } | null)?.bullets;
  const items = Array.isArray(bullets) ? bullets.map(String) : item.body.split('\n');
  return items.map((bullet) => bullet.trim()).filter(Boolean);
}
