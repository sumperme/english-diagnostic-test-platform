// Paper I report-feedback extractor (Oct 2026 client pack). Read-only over Client_Feedback/.
//
//   node scripts/extract-paper1-feedback.mjs            # summary + anomalies to stdout
//   node scripts/extract-paper1-feedback.mjs --json     # full structure as JSON
//
// Source: Client_Feedback/Updated Paper 1 information-Oct2026/
//   Paper01-Part01-MicroFeedback-AreaNN.docx            per-variant key / target / type + type library
//   Paper01 Comments in report for PartA(01).docx        area overview by score band
//   Paper01 Concluding Comments in report for PartA(01).docx
//   Paper01 Comments in report for PartB(02).docx        placement comments, extra sentences, roadmap
//   Paper01 Overall Score Scheme in report.docx          Part A grid, area labels, Part B thresholds, overall ladder
//   Paper01 Sample Diagnostic Report.docx                linking sentences used around the strengths / roadmap

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docxParagraphs as readParagraphs, docxTables as readTables } from './docx-text.mjs';

// collectFeedback({ markup: true }) keeps italics (*text*) and hyperlinks ([text](url)).
let readOptions = {};
const docxParagraphs = (file) => readParagraphs(file, readOptions);
const docxTables = (file) => readTables(file, readOptions);

/** Inline markup removed: the text exactly as the plain extraction sees it. */
export const stripMarkup = (text) =>
  String(text ?? '')
    .replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '$1')
    .replace(/\*/g, '');

const ROOT = join(import.meta.dirname, '..');
const PACK = join(ROOT, 'Client_Feedback', 'Updated Paper 1 information-Oct2026');

const pad2 = (n) => String(n).padStart(2, '0');
const pad3 = (n) => String(n).padStart(3, '0');
const CATEGORY_LETTERS = ['A', 'B', 'C', 'D', 'E'];

// Keeps client typography (curly quotes, dashes, arrows) but collapses whitespace.
function clean(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}
const oneLine = (text) => clean(text).replace(/\s*\n\s*/g, ' ');

function tableCellSet(tables) {
  return new Set(tables.flat(2).flatMap((cell) => cell.split('\n').map((s) => s.trim())));
}

// ---------------------------------------------------------------------------
// MicroFeedback (Part A, one file per area)
// ---------------------------------------------------------------------------

const FIELD_LABELS = ['When to use', 'Key difference', 'Look for', 'Examples', 'Example', 'Watch out'];

function parseTypeLibrary(area, paragraphs, anomalies) {
  const types = new Map();
  let current = null;
  const flush = () => {
    if (!current) return;
    if (!current.heading) anomalies.push(`Area ${pad2(area)} Type ${current.number}: no Grammar Point line`);
    types.set(current.number, current);
    current = null;
  };
  for (const raw of paragraphs) {
    const line = oneLine(raw);
    if (!line) continue;
    const typeHead = line.match(/^Type\s*(\d+)$/);
    if (typeHead) {
      flush();
      current = { number: Number(typeHead[1]), heading: '', fields: [] };
      continue;
    }
    if (/^Area \d+ Category [A-E]$/.test(line)) {
      flush();
      continue;
    }
    if (!current) continue;
    // "Note: Items using Types 9 and 10 share…" is an author note about the library, not student copy.
    if (/^Note:\s*Items using Types/i.test(line)) continue;
    const gp = line.match(/^Grammar Point:\s*(.+)$/);
    if (gp) {
      current.heading = gp[1].trim();
      continue;
    }
    const label = FIELD_LABELS.find((l) => line.startsWith(`${l}:`));
    if (label) {
      current.fields.push({ label, text: line.slice(label.length + 1).trim() });
      continue;
    }
    if (current.fields.length > 0) {
      const last = current.fields[current.fields.length - 1];
      last.text = `${last.text} ${line}`.trim();
    } else {
      anomalies.push(`Area ${pad2(area)} Type ${current.number}: unlabelled line "${line.slice(0, 60)}"`);
    }
  }
  flush();
  return types;
}

