import { useState } from "react";
import { createPortal } from "react-dom";
import { FiSend, FiX } from "react-icons/fi";
import { useMessageEducators } from "../hooks/useSupervisorPortal";
import { T } from "../../claims/shared";

// A note from a supervisor to some or all of their educators (17 Nov 2026): it arrives as a
// notification in the teacher portal and an email (supervisor_message). `educators` — the
// supervisor's educators [{ id, name }]; `selected` — who's ticked at the start (default: all).
const STARTERS = [
  ["Check-in reports", "Some of your parent check-ins have happened but their reports aren't written yet. Please write them up this week."],
  ["Marking", "There's work waiting to be marked in your classes. Please mark and release it so learners and parents get their reports."],
  ["Attendance", "Please make sure attendance is taken at every session — it's how sessions count as delivered."],
  ["QA visit", "I'll be visiting soon for a quality check. Nothing to prepare beyond your normal session plan."],
];

export default function MessageEducatorsDialog({ educators = [], selected = null, onClose }) {
  const [ids, setIds] = useState(() => new Set(selected && selected.length ? selected : educators.map((e) => e.id)));
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const send = useMessageEducators();
  const all = ids.size === educators.length;
  const toggle = (id) => setIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const field = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${T.border}`, fontSize: 13.5, fontFamily: "inherit", color: T.ink };
  const submit = () => send.mutate({ teacherIds: [...ids], title: title.trim(), message: message.trim() }, { onSuccess: ({ sent }) => { if (sent.length) onClose(); } });

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !send.isPending) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(17,32,51,0.45)", fontFamily: "Inter, sans-serif" }}>
      <div role="dialog" aria-modal="true" aria-label="Message your educators" style={{ width: "100%", maxWidth: 600, maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "#fff", borderRadius: 18, boxShadow: "0 24px 64px rgba(17,32,51,0.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "18px 20px 0" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: T.ink }}>Message your educators</h2>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: T.inkMuted }}>It arrives in their portal&apos;s notifications and by email.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ border: 0, background: "none", color: T.inkMuted, cursor: "pointer", padding: 4 }}><FiX size={18} /></button>
        </div>
        <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>To ({ids.size})</span>
              <button type="button" onClick={() => setIds(all ? new Set() : new Set(educators.map((e) => e.id)))} style={{ border: 0, background: "none", color: T.accentMid, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                {all ? "Clear" : "Everyone"}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {educators.map((e) => {
                const on = ids.has(e.id);
                return (
                  <button key={e.id} type="button" aria-pressed={on} onClick={() => toggle(e.id)}
                    style={{ padding: "6px 11px", borderRadius: 999, border: `1.5px solid ${on ? T.accent : T.border}`, background: on ? T.accent : "#fff", color: on ? "#fff" : T.ink, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {e.name}
                  </button>
                );
              })}
              {educators.length === 0 && <span style={{ fontSize: 13, color: T.inkMuted }}>No educators are assigned to you yet.</span>}
            </div>
          </div>
          <div>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>Start from</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {STARTERS.map(([label, text]) => (
                <button key={label} type="button" onClick={() => { setTitle(label); setMessage(text); }}
                  style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.tintBorder}`, background: T.tintBg, color: T.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 800, color: T.ink }}>
            Title <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span>
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Check-in reports" style={field} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 800, color: T.ink }}>
            Message
            <textarea value={message} maxLength={2000} rows={5} onChange={(e) => setMessage(e.target.value)} placeholder="Write your note…" style={{ ...field, resize: "vertical", lineHeight: 1.5 }} />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "9px 16px", borderRadius: 10, border: `1.5px solid ${T.border}`, background: "#fff", color: T.ink, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button type="button" disabled={!ids.size || !message.trim() || send.isPending} onClick={submit}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "none", background: !ids.size || !message.trim() ? "#9CB3C9" : T.accent, color: "#fff", fontWeight: 800, fontSize: 13, cursor: !ids.size || !message.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              <FiSend size={14} /> {send.isPending ? "Sending…" : `Send${ids.size ? ` to ${ids.size}` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
