import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { FiAlertTriangle, FiHelpCircle, FiEdit3, FiX } from "react-icons/fi";
import { BRAND, FONT } from "../../theme/brand";

// The system's own "Are you sure?" and "Why?" boxes, in place of the browser's confirm() / prompt()
// (12 Nov 2026 — those show the site's address and the browser's own look). Call from anywhere,
// no hook or state needed:
//
//   if (!(await askConfirm({ title: "Delete Jane?", message: "…", confirmLabel: "Delete", tone: "danger" }))) return;
//   const why = await askText({ title: "Reject this payout?", label: "Why? (the affiliate sees this)" });
//   if (why === null) return;          // closed — "" means left blank
//
// <AskDialogHost /> is mounted once (App.jsx). One box at a time; a second waits its turn.
// Escape / the backdrop / ✕ = cancel; Enter = the main button (in a text box: Ctrl/⌘+Enter when
// it's several lines). Red (tone "danger") only for something destructive, as everywhere.

let queue = [];
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const current = () => queue[0] || null;

function open(kind, options) {
  const opts = typeof options === "string" ? { message: options } : { ...options };
  return new Promise((resolve) => {
    queue = [...queue, { id: Math.random().toString(36).slice(2), kind, ...opts, resolve }];
    emit();
  });
}
function close(entry, value) {
  queue = queue.filter((q) => q !== entry);
  emit();
  entry.resolve(value);
}

export const askConfirm = (options) => open("confirm", options);
export const askText = (options) => open("text", options);

const TONE = {
  danger: { icon: FiAlertTriangle, bg: BRAND.dangerTint, fg: BRAND.danger, border: BRAND.dangerBorder, button: BRAND.danger, hover: "#991B1B" },
  default: { icon: FiHelpCircle, bg: BRAND.skyTint, fg: BRAND.mid, border: BRAND.skyBorder, button: BRAND.navy, hover: BRAND.navyDeep },
};

export default function AskDialogHost() {
  const entry = useSyncExternalStore(subscribe, current, current);
  if (!entry) return null;
  return <AskBox key={entry.id} entry={entry} />;
}