// Category tables are either one 4-column block (Q | Key | Target | Type) or two such blocks side by side.
function parseCategoryTable(rows) {
  const header = rows[0] ?? [];
  const starts = header.reduce((acc, cell, i) => (oneLine(cell) === 'Q' ? [...acc, i] : acc), []);
  const out = [];
  for (const row of rows.slice(1)) {
    for (const from of starts) {
      const q = oneLine(row[from]);
      if (!/^\d{1,2}$/.test(q)) continue;
      out.push({
        variant: Number(q),
        key: oneLine(row[from + 1]).toUpperCase(),
        target: oneLine(row[from + 2]).replace(/\s{2,}/g, ' '),
        type: Number(oneLine(row[from + 3])),
      });
    }
  }
  return out.sort((a, b) => a.variant - b.variant);
}

function parseMicroFeedback(area, anomalies) {
  const file = join(PACK, `Paper01-Part01-MicroFeedback-Area${pad2(area)}.docx`);
  const tables = docxTables(file);
  const cells = tableCellSet(tables);
  const paragraphs = docxParagraphs(file).filter((p) => !cells.has(p.trim()));
  const types = parseTypeLibrary(area, paragraphs, anomalies);
  if (tables.length !== 5) anomalies.push(`Area ${pad2(area)}: expected 5 category tables, found ${tables.length}`);

  const variants = [];
  tables.forEach((rows, categoryIndex) => {
    const slot = (area - 1) * 5 + categoryIndex + 1;
    const entries = parseCategoryTable(rows);
    if (entries.length !== 30) anomalies.push(`Slot ${pad3(slot)}: expected 30 variants, found ${entries.length}`);
    for (const entry of entries) {
      if (!/^[A-D]$/.test(entry.key)) anomalies.push(`Slot ${pad3(slot)} Q${entry.variant}: key "${entry.key}"`);
      if (!types.has(entry.type)) anomalies.push(`Slot ${pad3(slot)} Q${entry.variant}: unknown Type ${entry.type}`);
      variants.push({
        questionCode: `01-01-${pad2(area)}-${pad3(slot)}-${pad2(entry.variant)}`,
        area,
        slot,
        category: CATEGORY_LETTERS[categoryIndex],
        variant: entry.variant,
        key: entry.key,
        target: entry.target,
        type: entry.type,
        typeRef: `A${pad2(area)}-T${pad2(entry.type)}`,
      });
    }
  });
  return { area, types, variants };
}

// ---------------------------------------------------------------------------
// Part A area overviews + concluding comments
// ---------------------------------------------------------------------------

function areaNumberOf(cell) {
  const m = oneLine(cell).match(/^(\d{2})\b/);
  return m ? Number(m[1]) : null;
}

// AA: 01 = 5/5, 02 = 4/5, 03 = 3–2/5, 04 = 1–0/5.
function parseAreaOverviews(anomalies) {
  const tables = docxTables(join(PACK, 'Paper01 Comments in report for PartA(01).docx'));
  const out = [];
  const pairs = [
    [0, 1, '01', 'excellent'],
    [0, 2, '02', 'strong'],
    [1, 1, '03', 'approaching'],
    [1, 2, '04', 'beginning'],
  ];
  for (const [t, col, aa, band] of pairs) {
    for (const row of tables[t].slice(1)) {
      const area = areaNumberOf(row[0]);
      if (!area) continue;
      out.push({ area, aa, band, text: oneLine(row[col]) });
    }
  }
  for (let area = 1; area <= 12; area += 1) {
    const n = out.filter((o) => o.area === area).length;
    if (n !== 4) anomalies.push(`Area ${pad2(area)}: ${n} overview bands (expected 4)`);
  }
  return out.sort((a, b) => a.area - b.area || a.aa.localeCompare(b.aa));
}

const STEP_RE = /^(Review|Notice|Practise|Practice|Use|Check):\s*(.+)$/;

// AA: 00 = no priority areas, 01 = 1–2, 02 = 3–4, 03 = 5 or more.
function parseConcluding(anomalies) {
  const [table] = docxTables(join(PACK, 'Paper01 Concluding Comments in report for PartA(01).docx'));
  const buckets = [
    [/^No priority/i, '00', 'none'],
    [/^1.2 priority/i, '01', 'oneToTwo'],
    [/^3.4 priority/i, '02', 'threeToFour'],
    [/^5 or more/i, '03', 'fiveOrMore'],
  ];
  const out = [];
  for (const row of table.slice(1)) {
    const label = oneLine(row[0]);
    const bucket = buckets.find(([re]) => re.test(label));
    if (!bucket) continue;
    const lines = clean(row[1]).split('\n').map((l) => l.trim()).filter(Boolean);
    const steps = [];
    const before = [];
    const after = [];
    for (const line of lines) {
      const m = line.match(STEP_RE);
      if (m) steps.push({ label: m[1], text: m[2].trim() });
      else (steps.length === 0 ? before : after).push(line);
    }
    out.push({ aa: bucket[1], bucket: bucket[2], label, intro: before.join(' '), steps, closing: after.join(' ') });
  }
  if (out.length !== 4) anomalies.push(`Concluding comments: ${out.length} buckets (expected 4)`);
  return out;
}

