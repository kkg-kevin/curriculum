import { useRef, useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { uploadApi } from "../../../services/uploadApi";
import { Field } from "./formFields";

const AUDIENCE_LABELS = { teacher: "Teacher only", student: "Student only", both: "Teacher & Student" };

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#38aae1", flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#7C3AED", flexShrink: 0 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
}

// Accepted upload formats: documents, images, audio, video, and zip archives — matches
// server/src/modules/uploads/upload.middleware.js's ALLOWED_DOCUMENT_MIME_TYPES.
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp3,.wav,.ogg,.mp4,.webm,.mov,.zip";

function AddLinkForm({ onAdd, onCancel }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    const withProtocol = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
    onAdd({
      id: crypto.randomUUID(), type: "link", url: withProtocol,
      filename: label.trim() || withProtocol, mimeType: "", size: 0, audience: "both",
    });
    setLabel(""); setUrl("");
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: "8px", flexWrap: "wrap", padding: "10px 12px", backgroundColor: "#F0F7FF", border: "1.5px solid #C7D9F8", borderRadius: "10px", marginTop: "8px" }}>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Link label (optional)"
        style={{ flex: "1 1 140px", padding: "7px 10px", borderRadius: "7px", border: "1.5px solid #D1D5DB", fontSize: "12.5px", fontFamily: "Inter, sans-serif", outline: "none" }}
      />
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        style={{ flex: "2 1 200px", padding: "7px 10px", borderRadius: "7px", border: "1.5px solid #D1D5DB", fontSize: "12.5px", fontFamily: "Inter, sans-serif", outline: "none" }}
      />
      <button type="submit" disabled={!url.trim()} style={{ padding: "0 14px", borderRadius: "7px", border: "none", backgroundColor: "#25476a", color: "#fff", fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: url.trim() ? "pointer" : "not-allowed", opacity: url.trim() ? 1 : 0.5 }}>Add</button>
      <button type="button" onClick={onCancel} style={{ padding: "0 12px", borderRadius: "7px", border: "1.5px solid #E5E7EB", backgroundColor: "transparent", color: "#9CA3AF", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Cancel</button>
    </form>
  );
}

function ResourcesUploader({ value, onChange }) {
  const resources = value || [];
  const [uploading, setUploading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url, filename, mimeType, size } = await uploadApi.uploadDocument(file);
      onChange([...resources, { id: crypto.randomUUID(), type: "file", url, filename, mimeType, size, audience: "both" }]);
    } catch (err) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const addLink = (resource) => {
    onChange([...resources, resource]);
    setAddingLink(false);
  };

  const removeResource = (id) => {
    onChange(resources.filter((r) => r.id !== id));
  };

  const setAudience = (id, audience) => {
    onChange(resources.map((r) => (r.id === id ? { ...r, audience } : r)));
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFilePicked}
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "10px",
            border: "1.5px dashed #E5E7EB", backgroundColor: "#F9FAFB", color: "#25476a",
            fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.2 9.19a1.5 1.5 0 0 1-2.12-2.12l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {uploading ? "Uploading…" : "Attach file"}
        </button>
        <button
          type="button"
          onClick={() => setAddingLink((v) => !v)}
          style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", borderRadius: "10px",
            border: "1.5px dashed #E5E7EB", backgroundColor: "#F9FAFB", color: "#7C3AED",
            fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer",
          }}
        >
          <LinkIcon />
          Add link
        </button>
      </div>

      {addingLink && <AddLinkForm onAdd={addLink} onCancel={() => setAddingLink(false)} />}

      {resources.length > 0 && (
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" }}>
          {resources.map((r) => (
            <li
              key={r.id}
              style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px",
                backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "8px", flexWrap: "wrap",
              }}
            >
              {r.type === "link" ? <LinkIcon /> : <FileIcon />}
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, minWidth: "120px", fontSize: "13px", color: "#25476a", fontWeight: "600", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {r.filename}
              </a>
              {r.type !== "link" && <span style={{ fontSize: "11px", color: "#9CA3AF", flexShrink: 0 }}>{formatSize(r.size)}</span>}
              <select
                value={r.audience || "both"}
                onChange={(e) => setAudience(r.id, e.target.value)}
                title="Who is this resource for?"
                style={{
                  padding: "4px 8px", borderRadius: "7px", border: "1.5px solid #E5E7EB",
                  fontSize: "11px", fontWeight: "600", fontFamily: "Inter, sans-serif",
                  backgroundColor: "#fff", color: "#25476a", outline: "none", cursor: "pointer", flexShrink: 0,
                }}
              >
                {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeResource(r.id)}
                title="Remove"
                style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "16px", lineHeight: 1, padding: 0, flexShrink: 0 }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ResourcesField({ name, label, hint }) {
  const { control } = useFormContext();

  return (
    <Field label={label} hint={hint}>
      <Controller
        name={name}
        control={control}
        render={({ field }) => <ResourcesUploader value={field.value} onChange={field.onChange} />}
      />
    </Field>
  );
}
