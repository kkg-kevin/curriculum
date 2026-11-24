import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  FiSmile, FiStar, FiZap, FiCpu, FiCode, FiNavigation, FiSun, FiMoon, FiMusic, FiFeather, FiGlobe, FiBox, FiCompass, FiAnchor,
  FiHeart, FiAperture, FiUser, FiShield, FiUsers, FiPlay, FiEdit3, FiLifeBuoy, FiTool, FiFlag, FiAward, FiLink, FiPaperclip,
  FiImage, FiX, FiFileText, FiDownload, FiAlertTriangle,
} from "react-icons/fi";
import { BRAND } from "../../../theme/brand";
import { connectApi, mediaUrl } from "../services/connectApi";

// Digifunzi Connect's look: the system colours (navy, gold, sky), Nunito like the learner profile,
// rounded cards, icons (no emojis). Everything Connect's pages share lives here.

export const C = { ...BRAND };
export const FONT = "Nunito, Inter, sans-serif";

const ICONS = {
  smile: FiSmile, star: FiStar, zap: FiZap, cpu: FiCpu, code: FiCode, rocket: FiNavigation, sun: FiSun, moon: FiMoon, music: FiMusic,
  feather: FiFeather, globe: FiGlobe, box: FiBox, compass: FiCompass, anchor: FiAnchor, heart: FiHeart, aperture: FiAperture,
  user: FiUser, shield: FiShield, users: FiUsers, play: FiPlay, "edit-3": FiEdit3, "life-buoy": FiLifeBuoy, tool: FiTool,
  flag: FiFlag, award: FiAward, link: FiLink,
};
export const IconFor = ({ name, size = 18, ...rest }) => {
  const I = ICONS[name] || FiStar;
  return <I size={size} {...rest} />;
};

export const errorOf = (err, fallback = "Something went wrong") => err?.message || fallback;

export function timeAgo(date) {
  if (!date) return "";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: new Date(date).getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

// ── People ───────────────────────────────────────────────────────────────────────────────────────
export function MemberAvatar({ card, size = 40 }) {
  const a = card?.avatar || {};
  if (a.photoUrl) {
    return <img src={mediaUrl(a.photoUrl)} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `2px solid #fff` }} />;
  }
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: "50%", background: a.color || C.navy, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <IconFor name={a.icon} size={Math.round(size * 0.5)} />
    </span>
  );
}