// Linking sentences that appear only in the sample report, around the strengths and the roadmap.
function parseTemplates(anomalies) {
  const lines = docxParagraphs(join(PACK, 'Paper01 Sample Diagnostic Report.docx')).map(oneLine);
  const find = (re) => lines.find((l) => re.test(l));
  const strengthsIntro = find(/^You showed excellent or strong control/);
  const strengthsClosing = find(/^These results show that you can recognise/);
  const roadmapIntro = find(/^Your results show that you could improve/);
  const out = [];
  const push = (aa, key, text, transform) => {
    if (!text) anomalies.push(`Sample report: template "${key}" not found`);
    else out.push({ aa, key, text: transform(text) });
  };
  const counted = (t) => t.replace(/\[\s*\d+\s*\]\s*grammar areas/, '{n} grammar {areas}');
  push('01', 'strengthsIntro', strengthsIntro, counted);
  push('02', 'strengthsClosing', strengthsClosing, (t) => t);
  push('03', 'roadmapIntro', roadmapIntro, counted);
  return out;
}

// ---------------------------------------------------------------------------
// Part B comments
// ---------------------------------------------------------------------------

const PART_B_LEVELS = [
  { aa: '00', level: 'A2', match: /^Below B1/i },
  { aa: '01', level: 'B1', match: /^B1\b/ },
  { aa: '02', level: 'B2', match: /^B2\b/ },
  { aa: '03', level: 'C1', match: /^C1\b/ },
  { aa: '04', level: 'C2', match: /^C2\b/ },
];

function levelRows(table) {
  const out = [];
  for (const row of table.slice(1)) {
    const head = clean(row[0]);
    const spec = PART_B_LEVELS.find((l) => l.match.test(head));
    if (!spec) continue;
    const [, label = ''] = head.split('\n');
    out.push({ ...spec, label: label.trim(), cell: clean(row[1]) });
  }
  return out;
}

// Additional sentence AA: 01 = uneven, 02 = close to next band, 03 = weaker at top, 04 = even.
const ADDITIONAL = [
  { aa: '01', key: 'uneven', match: /^UNEVEN RESULTS/i },
  { aa: '02', key: 'closeToNext', match: /^CLOSE TO THE NEXT BAND/i },
  { aa: '03', key: 'weakerAtTop', match: /^STRONG ACROSS LEVELS/i },
  { aa: '04', key: 'even', match: /^EVEN RESULTS/i },
];

function parsePartB(anomalies) {
  const tables = docxTables(join(PACK, 'Paper01 Comments in report for PartB(02).docx'));
  const thresholds = tables[0]
    .slice(1)
    .map((row) => {
      const m = oneLine(row[2]).match(/^(\d+)\s+correct/);
      return { level: oneLine(row[0]), questions: Number(oneLine(row[1])), threshold: m ? Number(m[1]) : NaN };
    })
    .filter((r) => /^(B1|B2|C1|C2)$/.test(r.level));
  const placement = levelRows(tables[1]).map(({ cell, match: _m, ...rest }) => ({ ...rest, text: oneLine(cell) }));
  const roadmap = levelRows(tables[3]).map(({ cell, match: _m, ...rest }) => ({
    ...rest,
    bullets: cell.split('\n').map((l) => l.trim()).filter(Boolean),
  }));
  const additional = [];
  for (const row of tables[2]) {
    const head = clean(row[0]);
    const spec = ADDITIONAL.find((a) => a.match.test(head));
    if (!spec) continue;
    const [title, ...condition] = head.split('\n');
    additional.push({ aa: spec.aa, key: spec.key, title: title.trim(), condition: oneLine(condition.join(' ')), text: oneLine(row[1]) });
  }
  if (thresholds.length !== 4) anomalies.push(`Part B thresholds: ${thresholds.length} levels`);
  if (placement.length !== 5) anomalies.push(`Part B placement comments: ${placement.length} (expected 5)`);
  if (roadmap.length !== 5) anomalies.push(`Part B roadmaps: ${roadmap.length} (expected 5)`);
  if (additional.length !== 4) anomalies.push(`Part B additional sentences: ${additional.length} (expected 4)`);
  for (const r of roadmap) if (r.bullets.length !== 5) anomalies.push(`Part B roadmap ${r.level}: ${r.bullets.length} bullets`);
  return { thresholds, placement, additional, roadmap };
}

