import { useState } from "react";
import { BRAND, FONT, pill } from "../../../theme/brand";
import { PROGRAMMES } from "../services/affiliatesApi";

// Shared by the admin's Prospects (list + a family's page) and the affiliate's My prospects
// (26 Nov 2026): a prospect's status (server affiliate.rules.js's PROSPECT_STAGES — the server sends
// the list) and the form that corrects a family's details.

// The look of each status. Gold = do something; navy = going well; grey = parked or closed.
export const STAGE_TONE = {
  new: "waiting",
  contacted: "info",
  no_answer: "waiting",
  interested: "good",
  visit_booked: "strong",
  later: "neutral",
  not_interested: "neutral",
  signed_up: "strong",
};

export function StagePill({ stage, label, style }) {
  return <span style={pill(STAGE_TONE[stage] || "neutral", style)}>{label}</span>;
}

// A dropdown of the statuses a person can set (Signed up comes from the sign-up itself).
export function StageSelect({ stages = [], value, onChange, disabled, ariaLabel = "Status", style }) {
  const settable = stages.filter((s) => !s.auto);
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => e.target.value !== value && onChange(e.target.value)}
      style={{ padding: "7px 10px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13, fontWeight: 700, fontFamily: FONT, color: BRAND.ink, background: "#fff", cursor: disabled ? "default" : "pointer", minWidth: 0, ...style }}
    >
      {settable.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
    </select>
  );
}

const input = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff", minWidth: 0 };
const label = { display: "grid", gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, minWidth: 0 };
const btn = { display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, border: `1px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13.5, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" };

// Correcting a family's details (the affiliate their own, our team any open one).
export function ProspectDetailsForm({ prospect, saving, onSave, onCancel }) {
  const [form, setForm] = useState({
    parentName: prospect.parentName || "",
    phone: prospect.phone || "",
    email: prospect.email || "",
    childName: prospect.childName || "",
    childAge: prospect.childAge ?? "",
    programme: prospect.programme || "",
    notes: prospect.affiliateNote ?? prospect.notes ?? "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
        <label style={label}>Parent&apos;s name<input style={input} value={form.parentName} onChange={set("parentName")} required minLength={2} maxLength={150} /></label>
        <label style={label}>Phone<input style={input} value={form.phone} onChange={set("phone")} maxLength={40} inputMode="tel" /></label>
        <label style={label}>Email<input style={input} type="email" value={form.email} onChange={set("email")} maxLength={255} /></label>
        <label style={label}>Programme they&apos;re interested in
          <select style={input} value={form.programme} onChange={set("programme")}>
            <option value="">Not sure yet</option>
            {PROGRAMMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label style={label}>Child&apos;s name <span style={{ fontWeight: 500, color: BRAND.muted }}>(optional)</span><input style={input} value={form.childName} onChange={set("childName")} maxLength={150} /></label>
        <label style={label}>Child&apos;s age <span style={{ fontWeight: 500, color: BRAND.muted }}>(optional)</span><input style={input} type="number" min="2" max="25" value={form.childAge} onChange={set("childAge")} /></label>
      </div>
      <label style={label}>Notes for follow-up<textarea style={{ ...input, resize: "vertical" }} rows={3} value={form.notes} onChange={set("notes")} maxLength={1000} /></label>
      <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>Keep a phone number or email: that&apos;s how the family is recognised when they sign up.</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" style={btn} onClick={onCancel}>Cancel</button>
        <button type="submit" style={{ ...btn, background: BRAND.navy, borderColor: BRAND.navy, color: "#fff" }} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
}