export function Name({ card, onClick }) {
  const staff = card?.kind === "staff";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <button type="button" onClick={onClick} disabled={!onClick} style={{ border: 0, background: "none", padding: 0, font: "inherit", fontWeight: 800, color: C.ink, cursor: onClick ? "pointer" : "default", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {card?.displayName || "Someone"}
      </button>
      {staff && <span style={pill("strong")}><FiShield size={11} /> {card.role || "Teacher"}</span>}
    </span>
  );
}

// ── Building blocks ──────────────────────────────────────────────────────────────────────────────
const TONES = {
  strong: { bg: C.navyTint, color: C.navy, border: C.navyBorder },
  good: { bg: C.skyTint, color: C.navy, border: C.skyBorder },
  info: { bg: C.skyTint, color: C.skyText, border: C.skyBorder },
  waiting: { bg: C.goldTint, color: C.goldText, border: C.goldBorder },
  neutral: { bg: C.greyTint, color: C.greyText, border: C.border },
  danger: { bg: C.dangerTint, color: C.danger, border: C.dangerBorder },
};
export const pill = (tone = "neutral", extra = {}) => {
  const t = TONES[tone] || TONES.neutral;
  return { display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999, background: t.bg, color: t.color, border: `1px solid ${t.border}`, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap", ...extra };
};

export const card = { background: "#fff", borderRadius: 18, border: `1.5px solid ${C.border}`, padding: 18, minWidth: 0 };

export function btn(kind = "primary", extra = {}) {
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 16px", borderRadius: 12, fontWeight: 800, fontSize: 14, fontFamily: FONT, cursor: "pointer", border: "1.5px solid transparent", whiteSpace: "nowrap" };
  const kinds = {
    primary: { background: C.navy, color: "#fff" },
    gold: { background: C.gold, color: C.navyDeep },
    ghost: { background: "#fff", color: C.navy, borderColor: C.border },
    soft: { background: C.skyTint, color: C.navy, borderColor: C.skyBorder },
    danger: { background: "#fff", color: C.danger, borderColor: C.dangerBorder },
    link: { background: "none", color: C.mid, padding: "4px 6px" },
  };
  return { ...base, ...kinds[kind], ...extra };
}

export function Empty({ icon = "compass", title, children, action }) {
  return (
    <div style={{ ...card, textAlign: "center", padding: "36px 20px", fontFamily: FONT }}>
      <span style={{ width: 56, height: 56, borderRadius: 18, background: C.skyTint, color: C.mid, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><IconFor name={icon} size={26} /></span>
      <h3 style={{ margin: "4px 0 6px", color: C.ink, fontSize: 18 }}>{title}</h3>
      {children && <p style={{ margin: "0 auto 14px", color: C.muted, maxWidth: 460, lineHeight: 1.5 }}>{children}</p>}
      {action}
    </div>
  );
}

export function Loading({ rows = 3 }) {
  return (
    <div aria-busy="true" style={{ display: "grid", gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ ...card, height: 92, background: `linear-gradient(90deg, ${C.line} 0%, #fff 50%, ${C.line} 100%)`, backgroundSize: "200% 100%", animation: "connectShimmer 1.4s infinite" }} />
      ))}
      <style>{"@keyframes connectShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}"}</style>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div role="alert" style={{ ...card, borderColor: C.dangerBorder, background: C.dangerTint, color: C.danger, display: "flex", gap: 10, alignItems: "center", fontFamily: FONT }}>
      <FiAlertTriangle /> <span style={{ flex: 1 }}>{errorOf(error)}</span>
      {onRetry && <button type="button" style={btn("ghost")} onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "4px 0 10px", flexWrap: "wrap" }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: C.ink, fontFamily: FONT }}>{children}</h2>
      {right}
    </div>
  );
}

export function Chips({ options, value, onChange, all = "All" }) {
  return (
    <ScrollRow activeKey={value} role="tablist">
      {all && <Chip active={!value} onClick={() => onChange("")}>{all}</Chip>}
      {options.map((o) => <Chip key={o.key} active={value === o.key} onClick={() => onChange(o.key)}>{o.label}</Chip>)}
    </ScrollRow>
  );
}

// A row of tabs or chips that scrolls sideways on small screens (fading at the edge so it's clear
// there is more), and brings the chosen one into view whenever the choice changes.
export function ScrollRow({ children, activeKey, style, as: Tag = "div", ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const row = ref.current;
    const el = row?.querySelector('[aria-selected="true"], [aria-current="page"]');
    if (!row || !el || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2), behavior: "smooth" });
  }, [activeKey]);
  return (
    <Tag ref={ref} className="cx-row" {...rest} style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, position: "relative", ...style }}>
      {children}
    </Tag>
  );
}

// Connect's own small style sheet, mounted by each Connect page (learner, parent, admin) inside a
// root with className "cx":
//   - items of an inline grid may shrink below their content, so a long word or a row of chips never
//     pushes a page wider than the phone (a plain grid column grows to its widest content);
//   - text boxes are 16px on phones, so iPhones don't zoom in when one is tapped;
//   - checkboxes and radios big enough to tap, a clear focus ring for keyboards;
//   - sideways rows fade at the right edge on small screens, with their scrollbars hidden.
export function ConnectStyles() {
  return (
    <style>{`
      .cx [style*="display: grid"] > * { min-width: 0; }
      .cx img { max-width: 100%; }
      .cx input[type="checkbox"], .cx input[type="radio"] { width: 20px; height: 20px; accent-color: #25476a; flex-shrink: 0; cursor: pointer; }
      .cx button, .cx a { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      .cx button:focus-visible, .cx a:focus-visible, .cx input:focus-visible, .cx textarea:focus-visible, .cx select:focus-visible { outline: 3px solid #38aae1; outline-offset: 2px; }
      .cx-row { scrollbar-width: none; }
      .cx-row::-webkit-scrollbar { display: none; }
      @media (max-width: 760px) {
        .cx input:not([type="checkbox"]):not([type="radio"]), .cx textarea, .cx select { font-size: 16px !important; }
        .cx-row { padding-right: 24px; -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent); }
        .cx-hide-narrow { display: none !important; }
      }
    `}</style>
  );
}
export function Chip({ active, onClick, children }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}
      style={{ padding: "7px 14px", minHeight: 36, borderRadius: 999, border: `1.5px solid ${active ? C.navy : C.border}`, background: active ? C.navy : "#fff", color: active ? "#fff" : C.navy, fontWeight: 800, fontSize: 13, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </button>
  );
}

