import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiMinus, FiPlus, FiRotateCcw, FiRotateCw, FiRefreshCw } from "react-icons/fi";

// Adjust an image before it's uploaded: drag to position, zoom (slider, buttons or mouse wheel),
// rotate a quarter turn either way, flip, and brighten or add contrast. Pure canvas work — no
// library.
//
//   variant "website" (default) — the frame is locked to `aspect` (width ÷ height), the shape the
//            website shows the image in. "Upload whole image" skips the crop — the website shows
//            any shape whole anyway (on a blur of itself), so cropping is the better look, not a
//            requirement. Warns when the picture is too small to look sharp.
//   variant "avatar" — a profile photo: a square crop shown through a round mask, the way
//            avatars appear everywhere in the app.
//
// onDone(file) receives the adjusted File (same name and type) or the original one when skipped;
// onCancel() abandons it.

const FRAME_MAX_W = 560;
const AVATAR_FRAME = 360;
const MIN_GOOD_WIDTH = 800;
const MIN_GOOD_AVATAR = 300;
const OUTPUT_MAX_W = 2000;
const AVATAR_OUTPUT = 800;
const ZOOM_MAX = 4;

const button = {
  padding: "9px 16px", borderRadius: "10px", fontSize: "13.5px", fontWeight: 600,
  fontFamily: "Inter, sans-serif", cursor: "pointer",
};
const tool = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 8,
  border: "1.5px solid #E5E7EB", background: "#fff", color: "#374151", fontSize: 12.5, fontWeight: 600,
  fontFamily: "Inter, sans-serif", cursor: "pointer",
};

function Slider({ label, value, min, max, step, onChange, disabled, format }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "84px 1fr 44px", alignItems: "center", gap: 10, fontSize: 12.5, color: "#374151", fontWeight: 600 }}>
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled} />
      <span style={{ fontSize: 11.5, color: "#6B7280", textAlign: "right", fontWeight: 500 }}>{format(value)}</span>
    </label>
  );
}

