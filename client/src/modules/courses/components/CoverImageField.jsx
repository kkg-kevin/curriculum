import { useRef, useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import toast from "react-hot-toast";
import { uploadApi } from "../../../services/uploadApi";

function Uploader({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadApi.uploadImage(file);
      onChange(url);
    } catch (err) {
      toast.error(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleFilePicked}
        style={{ display: "none" }}
      />

      {value ? (
        <div style={{ position: "relative", width: "220px" }}>
          <img
            src={value}
            alt="Cover"
            style={{ width: "100%", height: "140px", objectFit: "cover", borderRadius: "10px", border: "1.5px solid #E5E7EB" }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              {uploading ? "Uploading…" : "Change"}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              style={{ padding: "6px 12px", borderRadius: "8px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#EF4444", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          style={{
            width: "220px", height: "140px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px",
            borderRadius: "10px", border: "1.5px dashed #E5E7EB", backgroundColor: "#F9FAFB", color: "#6B7280",
            fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {uploading ? "Uploading…" : "Upload cover image"}
        </button>
      )}
    </div>
  );
}

export default function CoverImageField({ name, label }) {
  const { control } = useFormContext();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{label}</label>
      <Controller
        name={name}
        control={control}
        render={({ field }) => <Uploader value={field.value} onChange={field.onChange} />}
      />
    </div>
  );
}
