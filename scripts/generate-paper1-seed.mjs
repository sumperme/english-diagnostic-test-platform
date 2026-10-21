// Generates migrations/0020_paper1_bank_and_feedback.sql: the whole Paper I bank plus the
// report feedback library, from the client docx files. Client_Feedback/ is read-only.
//
//   node scripts/generate-paper1-seed.mjs
//
// Stems and options:   Client_Feedback/test-question-bank/            (extract-paper1-bank.mjs)
// Part A keys/targets: Client_Feedback/Updated Paper 1 information-Oct2026/ MicroFeedback files
// Report feedback:     the same Oct2026 folder                         (extract-paper1-feedback.mjs)
//
// Feedback codes are TT-PP-SS-GGG-QQ-AA (see docs/TEST_BANK_GUIDE.md).

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, collect } from './extract-paper1-bank.mjs';
import { collectFeedback, stripMarkup } from './extract-paper1-feedback.mjs';

const SEED_TS = 1760400000000; // 2025-10-14 00:00:00 UTC — deterministic
const OUT = join(ROOT, 'migrations', '0020_paper1_bank_and_feedback.sql');
const MARKUP_OUT = join(ROOT, 'migrations', '0021_paper1_feedback_formatting.sql');

const q = (s) => `'${String(s ?? '').replace(/'/g, "''")}'`;
const qn = (s) => (s == null || s === '' ? 'NULL' : q(s));
const pad2 = (n) => String(n).padStart(2, '0');
const pad3 = (n) => String(n).padStart(3, '0');
const FEEDBACK_CODE_RE = /^\d{2}-\d{2}-\d{2}-\d{3}-\d{2}-\d{2}$/;

const DIMENSIONS = [
  { id: 1, key: 'complexTenses', name: 'Tenses & Time Expressions', short: 'Tenses' },
  { id: 2, key: 'modalsStance', name: 'Modal Verbs: Certainty, Possibility & Advice', short: 'Modals' },
  { id: 3, key: 'adjectiveRelativeClauses', name: 'Adjective (Relative) Clauses', short: 'Relative Cl.' },
  { id: 4, key: 'nounClausesNominalisation', name: 'Noun Clauses & Formal Academic Expressions', short: 'Noun Cl.' },
  { id: 5, key: 'adverbialClausesConnectors', name: 'Linking Ideas & Sentence Relationships', short: 'Linking' },
  { id: 6, key: 'conditionalsUnrealistic', name: 'Conditionals & Unreal Situations', short: 'Conditionals' },
  { id: 7, key: 'reportedSpeech', name: 'Reported Speech', short: 'Reported' },
  { id: 8, key: 'gerundsInfinitives', name: 'Gerunds & Infinitives', short: 'Ger./Inf.' },
  { id: 9, key: 'subjunctiveFormal', name: 'Formal Grammar & Official Language', short: 'Formal' },
  { id: 10, key: 'inversionFronting', name: 'Inversion & Emphasis', short: 'Inversion' },
  { id: 11, key: 'participleReducedClauses', name: 'Participial Phrases & Reduced Clauses', short: 'Participles' },
  { id: 12, key: 'dependentPrepositions', name: 'Prepositions & Common Word Combinations', short: 'Prepositions' },
];

const PART_A_BAND_KEYS = ['a2OrBelow', 'b1', 'b1Plus', 'b2', 'b2Plus', 'c1', 'c1Plus', 'c2'];
const OVERALL_BAND_KEYS = ['a2OrBelow', 'b1', 'b1b2', 'b2', 'b2c1', 'c1', 'c1c2', 'c2'];
// Approved estimates by overall ladder step (client sign-off, Oct 2026).
const OVERALL_ESTIMATES = [
  { ielts: '≤ 3.5', toefl: '≤ 41' },
  { ielts: '4.0–5.0', toefl: '42–71' },
  { ielts: '5.0–5.5', toefl: '60–78' },
  { ielts: '5.5–6.5', toefl: '72–94' },
  { ielts: '6.5–7.0', toefl: '88–100' },
  { ielts: '7.0–8.0', toefl: '95–113' },
  { ielts: '8.0–8.5', toefl: '110–116' },
  { ielts: '8.5–9.0', toefl: '114–120' },
];
const PART_B_LEVEL_LABELS = { A2: 'Foundation', B1: 'Intermediate', B2: 'Upper Intermediate', C1: 'Advanced', C2: 'Proficient' };
const AREA_OVERVIEW_RANGES = { '01': [5, 5], '02': [4, 4], '03': [2, 3], '04': [0, 1] };
const CONCLUDING_RANGES = { '00': [0, 0], '01': [1, 2], '02': [3, 4], '03': [5, 12] };

