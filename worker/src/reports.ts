// Server-side PDF report service with FIFO cache.
//
//   GET /api/reports/:attemptId/pdf?lang=en|zh-HK[&voucher=CODE]
//
// Auth (any one):
//   1. Student retrieval pair: ?voucher=CODE matching users.external_ref of the attempt's user.
//   2. Active session Bearer token equal to test_attempts.session_token.
//   3. Teacher key (X-Teacher-Key) whose user_group matches the attempt user's user_group.
//
// Rendering: pdf-lib from attempt_reports.variables (layout-free, see reportVariables.ts)
// + test_attempt_answers + reportI18n.ts strings. Fonts load from R2 fonts/ at render
// time (Montserrat for Latin, Noto Serif TC for zh-HK / CJK names).
//
// Cache: latest 20 PDFs kept in R2 under pdf-cache/, indexed in D1 pdf_cache_index,
// evicted first-come-first-leave by created_at (insertion order, not last access).

import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { REPORT_STRINGS, type ReportLang } from './reportI18n';
import type { AttemptAnswerRow, ReportVariablesV1 } from './reportVariables';
import { stripSpeakingUiBoilerplate } from './paper3Prompt';

type ReportsEnv = {
  DB: D1Database;
  R2_ASSETS: R2Bucket;
};

type AuthEnv = { DB: D1Database };

type JsonResponder = (body: unknown, init?: ResponseInit, origin?: string) => Response;

const PDF_CACHE_MAX = 20;

// EDT palette (AGENTS.md design tokens)
const FOREST = rgb(27 / 255, 45 / 255, 42 / 255);
const NEON = rgb(206 / 255, 255 / 255, 26 / 255);
const GOLD = rgb(170 / 255, 169 / 255, 90 / 255);
const OLIVE = rgb(130 / 255, 129 / 255, 109 / 255);
const SOFT = rgb(244 / 255, 244 / 255, 244 / 255);
const INK = rgb(0.13, 0.16, 0.15);
// Feedback marks + radar, matching the web report (emerald / rose / sky / slate grid)
const GREEN = rgb(4 / 255, 120 / 255, 87 / 255);
const RED = rgb(190 / 255, 18 / 255, 60 / 255);
const SKY = rgb(14 / 255, 165 / 255, 233 / 255);
const GRID = rgb(203 / 255, 213 / 255, 225 / 255);

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MARGIN = 48;

export type AttemptRow = {
  id: string;
  user_id: number | null;
  test_id: number;
  session_token: string | null;
  status: string;
  external_ref: string | null;
  user_group: string | null;
};

/** Load an attempt and check report-access credentials (voucher pair / owning session / teacher key). */
export async function authorizeAttemptAccess(
  request: Request,
  env: { DB: D1Database },
  attemptId: string,
  url: URL,
): Promise<{ attempt: AttemptRow | null; authorized: boolean }> {
  const attempt = await env.DB.prepare(
    `SELECT a.id, a.user_id, a.test_id, a.session_token, a.status, u.external_ref, u.user_group
     FROM test_attempts a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?`,
  )
    .bind(attemptId)
    .first<AttemptRow>();
  if (!attempt) return { attempt: null, authorized: false };
  return { attempt, authorized: await isAuthorized(request, env, attempt, url) };
}

const REPORTS_RE = /^\/api\/reports\/([0-9a-fA-F-]{8,64})\/pdf$/;

