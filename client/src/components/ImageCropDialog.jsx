import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Crop an image to the shape the website shows it in, before it's uploaded: drag to position,
// slider to zoom, the frame is locked to `aspect` (width ÷ height). "Upload whole image" skips the
// crop — the website shows any shape whole anyway (on a blur of itself), so cropping is the
// better look, not a requirement. Warns when the picture is too small to look sharp.
//
// onDone(file) receives the cropped File (same name and type) or the original one when skipped;
// onCancel() abandons the upload. Pure canvas work — no library.

const FRAME_MAX_W = 560;
const MIN_GOOD_WIDTH = 800;
const OUTPUT_MAX_W = 2000;

const button = {
  padding: "9px 16px", borderRadius: "10px", fontSize: "13.5px", fontWeight: 600,
  fontFamily: "Inter, sans-serif", cursor: "pointer",
};

export default function ImageCropDialog({ file, aspect, title = "Crop image", onDone, onCancel }) {
  const [src, setSrc] = useState(null);
  const [natural, setNatural] = useState(null); // { w, h }
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);
  const imgRef = useRef(null);

  const frameW = Math.min(FRAME_MAX_W, (typeof window !== "undefined" ? window.innerWidth : FRAME_MAX_W) - 64);
  const frameH = Math.round(frameW / aspect);
  const baseScale = natural ? Math.max(frameW / natural.w, frameH / natural.h) : 1;
  const scale = baseScale * zoom;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const clamp = (x, y, s = scale) => ({
    x: Math.min(0, Math.max(frameW - natural.w * s, x)),
    y: Math.min(0, Math.max(frameH - natural.h * s, y)),
  });

  const onLoad = (e) => {
    const w = e.currentTarget.naturalWidth;
    const h = e.currentTarget.naturalHeight;
    setNatural({ w, h });
    const s = Math.max(frameW / w, frameH / h);
    setOffset({ x: (frameW - w * s) / 2, y: (frameH - h * s) / 2 });
  };

  // Zoom around the frame's centre, keeping the image covering the frame.
  const changeZoom = (next) => {
    const s1 = baseScale * next;
    const cx = (frameW / 2 - offset.x) / scale;
    const cy = (frameH / 2 - offset.y) / scale;
    setZoom(next);
    setOffset(clamp(frameW / 2 - cx * s1, frameH / 2 - cy * s1, s1));
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onPointerMove = (e) => {
    if (!drag.current || !natural) return;
    setOffset(clamp(e.clientX - drag.current.x, e.clientY - drag.current.y));
  };
  const onPointerUp = () => { drag.current = null; };

  const applyCrop = async () => {
    setBusy(true);
    try {
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = frameW / scale;
      const sh = frameH / scale;
      const outW = Math.round(Math.min(sw, OUTPUT_MAX_W));
      const outH = Math.round(outW / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      canvas.getContext("2d").drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, outW, outH);
      const type = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
      onDone(blob ? new File([blob], file.name, { type }) : file);
    } finally {
      setBusy(false);
    }
  };

  const small = natural && natural.w < MIN_GOOD_WIDTH;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 10002, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: "#fff", borderRadius: 16, padding: 24, width: frameW + 48, maxWidth: "calc(100vw - 16px)", fontFamily: "Inter, sans-serif", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "#111827" }}>{title}</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6B7280" }}>Drag to position it and zoom to frame it — this is the shape the website shows.</p>

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ position: "relative", width: frameW, height: frameH, overflow: "hidden", borderRadius: 10, background: "#111827", cursor: "grab", touchAction: "none", userSelect: "none" }}
        >
          {src && (
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={onLoad}
              style={{
                position: "absolute", left: 0, top: 0, maxWidth: "none",
                width: natural ? natural.w * scale : "auto",
                height: natural ? natural.h * scale : "auto",
                transform: `translate(${offset.x}px, ${offset.y}px)`,
                visibility: natural ? "visible" : "hidden",
              }}
            />
          )}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, fontSize: 12.5, color: "#374151", fontWeight: 600 }}>
          Zoom
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} style={{ flex: 1 }} disabled={!natural} />
        </label>

        {natural && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: small ? "#B45309" : "#9CA3AF", lineHeight: 1.5 }}>
            {small
              ? `This image is small (${natural.w} × ${natural.h} px) and may look blurry on large screens. A photo at least 1200 px wide works best.`
              : `${natural.w} × ${natural.h} px`}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 18 }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ ...button, background: "transparent", color: "#374151", border: "1.5px solid #E5E7EB" }}>
            Cancel
          </button>
          <button type="button" onClick={() => onDone(file)} disabled={busy} style={{ ...button, background: "#fff", color: "#25476a", border: "1.5px solid #a8d5ee" }}>
            Upload whole image
          </button>
          <button type="button" onClick={applyCrop} disabled={busy || !natural} style={{ ...button, background: "#25476a", color: "#fff", border: "none" }}>
            {busy ? "Cropping…" : "Crop & upload"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