function partBBand(canonical) {
  if (canonical >= 61 && canonical <= 66) return { ss: '01', level: 'B1' };
  if (canonical >= 67 && canonical <= 76) return { ss: '02', level: 'B2' };
  if (canonical >= 77 && canonical <= 86) return { ss: '03', level: 'C1' };
  if (canonical >= 87 && canonical <= 90) return { ss: '04', level: 'C2' };
  return null;
}

const errors = [];
const fail = (message) => errors.push(message);

// ---------------------------------------------------------------------------
// Load sources
// ---------------------------------------------------------------------------

const { results, skipped } = collect();
const bank = results.flatMap((r) => r.questions);
const bankByCode = new Map();
for (const item of bank) {
  if (!item.questionCode) fail(`Item without a question code in ${item.file}`);
  else if (bankByCode.has(item.questionCode)) fail(`Duplicate bank code ${item.questionCode}`);
  else bankByCode.set(item.questionCode, item);
}

const feedback = collectFeedback();
for (const a of feedback.anomalies) fail(`Feedback source: ${a}`);
const microByCode = new Map(feedback.variants.map((v) => [v.questionCode, v]));
const typesByArea = new Map(feedback.areas.map((a) => [a.area, a.types]));

// ---------------------------------------------------------------------------
// Merge Part A keys
// ---------------------------------------------------------------------------

const keyOverrides = [];
for (const [code, micro] of microByCode) {
  const item = bankByCode.get(code);
  if (!item) {
    fail(`MicroFeedback code ${code} has no stem in the question bank`);
    continue;
  }
  if (item.correctAnswer !== micro.key) {
    keyOverrides.push({ code, bank: item.correctAnswer ?? '(none)', micro: micro.key, target: micro.target });
  }
  if (!typesByArea.get(micro.area)?.has(micro.type)) fail(`${code}: unknown Type ${micro.type} in Area ${pad2(micro.area)}`);
}
for (const item of bank) {
  if (item.part === 'A' && !microByCode.has(item.questionCode)) fail(`${item.questionCode} has no MicroFeedback row`);
}

const finalItem = (item) => {
  if (item.part !== 'A') {
    return { ...item, key: item.correctAnswer, explanation: item.explanation || item.correctText || null };
  }
  const micro = microByCode.get(item.questionCode);
  return { ...item, key: micro?.key ?? null, explanation: micro?.target || null };
};

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const lines = [];
const out = (line = '') => lines.push(line);
const T1 = `(SELECT id FROM tests WHERE test_code = '01')`;

out('-- Paper I: question bank and report feedback library (Oct 2026 client pack).');
out('-- GENERATED by scripts/generate-paper1-seed.mjs. Do not hand-edit.');
out('--');
out('-- Hard-replaces everything Paper I owns: attempt history, reports, PDF cache rows,');
out('-- class overviews, legacy submissions, questions, groups, dimensions and conversion bands.');
out('-- Do not apply --remote without a D1 backup and an explicit go-ahead.');
out('--');
out('-- Part A keys and target structures come from the MicroFeedback files. They override the');
out('-- question-bank answer tables where the two disagree:');
for (const o of keyOverrides) out(`--   ${o.code}: bank ${o.bank} -> ${o.micro} (${o.target})`);
out('--');
out('-- feedback_items codes (TT-PP-SS-GGG-QQ-AA):');
out('--   01-01-SS-GGG-QQ-00  grammar-point feedback for one Part A variant (AA 01-04 reserved for option comments)');
out('--   01-01-SS-000-00-AA  area overview: AA 01 = 5/5, 02 = 4/5, 03 = 3-2/5, 04 = 1-0/5');
out('--   01-01-00-000-00-AA  Part A concluding comment: AA 00 = no priority areas, 01 = 1-2, 02 = 3-4, 03 = 5+');
out('--   01-01-00-000-01-AA  Part A linking sentences ({n} = area count, {areas} = area/areas)');
out('--   01-02-00-000-00-AA  Part B placement comment: AA 00 = A2 or below, 01-04 = B1-C2');
out('--   01-02-00-000-01-AA  Part B additional sentence: AA 01 uneven, 02 close, 03 weaker at top, 04 even');
out('--   01-02-00-000-02-AA  Part B roadmap bullets (newline-separated), AA as for placement');
out('');