export async function handleReportRequest(
  request: Request,
  env: ReportsEnv,
  origin: string | undefined,
  json: JsonResponder,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = url.pathname.match(REPORTS_RE);
  if (!match) return null;
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, { status: 405 }, origin);

  const attemptId = match[1];
  const lang: ReportLang = url.searchParams.get('lang') === 'zh-HK' ? 'zh-HK' : 'en';

  const attempt = await env.DB.prepare(
    `SELECT a.id, a.user_id, a.test_id, a.session_token, a.status, u.external_ref, u.user_group
     FROM test_attempts a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = ?`,
  )
    .bind(attemptId)
    .first<AttemptRow>();
  if (!attempt) return json({ error: 'Not found' }, { status: 404 }, origin);

  if (!(await isAuthorized(request, env, attempt, url))) {
    return json({ error: 'Unauthorized' }, { status: 401 }, origin);
  }

  const report = await env.DB.prepare(
    `SELECT report_version, variables, ai_status, ai_feedback_en, ai_feedback_zh, ai_generated_at
     FROM attempt_reports WHERE test_attempt_id = ?`,
  )
    .bind(attemptId)
    .first<{
      report_version: string;
      variables: string;
      ai_status: string | null;
      ai_feedback_en: string | null;
      ai_feedback_zh: string | null;
      ai_generated_at: number | null;
    }>();
  if (!report) return json({ error: 'Report not ready' }, { status: 404 }, origin);

  let variables: ReportVariablesV1;
  try {
    variables = JSON.parse(report.variables) as ReportVariablesV1;
  } catch {
    return json({ error: 'Corrupt report variables' }, { status: 500 }, origin);
  }

  // Localized AI feedback (only once generation completed).
  const aiFeedback =
    report.ai_status === 'done'
      ? (lang === 'zh-HK' ? report.ai_feedback_zh : report.ai_feedback_en) ?? report.ai_feedback_en
      : null;

  const pdfFilename = reportPdfFilename(attempt.external_ref, variables.testCode, attemptId);
  // ai_generated_at busts the cache so PDFs downloaded after generation include
  // the feedback instead of serving the stale pre-feedback copy.
  // pdfLayout bumps when Answer Review / paragraph layout changes (e.g. newline fix).
  const pdfLayout = 4;
  const cacheKey = `${attemptId}:${lang}:${report.report_version}:ai${report.ai_generated_at ?? 0}:L${pdfLayout}`;

  // Cache hit: stream straight from R2.
  const indexRow = await env.DB.prepare('SELECT r2_key FROM pdf_cache_index WHERE cache_key = ?')
    .bind(cacheKey)
    .first<{ r2_key: string }>();
  if (indexRow) {
    const cached = await env.R2_ASSETS.get(indexRow.r2_key);
    if (cached) return pdfResponse(cached.body, pdfFilename, origin);
    // Index row without object (out-of-band deletion) — drop it and re-render.
    await env.DB.prepare('DELETE FROM pdf_cache_index WHERE cache_key = ?').bind(cacheKey).run();
  }

  const answers = await env.DB.prepare(
    `SELECT a.question_code, a.selected_option, a.is_correct, a.display_order,
            a.text_response, a.ai_band_key, a.ai_mark_json,
            g.canonical_number, g.response_type, p.part_code, p.skill AS part_skill,
            d.key AS dimension_key,
            q.prompt_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_answer
     FROM test_attempt_answers a
     JOIN question_groups g ON g.id = a.question_group_id
     JOIN test_parts p ON p.id = g.test_part_id
     JOIN questions q ON q.id = a.question_id
     LEFT JOIN dimensions d ON d.id = g.dimension_id
     WHERE a.test_attempt_id = ? ORDER BY COALESCE(a.display_order, g.canonical_number)`,
  )
    .bind(attemptId)
    .all<AttemptAnswerRow>();

  const bytes = await renderReportPdf(env, variables, answers.results ?? [], lang, aiFeedback);

  // Store + FIFO eviction. The object key mirrors the cache key's AI state so
  // pre- and post-feedback renders never overwrite each other.
  const r2Key = `pdf-cache/${attemptId}-${lang}-${report.report_version}-ai${report.ai_generated_at ?? 0}-L${pdfLayout}.pdf`;
  await env.R2_ASSETS.put(r2Key, bytes, { httpMetadata: { contentType: 'application/pdf' } });
  await env.DB.prepare(
    'INSERT OR REPLACE INTO pdf_cache_index (cache_key, test_attempt_id, r2_key, size_bytes, created_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(cacheKey, attemptId, r2Key, bytes.byteLength, Date.now())
    .run();
  await evictOldest(env);

  return pdfResponse(bytes, pdfFilename, origin);
}

