import { useRef, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { uploadApi, IMAGE_TYPES, IMAGE_MAX_MB } from "../../../services/uploadApi";
import ImageCropDialog from "../../../components/ImageCropDialog";

// Multi-photo uploader: uploads each picked/dropped file immediately (reusing the same
// /api/uploads/image endpoint ImageUploadField uses) and keeps `value` as a plain array of
// resolved URLs, so the parent form already holds real URLs by Save. `max` caps how many photos
// the field holds; the drop zone hides once it's full.
//
// `cropAspect` (width ÷ height of the website's frame): each picked photo goes through a crop step
// (ImageCropDialog), one after another, before they're uploaded together. GIFs skip it.
// `sortable`: photos can be dragged (or moved with the arrows) into order. `coverLabel`: the first
// photo is marked with it ("Cover") — for galleries whose first photo is the one shown on cards.
export default function PhotoGalleryField({ value = [], onChange, label = "Photos", max, hint = "Upload images of the learning hub (JPG, PNG)", cropAspect, sortable = false, coverLabel }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Photos still waiting for their crop step, and the ones already decided (cropped or whole).
  const [cropQueue, setCropQueue] = useState([]);
  const decided = useRef([]);
  const fileInputRef = useRef(null);
  const remaining = max == null ? Infinity : Math.max(0, max - value.length);

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    const valid = [];
    for (const file of files) {
      // Size is checked by uploadApi.uploadImage, after a large photo has been resized.
      if (!IMAGE_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only PNG, JPEG, GIF, and WEBP images are allowed`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length > remaining) {
      toast.error(`You can add at most ${max} photo${max === 1 ? "" : "s"}`);
      valid.splice(remaining);
    }
    if (valid.length === 0) return;

    if (cropAspect) {
      decided.current = valid.filter((f) => f.type === "image/gif");
      const toCrop = valid.filter((f) => f.type !== "image/gif");
      if (toCrop.length > 0) {
        setCropQueue(toCrop);
        return;
      }
    }
    send(valid);
  };

  // One crop step done (file = the cropped or whole photo, or null when cancelled): the next one,
  // or once none are left, upload everything decided.
  const nextCrop = (file) => {
    if (file) decided.current.push(file);
    const rest = cropQueue.slice(1);
    setCropQueue(rest);
    if (rest.length === 0 && decided.current.length > 0) {
      const files = decided.current;
      decided.current = [];
      send(files);
    }
  };

  const send = async (valid) => {
    setUploading(true);
    try {
      // Each photo stands alone: one that is refused (too large, a failed upload) is reported
      // by name and the rest are still added.
      const results = await Promise.allSettled(valid.map((file) => uploadApi.uploadImage(file)));
      const urls = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
      results.filter((r) => r.status === "rejected").forEach((r) => toast.error(r.reason?.message || "A photo could not be uploaded"));
      if (urls.length > 0) onChange([...value, ...urls]);
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

  const movePhoto = (from, to) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {label && <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{label}</label>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple={remaining > 1}
        onChange={handleFilePicked}
        style={{ display: "none" }}
      />

      {remaining > 0 && <div
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
        <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>Up to {IMAGE_MAX_MB} MB each · large photos are resized for you{max != null ? ` · ${remaining} of ${max} left` : ""}</p>
      </div>}

      {value.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: "10px" }}>
          {value.map((url, i) => (
            <div
              key={url + i}
              draggable={sortable}
              onDragStart={sortable ? () => setDragIndex(i) : undefined}
              onDragOver={sortable ? (e) => e.preventDefault() : undefined}
              onDrop={sortable ? (e) => { e.preventDefault(); e.stopPropagation(); if (dragIndex != null) movePhoto(dragIndex, i); setDragIndex(null); } : undefined}
              onDragEnd={sortable ? () => setDragIndex(null) : undefined}
              style={{
                position: "relative", aspectRatio: String(cropAspect || 1), borderRadius: "10px", overflow: "hidden", background: "#F3F4F6",
                border: `1.5px solid ${coverLabel && i === 0 ? "#25476a" : "#E5E7EB"}`, cursor: sortable ? "grab" : "default", opacity: dragIndex === i ? 0.4 : 1,
              }}
            >
              <img src={url} alt={`Photo ${i + 1}`} draggable={false} style={{ width: "100%", height: "100%", objectFit: cropAspect ? "contain" : "cover" }} />
              {coverLabel && i === 0 && (
                <span style={{ position: "absolute", left: "4px", bottom: "4px", padding: "2px 7px", borderRadius: "999px", background: "#25476a", color: "#fff", fontSize: "10px", fontWeight: 700 }}>{coverLabel}</span>
              )}
              {sortable && value.length > 1 && (
                <span style={{ position: "absolute", right: "4px", bottom: "4px", display: "flex", gap: "3px" }}>
                  {[[-1, FiChevronLeft, "Move earlier"], [1, FiChevronRight, "Move later"]].map(([step, Icon, title]) => (
                    <button
                      key={step}
                      type="button"
                      title={title}
                      aria-label={title}
                      disabled={i + step < 0 || i + step >= value.length}
                      onClick={(e) => { e.stopPropagation(); movePhoto(i, i + step); }}
                      style={{ width: "20px", height: "20px", borderRadius: "50%", border: "none", backgroundColor: "rgba(17,24,39,0.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: i + step < 0 || i + step >= value.length ? 0.3 : 1 }}
                    >
                      <Icon size={12} />
                    </button>
                  ))}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); removePhoto(i); }}
                title="Remove"
                style={{ position: "absolute", top: "4px", right: "4px", width: "22px", height: "22px", borderRadius: "50%", border: "none", backgroundColor: "rgba(17,24,39,0.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                <FiX size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {hint && <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{hint}</p>}

      {cropQueue.length > 0 && (
        <ImageCropDialog
          key={cropQueue.length}
          file={cropQueue[0]}
          aspect={cropAspect}
          title={cropQueue.length > 1 ? `Crop photo (${cropQueue.length} to go)` : "Crop photo"}
          onDone={nextCrop}
          onCancel={() => nextCrop(null)}
        />
      )}
    </div>
  );
}