out('-- Wipe Paper I attempt history that would FK-break or silently rebind to new items.');
out(`DELETE FROM pdf_cache_index WHERE test_attempt_id IN (SELECT id FROM test_attempts WHERE test_id = ${T1});`);
out(`DELETE FROM attempt_reports WHERE test_attempt_id IN (SELECT id FROM test_attempts WHERE test_id = ${T1});`);
out(`DELETE FROM test_attempt_answers WHERE test_attempt_id IN (SELECT id FROM test_attempts WHERE test_id = ${T1});`);
out(`DELETE FROM test_attempt_answers WHERE question_group_id IN (SELECT id FROM question_groups WHERE test_id = ${T1});`);
out(`DELETE FROM test_attempts WHERE test_id = ${T1};`);
out(`DELETE FROM class_overviews WHERE test_code = '01';`);
out('DELETE FROM submissions;');
out('');
out('-- Remove the previous Paper I bank, dimensions and conversion grids.');
out(`DELETE FROM questions WHERE question_group_id IN (SELECT id FROM question_groups WHERE test_id = ${T1});`);
out(`DELETE FROM question_groups WHERE test_id = ${T1};`);
out(`DELETE FROM dimensions WHERE test_part_id IN (SELECT id FROM test_parts WHERE test_id = ${T1});`);
out(`DELETE FROM score_conversion_bands WHERE test_id = ${T1};`);
out('');
out('-- Schema');
out('ALTER TABLE question_groups ADD COLUMN cefr_level TEXT;');
out('ALTER TABLE score_conversion_bands ADD COLUMN level_label TEXT;');
out('ALTER TABLE attempt_reports DROP COLUMN ai_feedback_zh;');
out(`CREATE TABLE feedback_items (
  feedback_code TEXT PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id),
  test_part_id INTEGER REFERENCES test_parts(id),
  question_id INTEGER REFERENCES questions(id),
  kind TEXT NOT NULL,
  type_ref TEXT,
  heading TEXT,
  body TEXT NOT NULL,
  fields_json TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);`);
out('CREATE INDEX idx_feedback_items_question ON feedback_items(question_id);');
out('CREATE INDEX idx_feedback_items_kind ON feedback_items(test_id, kind);');
out('');
out(
  `UPDATE tests SET name = 'Paper I — Grammar & Vocabulary', description = 'CEFR-aligned English Diagnostic Test, Paper I: 60 grammar MCQs across 12 areas (Part A) and 30 vocabulary MCQs from B1 to C2 (Part B).' WHERE test_code = '01';`,
);
out('');

out('-- Part A grammar areas');
for (const d of DIMENSIONS) {
  out(
    `INSERT INTO dimensions (id, test_part_id, dimension_code, key, name, short, sort_order) VALUES (${d.id}, 1, '${pad2(d.id)}', ${q(d.key)}, ${q(d.name)}, ${q(d.short)}, ${d.id});`,
  );
}
out('');

