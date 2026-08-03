import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Avatar from "./Avatar";
import ImageUploadField from "../ImageUploadField";

// Wraps the shared Avatar with a small edit affordance and a click-open popover holding an
// ImageUploadField — used everywhere a person/entity can set their own profile photo (teacher,
// school, learner portals). The popover renders through a portal into document.body, positioned
// from the trigger's own getBoundingClientRect (same pattern as CurriculumCard's kebab menu) —
// rendering it inline instead gets clipped/invisible the moment it's placed inside any
// `overflow: hidden` ancestor, which every one of these hero sections is.
// Persistence is the caller's job: onChange(url) fires with the new photo URL (or null on
// remove) and the caller is expected to save it and pass the updated `photo` back down.
export default function AvatarPhotoEditor({ firstName, lastName, photo, onChange, size = 64, borderColor = "#fff" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  const openPopover = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.left });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (!triggerRef.current?.contains(e.target) && !popoverRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        aria-label="Edit profile photo"
        style={{ position: "relative", background: "none", border: "none", padding: 0, cursor: "pointer", borderRadius: "50%", display: "block" }}
      >
        <Avatar firstName={firstName} lastName={lastName} photo={photo} size={size} borderColor={borderColor} />
        <span
          style={{
            position: "absolute", bottom: 0, right: 0,
            width: Math.max(18, Math.round(size * 0.32)), height: Math.max(18, Math.round(size * 0.32)),
            borderRadius: "50%", backgroundColor: "#fff", border: "1.5px solid #E5E7EB",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        >
          <svg width="60%" height="60%" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="#25476a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="#25476a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>
      </button>

      {open && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            padding: "14px", width: "220px", fontFamily: "Inter, sans-serif",
          }}
        >
          <p style={{ margin: "0 0 10px", fontSize: "12px", fontWeight: "700", color: "#374151" }}>Profile Photo</p>
          <ImageUploadField value={photo || null} onChange={(url) => { onChange(url); setOpen(false); }} width="100%" height="130px" />
        </div>,
        document.body
      )}
    </div>
  );
}
