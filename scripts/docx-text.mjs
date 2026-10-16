// Minimal dependency-free .docx text reader.
//
// A .docx is a ZIP container; the body text lives in word/document.xml. We read the ZIP
// central directory by hand and inflate with node:zlib so the Paper I bank extractor needs
// no third-party packages.
//
// Exports:
//   readZipEntry(file, name) -> Buffer
//   docxParagraphs(file)     -> string[]  (one entry per <w:p>, tabs preserved as \t)
//   docxTables(file)         -> Array<string[][]>  (rows x cells per <w:tbl>)

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

export function documentXml(file) {
  return readZipEntry(file, 'word/document.xml').toString('utf8');
}

export function docxParagraphs(file) {
  const xml = documentXml(file);
  const body = xml.slice(xml.indexOf('<w:body>'));
  return [...body.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g)].map((m) =>
    paragraphText(m[0]),
  );
}

export function docxTables(file) {
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