// Question groups + variants
const counts = [];
for (let canonical = 1; canonical <= 90; canonical += 1) {
  const ggg = pad3(canonical);
  const items = bank
    .filter((item) => item.ggg === ggg)
    .sort((a, b) => Number(a.qq) - Number(b.qq))
    .map(finalItem);
  if (items.length < 1) {
    fail(`Group ${ggg} has no questions`);
    continue;
  }
  const partA = canonical <= 60;
  const area = partA ? Math.ceil(canonical / 5) : null;
  const band = partA ? null : partBBand(canonical);
  for (const item of items) {
    if (!['A', 'B', 'C', 'D'].every((l) => String(item.options?.[l] ?? '').trim())) fail(`${item.questionCode} is missing an option`);
    if (!/^[A-D]$/.test(item.key ?? '')) fail(`${item.questionCode} has no A–D answer`);
    const expected = partA ? `01-01-${pad2(area)}-${ggg}-${item.qq}` : `01-02-${band.ss}-${ggg}-${item.qq}`;
    if (item.questionCode !== expected) fail(`${item.questionCode} does not match expected ${expected}`);
  }
  out(
    `INSERT INTO question_groups (id, test_id, test_part_id, dimension_id, shared_resource_id, group_code, canonical_number, legacy_qid, variant_count, sort_order, cefr_level) ` +
      `VALUES (${canonical}, 1, ${partA ? 1 : 2}, ${partA ? area : 'NULL'}, NULL, '${ggg}', ${canonical}, ${q(partA ? `A${canonical}` : `B${canonical - 60}`)}, ${items.length}, ${canonical}, ${partA ? 'NULL' : q(band.level)});`,
  );
  for (const item of items) {
    out(
      `INSERT INTO questions (question_group_id, question_code, variant_code, prompt_text, option_a, option_b, option_c, option_d, correct_answer, explanation, created_at) ` +
        `VALUES (${canonical}, '${item.questionCode}', '${item.qq}', ${q(item.stem)}, ${q(item.options.A)}, ${q(item.options.B)}, ${q(item.options.C)}, ${q(item.options.D)}, '${item.key}', ${qn(item.explanation)}, ${SEED_TS});`,
    );
  }
  counts.push({ ggg, n: items.length });
}
out('');

// Feedback library
function buildFeedbackRows(feedback) {
  const typesByArea = new Map(feedback.areas.map((a) => [a.area, a.types]));
  const feedbackRows = [];
  const addFeedback = (row) => {
    if (!FEEDBACK_CODE_RE.test(row.code)) fail(`Bad feedback code ${row.code}`);
    if (feedbackRows.some((r) => r.code === row.code)) fail(`Duplicate feedback code ${row.code}`);
    if (!String(row.body ?? '').trim()) fail(`Empty feedback body for ${row.code}`);
    feedbackRows.push(row);
  };

  for (const micro of feedback.variants) {
    const type = typesByArea.get(micro.area)?.get(micro.type);
    if (!type) continue;
    addFeedback({
      code: `${micro.questionCode}-00`,
      part: 1,
      questionCode: micro.questionCode,
      kind: 'micro_feedback',
      typeRef: micro.typeRef,
      heading: type.heading,
      body: type.fields.map((f) => `${f.label}: ${f.text}`).join('\n'),
      fields: type.fields,
      sort: micro.slot * 100 + micro.variant,
    });
  }

  for (const o of feedback.areaOverviews) {
    const [minScore, maxScore] = AREA_OVERVIEW_RANGES[o.aa];
    addFeedback({
      code: `01-01-${pad2(o.area)}-000-00-${o.aa}`,
      part: 1,
      kind: 'area_overview',
      heading: DIMENSIONS[o.area - 1].name,
      body: o.text,
      fields: { band: o.band, minScore, maxScore },
      sort: o.area * 10 + Number(o.aa),
    });
  }

  for (const c of feedback.concluding) {
    const [minPriority, maxPriority] = CONCLUDING_RANGES[c.aa];
    addFeedback({
      code: `01-01-00-000-00-${c.aa}`,
      part: 1,
      kind: 'part_a_concluding',
      heading: c.label,
      body: [c.intro, ...c.steps.map((s) => `${s.label}: ${s.text}`), c.closing].filter(Boolean).join('\n'),
      fields: { bucket: c.bucket, minPriority, maxPriority, intro: c.intro, steps: c.steps, closing: c.closing },
      sort: Number(c.aa),
    });
  }

  for (const t of feedback.templates) {
    addFeedback({
      code: `01-01-00-000-01-${t.aa}`,
      part: 1,
      kind: 'part_a_template',
      heading: t.key,
      body: t.text,
      fields: { key: t.key },
      sort: Number(t.aa),
    });
  }

  for (const p of feedback.partB.placement) {
    addFeedback({
      code: `01-02-00-000-00-${p.aa}`,
      part: 2,
      kind: 'part_b_placement',
      heading: p.label,
      body: p.text,
      fields: { level: p.level },
      sort: Number(p.aa),
    });
  }

  for (const a of feedback.partB.additional) {
    addFeedback({
      code: `01-02-00-000-01-${a.aa}`,
      part: 2,
      kind: 'part_b_additional',
      heading: a.title,
      body: a.text,
      fields: { key: a.key, condition: a.condition || null },
      sort: Number(a.aa),
    });
  }

  for (const r of feedback.partB.roadmap) {
    addFeedback({
      code: `01-02-00-000-02-${r.aa}`,
      part: 2,
      kind: 'part_b_roadmap',
      heading: r.label,
      body: r.bullets.join('\n'),
      fields: { level: r.level, bullets: r.bullets },
      sort: Number(r.aa),
    });
  }
  return feedbackRows;
}

