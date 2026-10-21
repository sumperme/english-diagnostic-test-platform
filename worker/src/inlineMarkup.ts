// Inline markup in Paper I feedback_items text (migration 0021): *italic* and [text](https://url).
// Only feedback copy is parsed; candidate-entered text never goes through here.

export type InlineSpan = { text: string; italic: boolean; href?: string };

const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*([^*\n]+)\*/g;

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const push = (value: string, italic: boolean, href?: string) => {
    if (value) spans.push(href ? { text: value, italic, href } : { text: value, italic });
  };
  let last = 0;
  for (const m of String(text ?? '').matchAll(TOKEN)) {
    const at = m.index ?? 0;
    push(text.slice(last, at), false);
    if (m[2]) for (const span of parseInline(m[1])) push(span.text, span.italic, m[2]);
    else push(m[3], true);
    last = at + m[0].length;
  }
  push(String(text ?? '').slice(last), false);
  return spans;
}

/** Plain text with the markup removed. */
export const stripInline = (text: string): string =>
  parseInline(text)
    .map((span) => span.text)
    .join('');

/** Spans back to markup; adjacent spans with the same formatting are merged. */
export function serializeInline(spans: InlineSpan[]): string {
  const merged: InlineSpan[] = [];
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && last.italic === span.italic && last.href === span.href) last.text += span.text;
    else if (span.text) merged.push({ ...span });
  }
  let out = '';
  for (let i = 0; i < merged.length; ) {
    const href = merged[i].href;
    let inner = '';
    while (i < merged.length && merged[i].href === href) {
      inner += merged[i].italic ? `*${merged[i].text}*` : merged[i].text;
      i += 1;
    }
    out += href ? `[${inner}](${href})` : inner;
  }
  return out;
}
