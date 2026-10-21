// Paper I question-bank extractor (ANALYSIS ONLY — never writes to D1).
//
// Parses every .docx under Client_Feedback/test-question-bank/ and emits structured JSON plus an
// anomaly report. Client_Feedback/ is read-only and irreplaceable; this script only reads it.
//
//   node scripts/extract-paper1-bank.mjs                       # report to stdout
//   node scripts/extract-paper1-bank.mjs --out tmp/bank.json   # also write the JSON
//
// Source layout:
//   Paper I Part A Grammar/Paper01-Part01-AreaSS-ExamSlot(NNNtoMMM)/Paper01-Part01-AreaSS-ExamSlotGGG.docx
//   Paper I Part B Vocabulary/Paper01-Part02-AreaSS(LEVEL)-ExamSlot(NNNtoMMM).docx
//
// Each stem and each result-table Q cell is the printed code TT-PP-SS-GGG-QQ.
// Area 07 puts that code alone on its own paragraph (`01-01-07-031-01.`) and the stem after it.

import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docxParagraphs, docxTables } from './docx-text.mjs';

const ROOT = join(import.meta.dirname, '..');
const BANK = join(ROOT, 'Client_Feedback', 'test-question-bank');
const PART_A_DIR = join(BANK, 'Paper I Part A Grammar');
const PART_B_DIR = join(BANK, 'Paper I Part B Vocabulary');

const CODE_RE = /^(\d{2})-(\d{2})-(\d{2})-(\d{3})-(\d{2})$/;
const STEM_RE = /^(\d{2}-\d{2}-\d{2}-\d{3}-\d{2})\.\s+(\S[\s\S]*)$/;
// Area 07 puts the question code alone on its own paragraph, with the stem on the following lines.
const BARE_CODE_RE = /^(\d{2}-\d{2}-\d{2}-\d{3}-\d{2})\.$/;
const OPTION_RE = /^([A-D])[).]\s*(\S[\s\S]*)$/;