export const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${C.border}`, fontSize: 14.5, fontFamily: FONT, color: C.ink, background: "#fff" };
export const label = { display: "block", fontSize: 13, fontWeight: 800, color: C.inkSoft, margin: "10px 0 5px", fontFamily: FONT };

// ── A pop-up box ─────────────────────────────────────────────────────────────────────────────────
export function Modal({ open, title, onClose, children, width = 560, footer }) {
  // A bottom sheet on phones, a box in the middle elsewhere.
  const narrow = useNarrow(640);
  useEffect(() => {
    if (!open) return undefined;
    // The page behind doesn't scroll while the box is open.
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="cx" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(15,23,42,0.5)", zIndex: 1500, display: "flex", alignItems: narrow ? "flex-end" : "center", justifyContent: "center", padding: narrow ? 0 : 16 }}>
      <ConnectStyles />
      <div role="dialog" aria-modal="true" aria-label={title} style={{ background: "#fff", borderRadius: narrow ? "20px 20px 0 0" : 20, width: "100%", maxWidth: narrow ? "100%" : width, maxHeight: narrow ? "92dvh" : "90vh", display: "flex", flexDirection: "column", fontFamily: FONT, boxShadow: "0 24px 70px rgba(0,0,0,0.3)", paddingBottom: narrow ? "env(safe-area-inset-bottom)" : 0 }}>
        {narrow && <span aria-hidden style={{ width: 40, height: 4, borderRadius: 4, background: C.border, margin: "8px auto 0", flexShrink: 0 }} />}
        <div style={{ display: "flex", alignItems: "center", padding: narrow ? "8px 12px 8px 16px" : "14px 14px 14px 20px", borderBottom: `1px solid ${C.line}` }}>
          <h3 style={{ margin: 0, fontSize: 18, flex: 1, color: C.ink }}>{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "none", cursor: "pointer", color: C.muted, width: 40, height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><FiX size={22} /></button>
        </div>
        <div style={{ padding: narrow ? 16 : 20, overflowY: "auto", overscrollBehavior: "contain" }}>{children}</div>
        {footer && <div style={{ padding: narrow ? "10px 16px" : "12px 20px", borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ── Files ────────────────────────────────────────────────────────────────────────────────────────
export const FILE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,application/pdf,.sb3,.sb2,.pbx,.py,.ino,.txt,.js,.html,.css,.json,.c,.cpp,.h,.java,.md,.csv";

export function FilePickerButton({ onUploaded, max = 6, current = 0, imagesOnly = false, label: text = "Add picture or file", disabled }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, Math.max(0, max - current));
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) onUploaded(await connectApi.upload(f));
    } catch (err) {
      toast.error(errorOf(err, "That file couldn't be added"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <input ref={ref} type="file" hidden multiple accept={imagesOnly ? "image/*" : FILE_ACCEPT} onChange={pick} />
      <button type="button" disabled={disabled || busy || current >= max} onClick={() => ref.current?.click()} style={btn("ghost", { opacity: disabled || current >= max ? 0.5 : 1 })}>
        {imagesOnly ? <FiImage /> : <FiPaperclip />} {busy ? "Adding…" : text}
      </button>
    </>
  );
}

export function FileGallery({ files = [], onRemove, compact = false }) {
  const [zoom, setZoom] = useState(null);
  if (!files.length) return null;
  const images = files.filter((f) => f.kind === "image");
  const others = files.filter((f) => f.kind !== "image");
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(images.length, compact ? 4 : 3)}, minmax(0, 1fr))`, gap: 6 }}>
          {images.map((f) => (
            <div key={f.id} style={{ position: "relative" }}>
              <button type="button" onClick={() => setZoom(f)} style={{ border: 0, padding: 0, background: "none", cursor: "zoom-in", width: "100%" }}>
                <img src={mediaUrl(f.url)} alt={f.filename} loading="lazy" style={{ width: "100%", aspectRatio: images.length === 1 && !compact ? "16 / 10" : "1", objectFit: "cover", borderRadius: 12, display: "block", background: C.line }} />
              </button>
              {onRemove && <RemoveDot onClick={() => onRemove(f.id)} />}
            </div>
          ))}
        </div>
      )}
      {others.map((f) => (
        <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.canvas }}>
          <FiFileText color={C.mid} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700, fontSize: 13.5 }}>{f.filename}</span>
          <a href={mediaUrl(f.url)} target="_blank" rel="noreferrer" style={btn("link")} aria-label={`Open ${f.filename}`}><FiDownload /></a>
          {onRemove && <button type="button" onClick={() => onRemove(f.id)} aria-label="Remove" style={btn("link")}><FiX /></button>}
        </div>
      ))}
      <Modal open={!!zoom} title={zoom?.filename || "Picture"} onClose={() => setZoom(null)} width={900}>
        {zoom && <img src={mediaUrl(zoom.url)} alt={zoom.filename} style={{ width: "100%", borderRadius: 12 }} />}
      </Modal>
    </div>
  );
}

