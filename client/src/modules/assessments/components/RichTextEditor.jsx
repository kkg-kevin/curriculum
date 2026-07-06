import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import toast from "react-hot-toast";
import { uploadApi } from "../../../services/uploadApi";

function ToolbarButton({ onClick, disabled, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center",
        backgroundColor: "transparent", border: "1.5px solid transparent", borderRadius: "6px",
        color: "#374151", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
        fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", flexShrink: 0,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.backgroundColor = "#F3F4F6"; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, minHeight = 120, maxHeight = 260 }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const editor = useEditor({
    extensions: [StarterKit, Image],
    content: value || "",
    editorProps: {
      attributes: { class: "asm-rte-content" },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) editor.commands.setContent(next, false);
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
        .asm-rte-content { min-height: ${minHeight}px; max-height: ${maxHeight}px; overflow-y: auto; padding: 10px 12px; outline: none; font-size: 13.5px; color: #374151; line-height: 1.6; }
        .asm-rte-content p { margin: 0 0 10px; }
        .asm-rte-content p:last-child { margin-bottom: 0; }
        .asm-rte-content ul, .asm-rte-content ol { margin: 0 0 10px; padding-left: 22px; }
        .asm-rte-content img { max-width: 100%; border-radius: 8px; margin: 8px 0; display: block; }
        .asm-rte-content strong { font-weight: 700; }
        @keyframes asm-rte-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: "2px", padding: "6px 8px", borderBottom: "1px solid #E5E7EB", backgroundColor: "#fff", flexWrap: "wrap" }}>
        <ToolbarButton title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}><em>i</em></ToolbarButton>
        <ToolbarButton title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/><line x1="9" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </ToolbarButton>
        <ToolbarButton title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><text x="1" y="8" fontSize="7" fill="currentColor">1</text><text x="1" y="15" fontSize="7" fill="currentColor">2</text><text x="1" y="22" fontSize="7" fill="currentColor">3</text><line x1="9" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="9" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </ToolbarButton>
        <div style={{ width: "1px", height: "18px", backgroundColor: "#E5E7EB", margin: "0 4px" }} />
        <ToolbarButton title="Insert image" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? (
            <span style={{ width: "12px", height: "12px", border: "2px solid rgba(37,71,106,0.3)", borderTopColor: "#25476a", borderRadius: "50%", display: "inline-block", animation: "asm-rte-spin 0.7s linear infinite" }} />
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          )}
        </ToolbarButton>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleFilePicked} style={{ display: "none" }} />
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