function parseQuestionCode(code) {
  const match = code.match(CODE_RE);
  if (!match) return null;
  return {
    questionCode: code,
    tt: match[1],
    pp: match[2],
    ss: match[3],
    ggg: match[4],
    qq: match[5],
    number: Number(match[5]),
  };
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// Word writes a 162-byte owner lock file named ~$<truncated name>.docx while a doc is open.
// It is not a document and must never be fed to the parser.
const isLockFile = (file) => basename(file).startsWith('~$');
const isDocx = (file) => file.toLowerCase().endsWith('.docx');
// Misfiled copy of Area 08 Category B sitting inside Area 07. Area 07 already has real A–E
// files; do not parse or seed this stray document (Client_Feedback/ is read-only).
function isStrayArea08InArea07(file) {
  const rel = relative(PART_A_DIR, file).replace(/\\/g, '/');
  return /Area 07_Reported Speech/i.test(rel) && /Area 08 Gerunds Infinitives/i.test(basename(file));
}

function normalise(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Dialogue stems print Speaker B on its own line (live fix: migration 0022). */
export function formatDialogueStem(text) {
  return String(text ?? '').replace(/ +(?=Speaker B\b)/g, '\n');
}

// Pulls Q -> { key, target, focus } out of every answer-key table in the document.
//
// Two layouts occur. Most files use a single 4-column block (Q | Key | target | focus). Areas
// 02-07 instead pack two blocks side by side in one table (Q | Key | target | Q | Key | target),
// so the column layout is derived from each table's header row rather than assumed.
function parseAnswerKey(file) {
  const key = new Map();
  const keyAnomalies = [];

  for (const rows of docxTables(file)) {
    const header = (rows[0] ?? []).map((c) => normalise(c));
    let starts = header.reduce((acc, cell, i) => (cell === 'Q' ? [...acc, i] : acc), []);
    if (starts.length === 0) starts = [0]; // no recognisable header; assume a single leading block

    for (const row of rows) {
      for (let b = 0; b < starts.length; b += 1) {
        const from = starts[b];
        const to = b + 1 < starts.length ? starts[b + 1] : row.length;
        const cells = row.slice(from, to);
        if (cells.length < 2) continue;
        const q = normalise(cells[0]);
        const keyId = CODE_RE.test(q) ? q : /^\d{1,3}$/.test(q) ? String(Number(q)) : null;
        if (!keyId) continue; // header row, blank filler, or a spanned cell
        const answer = normalise(cells[1]).toUpperCase();
        if (!/^[A-D]$/.test(answer)) {
          keyAnomalies.push({ kind: 'nonLetterKey', q: keyId, value: cells[1] });
          continue;
        }
        if (key.has(keyId) && key.get(keyId).answer !== answer) {
          keyAnomalies.push({ kind: 'conflictingKey', q: keyId, values: [key.get(keyId).answer, answer] });
        }
        key.set(keyId, {
          answer,
          target: normalise(cells[2] ?? ''),
          focus: normalise(cells[3] ?? ''),
        });
      }
    }
  }
  return { key, keyAnomalies };
}

// Walks the paragraph stream collecting "N. stem" followed by up to four "A) option" lines.
function parseItems(paragraphs) {
  const items = [];
  const anomalies = [];
  let current = null;

  const flush = () => {
    if (current) items.push(current);
    current = null;
  };

  for (const raw of paragraphs) {
    const text = normalise(raw);
    if (!text) continue;

    const optionMatch = text.match(OPTION_RE);
    if (optionMatch && current) {
      const letter = optionMatch[1];
      if (current.options[letter] !== undefined) {
        anomalies.push({ kind: 'duplicateOptionLetter', number: current.number, letter });
      }
      current.options[letter] = optionMatch[2].trim();
      continue;
    }

    const bareCode = text.match(BARE_CODE_RE);
    const stemMatch = bareCode ? null : text.match(STEM_RE);
    // A coded line only starts a new item if we are not mid-way through one; a coded line
    // while options are incomplete is far more likely to be wrapped stem text.
    const canOpen = !current || Object.keys(current.options).length >= 4;
    if (bareCode && canOpen) {
      flush();
      current = { ...parseQuestionCode(bareCode[1]), stem: '', options: {} };
      continue;
    }
    if (stemMatch && canOpen) {
      flush();
      current = { ...parseQuestionCode(stemMatch[1]), stem: stemMatch[2].trim(), options: {} };
      continue;
    }

    if (current && Object.keys(current.options).length === 0) {
      // Continuation of a wrapped stem.
      current.stem = `${current.stem} ${text}`.trim();
    }
  }
  flush();
  return { items, itemAnomalies: anomalies };
}

const CATEGORY_LETTERS = ['A', 'B', 'C', 'D', 'E'];

function partAMeta(file) {
  const rel = relative(PART_A_DIR, file).replace(/\\/g, '/');
  const folder = dirname(rel);
  const areaFromFolder = folder.match(/Area(\d{2})/);
  const name = basename(file, '.docx');
  const fromName = name.match(/^Paper(\d{2})-Part(\d{2})-Area(\d{2})-ExamSlot(\d{3})$/);
  const slot = fromName ? Number(fromName[4]) : null;
  return {
    part: 'A',
    folder,
    folderAreaNumber: areaFromFolder ? Number(areaFromFolder[1]) : null,
    folderAreaName: folder,
    fileAreaNumber: fromName ? Number(fromName[3]) : null,
    fileAreaName: fromName ? `Area ${fromName[3]}` : null,
    categoryLetter: slot ? CATEGORY_LETTERS[(slot - 1) % 5] : null,
    subTopic: fromName ? `ExamSlot${fromName[4]}` : null,
    slot,
    misfiled: Boolean(areaFromFolder && fromName && Number(areaFromFolder[1]) !== Number(fromName[3])),
  };
}

function partBMeta(file) {
  const name = basename(file, '.docx');
  const m = name.match(/^Paper(\d{2})-Part(\d{2})-Area(\d{2})\((B1|B2|C1|C2)\)-ExamSlot\((\d{3})to(\d{3})\)$/);
  return {
    part: 'B',
    level: m ? m[4] : null,
    ss: m ? m[3] : null,
    slotStart: m ? Number(m[5]) : null,
    slotEnd: m ? Number(m[6]) : null,
    filenameCount: null,
    set: m ? Number(m[5]) : 1,
  };
}

function parseFile(file, meta) {
  const paragraphs = docxParagraphs(file);
  const headerId = normalise(paragraphs.find((p) => normalise(p)) ?? '');
  const { items, itemAnomalies } = parseItems(paragraphs);
  const { key, keyAnomalies } = parseAnswerKey(file);

  const anomalies = [
    ...itemAnomalies.map((a) => ({ ...a, file })),
    ...keyAnomalies.map((a) => ({ ...a, file })),
  ];

  const questions = items.map((item) => {
    const letters = Object.keys(item.options).sort();
    const entry = key.get(item.questionCode) ?? key.get(String(item.number));
    const q = {
      file,
      ...meta,
      questionCode: item.questionCode,
      tt: item.tt,
      pp: item.pp,
      ss: item.ss,
      ggg: item.ggg,
      qq: item.qq,
      number: item.number,
      stem: formatDialogueStem(item.stem),
      options: item.options,
      optionCount: letters.length,
      correctAnswer: entry ? entry.answer : null,
      correctText: entry ? entry.target : null,
      explanation: entry ? entry.focus : null,
    };
    if (letters.join('') !== 'ABCD') {
      anomalies.push({ kind: 'optionSetNotABCD', file, number: item.number, letters });
    }
    if (!entry) anomalies.push({ kind: 'missingAnswerKey', file, number: item.number });
    else if (item.options[entry.answer] === undefined) {
      anomalies.push({
        kind: 'keyLetterNotAmongOptions',
        file,
        number: item.number,
        answer: entry.answer,
        letters,
      });
    } else if (entry.target && meta.part === 'B') {
      // Part B answer tables restate the correct choice text, so it can be cross-checked.
      const chosen = normalise(item.options[entry.answer]).toLowerCase();
      const expected = normalise(entry.target).toLowerCase();
      if (expected && chosen !== expected) {
        anomalies.push({
          kind: 'keyTextMismatch',
          file,
          number: item.number,
          answer: entry.answer,
          optionText: item.options[entry.answer],
          keyText: entry.target,
        });
      }
    }
    return q;
  });

  const codes = questions.map((q) => q.questionCode);
  const seenCodes = new Set();
  for (const code of codes) {
    if (seenCodes.has(code)) anomalies.push({ kind: 'duplicateQuestionCode', file, questionCode: code });
    seenCodes.add(code);
  }
  const consumedNumbers = new Set(
    questions.filter((q) => !seenCodes.has(String(q.number)) && key.has(String(q.number))).map((q) => String(q.number)),
  );
  const keyedButNoStem = [...key.keys()].filter((code) => !seenCodes.has(code) && !consumedNumbers.has(code));
  if (keyedButNoStem.length > 0) {
    anomalies.push({ kind: 'answerKeyWithoutStem', file, numbers: keyedButNoStem });
  }

  return { file, meta, headerId, questions, keyCount: key.size, anomalies };
}

function collect() {
  const results = [];
  const skipped = [];

  for (const file of walk(PART_A_DIR)) {
    if (isLockFile(file)) {
      skipped.push({ file, reason: 'Word owner lock file (~$ prefix)', bytes: statSync(file).size });
      continue;
    }
    if (isStrayArea08InArea07(file)) {
      skipped.push({
        file,
        reason: 'stray Area 08-named file inside Area 07 (skip; Area 07 already has A–E)',
      });
      continue;
    }
    if (!isDocx(file)) {
      skipped.push({ file, reason: 'not a .docx' });
      continue;
    }
    results.push(parseFile(file, partAMeta(file)));
  }

  for (const file of walk(PART_B_DIR)) {
    if (isLockFile(file)) {
      skipped.push({ file, reason: 'Word owner lock file (~$ prefix)', bytes: statSync(file).size });
      continue;
    }
    if (!isDocx(file)) {
      skipped.push({ file, reason: 'not a .docx' });
      continue;
    }
    results.push(parseFile(file, partBMeta(file)));
  }

  return { results, skipped };
}

function hash(text) {
  // Cheap stable fingerprint for duplicate detection; collisions are not security-relevant here.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + text.charCodeAt(i) + 1, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16)}${h2.toString(16)}`;
}

const stemKey = (q) => hash(normalise(q.stem).toLowerCase());
const fullKey = (q) =>
  hash(
    [normalise(q.stem).toLowerCase(), 'A', 'B', 'C', 'D']
      .map((k) => (q.options[k] !== undefined ? normalise(q.options[k]).toLowerCase() : k))
      .join('|') + `|${q.correctAnswer}`,
  );

function report() {
  const { results, skipped } = collect();
  const all = results.flatMap((r) => r.questions);
  const anomalies = results.flatMap((r) => r.anomalies);
  const label = (r) =>
    r.meta.part === 'A'
      ? `A${String(r.meta.folderAreaNumber).padStart(2, '0')}/${r.meta.categoryLetter} ${r.meta.subTopic}`
      : `B ${r.meta.level} set ${r.meta.set}`;

  console.log('='.repeat(100));
  console.log('SKIPPED FILES');
  console.log('='.repeat(100));
  for (const s of skipped) {
    console.log(`  ${relative(ROOT, s.file)}\n      -> ${s.reason}${s.bytes ? ` (${s.bytes} bytes)` : ''}`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('PER-FILE COUNTS');
  console.log('='.repeat(100));
  console.log(
    ['items', 'keys', 'clientIdHeader', 'folder / file'].map((h, i) => (i < 2 ? h.padStart(6) : h)).join('  '),
  );
  for (const r of results.sort((a, b) => a.file.localeCompare(b.file))) {
    const flag = r.meta.part === 'A' && r.questions.length !== 30 ? '  <== NOT 30' : '';
    const mis = r.meta.misfiled ? '  <== MISFILED (folder area != filename area)' : '';
    console.log(
      `${String(r.questions.length).padStart(6)}  ${String(r.keyCount).padStart(6)}  ${r.headerId.padEnd(24)}  ${relative(BANK, r.file)}${flag}${mis}  [${label(r)}]`,
    );
  }

  console.log('\n' + '='.repeat(100));
  console.log('PART A — PER-AREA TOTALS');
  console.log('='.repeat(100));
  const areas = new Map();
  for (const r of results.filter((x) => x.meta.part === 'A')) {
    const k = r.meta.folder;
    if (!areas.has(k)) areas.set(k, { files: 0, items: 0, categories: [], misfiled: 0 });
    const a = areas.get(k);
    a.files += 1;
    a.items += r.questions.length;
    a.categories.push(r.meta.misfiled ? `${r.meta.categoryLetter}!` : r.meta.categoryLetter);
    if (r.meta.misfiled) a.misfiled += 1;
  }
  for (const [folder, a] of [...areas].sort()) {
    console.log(
      `  ${folder.padEnd(58)} files=${a.files}  items=${String(a.items).padStart(4)}  cats=${a.categories.sort().join('')}${a.misfiled ? '  (! = misfiled)' : ''}`,
    );
  }

  console.log('\n' + '='.repeat(100));
  console.log('PART B — POOL SIZES BY CEFR LEVEL');
  console.log('='.repeat(100));
  const levels = new Map();
  for (const r of results.filter((x) => x.meta.part === 'B')) {
    const k = r.meta.level;
    if (!levels.has(k)) levels.set(k, { files: 0, items: 0, filenameClaim: 0 });
    const l = levels.get(k);
    l.files += 1;
    l.items += r.questions.length;
    l.filenameClaim += r.meta.filenameCount ?? 0;
  }
  let bTotal = 0;
  let bClaim = 0;
  for (const [level, l] of [...levels].sort()) {
    bTotal += l.items;
    bClaim += l.filenameClaim;
    console.log(
      `  ${level}  files=${l.files}  actual=${String(l.items).padStart(4)}  filenameClaim=${String(l.filenameClaim).padStart(4)}  delta=${l.items - l.filenameClaim}`,
    );
  }
  console.log(`  TOTAL   actual=${bTotal}  filenameClaim=${bClaim}  delta=${bTotal - bClaim}`);
  console.log(`  Needed for 30 groups x 30 variants = 900  =>  surplus/deficit = ${bTotal - 900}`);

  console.log('\n' + '='.repeat(100));
  console.log('DUPLICATE DETECTION (whole bank)');
  console.log('='.repeat(100));
  for (const [name, keyFn] of [
    ['identical stem', stemKey],
    ['identical stem + all options + answer', fullKey],
  ]) {
    const buckets = new Map();
    for (const q of all) {
      const k = keyFn(q);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(q);
    }
    const dupes = [...buckets.values()].filter((v) => v.length > 1);
    const affected = dupes.reduce((n, v) => n + v.length, 0);
    console.log(`\n  ${name}: ${dupes.length} duplicate cluster(s) covering ${affected} item(s)`);
    for (const cluster of dupes.slice(0, 40)) {
      console.log(`    "${cluster[0].stem.slice(0, 95)}"`);
      for (const q of cluster) console.log(`        #${q.number} ${relative(BANK, q.file)}`);
    }
    if (dupes.length > 40) console.log(`    ... ${dupes.length - 40} more cluster(s)`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('ANOMALIES');
  console.log('='.repeat(100));
  if (anomalies.length === 0) console.log('  none');
  const byKind = new Map();
  for (const a of anomalies) {
    if (!byKind.has(a.kind)) byKind.set(a.kind, []);
    byKind.get(a.kind).push(a);
  }
  for (const [kind, list] of byKind) {
    console.log(`\n  ${kind}: ${list.length}`);
    for (const a of list.slice(0, 25)) {
      const { kind: _k, file, ...rest } = a;
      console.log(`    ${relative(BANK, file)}  ${JSON.stringify(rest)}`);
    }
    if (list.length > 25) console.log(`    ... ${list.length - 25} more`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('TOTALS');
  console.log('='.repeat(100));
  const partA = all.filter((q) => q.part === 'A');
  const partB = all.filter((q) => q.part === 'B');
  console.log(`  files parsed:   ${results.length} (Part A ${results.filter((r) => r.meta.part === 'A').length}, Part B ${results.filter((r) => r.meta.part === 'B').length})`);
  console.log(`  Part A items:   ${partA.length}`);
  console.log(`  Part B items:   ${partB.length}`);
  console.log(`  total items:    ${all.length}`);
  console.log(`  anomalies:      ${anomalies.length}`);

  const outIdx = process.argv.indexOf('--out');
  if (outIdx !== -1 && process.argv[outIdx + 1]) {
    const target = join(ROOT, process.argv[outIdx + 1]);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          skipped: skipped.map((s) => ({ ...s, file: relative(ROOT, s.file) })),
          files: results.map((r) => ({
            file: relative(ROOT, r.file),
            meta: r.meta,
            headerId: r.headerId,
            itemCount: r.questions.length,
            keyCount: r.keyCount,
          })),
          questions: all.map((q) => ({ ...q, file: relative(ROOT, q.file) })),
          anomalies: anomalies.map((a) => ({ ...a, file: relative(ROOT, a.file) })),
        },
        null,
        2,
      ),
    );
    console.log(`\n  JSON written to ${relative(ROOT, target)}`);
  }
}

export {
  BANK,
  PART_A_DIR,
  PART_B_DIR,
  ROOT,
  collect,
  fullKey,
  hash,
  isLockFile,
  isStrayArea08InArea07,
  normalise,
  parseFile,
  partAMeta,
  partBMeta,
  stemKey,
};

function isDirectRun() {
  const self = fileURLToPath(import.meta.url);
  const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
  return Boolean(invoked) && self.toLowerCase() === invoked.toLowerCase();
}

if (isDirectRun()) report();
