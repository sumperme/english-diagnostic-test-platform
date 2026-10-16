// Server-side PDF report service with FIFO cache.
//
//   GET /api/reports/:attemptId/pdf[?voucher=CODE]
//
// Auth (any one):
//   1. Student retrieval pair: ?voucher=CODE matching users.external_ref of the attempt's user.
//   2. Active session Bearer token equal to test_attempts.session_token.
//   3. Teacher key (X-Teacher-Key) whose user_group matches the attempt user's user_group.
//
// Rendering: pdf-lib from attempt_reports.variables (layout-free, see reportVariables.ts),
// English reportI18n.ts labels and, for Paper I, comments resolved from feedback_items.
// Fonts load from R2 fonts/ at render time (Montserrat for Latin, Noto Serif TC for CJK names).
// Text is measured before it is drawn so page breaks fall between cards and rows, never
// inside them; grammar-point cards taller than the remaining page split between fields.
//
// Cache: latest 20 PDFs kept in R2 under pdf-cache/, indexed in D1 pdf_cache_index,
// evicted first-come-first-leave by created_at (insertion order, not last access).

import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { REPORT_STRINGS, formatPaper1Level } from './reportI18n';
import type { FeedbackItem, Paper1Area, Paper1Report, ReportDimension, ReportVariablesV1 } from './reportVariables';
import {
  PAPER1_TEMPLATE_CODES,
  fillTemplate,
  formatReportPercent,
  loadPaper1Feedback,
  paper1GrammarPoints,
} from './paper1Report';

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
const SKY = rgb(14 / 255, 165 / 255, 233 / 255);
const GRID = rgb(203 / 255, 213 / 255, 225 / 255);
const SLATE = rgb(71 / 255, 85 / 255, 105 / 255);

const PAGE_W = 595.28; // A4 portrait, points
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
/** Lowest point body content may reach; the footer rule sits at y = 34. */
const CONTENT_BOTTOM = MARGIN + 8;
/** Usable height of a fresh page. */
const PAGE_ROOM = PAGE_H - MARGIN - CONTENT_BOTTOM;

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

  const { attempt, authorized } = await authorizeAttemptAccess(request, env, attemptId, url);
  if (!attempt) return json({ error: 'Not found' }, { status: 404 }, origin);
  if (!authorized) return json({ error: 'Unauthorized' }, { status: 401 }, origin);

  const report = await env.DB.prepare(
    `SELECT report_version, variables, ai_status, ai_feedback_en, ai_generated_at
     FROM attempt_reports WHERE test_attempt_id = ?`,
  )
    .bind(attemptId)
    .first<{
      report_version: string;
      variables: string;
      ai_status: string | null;
      ai_feedback_en: string | null;
      ai_generated_at: number | null;
    }>();
  if (!report) return json({ error: 'Report not ready' }, { status: 404 }, origin);

  let variables: ReportVariablesV1;
  try {
    variables = JSON.parse(report.variables) as ReportVariablesV1;
  } catch {
    return json({ error: 'Corrupt report variables' }, { status: 500 }, origin);
  }

  const aiFeedback = report.ai_status === 'done' ? report.ai_feedback_en : null;

  const pdfFilename = reportPdfFilename(attempt.external_ref, variables.testCode, attemptId);
  // ai_generated_at busts the cache so PDFs downloaded after generation include
  // the feedback instead of serving the stale pre-feedback copy.
  // pdfLayout bumps whenever the rendered layout changes.
  const pdfLayout = 9;
  const cacheKey = `${attemptId}:${report.report_version}:ai${report.ai_generated_at ?? 0}:L${pdfLayout}`;

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

  const feedback = variables.paper1 ? await loadPaper1Feedback(env.DB, variables.paper1) : {};
  const bytes = await renderReportPdf(env, variables, aiFeedback, feedback);

  // Store + FIFO eviction. The object key mirrors the cache key's AI state so
  // pre- and post-feedback renders never overwrite each other.
  const r2Key = `pdf-cache/${attemptId}-${report.report_version}-ai${report.ai_generated_at ?? 0}-L${pdfLayout}.pdf`;
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
// Layout primitives
// ---------------------------------------------------------------------------