const feedbackRows = buildFeedbackRows(feedback);

out('-- Report feedback library');
for (const row of feedbackRows) {
  const questionId = row.questionCode ? `(SELECT id FROM questions WHERE question_code = '${row.questionCode}')` : 'NULL';
  out(
    `INSERT INTO feedback_items (feedback_code, test_id, test_part_id, question_id, kind, type_ref, heading, body, fields_json, sort_order) ` +
      `VALUES ('${row.code}', 1, ${row.part}, ${questionId}, '${row.kind}', ${qn(row.typeRef)}, ${qn(row.heading)}, ${q(row.body)}, ${q(JSON.stringify(row.fields))}, ${row.sort});`,
  );
}
out('');

// Conversion grids
const bandInsert = (part, min, max, key, cefr, levelLabel, ielts, toefl, sort) =>
  out(
    `INSERT INTO score_conversion_bands (test_id, test_part_id, min_correct, max_correct, band_key, cefr_label, level_label, ielts_indicative, toefl_indicative, sort_order) ` +
      `VALUES (1, ${part}, ${min}, ${max}, ${q(key)}, ${q(cefr)}, ${q(levelLabel)}, ${qn(ielts)}, ${qn(toefl)}, ${sort});`,
  );

out('-- Part A /60 -> CEFR (min/max = raw score range)');
const scheme = feedback.scheme;
scheme.partA.forEach((b, i) => bandInsert(1, b.min, b.max, PART_A_BAND_KEYS[i], b.cefr, b.label, null, null, i));
out('-- Part B per-level thresholds (min = correct answers needed, max = questions at the level)');
bandInsert(2, 0, 0, 'a2OrBelow', 'A2 or below', PART_B_LEVEL_LABELS.A2, null, null, 0);
feedback.partB.thresholds.forEach((t, i) =>
  bandInsert(2, t.threshold, t.questions, t.level.toLowerCase(), t.level, PART_B_LEVEL_LABELS[t.level], null, null, i + 1),
);
out('-- Overall ladder: min = max = step, overall step = ceil((Part A step + Part B step) / 2)');
scheme.overall.forEach((s) =>
  bandInsert('NULL', s.step, s.step, OVERALL_BAND_KEYS[s.step], s.overall, s.label, OVERALL_ESTIMATES[s.step].ielts, OVERALL_ESTIMATES[s.step].toefl, s.step),
);
out('');

// Cross-checks against the documents
const partBQuestions = Object.fromEntries(feedback.partB.thresholds.map((t) => [t.level, t.questions]));
const partBGroups = { B1: 0, B2: 0, C1: 0, C2: 0 };
for (let c = 61; c <= 90; c += 1) partBGroups[partBBand(c).level] += 1;
for (const level of Object.keys(partBGroups)) {
  if (partBGroups[level] !== partBQuestions[level]) fail(`Part B ${level}: ${partBGroups[level]} groups but the thresholds doc says ${partBQuestions[level]}`);
}
const partAMicro = feedbackRows.filter((r) => r.kind === 'micro_feedback').length;
if (partAMicro !== 1800) fail(`Expected 1800 micro-feedback rows, got ${partAMicro}`);