// ---------------------------------------------------------------------------
// Overall score scheme
// ---------------------------------------------------------------------------

function parseScheme(anomalies) {
  const tables = docxTables(join(PACK, 'Paper01 Overall Score Scheme in report.docx'));
  const overall = tables[0].slice(1).map((row, step) => ({
    step,
    partA: oneLine(row[0]),
    partB: oneLine(row[1]) || null,
    overall: oneLine(row[2]),
    label: oneLine(row[3]).replace(/\s*\/\s*/g, ' / '),
  }));
  const partA = tables[1].slice(1).map((row) => {
    const [min, max] = oneLine(row[2]).split('-').map(Number);
    return { cefr: oneLine(row[0]), label: oneLine(row[1]), min, max };
  });
  const areaLabels = tables[2].slice(1).map((row) => {
    const [min, max = min] = oneLine(row[0]).split('-').map(Number);
    return { min, max, label: oneLine(row[1]) };
  });
  if (overall.length !== 8) anomalies.push(`Scheme: overall ladder has ${overall.length} steps`);
  if (partA.length !== 8) anomalies.push(`Scheme: Part A grid has ${partA.length} bands`);
  if (areaLabels.length !== 5) anomalies.push(`Scheme: area labels ${areaLabels.length}`);
  let expectMin = 0;
  for (const band of partA) {
    if (band.min !== expectMin) anomalies.push(`Scheme: Part A band ${band.cefr} starts at ${band.min}, expected ${expectMin}`);
    expectMin = band.max + 1;
  }
  if (expectMin !== 61) anomalies.push('Scheme: Part A grid does not end at 60');
  return { overall, partA, areaLabels };
}

// ---------------------------------------------------------------------------

export function collectFeedback({ markup = false } = {}) {
  readOptions = { markup };
  const anomalies = [];
  const areas = [];
  for (let area = 1; area <= 12; area += 1) areas.push(parseMicroFeedback(area, anomalies));
  return {
    areas,
    variants: areas.flatMap((a) => a.variants),
    areaOverviews: parseAreaOverviews(anomalies),
    concluding: parseConcluding(anomalies),
    templates: parseTemplates(anomalies),
    partB: parsePartB(anomalies),
    scheme: parseScheme(anomalies),
    anomalies,
  };
}

function isDirectRun() {
  const self = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
  return Boolean(invoked) && self.toLowerCase() === invoked.toLowerCase();
}

if (isDirectRun()) {
  const data = collectFeedback();
  if (process.argv.includes('--json')) {
    const serialisable = {
      ...data,
      areas: data.areas.map((a) => ({ area: a.area, types: [...a.types.values()] })),
    };
    console.log(JSON.stringify(serialisable, null, 2));
  } else {
    const typeCount = data.areas.reduce((n, a) => n + a.types.size, 0);
    console.log(`Part A variants:      ${data.variants.length}`);
    console.log(`Grammar-point types:  ${typeCount}`);
    console.log(`Area overviews:       ${data.areaOverviews.length}`);
    console.log(`Concluding buckets:   ${data.concluding.length}`);
    console.log(`Templates:            ${data.templates.length}`);
    console.log(`Part B thresholds:    ${data.partB.thresholds.map((t) => `${t.level} ${t.threshold}/${t.questions}`).join(', ')}`);
    console.log(`Part B placement:     ${data.partB.placement.length}`);
    console.log(`Part B additional:    ${data.partB.additional.length}`);
    console.log(`Part B roadmaps:      ${data.partB.roadmap.length}`);
    console.log(`Scheme ladder steps:  ${data.scheme.overall.length}; Part A bands ${data.scheme.partA.length}`);
    console.log(`Anomalies:            ${data.anomalies.length}`);
    for (const a of data.anomalies) console.log(`  - ${a}`);
  }
}