const CJK_RE = /[\u3000-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/;

type Fonts = { body: PDFFont; bold: PDFFont; cjk: PDFFont | null };
type Color = ReturnType<typeof rgb>;
type TextStyle = { size: number; bold?: boolean; color?: Color; lineGap?: number };

const BODY: TextStyle = { size: 9, color: INK, lineGap: 3.5 };
const SMALL_NOTE: TextStyle = { size: 7.5, color: OLIVE, lineGap: 3 };

async function loadFont(env: ReportsEnv, doc: PDFDocument, key: string): Promise<PDFFont> {
  const object = await env.R2_ASSETS.get(key);
  if (!object) throw new Error(`Font asset missing in R2: ${key}`);
  return doc.embedFont(await object.arrayBuffer(), { subset: true });
}

/**
 * Cursor-based writer. `y` is the top of the next content; text baselines sit at
 * top - 0.8 × size. Measuring helpers return heights without drawing.
 */
class PdfWriter {
  page: PDFPage;
  y = PAGE_H;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
  ) {
    this.page = doc.addPage([PAGE_W, PAGE_H]);
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  /** Vertical space left on the current page. */
  get room() {
    return this.y - CONTENT_BOTTOM;
  }

  /** Starts a new page unless `height` still fits on this one. */
  ensure(height: number) {
    if (height > this.room) this.newPage();
  }

  gap(height: number) {
    this.y -= height;
  }

  font(text: string, bold = false): PDFFont {
    if (CJK_RE.test(text) && this.fonts.cjk) return this.fonts.cjk;
    return bold ? this.fonts.bold : this.fonts.body;
  }

  widthOf(text: string, style: TextStyle): number {
    return this.font(text, style.bold).widthOfTextAtSize(text, style.size);
  }

  lineStep(style: TextStyle): number {
    return style.size + (style.lineGap ?? 4);
  }

  /**
   * Wraps text to `width`. Hard line breaks are kept; blank lines become ''.
   * `firstIndent` narrows the first line (for an inline bold label drawn before it).
   */
  lines(value: string, style: TextStyle, width: number, firstIndent = 0): string[] {
    const out: string[] = [];
    const blocks = String(value ?? '')
      .replace(/\r\n?/g, '\n')
      .split('\n');
    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) {
        if (out.length > 0) out.push('');
        continue;
      }
      const font = this.font(trimmed, style.bold);
      const isCjk = CJK_RE.test(trimmed);
      const tokens = isCjk ? Array.from(trimmed) : trimmed.split(/\s+/);
      const joiner = isCjk ? '' : ' ';
      let current = '';
      for (const token of tokens) {
        const limit = out.length === 0 ? width - firstIndent : width;
        const candidate = current ? current + joiner + token : token;
        if (current && font.widthOfTextAtSize(candidate, style.size) > limit) {
          out.push(current);
          current = token;
        } else {
          current = candidate;
        }
      }
      if (current) out.push(current);
    }
    while (out.length > 0 && out[out.length - 1] === '') out.pop();
    return out;
  }

  /** Height of wrapped lines; blank lines count as a short gap. */
  heightOf(lines: string[], style: TextStyle): number {
    const step = this.lineStep(style);
    return lines.reduce((height, line) => height + (line ? step : step * 0.6), 0);
  }

  /** Draws one line with its top at `top` (no page checks). */
  textAt(value: string, x: number, top: number, style: TextStyle) {
    const safe = value.replace(/[\r\n]+/g, ' ').trimEnd();
    if (!safe) return;
    this.page.drawText(safe, {
      x,
      y: top - style.size * 0.8,
      size: style.size,
      font: this.font(safe, style.bold),
      color: style.color ?? INK,
    });
  }

  textRight(value: string, right: number, top: number, style: TextStyle) {
    this.textAt(value, right - this.widthOf(value, style), top, style);
  }

  /** Draws pre-wrapped lines from `top` down (no page checks); returns the height used. */
  linesAt(lines: string[], x: number, top: number, style: TextStyle, firstX = x): number {
    const step = this.lineStep(style);
    let cursor = top;
    lines.forEach((line, i) => {
      if (line) this.textAt(line, i === 0 ? firstX : x, cursor, style);
      cursor -= line ? step : step * 0.6;
    });
    return top - cursor;
  }

  /** Flowing text at the cursor; page breaks fall between lines. */
  paragraph(value: string, style: TextStyle = BODY, x = MARGIN, width = PAGE_W - MARGIN - x) {
    const step = this.lineStep(style);
    for (const line of this.lines(value, style, width)) {
      const height = line ? step : step * 0.6;
      this.ensure(height);
      if (line) this.textAt(line, x, this.y, style);
      this.y -= height;
    }
  }

  /** "Label: text" with a bold inline label; page breaks fall between lines. */
  labelledParagraph(label: string, value: string, style: TextStyle = BODY, x = MARGIN, width = PAGE_W - MARGIN - x) {
    const labelText = `${label} `;
    const labelStyle = { ...style, bold: true, color: FOREST };
    const indent = this.widthOf(labelText, labelStyle);
    const lines = this.lines(value, style, width, indent);
    const step = this.lineStep(style);
    if (lines.length === 0) {
      this.ensure(step);
      this.textAt(label, x, this.y, labelStyle);
      this.y -= step;
      return;
    }
    lines.forEach((line, i) => {
      const height = line ? step : step * 0.6;
      this.ensure(height);
      if (i === 0) this.textAt(labelText, x, this.y, labelStyle);
      if (line) this.textAt(line, i === 0 ? x + indent : x, this.y, style);
      this.y -= height;
    });
  }

  hairline(y: number, color: Color = GRID, x1 = MARGIN, x2 = PAGE_W - MARGIN) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color });
  }
}

/** Gold uppercase heading with a rule underneath. `keepWith` reserves room for what follows. */
function sectionHeading(w: PdfWriter, label: string, keepWith = 24) {
  w.ensure(36 + keepWith);
  w.gap(10);
  w.textAt(label.toUpperCase(), MARGIN, w.y, { size: 10, bold: true, color: GOLD });
  w.gap(14);
  w.page.drawLine({ start: { x: MARGIN, y: w.y }, end: { x: PAGE_W - MARGIN, y: w.y }, thickness: 0.7, color: GOLD });
  w.gap(12);
}

