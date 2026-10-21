// Minimal dependency-free .docx text reader.
//
// A .docx is a ZIP container; the body text lives in word/document.xml. We read the ZIP
// central directory by hand and inflate with node:zlib so the Paper I bank extractor needs
// no third-party packages.
//
// Exports:
//   readZipEntry(file, name)          -> Buffer
//   docxParagraphs(file, { markup })  -> string[]  (one entry per <w:p>, tabs preserved as \t)
//   docxTables(file, { markup })      -> Array<string[][]>  (rows x cells per <w:tbl>)
//
// With { markup: true } italic runs come back as *text* and external hyperlinks as
// [text](url) — the inline markup stored in feedback_items (see TEST_BANK_GUIDE.md).

import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CD_SIG = 0x02014b50;

function findEndOfCentralDirectory(buf) {
  const min = Math.max(0, buf.length - 66_000);
  for (let i = buf.length - 22; i >= min; i -= 1) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error('not a ZIP archive (no end-of-central-directory record)');
}

function readCentralDirectory(buf) {
  const eocd = findEndOfCentralDirectory(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(offset) !== CD_SIG) break;
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen);
    entries.set(name, { method, compressedSize, localOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function readZipEntry(file, name) {
  const buf = readFileSync(file);
  const entry = readCentralDirectory(buf).get(name);
  if (!entry) throw new Error(`entry ${name} not found in ${file}`);
  // Local file header: name/extra lengths can differ from the central directory copy.
  const nameLen = buf.readUInt16LE(entry.localOffset + 26);
  const extraLen = buf.readUInt16LE(entry.localOffset + 28);
  const start = entry.localOffset + 30 + nameLen + extraLen;
  const raw = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(raw);
  if (entry.method === 8) return inflateRawSync(raw);
  throw new Error(`unsupported ZIP compression method ${entry.method} in ${file}`);
}

function decodeXmlEntities(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');
}

// Flattens one <w:p>…</w:p> fragment to plain text, keeping w:tab as \t and w:br as \n.
function paragraphText(xml) {
  let out = '';
  const token = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>/g;
  let m;
  while ((m = token.exec(xml)) !== null) {
    if (m[1] !== undefined) out += decodeXmlEntities(m[1]);
    else if (m[0].startsWith('<w:tab')) out += '\t';
    else out += '\n';
  }
  return out;
}

const ITALIC_RE = /<w:i(?:\s+w:val="([^"]*)")?\s*\/>/;

function italicFlag(rPr) {
  const m = rPr.match(ITALIC_RE);
  if (!m) return null;
  return !['0', 'false', 'off'].includes(m[1] ?? '');
}

function tryZipEntry(file, name) {
  try {
    return readZipEntry(file, name).toString('utf8');
  } catch {
    return '';
  }
}

// Character styles that switch italics on (e.g. Word's built-in "Emphasis"), following basedOn.
function italicCharacterStyles(file) {
  const styles = new Map();
  for (const m of tryZipEntry(file, 'word/styles.xml').matchAll(/<w:style\b([^>]*)>([\s\S]*?)<\/w:style>/g)) {
    if (!/w:type="character"/.test(m[1])) continue;
    const id = m[1].match(/w:styleId="([^"]+)"/)?.[1];
    if (!id) continue;
    const rPr = m[2].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? '';
    styles.set(id, { italic: italicFlag(rPr), basedOn: m[2].match(/<w:basedOn w:val="([^"]+)"/)?.[1] ?? null });
  }
  const resolve = (id, depth = 0) => {
    const style = styles.get(id);
    if (!style || depth > 10) return false;
    return style.italic ?? (style.basedOn ? resolve(style.basedOn, depth + 1) : false);
  };
  return new Set([...styles.keys()].filter((id) => resolve(id)));
}

function externalLinks(file) {
  const links = new Map();
  for (const m of tryZipEntry(file, 'word/_rels/document.xml.rels').matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    if (!/TargetMode="External"/.test(m[1]) || !/\/hyperlink"/.test(m[1])) continue;
    const id = m[1].match(/\bId="([^"]+)"/)?.[1];
    const target = decodeXmlEntities(m[1].match(/\bTarget="([^"]+)"/)?.[1] ?? '');
    if (id && /^https?:\/\//.test(target)) links.set(id, target);
  }
  return links;
}

function markupContext(file) {
  return { italicStyles: italicCharacterStyles(file), links: externalLinks(file) };
}

// Italic and hyperlink runs as *text* / [text](url). Whitespace stays outside the markers and
// a space between two italic runs joins them, so "will" + " " + "have" becomes *will have*.
function paragraphMarkup(xml, ctx) {
  const segments = [];
  const token = /<w:hyperlink\b([^>]*)>|<\/w:hyperlink>|<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
  let href = null;
  let m;
  while ((m = token.exec(xml)) !== null) {
    if (m[0].startsWith('<w:hyperlink')) {
      const id = m[1].match(/r:id="([^"]+)"/)?.[1];
      href = (id && ctx.links.get(id)) || null;
    } else if (m[0] === '</w:hyperlink>') {
      href = null;
    } else {
      const rPr = m[2].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? '';
      const style = rPr.match(/<w:rStyle w:val="([^"]+)"/)?.[1];
      const italic = italicFlag(rPr) ?? (style ? ctx.italicStyles.has(style) : false);
      const text = paragraphText(m[2]);
      if (text) segments.push({ text, italic, href });
    }
  }
  segments.forEach((seg, i) => {
    if (seg.text.trim()) return;
    const prev = segments[i - 1];
    const next = segments[i + 1];
    seg.italic = Boolean(prev?.italic && next?.italic);
  });
  const merged = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.italic === seg.italic && last.href === seg.href) last.text += seg.text;
    else merged.push({ ...seg });
  }
  const wrap = (text, open, close) =>
    text
      .split('\n')
      .map((line) => {
        const parts = line.match(/^(\s*)([\s\S]*?)(\s*)$/);
        return parts[2] ? `${parts[1]}${open}${parts[2]}${close}${parts[3]}` : line;
      })
      .join('\n');
  let out = '';
  for (let i = 0; i < merged.length; ) {
    const link = merged[i].href;
    let inner = '';
    while (i < merged.length && merged[i].href === link) {
      inner += merged[i].italic ? wrap(merged[i].text, '*', '*') : merged[i].text;
      i += 1;
    }
    out += link ? wrap(inner, '[', `](${link})`) : inner;
  }
  return out;
}

export function documentXml(file) {
  return readZipEntry(file, 'word/document.xml').toString('utf8');
}

function paragraphReader(file, options) {
  if (!options?.markup) return paragraphText;
  const ctx = markupContext(file);
  return (xml) => paragraphMarkup(xml, ctx);
}

export function docxParagraphs(file, options) {
  const read = paragraphReader(file, options);
  const xml = documentXml(file);
  const body = xml.slice(xml.indexOf('<w:body>'));
  return [...body.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g)].map((m) => read(m[0]));
}

export function docxTables(file, options) {
  const paragraphText = paragraphReader(file, options);
  const xml = documentXml(file);
  const tables = [];
  for (const tbl of xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)) {
    const rows = [];
    for (const tr of tbl[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)) {
      const cells = [];
      for (const tc of tr[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)) {
        const paras = [...tc[1].matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g)].map(
          (m) => paragraphText(m[0]),
        );
        cells.push(paras.join('\n').trim());
      }
      rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}
