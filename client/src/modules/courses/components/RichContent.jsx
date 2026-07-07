// TipTap's "empty" state is still markup (e.g. "<p></p>"), not an empty string —
// strip tags before deciding whether there's anything to show.
export function isEmptyHtml(html) {
  if (!html) return true;
  if (/<img[\s>]/i.test(html)) return false;
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
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
        .course-rich-content { font-size: 14px; color: #374151; line-height: 1.65; }
        .course-rich-content p { margin: 0 0 10px; }
        .course-rich-content p:last-child { margin-bottom: 0; }
        .course-rich-content ul, .course-rich-content ol { margin: 0 0 10px; padding-left: 22px; }
        .course-rich-content img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
        .course-rich-content strong { font-weight: 700; }
        .course-rich-content h2 { font-size: 1.3em; font-weight: 800; margin: 0 0 10px; color: #111827; }
        .course-rich-content h3 { font-size: 1.12em; font-weight: 700; margin: 0 0 8px; color: #111827; }
        .course-rich-content blockquote { margin: 0 0 10px; padding-left: 12px; border-left: 3px solid #a8d5ee; color: #6B7280; font-style: italic; }
        .course-rich-content code { background: #F3F4F6; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
        .course-rich-content pre { background: #111827; color: #F9FAFB; padding: 10px 12px; border-radius: 8px; overflow-x: auto; margin: 0 0 10px; }
        .course-rich-content pre code { background: none; padding: 0; color: inherit; }
        .course-rich-content a { color: #25476a; text-decoration: underline; }
        .course-rich-content hr { border: none; border-top: 1.5px solid #E5E7EB; margin: 14px 0; }
      `}</style>
      <div className="course-rich-content" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