/** Forest band with a neon accent for the major Paper I parts. */
function sectionBand(w: PdfWriter, label: string, keepWith = 40) {
  const height = 24;
  w.ensure(8 + height + 14 + keepWith);
  w.gap(8);
  w.page.drawRectangle({ x: MARGIN, y: w.y - height, width: CONTENT_W, height, color: FOREST });
  w.page.drawRectangle({ x: MARGIN, y: w.y - height, width: 3, height, color: NEON });
  w.textAt(label.toUpperCase(), MARGIN + 12, w.y - 7.5, { size: 10, bold: true, color: NEON });
  w.gap(height + 14);
}

function subHeading(w: PdfWriter, label: string, keepWith = 30) {
  const style: TextStyle = { size: 10.5, bold: true, color: FOREST };
  w.ensure(26 + keepWith);
  w.gap(6);
  w.textAt(label.toUpperCase(), MARGIN, w.y, style);
  w.gap(14);
  w.hairline(w.y + 2, GOLD, MARGIN, MARGIN + 60);
  w.gap(6);
}

/** Label column + value column sharing the first baseline. */
function labelValue(
  w: PdfWriter,
  label: string,
  value: string,
  valueStyle: TextStyle = { size: 10, bold: true, color: INK, lineGap: 3 },
) {
  const labelStyle: TextStyle = { size: 9, color: OLIVE };
  const valueX = MARGIN + 150;
  const lines = w.lines(value, valueStyle, PAGE_W - MARGIN - valueX);
  const height = Math.max(w.heightOf(lines, valueStyle), w.lineStep(labelStyle)) + 3;
  w.ensure(height);
  const top = w.y;
  w.textAt(label, MARGIN, top - 0.8 * (valueStyle.size - labelStyle.size), labelStyle);
  w.linesAt(lines, valueX, top, valueStyle);
  w.y -= height;
}

/** Neon blocks on a muted track; `fraction` is 0–1. */
function segmentBar(page: PDFPage, x: number, top: number, width: number, height: number, fraction: number, segments: number) {
  const gap = 1.6;
  const segW = (width - gap * (segments - 1)) / segments;
  const filled = Math.max(0, Math.min(1, fraction)) * segments;
  for (let i = 0; i < segments; i++) {
    const sx = x + i * (segW + gap);
    page.drawRectangle({ x: sx, y: top - height, width: segW, height, color: OLIVE, opacity: 0.28 });
    const fill = Math.max(0, Math.min(1, filled - i));
    if (fill > 0.01) page.drawRectangle({ x: sx, y: top - height, width: segW * fill, height, color: NEON });
  }
}

function chip(w: PdfWriter, label: string, right: number, top: number) {
  const style: TextStyle = { size: 6.5, bold: true, color: GOLD };
  const padX = 5;
  const height = 11;
  const width = w.widthOf(label, style) + padX * 2;
  w.page.drawRectangle({ x: right - width, y: top - height, width, height, borderColor: GOLD, borderWidth: 0.8 });
  w.textAt(label, right - width + padX, top - 2.6, style);
}

/** Radar chart mirroring the web report (sky polygon on a slate grid). */
function drawRadar(w: PdfWriter, dimensions: ReportDimension[], shortLabel: (key: string) => string) {
  const count = dimensions.length;
  if (count < 3) return;
  const R = 76;
  const LABEL_R = 94;
  const blockH = 2 * LABEL_R + 24;
  w.ensure(blockH);
  const page = w.page;
  const cx = PAGE_W / 2;
  const cy = w.y - LABEL_R - 12;
  // Page coords are y-up; start at 12 o'clock and go clockwise like the web chart.
  const axisAngle = (i: number) => Math.PI / 2 - (i * 2 * Math.PI) / count;
  const pt = (i: number, fraction: number): [number, number] => {
    const a = axisAngle(i);
    return [cx + fraction * R * Math.cos(a), cy + fraction * R * Math.sin(a)];
  };
  for (let level = 1; level <= 5; level++) {
    for (let i = 0; i < count; i++) {
      const [x1, y1] = pt(i, level / 5);
      const [x2, y2] = pt((i + 1) % count, level / 5);
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: level === 5 ? 1 : 0.5, color: GRID });
    }
  }
  for (let i = 0; i < count; i++) {
    const [x2, y2] = pt(i, 1);
    page.drawLine({ start: { x: cx, y: cy }, end: { x: x2, y: y2 }, thickness: 0.5, color: GRID });
  }
  const fractionFor = (dim: ReportDimension) => (dim.max > 0 ? Math.min(1, dim.score / dim.max) : 0);
  // drawSvgPath uses SVG coords (y down) from the given origin; map page->svg via y0 = PAGE_H.
  const dataPath =
    dimensions
      .map((dim, i) => {
        const [px, py] = pt(i, fractionFor(dim));
        return `${i === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${(PAGE_H - py).toFixed(2)}`;
      })
      .join(' ') + ' Z';
  page.drawSvgPath(dataPath, { x: 0, y: PAGE_H, color: SKY, opacity: 0.18, borderColor: SKY, borderWidth: 1.5, borderOpacity: 1 });
  dimensions.forEach((dim, i) => {
    const [px, py] = pt(i, fractionFor(dim));
    page.drawCircle({ x: px, y: py, size: 2.6, color: SKY });
  });
  const labelStyle: TextStyle = { size: 7.5, color: SLATE };
  dimensions.forEach((dim, i) => {
    const label = shortLabel(dim.key);
    const width = w.widthOf(label, labelStyle);
    const a = axisAngle(i);
    const lx = cx + LABEL_R * Math.cos(a);
    const ly = cy + LABEL_R * Math.sin(a);
    const anchored = Math.cos(a) > 0.2 ? lx : Math.cos(a) < -0.2 ? lx - width : lx - width / 2;
    w.textAt(label, anchored, ly + 3.5, labelStyle);
  });
  w.y -= blockH;
}

