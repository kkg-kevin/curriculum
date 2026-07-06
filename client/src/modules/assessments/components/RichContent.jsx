// TipTap's "empty" state is still markup (e.g. "<p></p>"), not an empty string —
// strip tags before deciding whether there's anything to show.
export function isEmptyHtml(html) {
  if (!html) return true;
  if (/<img[\s>]/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

// For compact, single-line previews (list rows, canvas item labels) where markup
// would just show up as literal tag text.
export function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Content here was authored by the same user through RichTextEditor (internal tool,
// no untrusted third-party input), so rendering raw HTML without a sanitizer is fine.
export default function RichContent({ html, emptyText }) {
  if (isEmptyHtml(html)) {
    return <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", fontStyle: "italic" }}>{emptyText}</p>;
  }
  return (
    <>
      <style>{`
        .asm-rich-content { font-size: 14px; color: #374151; line-height: 1.65; }
        .asm-rich-content p { margin: 0 0 10px; }
        .asm-rich-content p:last-child { margin-bottom: 0; }
        .asm-rich-content ul, .asm-rich-content ol { margin: 0 0 10px; padding-left: 22px; }
        .asm-rich-content img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
        .asm-rich-content strong { font-weight: 700; }
      `}</style>
      <div className="asm-rich-content" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