async function isAuthorized(request: Request, env: AuthEnv, attempt: AttemptRow, url: URL): Promise<boolean> {
  // 1. Student retrieval pair: attempt ID + original voucher code.
  const voucher = (url.searchParams.get('voucher') ?? '').trim().toUpperCase();
  if (voucher && attempt.external_ref && voucher === attempt.external_ref.trim().toUpperCase()) {
    return true;
  }

  // 2. Active session that owns the attempt.
  const auth = request.headers.get('Authorization') ?? '';
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer && attempt.session_token && bearer === attempt.session_token) {
    const session = await env.DB.prepare('SELECT expires_at FROM sessions WHERE token = ?')
      .bind(bearer)
      .first<{ expires_at: number }>();
    if (session && session.expires_at > Date.now()) return true;
  }

  // 3. Teacher key scoped to the attempt user's group.
  const teacherKey = (request.headers.get('X-Teacher-Key') ?? '').trim();
  if (teacherKey) {
    const cred = await env.DB.prepare('SELECT user_group FROM teacher_credentials WHERE key = ?')
      .bind(teacherKey)
      .first<{ user_group: string }>();
    if (cred && attempt.user_group && cred.user_group === attempt.user_group) return true;
  }

  return false;
}

async function evictOldest(env: ReportsEnv) {
  const rows = await env.DB.prepare(
    'SELECT cache_key, r2_key FROM pdf_cache_index ORDER BY created_at ASC',
  ).all<{ cache_key: string; r2_key: string }>();
  const all = rows.results ?? [];
  if (all.length <= PDF_CACHE_MAX) return;
  const victims = all.slice(0, all.length - PDF_CACHE_MAX);
  for (const victim of victims) {
    await env.R2_ASSETS.delete(victim.r2_key);
    await env.DB.prepare('DELETE FROM pdf_cache_index WHERE cache_key = ?').bind(victim.cache_key).run();
  }
}

function pdfResponse(
  body: BodyInit | ReadableStream | Uint8Array,
  filename: string,
  origin?: string,
) {
  const headers = new Headers({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Cache-Control': 'private, no-store',
  });
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  return new Response(body as BodyInit, { status: 200, headers });
}

function reportPdfFilename(voucherCode: string | null, testCode: string, attemptId: string): string {
  const safeVoucher = (voucherCode ?? 'unknown').replace(/[^A-Za-z0-9-]/g, '_');
  return `EDT-Report_${safeVoucher}_${testCode}_${attemptId}.pdf`;
}

// ---------------------------------------------------------------------------
// pdf-lib rendering
// ---------------------------------------------------------------------------

const CJK_RE = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

type Fonts = { body: PDFFont; bold: PDFFont; cjk: PDFFont | null; cjkBold: PDFFont | null };

async function loadFont(env: ReportsEnv, doc: PDFDocument, key: string): Promise<PDFFont> {
  const object = await env.R2_ASSETS.get(key);
  if (!object) throw new Error(`Font asset missing in R2: ${key}`);
  return doc.embedFont(await object.arrayBuffer(), { subset: true });
}