function bulletList(w: PdfWriter, items: string[], style: TextStyle = BODY) {
  const indent = 12;
  const width = CONTENT_W - indent;
  for (const item of items) {
    const lines = w.lines(item, style, width);
    if (lines.length === 0) continue;
    const step = w.lineStep(style);
    lines.forEach((line, i) => {
      w.ensure(step);
      if (i === 0) w.textAt('•', MARGIN + 2, w.y, { ...style, color: GOLD, bold: true });
      w.textAt(line, MARGIN + indent, w.y, style);
      w.y -= step;
    });
    w.gap(2);
  }
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

async function renderReportPdf(
  env: ReportsEnv,
  vars: ReportVariablesV1,
  aiFeedback: string | null,
  feedback: Record<string, FeedbackItem>,
): Promise<Uint8Array> {
  const strings = REPORT_STRINGS;
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // Noto Serif TC ships as a TrueType-outline variable font: fontkit can subset it
  // (its CFF/OTF subsetter cannot handle the CJK OTFs), keeping PDFs small.
  const needsCjk = CJK_RE.test(vars.candidate.name);
  const fonts: Fonts = {
    body: await loadFont(env, doc, 'fonts/Montserrat-Regular.ttf'),
    bold: await loadFont(env, doc, 'fonts/Montserrat-SemiBold.ttf'),
    cjk: needsCjk ? await loadFont(env, doc, 'fonts/NotoSerifTC-Regular.ttf') : null,
  };

  doc.setTitle(`EDT Report ${vars.attempt.attemptId}`);
  doc.setCreator('English Diagnostic Test Platform');

  const w = new PdfWriter(doc, fonts);
  const paper1 = vars.testCode === '01' ? vars.paper1 : undefined;

  // --- Header band (EDT forest + neon) ---
  const headerH = 110;
  const title = paper1 ? strings.paper1.reportTitle : strings.title;
  w.page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: headerH, color: FOREST });
  w.page.drawRectangle({ x: 0, y: PAGE_H - headerH, width: PAGE_W, height: 3, color: NEON });
  w.textAt('EDT', MARGIN, PAGE_H - 28, { size: 30, bold: true, color: NEON });
  w.textAt(title, MARGIN, PAGE_H - 64, { size: 12, bold: true, color: SOFT });
  w.textAt(strings.subtitle[vars.testCode] ?? `Test ${vars.testCode}`, MARGIN, PAGE_H - 83, { size: 10, color: OLIVE });
  w.y = PAGE_H - headerH - 22;

  if (paper1) renderPaper1(w, vars, paper1, feedback);
  else renderStandard(w, vars);

  // Hidden with the on-screen AI feedback control. Flip this to show stored feedback again.
  const showAiFeedback = false;
  if (showAiFeedback && aiFeedback) renderAiFeedback(w, aiFeedback);

  // Paper I prints the disclaimer under its estimates in the header block.
  if (!paper1) {
    w.gap(8);
    w.paragraph(strings.disclaimer, SMALL_NOTE);
  }

  // --- Footer on every page ---
  const pages = doc.getPages();
  const generated = `${strings.generatedAt}: ${new Date().toISOString()}`;
  const footerStyle: TextStyle = { size: 7, color: OLIVE };
  pages.forEach((page: PDFPage, i: number) => {
    page.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: PAGE_W - MARGIN, y: 34 }, thickness: 0.5, color: OLIVE });
    page.drawText(generated, { x: MARGIN, y: 22, size: 7, font: fonts.body, color: OLIVE });
    const pageLabel = `${strings.page} ${i + 1} / ${pages.length}`;
    page.drawText(pageLabel, {
      x: PAGE_W - MARGIN - fonts.body.widthOfTextAtSize(pageLabel, footerStyle.size),
      y: 22,
      size: footerStyle.size,
      font: fonts.body,
      color: OLIVE,
    });
  });

  return doc.save();
}

