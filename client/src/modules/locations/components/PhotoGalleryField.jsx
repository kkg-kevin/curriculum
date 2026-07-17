import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { uploadApi } from "../../../services/uploadApi";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

// Multi-photo uploader: uploads each picked/dropped file immediately (reusing the same
// /api/uploads/image endpoint ImageUploadField uses) and keeps `value` as a plain array of
// resolved URLs, so the parent form already holds real URLs by Save.
export default function PhotoGalleryField({ value = [], onChange, label = "Photos" }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const valid = [];
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only PNG, JPEG, GIF, and WEBP images are allowed`);
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name}: exceeds 5MB limit`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    setUploading(true);
    try {
      const urls = await Promise.all(valid.map((file) => uploadApi.uploadImage(file)));
      onChange([...value, ...urls]);
    } catch (err) {
      toast.error(err.message || "Failed to upload one or more photos");
    } finally {
      setUploading(false);
    }
  };

  const handleFilePicked = (e) => {
    uploadFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  };

  const removePhoto = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {label && <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{label}</label>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        onChange={handleFilePicked}
        style={{ display: "none" }}
      />

      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          padding: "28px 16px",
          borderRadius: "12px",
          border: `1.5px dashed ${dragOver ? "#38aae1" : "#a8d5ee"}`,
          backgroundColor: dragOver ? "#e8f5fb" : "#F8FBFE",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          cursor: uploading ? "not-allowed" : "pointer",
          transition: "all 0.15s",
        }}
      >
        <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#fff", border: "1px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3v14M5 10l7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 21h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827" }}>
          {uploading ? "Uploading…" : "Click to upload or drag and drop"}
        </p>
        <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Maximum file size: 5MB</p>
      </div>

      {value.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "10px" }}>
          {value.map((url, i) => (
            <div key={url + i} style={{ position: "relative", aspectRatio: "1", borderRadius: "10px", overflow: "hidden", border: "1.5px solid #E5E7EB" }}>
              <img src={url} alt={`Photo ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                title="Remove"
                style={{ position: "absolute", top: "4px", right: "4px", width: "22px", height: "22px", borderRadius: "50%", border: "none", backgroundColor: "rgba(17,24,39,0.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "13px", lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Upload images of the location (JPG, PNG)</p>
    </div>
  );
}
