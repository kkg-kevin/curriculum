import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { uploadApi, IMAGE_UPLOAD_HINT } from "../services/uploadApi";
import ImageCropDialog from "./ImageCropDialog";

// Immediate-upload image picker: uploads on file select and hands the resolved
// URL back via onChange, so the parent form already holds a real URL by Save.
//
// Optional, for images the public website shows (a bootcamp's cover, a hub's logo):
//   cropAspect — width ÷ height of the website's frame; a crop step (ImageCropDialog) opens
//                before the upload. GIFs (often animated) skip it.
//   guide      — what to upload, shown above the usual size/type hint.
// For a person's profile photo:
//   avatar     — the photo editor opens in its round "avatar" mode (position, zoom, rotate, flip,
//                brightness, contrast), the preview is round, and "Adjust" reopens the editor on
//                the photo already uploaded.
export default function ImageUploadField({ value, onChange, label, width = "220px", height = "140px", cropAspect, guide, avatar = false }) {
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const fileInputRef = useRef(null);
  const editable = avatar || Boolean(cropAspect);

  // "Adjust": the photo already uploaded, back into the editor.
  const adjustCurrent = async () => {
    setLoadingCurrent(true);
    try {
      const res = await fetch(value, { credentials: "include" });
      if (!res.ok) throw new Error("not found");
      const blob = await res.blob();
      const name = decodeURIComponent(String(value).split("/").pop()?.split("?")[0] || "photo.jpg");
      setPending(new File([blob], name, { type: blob.type || "image/jpeg" }));
    } catch {
      toast.error("This photo can't be adjusted — upload it again to edit it.");
    } finally {
      setLoadingCurrent(false);
    }
  };

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (editable && file.type !== "image/gif") {
      setPending(file);
      return;
    }
    upload(file);
  };

  const upload = async (file) => {
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
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      {label && <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{label}</label>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleFilePicked}
        style={{ display: "none" }}
      />

      {value ? (
        <div style={{ position: "relative", width }}>
          <img
            src={value}
            alt={label || "Uploaded"}
            style={avatar ? {
              width: height, maxWidth: "100%", height, objectFit: "cover", borderRadius: "50%", border: "1.5px solid #E5E7EB", display: "block", margin: "0 auto",
            } : {
              width: "100%", height, objectFit: cropAspect ? "contain" : "cover", borderRadius: "10px", border: "1.5px solid #E5E7EB",
              background: cropAspect ? "#F3F4F6" : undefined,
            }}
          />
          <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap", justifyContent: avatar ? "center" : "flex-start" }}>
            {avatar && (
              <button
                type="button"
                onClick={adjustCurrent}
                disabled={uploading || loadingCurrent}
                style={{ padding: "6px 12px", borderRadius: "8px", border: "1.5px solid #E5E7EB", backgroundColor: "#fff", color: "#25476a", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                {loadingCurrent ? "Opening…" : "Adjust"}
              </button>
            )}
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
            width: avatar ? height : width, maxWidth: "100%", height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px",
            borderRadius: avatar ? "50%" : "10px", border: "1.5px dashed #E5E7EB", margin: avatar ? "0 auto" : 0, backgroundColor: "#F9FAFB", color: "#6B7280",
            fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: uploading ? "not-allowed" : "pointer",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="2"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {uploading ? "Uploading…" : avatar ? "Upload photo" : "Upload image"}
        </button>
      )}

      {guide && <p style={{ margin: 0, maxWidth: width, fontSize: "11.5px", lineHeight: 1.4, color: "#4B5563" }}>{guide}</p>}
      {/* The same rules on every image field — see uploadApi.uploadImage. */}
      <p style={{ margin: 0, maxWidth: width, fontSize: "11px", lineHeight: 1.4, color: "#9CA3AF" }}>{IMAGE_UPLOAD_HINT}</p>

      {pending && (
        <ImageCropDialog
          file={pending}
          aspect={cropAspect || 1}
          variant={avatar ? "avatar" : "website"}
          title={avatar ? undefined : label ? `Crop: ${label}` : "Crop image"}
          onDone={(file) => { setPending(null); upload(file); }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