function renderAiFeedback(w: PdfWriter, aiFeedback: string) {
  const strings = REPORT_STRINGS;
  sectionHeading(w, strings.aiFeedbackTitle, 40);
  const lines = aiFeedback
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    // Template lines are "Label: content" — draw the label bold inline.
    const separatorAt = line.indexOf(':');
    if (separatorAt > 0 && separatorAt <= 24) {
      w.labelledParagraph(line.slice(0, separatorAt + 1), line.slice(separatorAt + 1).trim());
    } else {
      w.paragraph(line);
    }
    w.gap(4);
  }
  w.ensure(14);
  w.textAt(strings.aiFeedbackDisclaimer, MARGIN, w.y, SMALL_NOTE);
  w.gap(14);
}

// ---------------------------------------------------------------------------
// Papers II / III
// ---------------------------------------------------------------------------

function renderStandard(w: PdfWriter, vars: ReportVariablesV1) {
  const strings = REPORT_STRINGS;

  sectionHeading(w, strings.candidate);
  const testDate = new Date(vars.attempt.endTime || vars.attempt.startTime);
  const dateStr = `${testDate.getUTCFullYear()}-${String(testDate.getUTCMonth() + 1).padStart(2, '0')}-${String(testDate.getUTCDate()).padStart(2, '0')}`;
  const infoPairs: Array<[string, string]> = [
    [strings.name, vars.candidate.name || '—'],
    [strings.ref, vars.candidate.ref || '—'],
    [strings.userGroup, vars.candidate.userGroup || '—'],
    [strings.testDate, dateStr],
    [strings.duration, `${Math.round(vars.attempt.durationSec / 60)} ${strings.minutes}`],
  ];
  for (const [label, value] of infoPairs) labelValue(w, label, value);
  if (vars.attempt.autoSubmitted) {
    w.ensure(14);
    w.textAt(strings.autoSubmitted, MARGIN, w.y, SMALL_NOTE);
    w.gap(14);
  }

  // --- Overall score + band ---
  const band = vars.bands.overall;
  sectionHeading(w, strings.overallScore, 50);
  const top = w.y;
  w.textAt(`${vars.scores.overall.correct} / ${vars.scores.overall.total}`, MARGIN, top, { size: 24, bold: true });
  if (band) {
    w.textAt(`${strings.cefrBand}: ${band.cefrLabel}`, MARGIN + 170, top, { size: 13, bold: true, color: FOREST });
    const extras: string[] = [];
    if (band.ielts) extras.push(`${strings.approxIelts}: ${band.ielts}`);
    if (band.toefl) extras.push(`${strings.approxToefl}: ${band.toefl}`);
    if (extras.length) w.textAt(extras.join('    '), MARGIN + 170, top - 19, { size: 9, color: OLIVE });
  }
  w.gap(38);
  const narrative = band ? strings.bandNarratives[band.bandKey] : undefined;
  if (narrative) {
    w.paragraph(narrative.headline, { size: 11, bold: true, color: INK, lineGap: 3 });
    w.gap(2);
    w.paragraph(narrative.recommendation, { size: 9.5, color: INK, lineGap: 3.5 });
  }

  // --- Part scores + per-part bands ---
  const partLetter = (code: string) => (code === '01' ? 'A' : 'B');
  const skillLabel = (skill: string | null) => (skill ? (strings.skillLabels[skill] ?? skill) : '');
  sectionHeading(w, strings.partScores);
  for (const part of vars.scores.parts) {
    w.ensure(16);
    const partBand = vars.bands.parts.find((b) => b.partCode === part.partCode);
    w.textAt(`${strings.partLabel} ${partLetter(part.partCode)} — ${skillLabel(part.skill)}`, MARGIN, w.y, { size: 9.5 });
    w.textAt(`${part.correct} / ${part.total}`, MARGIN + 260, w.y, { size: 10, bold: true });
    if (partBand) w.textAt(partBand.cefrLabel, MARGIN + 340, w.y, { size: 10, bold: true, color: FOREST });
    w.gap(16);
  }
  const partBandDetails = vars.bands.parts.filter((b) => b.ielts || b.toefl);
  if (partBandDetails.length) {
    w.gap(4);
    for (const partBand of partBandDetails) {
      const detail = [
        partBand.ielts ? `${strings.approxIelts}: ${partBand.ielts}` : null,
        partBand.toefl ? `${strings.approxToefl}: ${partBand.toefl}` : null,
      ]
        .filter(Boolean)
        .join('    ');
      w.paragraph(`${strings.partLabel} ${partLetter(partBand.partCode)}: ${detail}`, { size: 8.5, color: OLIVE, lineGap: 4 });
    }
  }

  // --- Dimension profile (radar + table). Paper III has no radar — skip entirely. ---
  if (vars.testCode === '03' || vars.dimensions.length === 0) return;
  const dimensions = [...vars.dimensions].sort((a, b) =>
    (a.partCode + a.dimensionCode).localeCompare(b.partCode + b.dimensionCode),
  );
  sectionHeading(w, strings.dimensionProfile, 200);
  drawRadar(w, dimensions, (key) => strings.dimensionShorts[key] ?? key);

  const headStyle: TextStyle = { size: 9, bold: true, color: OLIVE };
  w.ensure(15);
  w.textAt(strings.dimension, MARGIN, w.y, headStyle);
  w.textAt(strings.score, MARGIN + 300, w.y, headStyle);
  w.textAt(strings.level, MARGIN + 380, w.y, headStyle);
  w.gap(14);
  for (const dim of dimensions) {
    w.ensure(14);
    const weak = dim.levelKey === 'needsWork' || dim.levelKey === 'developing';
    w.textAt(strings.dimensionLabels[dim.key] ?? dim.key, MARGIN, w.y, { size: 9 });
    w.textAt(`${strings.levelLabels[dim.levelKey] ?? dim.levelKey} ${dim.score}/${dim.max}`, MARGIN + 300, w.y, {
      size: 9,
      bold: weak,
      color: weak ? GOLD : INK,
    });
    w.gap(14);
  }
  w.gap(4);
  const weakLabel = vars.weakDimensionKeys.length
    ? vars.weakDimensionKeys.map((key) => strings.dimensionLabels[key] ?? key).join(', ')
    : strings.none;
  w.paragraph(`${strings.weakDimensions}: ${weakLabel}`, { size: 9, bold: true, color: INK, lineGap: 4 });
}

