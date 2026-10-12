function formatMb(bytes) {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

// The bar under a file field while a file goes up — `progress` is hooks/useFileUpload.js's
// ({ name, loaded, total, percent }); renders nothing when it is null.
export default function UploadProgress({ progress, onCancel, style }) {
  if (!progress) return null;
  const { name, loaded, total, percent } = progress;

  return (
    <div
      role="status"
      style={{ padding: "9px 12px", backgroundColor: "#F0F7FF", border: "1px solid #C7D9F8", borderRadius: "9px", fontFamily: "Inter, sans-serif", ...style }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: "12.5px", fontWeight: "600", color: "#25476a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Uploading {name}
        </span>
        <span style={{ fontSize: "11.5px", color: "#6B7280", flexShrink: 0 }}>
          {percent}% · {formatMb(loaded)} of {formatMb(total)}
        </span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            style={{ background: "none", border: "none", padding: 0, fontSize: "12px", fontWeight: "600", color: "#DC2626", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
          >
            Cancel
          </button>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        style={{ height: "6px", backgroundColor: "#DCE9F7", borderRadius: "999px", overflow: "hidden" }}
      >
        <div style={{ width: `${percent}%`, height: "100%", backgroundColor: "#38aae1", borderRadius: "999px", transition: "width 0.3s ease" }} />
      </div>
    </div>
  );
}
