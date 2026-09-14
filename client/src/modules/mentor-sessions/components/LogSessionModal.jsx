import { useState } from "react";
import { createPortal } from "react-dom";
import { useCreateMentorSession } from "../hooks/useMentorSessions";

const inputStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: "9px",
  border: "1.5px solid #E5E7EB", fontSize: "13.5px", fontFamily: "Inter, sans-serif",
  color: "#111827", outline: "none",
};
const labelStyle = { display: "block", fontSize: "12px", fontWeight: "700", color: "#374151", marginBottom: "5px" };

const todayStr = () => new Date().toISOString().slice(0, 10);

// Logs a mentor-learner session that already happened — no scheduling, just a record of hub,
// mentor, learner, date, fee. See mentor-session.service.js's header comment for why this is a
// log-only form (the hub collects/keeps the fee itself; this app just records what happened).
export default function LogSessionModal({ hubId, teachers, learners, onClose }) {
  const { mutate: createSession, isPending } = useCreateMentorSession();
  const [form, setForm] = useState({
    teacherId: "", learnerId: "", sessionDate: todayStr(),
    durationMinutes: "", feeAmount: "", feeCurrency: "KES", paymentStatus: "unpaid", notes: "",
  });
  const [errors, setErrors] = useState({});

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const next = {};
    if (!form.teacherId) next.teacherId = "Pick a mentor";
    if (!form.learnerId) next.learnerId = "Pick a learner";
    if (!form.sessionDate) next.sessionDate = "Session date is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (!validate()) return;
    createSession(
      {
        hubId,
        teacherId: form.teacherId,
        learnerId: form.learnerId,
        sessionDate: form.sessionDate,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        feeAmount: form.feeAmount ? Number(form.feeAmount) : null,
        feeCurrency: form.feeCurrency,
        paymentStatus: form.paymentStatus,
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
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>Log a Session</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>Record a mentor-learner session that already took place at this hub.</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", cursor: "pointer", fontSize: "16px", lineHeight: 1, width: "26px", height: "26px", borderRadius: "8px" }}>×</button>
        </div>

        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Mentor</label>
            <select style={inputStyle} value={form.teacherId} onChange={set("teacherId")}>
              <option value="">Select a mentor…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
              ))}
            </select>
            {teachers.length === 0 && <p style={{ margin: "5px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>No educators assigned to this hub yet.</p>}
            {errors.teacherId && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.teacherId}</p>}
          </div>

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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Session Date</label>
              <input type="date" style={inputStyle} value={form.sessionDate} onChange={set("sessionDate")} />
              {errors.sessionDate && <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#DC2626" }}>{errors.sessionDate}</p>}
            </div>
            <div>
              <label style={labelStyle}>Duration (mins)</label>
              <input type="number" min="1" style={inputStyle} value={form.durationMinutes} onChange={set("durationMinutes")} placeholder="60" />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Fee</label>
              <input type="number" min="0" style={inputStyle} value={form.feeAmount} onChange={set("feeAmount")} placeholder="0" />
            </div>
            <div>
              <label style={labelStyle}>Currency</label>
              <input style={inputStyle} value={form.feeCurrency} onChange={set("feeCurrency")} maxLength={8} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Payment Status</label>
            <select style={inputStyle} value={form.paymentStatus} onChange={set("paymentStatus")}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="waived">Waived</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Notes (optional)</label>
            <textarea style={{ ...inputStyle, minHeight: "60px", resize: "vertical" }} value={form.notes} onChange={set("notes")} maxLength={1000} />
          </div>
        </div>

        <div style={{ padding: "16px 24px", display: "flex", gap: "10px", justifyContent: "flex-end", borderTop: "1px solid #F3F4F6" }}>
          <button type="button" onClick={onClose} style={{ padding: "9px 18px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            Cancel
          </button>
          <button type="button" disabled={isPending} onClick={submit} style={{ padding: "9px 18px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}>
            {isPending ? "Logging…" : "Log Session"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