// ---------------------------------------------------------------------------
// Paper I (Oct 2026 sample report)
// ---------------------------------------------------------------------------

/** "13 September 2026" in Hong Kong time, matching the web report. */
function longDate(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Hong_Kong',
  }).format(new Date(ms));
}

type FieldRow = { label: string; text: string };

/** Grammar-point fields from fields_json, falling back to "Label: text" body lines. */
function grammarFields(item: FeedbackItem): FieldRow[] {
  if (Array.isArray(item.fields)) {
    return (item.fields as Array<Partial<FieldRow>>)
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

type ConcludingFields = { intro?: string; steps?: FieldRow[]; closing?: string };

function renderPaper1(w: PdfWriter, vars: ReportVariablesV1, report: Paper1Report, feedback: Record<string, FeedbackItem>) {
  const strings = REPORT_STRINGS;
  const p = strings.paper1;
  const areaName = (key: string) => strings.dimensionLabels[key] ?? key;
  const areaLabel = (area: Paper1Area) => strings.levelLabels[area.labelKey] ?? area.labelKey;
  const areaTitle = (area: Paper1Area) => `${p.area} ${Number(area.dimensionCode)}: ${areaName(area.key)}`;
  const body = (code: string) => feedback[code]?.body ?? '';
  const areasByKey = new Map(report.partA.areas.map((area) => [area.key, area]));

  // --- Summary block ---
  const emphasis: TextStyle = { size: 12, bold: true, color: FOREST, lineGap: 3 };
  const overall = report.overall;
  labelValue(w, p.candidateName, vars.candidate.name || '—');
  labelValue(w, p.date, longDate(vars.attempt.endTime || vars.attempt.startTime));
  labelValue(w, p.overallScore, `${overall.correct} / ${overall.total}  (${formatReportPercent(overall.percent)}%)`, emphasis);
  labelValue(w, p.cefrLevel, formatPaper1Level(overall.band), emphasis);
  labelValue(w, p.estimatedIelts, overall.band.ielts ?? '—');
  labelValue(w, p.estimatedToefl, overall.band.toefl ?? '—');
  if (vars.attempt.autoSubmitted) {
    w.ensure(14);
    w.textAt(strings.autoSubmitted, MARGIN, w.y, SMALL_NOTE);
    w.gap(14);
  }
  w.gap(4);
  w.paragraph(strings.disclaimer, SMALL_NOTE);

  // --- Part A: mastery profile ---
  sectionBand(w, p.partATitle);
  subHeading(w, p.masteryProfile);
  labelValue(w, p.partAPlacement, `${p.cefrLevelPrefix} ${formatPaper1Level(report.partA.band)}`);
  labelValue(w, p.partAScore, `${report.partA.correct} / ${report.partA.total}`);
  w.gap(4);
  drawRadar(
    w,
    report.partA.areas.map((area) => ({
      key: area.key,
      dimensionCode: area.dimensionCode,
      partCode: '01',
      score: area.score,
      max: area.max,
      levelKey: area.labelKey,
    })),
    (key) => strings.dimensionShorts[key] ?? key,
  );
  for (const area of report.partA.areas) drawAreaRow(w, area, areaName(area.key), areaLabel(area));

  // --- Detailed evaluation: strengths ---
  sectionBand(w, p.evaluationTitle);
  const strengths = report.partA.strengthKeys.map((key) => areasByKey.get(key)).filter((area): area is Paper1Area => !!area);
  subHeading(w, p.strengthsTitle);
  if (strengths.length === 0) {
    w.paragraph(strings.none);
  } else {
    w.paragraph(fillTemplate(body(PAPER1_TEMPLATE_CODES.strengthsIntro), { n: strengths.length }));
    w.gap(8);
    drawStrengthCards(
      w,
      strengths.map((area) => ({
        title: areaTitle(area),
        meta: `(${area.score}/${area.max} - ${areaLabel(area)})`,
        body: body(area.overviewCode),
      })),
    );
    w.paragraph(body(PAPER1_TEMPLATE_CODES.strengthsClosing));
  }

  // --- Growth roadmap ---
  const growth = report.partA.growthKeys.map((key) => areasByKey.get(key)).filter((area): area is Paper1Area => !!area);
  w.gap(6);
  subHeading(w, p.roadmapTitle);
  if (growth.length === 0) {
    w.paragraph(strings.none);
  } else {
    w.paragraph(fillTemplate(body(PAPER1_TEMPLATE_CODES.roadmapIntro), { n: growth.length }));
    for (const area of growth) {
      const headingStyle: TextStyle = { size: 11, bold: true, color: FOREST, lineGap: 3 };
      const headingLines = w.lines(areaTitle(area), headingStyle, CONTENT_W);
      const overviewLines = w.lines(body(area.overviewCode), BODY, CONTENT_W);
      // Keep the heading with its score line, the overview label and the first overview lines.
      w.ensure(10 + w.heightOf(headingLines, headingStyle) + 16 + 14 + w.heightOf(overviewLines.slice(0, 3), BODY));
      w.gap(10);
      w.y -= w.linesAt(headingLines, MARGIN, w.y, headingStyle);
      w.textAt(`${p.scoreLabel}: ${area.score}/${area.max} - ${areaLabel(area)}`, MARGIN, w.y, { size: 9, bold: true, color: GOLD });
      w.gap(16);
      w.labelledParagraph(`${p.areaOverview}:`, body(area.overviewCode));
      w.gap(6);
      for (const point of paper1GrammarPoints(area, feedback)) drawGrammarPoint(w, point, p.grammarPoint);
    }
  }

  // --- Concluding comment ---
  const concluding = feedback[report.partA.concludingCode];
  if (concluding) {
    w.gap(4);
    subHeading(w, p.concludingTitle, 50);
    const fields = (concluding.fields ?? {}) as ConcludingFields;
    if (fields.intro || fields.steps?.length || fields.closing) {
      if (fields.intro) w.paragraph(fields.intro);
      for (const step of fields.steps ?? []) {
        w.gap(3);
        w.labelledParagraph(`${step.label}:`, step.text, BODY, MARGIN + 12);
      }
      if (fields.closing) {
        w.gap(5);
        w.paragraph(fields.closing);
      }
    } else {
      w.paragraph(concluding.body);
    }
  }

  // --- Part B ---
  const partB = report.partB;
  sectionBand(w, p.partBTitle);
  labelValue(w, p.partBPlacement, `${p.cefrLevelPrefix} ${formatPaper1Level(partB.band)}`);
  labelValue(w, p.partBScore, `${partB.correct} / ${partB.total}`);
  w.gap(4);
  subHeading(w, p.cefrBreakdown, 4 * 20);
  for (const level of partB.levels) {
    const height = 20;
    w.ensure(height);
    const top = w.y;
    w.textAt(p.levelTitles[level.level] ?? level.level, MARGIN, top, { size: 9, bold: true, color: INK });
    segmentBar(w.page, MARGIN + 205, top + 0.5, 230, 9, level.percent / 100, 10);
    w.textRight(`${formatReportPercent(level.percent)}%`, PAGE_W - MARGIN, top, { size: 9, bold: true, color: FOREST });
    w.y -= height;
  }

  w.gap(4);
  subHeading(w, p.overallComments);
  const additional = partB.additional
    ? fillTemplate(body(partB.additional.code), { level: partB.additional.level })
    : '';
  w.paragraph([body(partB.placementCode), additional].filter(Boolean).join(' '));

  const roadmap = feedback[partB.roadmapCode];
  if (roadmap) {
    w.gap(4);
    subHeading(w, p.partBRoadmap);
    const bullets = (roadmap.fields as { bullets?: unknown } | null)?.bullets;
    const items = Array.isArray(bullets) ? bullets.map(String) : roadmap.body.split('\n');
    bulletList(w, items.map((item) => item.trim()).filter(Boolean));
  }
}

function drawAreaRow(w: PdfWriter, area: Paper1Area, name: string, label: string) {
  const nameStyle: TextStyle = { size: 8.5, color: INK, lineGap: 3 };
  const nameX = MARGIN + 44;
  const nameLines = w.lines(name, nameStyle, 176);
  const height = Math.max(w.heightOf(nameLines, nameStyle), 12) + 8;
  w.ensure(height);
  const top = w.y;
  w.textAt(`${REPORT_STRINGS.paper1.area} ${area.dimensionCode}`, MARGIN, top - 0.4, { size: 8, bold: true, color: OLIVE });
  w.linesAt(nameLines, nameX, top, nameStyle);
  segmentBar(w.page, MARGIN + 228, top, 84, 8, area.max > 0 ? area.score / area.max : 0, area.max || 5);
  w.textAt(`${area.score}/${area.max}`, MARGIN + 322, top + 0.4, { size: 9, bold: true, color: FOREST });
  w.textAt(label.toUpperCase(), MARGIN + 346, top - 0.8, { size: 7.5, bold: true, color: area.priority ? GOLD : FOREST });
  if (area.priority) chip(w, REPORT_STRINGS.paper1.priority.toUpperCase(), PAGE_W - MARGIN, top + 1);
  w.y -= height;
  w.hairline(w.y + 4);
}

type StrengthCard = { title: string; meta: string; body: string };

/** Two cards per row; a row breaks to the next page as one unit at the taller card's height. */
function drawStrengthCards(w: PdfWriter, cards: StrengthCard[]) {
  const colGap = 12;
  const colW = (CONTENT_W - colGap) / 2;
  const pad = 10;
  const innerW = colW - pad * 2 - 3;
  const titleStyle: TextStyle = { size: 9.5, bold: true, color: FOREST, lineGap: 3 };
  const metaStyle: TextStyle = { size: 8.5, bold: true, color: GOLD, lineGap: 3 };
  const bodyStyle: TextStyle = { size: 8.5, color: INK, lineGap: 3.2 };

  const measured = cards.map((card) => {
    const title = w.lines(card.title, titleStyle, innerW);
    const meta = w.lines(card.meta, metaStyle, innerW);
    const text = w.lines(card.body, bodyStyle, innerW);
    const height = pad + w.heightOf(title, titleStyle) + w.heightOf(meta, metaStyle) + 5 + w.heightOf(text, bodyStyle) + pad;
    return { title, meta, text, height };
  });

  for (let i = 0; i < measured.length; i += 2) {
    const row = measured.slice(i, i + 2);
    const height = Math.max(...row.map((card) => card.height));
    w.ensure(height + colGap);
    const top = w.y;
    row.forEach((card, col) => {
      const x = MARGIN + col * (colW + colGap);
      w.page.drawRectangle({ x, y: top - height, width: colW, height, color: SOFT });
      w.page.drawRectangle({ x, y: top - height, width: 3, height, color: NEON });
      w.page.drawRectangle({ x, y: top - height, width: colW, height, borderColor: GOLD, borderWidth: 0.6, borderOpacity: 0.5 });
      const textX = x + pad + 3;
      let cursor = top - pad;
      cursor -= w.linesAt(card.title, textX, cursor, titleStyle);
      cursor -= w.linesAt(card.meta, textX, cursor, metaStyle);
      cursor -= 5;
      w.linesAt(card.text, textX, cursor, bodyStyle);
    });
    w.y = top - height - colGap;
  }
}

/** Forest title strip + label/text rows; splits between rows when taller than the page room. */
function drawGrammarPoint(w: PdfWriter, item: FeedbackItem, tag: string) {
  const pad = 8;
  const labelW = 88;
  const textX = MARGIN + pad + labelW + 8;
  const textW = PAGE_W - MARGIN - pad - textX;
  const tagStyle: TextStyle = { size: 6.5, bold: true, color: NEON };
  const headStyle: TextStyle = { size: 9.5, bold: true, color: SOFT, lineGap: 3 };
  const labelStyle: TextStyle = { size: 7.5, bold: true, color: OLIVE, lineGap: 3.5 };
  const textStyle: TextStyle = { size: 8.5, color: INK, lineGap: 3.5 };

  const headLines = w.lines(item.heading ?? '', headStyle, CONTENT_W - pad * 2);
  const headerH = pad + 11 + w.heightOf(headLines, headStyle) + pad - 3;
  const rows = grammarFields(item).map((field) => {
    const label = w.lines(field.label, labelStyle, labelW);
    const text = w.lines(field.text, textStyle, textW);
    return { label, text, height: Math.max(w.heightOf(label, labelStyle), w.heightOf(text, textStyle)) + 8 };
  });
  const total = headerH + rows.reduce((sum, row) => sum + row.height, 0) + 4;

  if (total > w.room) {
    if (total <= PAGE_ROOM) w.newPage();
    else w.ensure(headerH + (rows[0]?.height ?? 0) + 4);
  }

  let index = 0;
  let first = true;
  while (first || index < rows.length) {
    const top = w.y;
    let cursor = top;
    if (first) {
      w.page.drawRectangle({ x: MARGIN, y: top - headerH, width: CONTENT_W, height: headerH, color: FOREST });
      w.textAt(tag.toUpperCase(), MARGIN + pad, top - pad, tagStyle);
      w.linesAt(headLines, MARGIN + pad, top - pad - 11, headStyle);
      cursor -= headerH;
    }
    let drawn = 0;
    while (index < rows.length && (cursor - rows[index].height - 4 >= CONTENT_BOTTOM || drawn === 0)) {
      const row = rows[index];
      if (drawn > 0 || !first) w.hairline(cursor, GRID, MARGIN + pad, PAGE_W - MARGIN - pad);
      w.linesAt(row.label, MARGIN + pad, cursor - 4, labelStyle);
      w.linesAt(row.text, textX, cursor - 4, textStyle);
      cursor -= row.height;
      index += 1;
      drawn += 1;
    }
    cursor -= 4;
    w.page.drawRectangle({
      x: MARGIN,
      y: cursor,
      width: CONTENT_W,
      height: top - cursor,
      borderColor: GOLD,
      borderWidth: 0.6,
      borderOpacity: 0.6,
    });
    w.y = cursor;
    first = false;
    if (index < rows.length) w.newPage();
  }
  w.gap(8);
}
