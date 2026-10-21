// Inline markup in Paper I feedback text (mirrors worker/src/inlineMarkup.ts):
// *italic* and [text](https://url). Only feedback copy is parsed, never candidate input.

export type InlineSpan = { text: string; italic: boolean; href?: string };

const TOKEN = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|\*([^*\n]+)\*/g;

export function parseInline(text: string): InlineSpan[] {
  const source = String(text ?? '');
  const spans: InlineSpan[] = [];
  const push = (value: string, italic: boolean, href?: string) => {
    if (value) spans.push(href ? { text: value, italic, href } : { text: value, italic });
  };
  let last = 0;
  for (const m of source.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    push(source.slice(last, at), false);
    if (m[2]) for (const span of parseInline(m[1])) push(span.text, span.italic, m[2]);
    else push(m[3], true);
    last = at + m[0].length;
  }
  push(source.slice(last), false);
  return spans;
}

/** Plain text with the markup removed (React keys, aria labels). */
export const stripInline = (text: string): string =>
  parseInline(text)
    .map((span) => span.text)
    .join('');