// 0021: the same rows with the documents' italics (*text*) and hyperlinks ([text](url)).
// 0020 is applied, so formatting ships as UPDATEs; stripping the markup must give 0020's text.
const markupRows = buildFeedbackRows(collectFeedback({ markup: true }));
const plainByCode = new Map(feedbackRows.map((row) => [row.code, row]));
const markupUpdates = [];
const deepStrip = (value) =>
  typeof value === 'string'
    ? stripMarkup(value)
    : Array.isArray(value)
      ? value.map(deepStrip)
      : value && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepStrip(v)]))
        : value;
if (markupRows.length !== feedbackRows.length) fail(`Markup pass built ${markupRows.length} rows, plain pass ${feedbackRows.length}`);
for (const row of markupRows) {
  const plain = plainByCode.get(row.code);
  if (!plain) {
    fail(`Markup row ${row.code} has no plain counterpart`);
    continue;
  }
  const fields = JSON.stringify(row.fields);
  const plainFields = JSON.stringify(plain.fields);
  if (
    stripMarkup(row.heading) !== String(plain.heading ?? '') ||
    stripMarkup(row.body) !== plain.body ||
    JSON.stringify(deepStrip(row.fields)) !== plainFields
  ) {
    fail(`${row.code}: markup text does not reduce to the 0020 text`);
    continue;
  }
  for (const text of [row.heading, row.body, fields]) {
    const outsideLinks = String(text ?? '').replace(/\]\(https?:\/\/[^)\s]+\)/g, ']');
    if ((outsideLinks.match(/\*/g) ?? []).length % 2) fail(`${row.code}: unbalanced italic markers`);
  }
  if (row.heading !== plain.heading || row.body !== plain.body || fields !== plainFields) markupUpdates.push(row);
}
const links = [...new Set(markupRows.flatMap((row) => [...`${row.body}`.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => `${m[1]} -> ${m[2]}`)))];
if (links.length !== 3) fail(`Expected 3 distinct hyperlinks in the feedback, found ${links.length}: ${links.join('; ')}`);

if (errors.length > 0) {
  console.error(`Generation failed with ${errors.length} error(s):`);
  for (const e of errors.slice(0, 50)) console.error(`  - ${e}`);
  process.exit(1);
}

writeFileSync(OUT, `${lines.join('\n')}\n`, 'utf8');

const markupLines = [
  '-- Paper I feedback formatting: italics and hyperlinks from the Oct 2026 client documents.',
  '-- GENERATED by scripts/generate-paper1-seed.mjs. Do not hand-edit.',
  '--',
  '-- Inline markup in feedback_items.heading / body / fields_json (rendered by both report renderers):',
  '--   *text*        italic, as in the Word documents (grammar points, example words, book titles)',
  '--   [text](url)   external hyperlink (Part B roadmap word lists)',
  '-- Only text formatting changes: removing the markup gives back the 0020 wording exactly.',
  `-- Rows updated: ${markupUpdates.length} of ${markupRows.length}.`,
  ...links.map((link) => `--   link: ${link}`),
  '',
  ...markupUpdates.map(
    (row) =>
      `UPDATE feedback_items SET heading = ${qn(row.heading)}, body = ${q(row.body)}, fields_json = ${q(JSON.stringify(row.fields))} WHERE feedback_code = '${row.code}';`,
  ),
];
writeFileSync(MARKUP_OUT, `${markupLines.join('\n')}\n`, 'utf8');

const partA = counts.filter((row) => Number(row.ggg) <= 60);
const partB = counts.filter((row) => Number(row.ggg) >= 61);
const byKind = feedbackRows.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {});
console.log(`Wrote ${OUT}`);
console.log(`  Part A groups: ${partA.length}  variants: ${partA.reduce((n, row) => n + row.n, 0)}`);
console.log(`  Part B groups: ${partB.length}  variants: ${partB.reduce((n, row) => n + row.n, 0)}`);
console.log(`  Feedback rows: ${feedbackRows.length}  ${JSON.stringify(byKind)}`);
console.log(`  Key overrides (MicroFeedback wins): ${keyOverrides.length}`);
for (const o of keyOverrides) console.log(`    ${o.code}: bank ${o.bank} -> ${o.micro}  ${o.target}`);
console.log(`  Skipped bank files: ${skipped.length}`);
console.log(`Wrote ${MARKUP_OUT}`);
console.log(`  Feedback rows with italics/links: ${markupUpdates.length}`);
for (const link of links) console.log(`    ${link}`);
