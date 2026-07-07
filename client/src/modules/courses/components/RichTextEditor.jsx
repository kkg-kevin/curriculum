import { useEffect, useRef, useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import toast from "react-hot-toast";
import { uploadApi } from "../../../services/uploadApi";

const SIZES = {
  md: { min: 160, max: 280 },
  lg: { min: 280, max: 480 },
};

function ToolbarButton({ onClick, disabled, active, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: active ? "#e8f5fb" : "transparent", border: `1.5px solid ${active ? "#a8d5ee" : "transparent"}`,
        borderRadius: "6px", color: active ? "#25476a" : "#374151", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1, fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!disabled && !active) e.currentTarget.style.backgroundColor = "#F3F4F6"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div style={{ width: "1px", height: "18px", backgroundColor: "#E5E7EB", margin: "0 4px", flexShrink: 0 }} />;
}

function LinkPopover({ editor, onClose }) {
  const [url, setUrl] = useState(editor.getAttributes("link").href || "");
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);

  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20, display: "flex", gap: "6px", padding: "8px",
        backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px",
        boxShadow: "0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } if (e.key === "Escape") onClose(); }}
        placeholder="https://…"
        style={{ width: "220px", padding: "6px 10px", borderRadius: "7px", border: "1.5px solid #E5E7EB", fontSize: "12.5px", fontFamily: "Inter, sans-serif", outline: "none" }}
      />
      <button
        type="button"
        onClick={apply}
        style={{ padding: "0 12px", borderRadius: "7px", border: "none", backgroundColor: "#25476a", color: "#fff", fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
      >
        {url.trim() ? "Apply" : "Remove"}
      </button>
    </div>
  );
}

export function Editor({ value, onChange, size = "md" }) {
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const fileInputRef = useRef(null);
  // Tracks the HTML this editor itself last emitted via onUpdate, so the sync effect below
  // can tell "the value prop changed because we typed" apart from "the value prop changed
  // because something external reset it" (e.g. switching to a different item). Resetting the
  // doc from HTML on every keystroke wipes TipTap's stored marks — the pending bold/underline/etc
  // toggle for the next character — which is why "unbold" previously wouldn't stick.
  const lastEmitted = useRef(value || "");

  // Every instance shares the `.rte-content` class for its shape/typography rules (below), but
  // min/max-height must NOT live in that shared class — each instance injects its own <style>
  // block, and with identical selectors, the LAST one rendered on the page would win for every
  // editor's height (CSS cascade), not just its own. Setting it as an inline style instead scopes
  // it correctly per element.
  const dims = SIZES[size] || SIZES.md;

  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: value || "",
    editorProps: { attributes: { class: "rte-content", style: `min-height:${dims.min}px;max-height:${dims.max}px;` } },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmitted.current = html;
      onChange(html);
    },
  });

  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor?.isActive("bold") ?? false,
      italic: ctx.editor?.isActive("italic") ?? false,
      underline: ctx.editor?.isActive("underline") ?? false,
      strike: ctx.editor?.isActive("strike") ?? false,
      link: ctx.editor?.isActive("link") ?? false,
      bulletList: ctx.editor?.isActive("bulletList") ?? false,
      orderedList: ctx.editor?.isActive("orderedList") ?? false,
      blockquote: ctx.editor?.isActive("blockquote") ?? false,
      codeBlock: ctx.editor?.isActive("codeBlock") ?? false,
      heading2: ctx.editor?.isActive("heading", { level: 2 }) ?? false,
      heading3: ctx.editor?.isActive("heading", { level: 3 }) ?? false,
      canUndo: ctx.editor?.can().undo() ?? false,
      canRedo: ctx.editor?.can().redo() ?? false,
    }),
  });

  useEffect(() => {
    if (!editor) return;
    const next = value || "";
    if (next !== lastEmitted.current) {
      editor.commands.setContent(next, false);
      lastEmitted.current = next;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !editor) return;
    setUploading(true);
    try {
      const url = await uploadApi.uploadImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  if (!editor) return null;

  return (
    <div style={{ border: "1.5px solid #E5E7EB", borderRadius: "10px", overflow: "hidden", backgroundColor: "#F9FAFB" }}>
      <style>{`
        .rte-content { overflow-y: auto; padding: 10px 12px; outline: none; font-size: 14px; color: #374151; line-height: 1.65; }
        .rte-content p { margin: 0 0 10px; }
        .rte-content p:last-child { margin-bottom: 0; }
        .rte-content ul, .rte-content ol { margin: 0 0 10px; padding-left: 22px; }
        .rte-content img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
        .rte-content strong { font-weight: 700; }
        .rte-content h2 { font-size: 1.3em; font-weight: 800; margin: 4px 0 8px; color: #111827; }
        .rte-content h3 { font-size: 1.12em; font-weight: 700; margin: 4px 0 6px; color: #111827; }
        .rte-content blockquote { margin: 0 0 10px; padding-left: 12px; border-left: 3px solid #a8d5ee; color: #6B7280; font-style: italic; }
        .rte-content code { background: #F3F4F6; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
        .rte-content pre { background: #111827; color: #F9FAFB; padding: 10px 12px; border-radius: 8px; overflow-x: auto; margin: 0 0 10px; }
        .rte-content pre code { background: none; padding: 0; color: inherit; }
        .rte-content a { color: #25476a; text-decoration: underline; }
        .rte-content hr { border: none; border-top: 1.5px solid #E5E7EB; margin: 14px 0; }
      `}</style>

      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "2px", padding: "6px 8px", borderBottom: "1px solid #E5E7EB", backgroundColor: "#fff", flexWrap: "wrap" }}>
        <ToolbarButton title="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}>↶</ToolbarButton>
        <ToolbarButton title="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}>↷</ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton title="Heading 2" active={state.heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarButton>
        <ToolbarButton title="Heading 3" active={state.heading3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton title="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
        <ToolbarButton title="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><em>i</em></ToolbarButton>
        <ToolbarButton title="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><span style={{ textDecoration: "underline" }}>U</span></ToolbarButton>
        <ToolbarButton title="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><span style={{ textDecoration: "line-through" }}>S</span></ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton title="Bullet list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/><line x1="9" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Numbered list" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><text x="1" y="8" fontSize="7" fill="currentColor">1</text><text x="1" y="15" fontSize="7" fill="currentColor">2</text><text x="1" y="22" fontSize="7" fill="currentColor">3</text><line x1="9" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Quote" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2v2a2 2 0 0 1-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 7h-3a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2v2a2 2 0 0 1-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Code block" active={state.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{"</>"}</ToolbarButton>
        <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton title="Link" active={state.link} onClick={() => setLinkOpen((v) => !v)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </ToolbarButton>
        {linkOpen && <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} />}
        <ToolbarButton title="Insert image" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? (
            <span style={{ width: "12px", height: "12px", border: "2px solid rgba(37,71,106,0.3)", borderTopColor: "#25476a", borderRadius: "50%", display: "inline-block", animation: "rte-spin 0.7s linear infinite" }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
        </ToolbarButton>
        <style>{`@keyframes rte-spin { to { transform: rotate(360deg); } }`}</style>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleFilePicked} style={{ display: "none" }} />
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

export default function RichTextEditor({ name, label, required, hint, size }) {
  const { control, formState: { errors } } = useFormContext();
  const error = name.split(".").reduce((obj, k) => obj?.[k], errors)?.message;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "flex", alignItems: "center", gap: "3px" }}>
        {label}
        {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Editor value={field.value} onChange={field.onChange} size={size} />
        )}
      />
      {hint && !error && <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{hint}</p>}
      {error && <p style={{ margin: 0, fontSize: "12px", color: "#EF4444" }}>{error}</p>}
    </div>
  );
}