async function renderReportPdf(
  env: ReportsEnv,
  vars: ReportVariablesV1,
  answers: AttemptAnswerRow[],
  lang: ReportLang,
  aiFeedback: string | null = null,
): Promise<Uint8Array> {
  const strings = REPORT_STRINGS[lang];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const needsCjk = lang === 'zh-HK' || CJK_RE.test(vars.candidate.name);
  // Noto Serif TC ships as a TrueType-outline variable font: fontkit can subset it
  // (its CFF/OTF subsetter cannot handle the CJK OTFs), keeping PDFs small.
  // The single instance renders at Regular weight for both roles.
  const notoCjk = needsCjk ? await loadFont(env, doc, 'fonts/NotoSerifTC-Regular.ttf') : null;
  const fonts: Fonts = {
    body: await loadFont(env, doc, 'fonts/Montserrat-Regular.ttf'),
    bold: await loadFont(env, doc, 'fonts/Montserrat-SemiBold.ttf'),
    cjk: notoCjk,
    cjkBold: notoCjk,
  };
  const pick = (text: string, bold: boolean): PDFFont => {
    if (CJK_RE.test(text)) return (bold ? fonts.cjkBold : fonts.cjk) ?? (bold ? fonts.bold : fonts.body);
    return bold ? fonts.bold : fonts.body;
  };

  doc.setTitle(`EDT Report ${vars.attempt.attemptId}`);
  doc.setCreator('English Diagnostic Test Platform');

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 24) newPage();
  };
  const text = (value: string, x: number, size: number, opts: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    // pdf-lib drawText treats \\n as multi-line using page.lineHeight (default 24)
    // without advancing our cursor — never pass newlines here.
    const safe = value.replace(/[\r\n]+/g, ' ').trimEnd();
    if (!safe) return;
    const font = pick(safe, opts.bold ?? false);
    page.drawText(safe, { x, y, size, font, color: opts.color ?? INK });
  };
  const wrap = (value: string, size: number, bold: boolean, maxWidth: number): string[] => {
    const font = pick(value, bold);
    const isCjk = CJK_RE.test(value);
    const tokens = isCjk ? Array.from(value) : value.split(/\s+/).filter(Boolean);
    const joiner = isCjk ? '' : ' ';
    const lines: string[] = [];
    let current = '';
    for (const token of tokens) {
      const candidate = current ? current + joiner + token : token;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = token;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const paragraph = (
    value: string,
    x: number,
    size: number,
    opts: { bold?: boolean; color?: ReturnType<typeof rgb>; maxWidth?: number; lineGap?: number } = {},
  ) => {
    const maxWidth = opts.maxWidth ?? PAGE_W - MARGIN - x;
    const lineStep = size + (opts.lineGap ?? 4);
    // Split hard breaks first. Paper III prompts/essays contain \\n; if left inside
    // a drawText call, pdf-lib stacks lines at page.lineHeight while we only move
    // `y` once — causing the Answer Review section to overlap.
    const blocks = String(value ?? '')
      .replace(/\r\n/g, '\n')
      .split('\n');
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) {
        ensure(lineStep);
        y -= lineStep * 0.6;
        continue;
      }
      for (const line of wrap(trimmed, size, opts.bold ?? false, maxWidth)) {
        ensure(lineStep + 2);
        text(line, x, size, opts);
        y -= lineStep;
      }
    }
  };
  const sectionHeading = (label: string) => {
    ensure(40);
    y -= 10;
    text(label.toUpperCase(), MARGIN, 10, { bold: true, color: GOLD });
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.7, color: GOLD });
    y -= 16;
  };

  // --- Header band (EDT forest + neon) ---
  const headerH = 110;
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: FOREST });
  page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: 3, color: NEON });
  page.drawText('EDT', { x: MARGIN, y: PAGE_H - 52, size: 30, font: fonts.bold, color: NEON });
  page.drawText(strings.title, { x: MARGIN, y: PAGE_H - 74, size: 12, font: pick(strings.title, true), color: SOFT });
  const subtitle = strings.subtitle[vars.testCode] ?? `Test ${vars.testCode}`;
  page.drawText(subtitle, { x: MARGIN, y: PAGE_H - 92, size: 10, font: pick(subtitle, false), color: OLIVE });
  y = PAGE_H - headerH - 28;

  // --- Candidate block ---
  sectionHeading(strings.candidate);
  const testDate = new Date(vars.attempt.endTime || vars.attempt.startTime);
  const dateStr = `${testDate.getUTCFullYear()}-${String(testDate.getUTCMonth() + 1).padStart(2, '0')}-${String(testDate.getUTCDate()).padStart(2, '0')}`;
  const infoPairs: Array<[string, string]> = [
    [strings.name, vars.candidate.name || '—'],
    [strings.ref, vars.candidate.ref || '—'],
    [strings.userGroup, vars.candidate.userGroup || '—'],
    [strings.testDate, dateStr],
    [strings.duration, `${Math.round(vars.attempt.durationSec / 60)} ${strings.minutes}`],
  ];
  for (const [label, value] of infoPairs) {
    ensure(16);
    text(label, MARGIN, 9, { color: OLIVE });
    text(value, MARGIN + 150, 10, { bold: true });
    y -= 16;
  }
  if (vars.attempt.autoSubmitted) {
    ensure(14);
    text(strings.autoSubmitted, MARGIN, 8.5, { color: OLIVE });
    y -= 14;
  }

  // --- Overall score + band ---
  sectionHeading(strings.overallScore);
  ensure(58);
  // 26pt digits ascend ~19pt above the baseline; drop the cursor so they clear
  // the section divider drawn by sectionHeading.
  y -= 12;
  const scoreLabel = `${vars.scores.overall.correct} / ${vars.scores.overall.total}`;
  text(scoreLabel, MARGIN, 26, { bold: true });
  if (vars.bands.overall) {
    const band = vars.bands.overall;
    text(`${strings.cefrBand}: ${band.cefrLabel}`, MARGIN + 170, 13, { bold: true, color: FOREST });
    y -= 18;
    const extras: string[] = [];
    if (band.ielts) extras.push(`${strings.approxIelts}: ${band.ielts}`);
    if (band.toefl) extras.push(`${strings.approxToefl}: ${band.toefl}`);
    if (extras.length) text(extras.join('    '), MARGIN + 170, 9, { color: OLIVE });
    y -= 24;
    const narrative = strings.bandNarratives[band.bandKey];
    if (narrative) {
      paragraph(narrative.headline, MARGIN, 11, { bold: true });
      y -= 2;
      paragraph(narrative.recommendation, MARGIN, 9.5, { color: INK, lineGap: 3.5 });
    }
  } else {
    y -= 34;
  }

  // --- Part scores (+ per-part bands for Test 2) ---
  const partLetter = (code: string) => (code === '01' ? 'A' : 'B');
  const skillLabel = (skill: string | null) => (skill ? (strings.skillLabels[skill] ?? skill) : '');
  sectionHeading(strings.partScores);
  for (const part of vars.scores.parts) {
    ensure(16);
    const partBand = vars.bands.parts.find((b) => b.partCode === part.partCode);
    const label = `${strings.partLabel} ${partLetter(part.partCode)} — ${skillLabel(part.skill)}`;
    text(label, MARGIN, 9.5);
    text(`${part.correct} / ${part.total}`, MARGIN + 260, 10, { bold: true });
    if (partBand) text(partBand.cefrLabel, MARGIN + 340, 10, { bold: true, color: FOREST });
    y -= 16;
  }
  const partBandDetails = vars.bands.parts.filter((b) => b.ielts || b.toefl);
  if (partBandDetails.length) {
    y -= 4;
    for (const band of partBandDetails) {
      ensure(13);
      const detail = [band.ielts ? `${strings.approxIelts}: ${band.ielts}` : null, band.toefl ? `${strings.approxToefl}: ${band.toefl}` : null]
        .filter(Boolean)
        .join('    ');
      text(`${strings.partLabel} ${partLetter(band.partCode)}: ${detail}`, MARGIN, 8.5, { color: OLIVE });
      y -= 13;
    }
  }

  // --- Dimension profile (radar + table). Paper III has no radar — skip entirely. ---
  if (vars.testCode !== '03' && vars.dimensions.length > 0) {
    const dimensions = [...vars.dimensions].sort((a, b) =>
      (a.partCode + a.dimensionCode).localeCompare(b.partCode + b.dimensionCode),
    );
    sectionHeading(strings.dimensionProfile);

    // Radar chart mirroring the web report (sky data polygon on a slate grid).
    const R = 76;
    const LABEL_R = 94;
    const blockH = 2 * LABEL_R + 24;
    ensure(blockH);
    const cx = PAGE_W / 2;
    const cy = y - LABEL_R - 4;
    const count = dimensions.length;
    // Page coords are y-up; start at 12 o'clock and go clockwise like the web chart.
    const axisAngle = (i: number) => Math.PI / 2 - (i * 2 * Math.PI) / count;
    const pt = (i: number, fraction: number): [number, number] => {
      const a = axisAngle(i);
      return [cx + fraction * R * Math.cos(a), cy + fraction * R * Math.sin(a)];
    };
    for (let level = 1; level <= 5; level++) {
      const fraction = level / 5;
      for (let i = 0; i < count; i++) {
        const [x1, y1] = pt(i, fraction);
        const [x2, y2] = pt((i + 1) % count, fraction);
        page.drawLine({
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          thickness: level === 5 ? 1 : 0.5,
          color: GRID,
        });
      }
    }
    for (let i = 0; i < count; i++) {
      const [x2, y2] = pt(i, 1);
      page.drawLine({ start: { x: cx, y: cy }, end: { x: x2, y: y2 }, thickness: 0.5, color: GRID });
    }
    const fractionFor = (dim: (typeof dimensions)[number]) => (dim.max > 0 ? Math.min(1, dim.score / dim.max) : 0);
    // drawSvgPath uses SVG coords (y down) from the given origin; map page->svg via y0 = PAGE_H.
    const dataPath =
      dimensions
        .map((dim, i) => {
          const [px, py] = pt(i, fractionFor(dim));
          return `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${(PAGE_H - py).toFixed(2)}`;
        })
        .join(' ') + ' Z';
    page.drawSvgPath(dataPath, {
      x: 0,
      y: PAGE_H,
      color: SKY,
      opacity: 0.18,
      borderColor: SKY,
      borderWidth: 1.5,
      borderOpacity: 1,
    });
    dimensions.forEach((dim, i) => {
      const [px, py] = pt(i, fractionFor(dim));
      page.drawCircle({ x: px, y: py, size: 2.6, color: SKY });
    });
    dimensions.forEach((dim, i) => {
      const label = strings.dimensionShorts[dim.key] ?? dim.key;
      const font = pick(label, false);
      const width = font.widthOfTextAtSize(label, 7.5);
      const a = axisAngle(i);
      const lx = cx + LABEL_R * Math.cos(a);
      const ly = cy + LABEL_R * Math.sin(a);
      const anchored = Math.cos(a) > 0.2 ? lx : Math.cos(a) < -0.2 ? lx - width : lx - width / 2;
      page.drawText(label, { x: anchored, y: ly - 2.5, size: 7.5, font, color: rgb(71 / 255, 85 / 255, 105 / 255) });
    });
    y = cy - LABEL_R - 16;

    ensure(15);
    text(strings.dimension, MARGIN, 9, { bold: true, color: OLIVE });
    text(strings.score, MARGIN + 300, 9, { bold: true, color: OLIVE });
    text(strings.level, MARGIN + 380, 9, { bold: true, color: OLIVE });
    y -= 14;
    for (const dim of dimensions) {
      ensure(14);
      text(strings.dimensionLabels[dim.key] ?? dim.key, MARGIN, 9);
      text(`${dim.score} / ${dim.max}`, MARGIN + 300, 9);
      const weak = dim.levelKey === 'needsWork' || dim.levelKey === 'developing';
      text(strings.levelLabels[dim.levelKey] ?? dim.levelKey, MARGIN + 380, 9, {
        bold: weak,
        color: weak ? GOLD : INK,
      });
      y -= 14;
    }
    ensure(16);
    y -= 4;
    const weakLabel = vars.weakDimensionKeys.length
      ? vars.weakDimensionKeys.map((key) => strings.dimensionLabels[key] ?? key).join(', ')
      : strings.none;
    paragraph(`${strings.weakDimensions}: ${weakLabel}`, MARGIN, 9, { bold: true });
  }

  // --- Cohort comparison ---
  if (vars.cohort) {
    sectionHeading(strings.cohortTitle);
    const cohortPairs: Array<[string, string]> = [];
    if (vars.cohort.percentileRank != null) cohortPairs.push([strings.percentile, `${vars.cohort.percentileRank}`]);
    if (vars.cohort.cohortRank != null) cohortPairs.push([strings.cohortRank, `${vars.cohort.cohortRank} / ${vars.cohort.cohortSize}`]);
    if (vars.cohort.groupPercentileRank != null) cohortPairs.push([strings.groupPercentile, `${vars.cohort.groupPercentileRank}`]);
    if (!cohortPairs.length) cohortPairs.push([strings.cohortSize, String(vars.cohort.cohortSize)]);
    for (const [label, value] of cohortPairs) {
      ensure(15);
      text(label, MARGIN, 9, { color: OLIVE });
      text(value, MARGIN + 220, 9.5, { bold: true });
      y -= 15;
    }
  }

  // --- AI tutor feedback (only when generated; collapses cleanly otherwise) ---
  if (aiFeedback) {
    sectionHeading(strings.aiFeedbackTitle);
    const lines = aiFeedback
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      // Template lines are "Label: content" — draw the label bold, body indented.
      const separator = line.includes('：') ? '：' : ':';
      const separatorAt = line.indexOf(separator);
      if (separatorAt > 0 && separatorAt <= 24) {
        const label = line.slice(0, separatorAt + 1);
        const body = line.slice(separatorAt + 1).trim();
        ensure(28);
        text(label, MARGIN, 9.5, { bold: true, color: FOREST });
        y -= 13;
        paragraph(body, MARGIN + 12, 9, { lineGap: 3 });
        y -= 3;
      } else {
        paragraph(line, MARGIN, 9, { lineGap: 3 });
        y -= 3;
      }
    }
    ensure(12);
    text(strings.aiFeedbackDisclaimer, MARGIN, 7.5, { color: OLIVE });
    y -= 12;
  }

  // --- Answer review ---
  if (answers.length > 0) {
    sectionHeading(strings.answerReview);
    const isTest1 = vars.testCode === '01';
    const isTest3 = vars.testCode === '03';
    const questionLabel = (row: AttemptAnswerRow): string | null => {
      if (row.dimension_key) return strings.dimensionLabels[row.dimension_key] ?? row.dimension_key;
      if (!isTest1) return null;
      return row.canonical_number <= 75 ? strings.vocabCommon : strings.vocabSpecialized;
    };
    const optionTexts = (row: AttemptAnswerRow): Record<string, string> => ({
      A: row.option_a,
      B: row.option_b,
      C: row.option_c,
      D: row.option_d,
    });

    let lastPart: string | null = null;
    for (const row of answers) {
      if (row.part_code !== lastPart) {
        lastPart = row.part_code;
        ensure(26);
        y -= 4;
        const skill = skillLabel(row.part_skill);
        text(`${strings.partLabel} ${partLetter(row.part_code)}${skill ? ` — ${skill}` : ''}`, MARGIN, 10.5, {
          bold: true,
          color: FOREST,
        });
        y -= 6;
        page.drawLine({
          start: { x: MARGIN, y },
          end: { x: PAGE_W - MARGIN, y },
          thickness: 0.4,
          color: GRID,
        });
        y -= 14;
      }

      ensure(44);
      const qNum = row.display_order ?? row.canonical_number;
      const label = questionLabel(row);
      const qHeader = isTest3 && label ? `Question ${qNum}: ${label}` : `Q${qNum}`;
      if (isTest3) {
        paragraph(qHeader, MARGIN, 9.5, { bold: true, lineGap: 3 });
      } else {
        text(qHeader, MARGIN, 9.5, { bold: true });
        if (label) {
          const headerWidth = pick(`Q${qNum}`, true).widthOfTextAtSize(`Q${qNum}`, 9.5);
          text(label, MARGIN + headerWidth + 8, 8, { color: OLIVE });
        }
        y -= 13;
      }
      const reviewPrompt = isTest3
        ? stripSpeakingUiBoilerplate(row.prompt_text ?? '')
        : (row.prompt_text ?? '');
      if (reviewPrompt) {
        paragraph(reviewPrompt, MARGIN, 9, { lineGap: 3 });
        y -= 2;
      }

      if (isTest3) {
        type Paper3PdfMark = {
          unanswered?: boolean;
          strengths?: string[];
          improvements?: string[];
          cefrLabel?: string;
        };
        let mark: Paper3PdfMark | null = null;
        try {
          mark = row.ai_mark_json ? (JSON.parse(row.ai_mark_json) as Paper3PdfMark) : null;
        } catch {
          mark = null;
        }
        const unanswered = Boolean(mark?.unanswered) || !row.ai_band_key;
        if (unanswered) {
          ensure(12);
          text(strings.unanswered, MARGIN + 14, 8.5, { color: OLIVE, bold: true });
          y -= 14;
        } else {
          const bandLabel = mark?.cefrLabel ?? row.ai_band_key ?? '';
          if (bandLabel) {
            ensure(12);
            text(`${strings.cefrBand}: ${bandLabel}`, MARGIN + 14, 8.5, { bold: true, color: FOREST });
            y -= 12;
          }
          if (row.response_type === 'writing' && row.text_response?.trim()) {
            const excerpt =
              row.text_response.trim().length > 400
                ? `${row.text_response.trim().slice(0, 400)}…`
                : row.text_response.trim();
            paragraph(excerpt, MARGIN + 14, 8.5, { lineGap: 3 });
            y -= 4;
          }
          if (mark?.strengths?.length) {
            paragraph(`${strings.strengths}: ${mark.strengths.join('; ')}`, MARGIN + 14, 8, {
              color: GREEN,
              lineGap: 3,
            });
            y -= 2;
          }
          if (mark?.improvements?.length) {
            paragraph(`${strings.improvements}: ${mark.improvements.join('; ')}`, MARGIN + 14, 8, {
              color: GOLD,
              lineGap: 3,
            });
            y -= 2;
          }
        }
        y -= 10;
        continue;
      }

      const options = optionTexts(row);
      for (const key of ['A', 'B', 'C', 'D']) {
        const isCorrectOption = row.correct_answer === key;
        const isSelected = row.selected_option === key;
        const suffix = isSelected
          ? isCorrectOption
            ? ` — ${strings.yourAnswerMark} · ${strings.correct}`
            : ` — ${strings.yourAnswerMark}`
          : isCorrectOption
            ? ` — ${strings.correctAnswerMark}`
            : '';
        const color = isCorrectOption ? GREEN : isSelected ? RED : INK;
        paragraph(`${key}. ${options[key]}${suffix}`, MARGIN + 14, 8.5, {
          color,
          bold: isCorrectOption || isSelected,
          lineGap: 2.5,
        });
      }
      if (!row.selected_option) {
        ensure(12);
        text(strings.unanswered, MARGIN + 14, 8, { color: OLIVE });
        y -= 12;
      }
      y -= 8;
    }
  }

  // --- Disclaimer ---
  y -= 8;
  paragraph(strings.disclaimer, MARGIN, 7.5, { color: OLIVE, lineGap: 3 });

  // --- Footer on every page ---
  const pages = doc.getPages();
  const generated = `${strings.generatedAt}: ${new Date().toISOString()}`;
  pages.forEach((p: PDFPage, i: number) => {
    p.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: PAGE_W - MARGIN, y: 34 }, thickness: 0.5, color: OLIVE });
    p.drawText(generated, { x: MARGIN, y: 22, size: 7, font: pick(generated, false), color: OLIVE });
    const pageLabel = `${strings.page} ${i + 1} / ${pages.length}`;
    const pageFont = pick(pageLabel, false);
    p.drawText(pageLabel, {
      x: PAGE_W - MARGIN - pageFont.widthOfTextAtSize(pageLabel, 7),
      y: 22,
      size: 7,
      font: pageFont,
      color: OLIVE,
    });
  });

  return doc.save();
}
