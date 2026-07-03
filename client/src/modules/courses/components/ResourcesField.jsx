import { useRef, useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { uploadApi } from "../../../services/uploadApi";
import { Field } from "./formFields";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ResourcesUploader({ value, onChange }) {
  const resources = value || [];
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { url, filename, mimeType, size } = await uploadApi.uploadDocument(file);
      onChange([...resources, { id: crypto.randomUUID(), url, filename, mimeType, size }]);
    } catch (err) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const removeResource = (id) => {
    onChange(resources.filter((r) => r.id !== id));
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        onChange={handleFilePicked}
        style={{ display: "none" }}
      />

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
        {uploading ? "Uploading…" : "Attach document"}
      </button>

      {resources.length > 0 && (
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" }}>
          {resources.map((r) => (
            <li
              key={r.id}
              style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px",
                backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "8px",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#38aae1", flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, fontSize: "13px", color: "#25476a", fontWeight: "600", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {r.filename}
              </a>
              <span style={{ fontSize: "11px", color: "#9CA3AF", flexShrink: 0 }}>{formatSize(r.size)}</span>
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