const RemoveDot = ({ onClick }) => (
  <button type="button" aria-label="Remove" onClick={onClick} style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: "50%", border: 0, background: "rgba(15,23,42,0.7)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><FiX size={14} /></button>
);

// ── Reporting ────────────────────────────────────────────────────────────────────────────────────
export function ReportDialog({ open, onClose, targetType, targetId, reasons = [], what = "this" }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const send = useMutation({
    mutationFn: () => connectApi.report({ targetType, targetId, reason, note: note || undefined }),
    onSuccess: () => { toast.success("Thanks for telling us. A teacher will look at it."); setReason(""); setNote(""); onClose(); },
    onError: (err) => toast.error(errorOf(err, "Couldn't send the report")),
  });
  return (
    <Modal open={open} title={`Report ${what}`} onClose={onClose}
      footer={<><button type="button" style={btn("ghost")} onClick={onClose}>Cancel</button><button type="button" style={btn("primary")} disabled={!reason || send.isPending} onClick={() => send.mutate()}>{send.isPending ? "Sending…" : "Send to a teacher"}</button></>}>
      <p style={{ marginTop: 0, color: C.muted, lineHeight: 1.5 }}>Only teachers who keep Connect safe will see this. The person won't know it was you.</p>
      <div style={{ display: "grid", gap: 8 }}>
        {reasons.map((r) => (
          <label key={r.key} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 12, border: `1.5px solid ${reason === r.key ? C.navy : C.border}`, cursor: "pointer", fontWeight: 700 }}>
            <input type="radio" name="report-reason" checked={reason === r.key} onChange={() => setReason(r.key)} /> {r.label}
          </label>
        ))}
      </div>
      <label style={label} htmlFor="report-note">Anything else? (optional)</label>
      <textarea id="report-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} style={input} />
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 0 }}>If you feel unsafe right now, tell a grown-up you trust straight away.</p>
    </Modal>
  );
}

// A small "more" menu.
export function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const shown = items.filter(Boolean);
  if (!shown.length) return null;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" aria-label="More" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ ...btn("link"), fontSize: 22, lineHeight: 1, color: C.muted, minWidth: 40, minHeight: 40, padding: 0 }}>⋯</button>
      {open && (
        <div role="menu" style={{ position: "absolute", right: 0, top: "100%", zIndex: 20, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.14)", minWidth: 190, padding: 6 }}>
          {shown.map((it) => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onClick(); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 14px", border: 0, background: "none", borderRadius: 8, fontFamily: FONT, fontWeight: 700, fontSize: 14, color: it.danger ? C.danger : C.ink, cursor: "pointer" }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Text with line breaks kept; never rendered as HTML.
export const PlainText = ({ children, style }) => <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.55, ...style }}>{children}</div>;

// The mobile breakpoint.
export function useNarrow(width = 760) {
  const [narrow, setNarrow] = useState(() => (typeof window !== "undefined" ? window.innerWidth < width : false));
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < width);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [width]);
  return narrow;
}
