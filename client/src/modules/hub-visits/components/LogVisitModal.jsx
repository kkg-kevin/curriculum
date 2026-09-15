import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLogVisit } from "../hooks/useHubVisits";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px",
  border: "1.5px solid #E5E7EB", fontSize: "13.5px", fontFamily: "Inter, sans-serif",
  color: "#111827", outline: "none",
};
const labelStyle = { display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "5px" };

const todayStr = () => new Date().toISOString().slice(0, 10);

function fmt(amount) {
  return `KES ${Number(amount || 0).toLocaleString()}`;
}

// Logs a learner visit to a space that already happened — no booking/check-in flow, just a
// record of hub, learner, space, date, hours (for hourly-priced spaces). See
// hub-visit.service.js's header comment for why this is a log-only form (the hub collects/keeps
// the fee itself; this app just records what happened and turns it into a charge later via
// "Generate charges").
export default function LogVisitModal({ hubId, learners, spaces, onClose }) {
  const { mutate: logVisit, isPending } = useLogVisit();
  // learners carries each learner's own learner_hub_links.spaceId (see HubFinanceTab) so the
  // space field can auto-fill to whichever space they're enrolled at, while staying editable in
  // case they used a different space that day.
  const [form, setForm] = useState({ learnerId: "", spaceId: "", visitDate: todayStr(), hours: "", notes: "" });
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => {
    const value = e.target.value;
    setForm((f) => {
      const next = { ...f, [field]: value };
      if (field === "learnerId") {
        const learner = learners.find((l) => l.id === value);
        next.spaceId = learner?.spaceId || f.spaceId;
      }
      return next;
    });
  };

  const space = spaces.find((s) => s.id === form.spaceId) || null;
  const isHourly = space?.pricingModel === "hourly";
  const estimatedAmount = useMemo(() => {
    if (!space) return null;
    if (space.pricingModel === "free") return 0;
    if (isHourly) return form.hours ? Number(space.rate) * Number(form.hours) : null;
    return Number(space.rate);
  }, [space, isHourly, form.hours]);

  const validate = () => {
    const next = {};
    if (!form.learnerId) next.learnerId = "Pick a learner";
    if (!form.spaceId) next.spaceId = "Pick a space";
    if (!form.visitDate) next.visitDate = "Visit date is required";
    if (isHourly && !form.hours) next.hours = "Hours are required for an hourly-priced space";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    logVisit(
      {
        hubId,
        learnerId: form.learnerId,
        spaceId: form.spaceId,
        visitDate: form.visitDate,
        hours: isHourly && form.hours ? Number(form.hours) : null,
        notes: form.notes,
      },
      { onSuccess: onClose }
    );
  };

  return createPortal(
    <div
      style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto", backgroundColor: "rgba(15,38,69,0.45)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: "#fff", borderRadius: "18px", width: "100%", maxWidth: "460px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)", overflow: "hidden", fontFamily: "Inter, sans-serif" }}>
        <div style={{ padding: "20px 24px", background: "linear-gradient(135deg,#1a3550 0%,#25476a 60%,#2e7db5 100%)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>Log a Visit</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Record a learner's use of a space that already took place at this hub.</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px", lineHeight: 1, width: "26px", height: "26px", borderRadius: "8px" }}>×</button>
        </div>

        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Learner</label>
            <select style={inputStyle} value={form.learnerId} onChange={set("learnerId")}>
              <option value="">Select a learner…</option>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>
              ))}
            </select>
            {learners.length === 0 && <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>No learners enrolled at this hub yet.</p>}
            {errors.learnerId && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.learnerId}</p>}
          </div>

          <div>
            <label style={labelStyle}>Space</label>
            <select style={inputStyle} value={form.spaceId} onChange={set("spaceId")}>
              <option value="">Select a space…</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>{s.name} — {s.pricingModel === "free" ? "Free" : `${fmt(s.rate)} ${s.priceUnit}`}</option>
              ))}
            </select>
            {spaces.length === 0 && <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>No spaces configured for this hub yet.</p>}
            {errors.spaceId && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.spaceId}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isHourly ? "1fr 1fr" : "1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Visit Date</label>
              <input type="date" style={inputStyle} value={form.visitDate} onChange={set("visitDate")} />
              {errors.visitDate && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.visitDate}</p>}
            </div>
            {isHourly && (
              <div>
                <label style={labelStyle}>Hours</label>
                <input type="number" min="0.5" step="0.5" style={inputStyle} value={form.hours} onChange={set("hours")} placeholder="1" />
                {errors.hours && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.hours}</p>}
              </div>
            )}
          </div>

          {estimatedAmount !== null && (
            <p style={{ margin: 0, fontSize: "12.5px", color: "#25476a", fontWeight: 700, backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", borderRadius: "8px", padding: "8px 12px" }}>
              Estimated charge: {fmt(estimatedAmount)}
            </p>
          )}

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={form.notes} onChange={set("notes")} maxLength={500} />
          </div>
        </div>

        <div style={{ padding: "16px 24px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 18px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" disabled={isPending} onClick={submit} style={{ padding: "9px 18px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}>
            {isPending ? "Logging…" : "Log Visit"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