export default function ImageCropDialog({ file, aspect = 1, variant = "website", title, onDone, onCancel }) {
  const avatar = variant === "avatar";
  const frameAspect = avatar ? 1 : aspect;
  const viewport = typeof window !== "undefined" ? window.innerWidth : FRAME_MAX_W;
  const frameW = Math.min(avatar ? AVATAR_FRAME : FRAME_MAX_W, viewport - 64);
  const frameH = Math.round(frameW / frameAspect);

  const [original, setOriginal] = useState(null); // the picked image, as loaded
  const [src, setSrc] = useState(null); // the working image: the original turned/flipped
  const [natural, setNatural] = useState(null); // { w, h } of the working image
  const [rotation, setRotation] = useState(0); // quarter turns, 0–3
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [busy, setBusy] = useState(false);
  const drag = useRef(null);
  const imgRef = useRef(null);
  const frameRef = useRef(null);

  const baseScale = natural ? Math.max(frameW / natural.w, frameH / natural.h) : 1;
  const scale = baseScale * zoom;
  const filter = `brightness(${brightness}%) contrast(${contrast}%)`;

  // Every temporary image address made here, released when the dialog closes — not sooner, so
  // the picture on screen never points at one that's gone.
  const objectUrls = useRef([]);
  const makeUrl = (blob) => {
    const url = URL.createObjectURL(blob);
    objectUrls.current.push(url);
    return url;
  };
  useEffect(() => () => { objectUrls.current.forEach((url) => URL.revokeObjectURL(url)); objectUrls.current = []; }, []);

  // Load the picked file once.
  useEffect(() => {
    let live = true;
    const img = new Image();
    img.onload = () => { if (live) setOriginal(img); };
    img.src = makeUrl(file);
    return () => { live = false; };
  }, [file]);

  // The working image: the original with the current turn and flip baked in, so positioning and
  // cropping below only ever deal with an upright picture.
  useEffect(() => {
    if (!original) return undefined;
    if (rotation === 0 && !flipped) {
      setSrc(original.src);
      return undefined;
    }
    const sideways = rotation % 2 === 1;
    const canvas = document.createElement("canvas");
    canvas.width = sideways ? original.naturalHeight : original.naturalWidth;
    canvas.height = sideways ? original.naturalWidth : original.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 2);
    if (flipped) ctx.scale(-1, 1);
    ctx.drawImage(original, -original.naturalWidth / 2, -original.naturalHeight / 2);
    let cancelled = false;
    canvas.toBlob((blob) => {
      if (!cancelled && blob) setSrc(makeUrl(blob));
    }, "image/png");
    return () => { cancelled = true; };
  }, [original, rotation, flipped]);

  const clamp = useCallback((x, y, s) => ({
    x: Math.min(0, Math.max(frameW - natural.w * s, x)),
    y: Math.min(0, Math.max(frameH - natural.h * s, y)),
  }), [natural, frameW, frameH]);

  // A new working image (first load, a turn or a flip) starts centred at the current zoom.
  const onLoad = (e) => {
    const w = e.currentTarget.naturalWidth;
    const h = e.currentTarget.naturalHeight;
    setNatural({ w, h });
    const s = Math.max(frameW / w, frameH / h) * zoom;
    setOffset({ x: (frameW - w * s) / 2, y: (frameH - h * s) / 2 });
  };

  // Zoom around the frame's centre, keeping the image covering the frame.
  const changeZoom = useCallback((next) => {
    if (!natural) return;
    const z = Math.min(ZOOM_MAX, Math.max(1, next));
    const s1 = baseScale * z;
    setOffset((o) => {
      const cx = (frameW / 2 - o.x) / scale;
      const cy = (frameH / 2 - o.y) / scale;
      return clamp(frameW / 2 - cx * s1, frameH / 2 - cy * s1, s1);
    });
    setZoom(z);
  }, [natural, baseScale, scale, frameW, frameH, clamp]);

  // Mouse wheel / trackpad zoom over the picture (a non-passive listener, so the page doesn't scroll).
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      changeZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [changeZoom, zoom]);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const onPointerMove = (e) => {
    if (!drag.current || !natural) return;
    setOffset(clamp(e.clientX - drag.current.x, e.clientY - drag.current.y, scale));
  };
  const onPointerUp = () => { drag.current = null; };

  const reset = () => {
    setRotation(0);
    setFlipped(false);
    setZoom(1);
    setBrightness(100);
    setContrast(100);
    if (natural && rotation === 0 && !flipped) {
      const s = baseScale;
      setOffset({ x: (frameW - natural.w * s) / 2, y: (frameH - natural.h * s) / 2 });
    }
  };

  const applyCrop = async () => {
    setBusy(true);
    try {
      const sx = -offset.x / scale;
      const sy = -offset.y / scale;
      const sw = frameW / scale;
      const sh = frameH / scale;
      const outW = Math.round(Math.min(sw, avatar ? AVATAR_OUTPUT : OUTPUT_MAX_W));
      const outH = Math.round(outW / frameAspect);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (brightness !== 100 || contrast !== 100) ctx.filter = filter;
      ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, outW, outH);
      const type = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.9));
      onDone(blob ? new File([blob], file.name, { type }) : file);
    } finally {
      setBusy(false);
    }
  };

  const small = natural && Math.min(natural.w, avatar ? natural.h : natural.w) < (avatar ? MIN_GOOD_AVATAR : MIN_GOOD_WIDTH);
  const edited = rotation !== 0 || flipped || zoom !== 1 || brightness !== 100 || contrast !== 100;
  const heading = title || (avatar ? "Adjust your photo" : "Crop image");

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 10002, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.5)", padding: 8 }}>
      <div role="dialog" aria-modal="true" aria-label={heading} style={{ background: "#fff", borderRadius: 16, padding: 24, width: Math.max(frameW, 440) + 48, maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100vh - 16px)", overflowY: "auto", boxSizing: "border-box", fontFamily: "Inter, sans-serif", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 700, color: "#111827" }}>{heading}</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6B7280" }}>
          {avatar ? "Drag to position, zoom to resize. The circle is how it shows across the app." : "Drag to position it and zoom to frame it — this is the shape the website shows."}
        </p>

        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ position: "relative", width: frameW, height: frameH, margin: avatar ? "0 auto" : 0, overflow: "hidden", borderRadius: 10, background: "#111827", cursor: "grab", touchAction: "none", userSelect: "none" }}
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
                filter,
                visibility: natural ? "visible" : "hidden",
              }}
            />
          )}
          {avatar && (
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, borderRadius: "50%", boxShadow: "0 0 0 9999px rgba(17,24,39,0.6)", border: "2px solid rgba(255,255,255,0.85)", pointerEvents: "none" }} />
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <button type="button" style={tool} onClick={() => setRotation((r) => (r + 3) % 4)} disabled={!natural} aria-label="Rotate left"><FiRotateCcw size={14} /> Rotate left</button>
          <button type="button" style={tool} onClick={() => setRotation((r) => (r + 1) % 4)} disabled={!natural} aria-label="Rotate right"><FiRotateCw size={14} /> Rotate right</button>
          <button type="button" style={{ ...tool, ...(flipped ? { borderColor: "#25476a", color: "#25476a" } : {}) }} onClick={() => setFlipped((f) => !f)} disabled={!natural} aria-pressed={flipped}>⇋ Flip</button>
          <button type="button" style={{ ...tool, marginLeft: "auto" }} onClick={reset} disabled={!edited}><FiRefreshCw size={13} /> Reset</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "84px 28px 1fr 28px 44px", alignItems: "center", gap: 6, fontSize: 12.5, color: "#374151", fontWeight: 600 }}>
            Zoom
            <button type="button" style={{ ...tool, padding: 5, justifyContent: "center" }} onClick={() => changeZoom(zoom - 0.25)} disabled={!natural || zoom <= 1} aria-label="Zoom out"><FiMinus size={13} /></button>
            <input type="range" min="1" max={ZOOM_MAX} step="0.01" value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} disabled={!natural} aria-label="Zoom" />
            <button type="button" style={{ ...tool, padding: 5, justifyContent: "center" }} onClick={() => changeZoom(zoom + 0.25)} disabled={!natural || zoom >= ZOOM_MAX} aria-label="Zoom in"><FiPlus size={13} /></button>
            <span style={{ fontSize: 11.5, color: "#6B7280", textAlign: "right", fontWeight: 500 }}>{Math.round(zoom * 100)}%</span>
          </div>
          <Slider label="Brightness" value={brightness} min={50} max={150} step={1} onChange={setBrightness} disabled={!natural} format={(v) => `${v}%`} />
          <Slider label="Contrast" value={contrast} min={50} max={150} step={1} onChange={setContrast} disabled={!natural} format={(v) => `${v}%`} />
        </div>

        {natural && (
          <p style={{ margin: "10px 0 0", fontSize: 12, color: small ? "#B45309" : "#9CA3AF", lineHeight: 1.5 }}>
            {small
              ? `This image is small (${natural.w} × ${natural.h} px) and may look blurry${avatar ? "" : " on large screens"}. ${avatar ? "A photo at least 400 px across works best." : "A photo at least 1200 px wide works best."}`
              : `${natural.w} × ${natural.h} px`}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 18 }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ ...button, background: "transparent", color: "#374151", border: "1.5px solid #E5E7EB" }}>
            Cancel
          </button>
          {!avatar && (
            <button type="button" onClick={() => onDone(file)} disabled={busy} style={{ ...button, background: "#fff", color: "#25476a", border: "1.5px solid #a8d5ee" }}>
              Upload whole image
            </button>
          )}
          <button type="button" onClick={applyCrop} disabled={busy || !natural} style={{ ...button, background: "#25476a", color: "#fff", border: "none" }}>
            {busy ? "Saving…" : avatar ? "Save photo" : "Crop & upload"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
