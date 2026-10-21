import { parseInline } from '../lib/inlineMarkup';

/** Renders feedback_items markup: *italic* as <em>, [text](url) as an external link. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((span, index) => {
        const content = span.italic ? <em>{span.text}</em> : span.text;
        if (!span.href) return <span key={index}>{content}</span>;
        return (
          <a
            key={index}
            href={span.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-edt-indigo underline decoration-edt-indigo/40 underline-offset-2 transition-colors hover:text-edt-forest hover:decoration-edt-neon"
          >
            {content}
          </a>
        );
      })}
    </>
  );
}