function AskBox({ entry }) {
  const isText = entry.kind === "text";
  const tone = TONE[entry.tone] || TONE.default;
  const Icon = isText ? FiEdit3 : tone.icon;
  const [value, setValue] = useState(entry.defaultValue || "");
  const [touched, setTouched] = useState(false);
  const mainRef = useRef(null);
  const fieldRef = useRef(null);
  const missing = isText && entry.required && !value.trim();

  const cancel = () => close(entry, isText ? null : false);
  const accept = () => {
    if (isText) {
      if (missing) { setTouched(true); fieldRef.current?.focus(); return; }
      close(entry, value.trim());
    } else close(entry, true);
  };

  useEffect(() => {
    const previous = document.activeElement;
    (isText ? fieldRef.current : mainRef.current)?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (previous?.focus) previous.focus(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = entry.title || (isText ? "Add a note" : "Are you sure?");
  const confirmLabel = entry.confirmLabel || (isText ? "Continue" : "Yes, go ahead");
  const cancelLabel = entry.cancelLabel || "Cancel";
  const multiline = isText && entry.multiline !== false;

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", inset: 0, zIndex: 10050, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        background: "rgba(17,32,51,0.45)", backdropFilter: "blur(3px)", animation: "askFade 140ms ease-out", fontFamily: FONT }}
    >
      <style>{`
        @keyframes askFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes askRise { from { opacity: 0; transform: translateY(10px) scale(0.98) } to { opacity: 1; transform: none } }
        .ask-btn { transition: background-color .15s ease, border-color .15s ease, color .15s ease; }
        .ask-btn:focus-visible, .ask-x:focus-visible { outline: 3px solid ${BRAND.sky}; outline-offset: 2px; }
        .ask-ghost:hover { background: ${BRAND.canvas} !important; border-color: ${BRAND.navyBorder} !important; }
        .ask-x:hover { background: ${BRAND.greyTint} !important; color: ${BRAND.ink} !important; }
        .ask-field:focus { border-color: ${BRAND.sky} !important; box-shadow: 0 0 0 3px ${BRAND.skyTint}; outline: none; }
        @media (max-width: 480px) { .ask-actions { flex-direction: column-reverse; } .ask-actions > button { width: 100%; } }
      `}</style>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`ask-title-${entry.id}`}
        aria-describedby={entry.message ? `ask-msg-${entry.id}` : undefined}
        style={{ position: "relative", width: "100%", maxWidth: 440, background: BRAND.surface, borderRadius: 18, overflow: "hidden",
          boxShadow: "0 24px 64px rgba(17,32,51,0.28), 0 4px 14px rgba(17,32,51,0.10)", animation: "askRise 170ms ease-out" }}
      >
        {/* The system's colour band along the top. */}
        <div aria-hidden="true" style={{ height: 5, background: entry.tone === "danger" ? BRAND.danger : `linear-gradient(90deg, ${BRAND.navy}, ${BRAND.mid} 55%, ${BRAND.sky})` }} />
        <button type="button" aria-label="Close" className="ask-x" onClick={cancel}
          style={{ position: "absolute", top: 14, right: 12, width: 32, height: 32, display: "grid", placeItems: "center", border: "none", borderRadius: 10, background: "transparent", color: BRAND.faint, cursor: "pointer" }}>
          <FiX size={18} />
        </button>

        <form onSubmit={(e) => { e.preventDefault(); accept(); }} style={{ padding: "22px 24px 20px" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <span aria-hidden="true" style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 14, display: "grid", placeItems: "center", background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}` }}>
              <Icon size={20} />
            </span>
            <div style={{ minWidth: 0, flex: 1, paddingRight: 22 }}>
              <h2 id={`ask-title-${entry.id}`} style={{ margin: "2px 0 6px", fontSize: 17, fontWeight: 800, color: BRAND.navy, lineHeight: 1.3 }}>{title}</h2>
              {entry.message && (
                <p id={`ask-msg-${entry.id}`} style={{ margin: 0, fontSize: 14, color: BRAND.muted, lineHeight: 1.6, whiteSpace: "pre-line" }}>{entry.message}</p>
              )}
            </div>
          </div>

          {isText && (
            <label style={{ display: "block", marginTop: 16 }}>
              {entry.label && <span style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: BRAND.inkSoft }}>{entry.label}{!entry.required && <span style={{ fontWeight: 500, color: BRAND.faint }}> (optional)</span>}</span>}
              {multiline ? (
                <textarea ref={fieldRef} className="ask-field" rows={3} value={value} placeholder={entry.placeholder || ""}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); accept(); } }}
                  style={fieldStyle(touched && missing)} />
              ) : (
                <input ref={fieldRef} className="ask-field" value={value} placeholder={entry.placeholder || ""}
                  onChange={(e) => setValue(e.target.value)} style={fieldStyle(touched && missing)} />
              )}
              {touched && missing && <span role="alert" style={{ display: "block", marginTop: 6, fontSize: 12.5, color: BRAND.danger, fontWeight: 600 }}>Please write something here first.</span>}
            </label>
          )}

          <div className="ask-actions" style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
            <button type="button" className="ask-btn ask-ghost" onClick={cancel}
              style={{ padding: "10px 18px", borderRadius: 12, border: `1.5px solid ${BRAND.border}`, background: BRAND.surface, color: BRAND.inkSoft, fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>
              {cancelLabel}
            </button>
            <button type="submit" ref={mainRef} className="ask-btn"
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tone.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = tone.button; }}
              style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: tone.button, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: "pointer", boxShadow: "0 4px 12px rgba(37,71,106,0.18)" }}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

const fieldStyle = (bad) => ({
  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 12, resize: "vertical",
  border: `1.5px solid ${bad ? BRAND.danger : BRAND.border}`, fontSize: 14, fontFamily: FONT, color: BRAND.ink, background: BRAND.surface,
});
