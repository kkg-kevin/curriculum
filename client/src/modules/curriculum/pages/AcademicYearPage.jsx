import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import {
  useAcademicYears,
  useCreateAcademicYearGroup,
  useCreateAcademicYearVersion,
  useChangeAcademicYearStatus,
} from "../hooks/useAcademicYear";

/* ── Constants ─────────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Competencies" },
  { n: 4, label: "Academic Year" },
  { n: 5, label: "Version Control" },
];

const STATUSES = [
  { value: "draft",     label: "Draft",     bg: "#FFFBEB", border: "#FCD34D", color: "#92400E", dot: "#F59E0B" },
  { value: "published", label: "Published", bg: "#fff8e6", border: "#fcd97a", color: "#b07800", dot: "#feb139" },
  { value: "inactive",  label: "Inactive",  bg: "#F9FAFB", border: "#E5E7EB", color: "#6B7280", dot: "#9CA3AF" },
];

/* ── CSS ───────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes ay-spin   { to { transform: rotate(360deg); } }
  @keyframes ay-fadein { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes ay-slide  { from { opacity:0; transform:translateX(8px); } to { opacity:1; transform:translateX(0); } }

  /* Layout */
  .ay-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 20px;
    align-items: start;
  }
  @media(max-width:960px){ .ay-layout{ grid-template-columns:1fr; } }

  /* Steps */
  .ay-steps { display:flex; align-items:center; justify-content:center; margin-bottom:32px; }
  .ay-connector { width:64px; height:2px; flex-shrink:0; margin:0 6px; margin-bottom:20px; }
  @media(max-width:580px){ .ay-connector{width:24px;} }

  /* Inputs */
  .ay-input {
    width:100%; padding:11px 14px; border-radius:10px;
    border:1.5px solid #E5E7EB; font-size:14px; font-family:Inter,sans-serif;
    background:#F9FAFB; color:#111827; box-sizing:border-box; outline:none;
    transition:border-color 0.15s,box-shadow 0.15s,background 0.15s;
  }
  .ay-input:focus { border-color:#25476a; background:#F0F7FF; box-shadow:0 0 0 3px rgba(37,71,106,0.1); }
  .ay-input.err   { border-color:#EF4444 !important; background:#FFF5F5 !important; }
  .ay-input[type="date"] { cursor:pointer; }

  /* Period carousel */
  .ay-carousel-wrap { position:relative; }
  .ay-carousel-arrow {
    width:36px; height:36px; border-radius:50%; flex-shrink:0;
    border:1.5px solid #E5E7EB; background:#fff; display:flex;
    align-items:center; justify-content:center; cursor:pointer;
    color:#374151; transition:all 0.15s;
  }
  .ay-carousel-arrow:enabled:hover { border-color:#25476a; background:#e8f5fb; color:#25476a; }
  .ay-carousel-arrow:disabled { opacity:0.25; cursor:not-allowed; }
  .ay-carousel-card { animation:ay-slide 0.16s ease; }
  .ay-carousel-dots { display:flex; gap:6px; justify-content:center; margin-top:16px; }
  .ay-carousel-dot  { width:8px; height:8px; border-radius:50%; background:#E5E7EB; border:none; cursor:pointer; padding:0; transition:all 0.2s; }
  .ay-carousel-dot.active { background:#25476a; width:22px; border-radius:4px; }
  .ay-break-divider { display:flex; align-items:center; gap:10px; margin:16px 0 12px; }
  .ay-break-line    { flex:1; height:1px; background:repeating-linear-gradient(90deg,#E5E7EB 0,#E5E7EB 4px,transparent 4px,transparent 8px); }

  /* Buttons */
  .ay-btn-primary   { padding:9px 18px; background:#25476a; color:#fff; border:none; border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:background 0.15s; white-space:nowrap; }
  .ay-btn-primary:hover:not(:disabled) { background:#0A3880; }
  .ay-btn-primary:disabled { background:#b8d9ee; cursor:not-allowed; }
  .ay-btn-secondary { padding:8px 16px; background:#fff; color:#374151; border:1.5px solid #E5E7EB; border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:all 0.15s; white-space:nowrap; }
  .ay-btn-secondary:hover { background:#F3F4F6; }
  .ay-btn-ghost     { padding:8px 16px; background:#e8f5fb; color:#25476a; border:1.5px solid #a8d5ee; border-radius:9px; font-size:13px; font-weight:600; font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:all 0.15s; white-space:nowrap; }
  .ay-btn-ghost:hover { background:#d6edf8; }
  .ay-btn-publish   { padding:9px 18px; background:#feb139; color:#25476a; border:none; border-radius:9px; font-size:13px; font-weight:700; font-family:Inter,sans-serif; cursor:pointer; display:inline-flex; align-items:center; gap:7px; transition:background 0.15s; white-space:nowrap; }
  .ay-btn-publish:hover:not(:disabled) { background:#f0a800; }
  .ay-btn-publish:disabled { background:#fef3d0; cursor:not-allowed; }

  /* Sidebar */
  .ay-sidebar {
    background:#fff; border-radius:16px; border:1.5px solid #E5E7EB;
    box-shadow:0 2px 8px rgba(0,0,0,0.04); overflow:hidden; position:sticky; top:20px;
  }
  .ay-sidebar-head {
    padding:14px 16px 12px; border-bottom:1px solid #F0F0F0;
    background:linear-gradient(135deg,#0A3880,#2e7db5);
  }
  .ay-sidebar-body { max-height:560px; overflow-y:auto; }
  .ay-sidebar-body::-webkit-scrollbar { width:3px; }
  .ay-sidebar-body::-webkit-scrollbar-thumb { background:#E5E7EB; border-radius:4px; }

  /* Year group accordion */
  .ay-group-header {
    width:100%; display:flex; align-items:center; justify-content:space-between;
    padding:11px 14px; background:none; border:none; border-bottom:1px solid #F5F5F5;
    cursor:pointer; font-family:Inter,sans-serif; text-align:left; transition:background 0.12s;
  }
  .ay-group-header:hover { background:#F9FAFB; }
  .ay-group-header.open  { background:#F0F7FF; border-bottom-color:#E0EEFF; }

  /* Version entries inside accordion */
  .ay-ver-entry {
    display:flex; align-items:center; justify-content:space-between;
    padding:8px 14px 8px 28px; border-bottom:1px solid #FAFAFA;
    cursor:pointer; background:none; border-left:none; border-right:none; border-top:none;
    width:100%; text-align:left; font-family:Inter,sans-serif; transition:background 0.12s;
  }
  .ay-ver-entry:hover        { background:#F9FAFB; }
  .ay-ver-entry.ver-selected { background:#FFFBEB; border-left:3px solid #F59E0B; padding-left:25px; }
  .ay-ver-entry.ver-published{ background:#fff8e6; }
  .ay-ver-entry.ver-selected.ver-published { background:#fff8e6; border-left-color:#feb139; }

  /* Add year button */
  .ay-add-year-btn {
    width:100%; padding:11px 14px; display:flex; align-items:center; gap:8px;
    background:none; border:none; border-top:1px solid #F0F0F0;
    font-family:Inter,sans-serif; font-size:12px; font-weight:600; color:#25476a;
    cursor:pointer; transition:background 0.12s;
  }
  .ay-add-year-btn:hover:not(:disabled) { background:#e8f5fb; }
  .ay-add-year-btn:disabled { color:#D1D5DB; cursor:not-allowed; }
`;

/* ── Shared style objects ──────────────────────────────────────────────── */

const card = {
  backgroundColor: "#fff",
  borderRadius: "16px",
  padding: "22px 24px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)",
};
const fieldLabel = { display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "7px" };
const errMsg     = { fontSize: "12px", color: "#EF4444", marginTop: "5px", marginBottom: 0 };
const badge      = { width: "26px", height: "26px", borderRadius: "8px", backgroundColor: "#25476a", color: "#fff", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

/* ── Helpers ───────────────────────────────────────────────────────────── */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function buildPeriods(curriculumPeriods, existingPeriods) {
  const base = (curriculumPeriods || []).map((p) => ({
    name: p.name, startDate: "", endDate: "", breakStartDate: "", breakEndDate: "",
  }));
  if (!existingPeriods?.length) return base;
  return base.map((b) => {
    const m = existingPeriods.find((p) => p.name === b.name);
    return m ? { ...b, startDate: m.startDate || "", endDate: m.endDate || "", breakStartDate: m.breakStartDate || "", breakEndDate: m.breakEndDate || "" } : b;
  });
}

/* ── Atoms ─────────────────────────────────────────────────────────────── */

function Spinner({ size = 14, light = true }) {
  return (
    <span style={{ width: `${size}px`, height: `${size}px`, border: `2px solid ${light ? "rgba(255,255,255,0.4)" : "#E5E7EB"}`, borderTopColor: light ? "#fff" : "#25476a", borderRadius: "50%", display: "inline-block", animation: "ay-spin 0.7s linear infinite", flexShrink: 0 }} />
  );
}

function StatusBadge({ status }) {
  const s = STATUSES.find((x) => x.value === status) || STATUSES[0];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", borderRadius: "20px", backgroundColor: s.bg, border: `1.5px solid ${s.border}`, color: s.color, fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap" }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

/* ── StepIndicator ─────────────────────────────────────────────────────── */

function StepIndicator({ current }) {
  return (
    <div className="ay-steps">
      {STEPS.map((step, i) => {
        const done = step.n < current, active = step.n === current;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", backgroundColor: done || active ? "#25476a" : "#F3F4F6", border: `2.5px solid ${done || active ? "#25476a" : "#E5E7EB"}`, display: "flex", alignItems: "center", justifyContent: "center", color: done || active ? "#fff" : "#9CA3AF", fontSize: done ? "15px" : "13px", fontWeight: "700", flexShrink: 0, boxShadow: active ? "0 0 0 4px rgba(37,71,106,0.1)" : "none" }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{ fontSize: "11px", fontWeight: active ? "700" : "400", color: active ? "#25476a" : done ? "#374151" : "#9CA3AF", whiteSpace: "nowrap" }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="ay-connector" style={{ backgroundColor: done ? "#25476a" : "#E5E7EB" }} />}
          </div>
        );
      })}
    </div>
  );
}

/* ── PeriodCarousel (edit) ─────────────────────────────────────────────── */

const ChevL = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>;
const ChevR = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;

function PeriodCarousel({ periods, onChange, errors }) {
  const [idx, setIdx] = useState(0);
  const total = periods.length;
  if (!total) return <p style={{ fontSize: "13px", color: "#9CA3AF", margin: 0 }}>No periods configured in Structure.</p>;

  const p    = periods[idx];
  const pErr = errors?.[idx] || {};
  const upd  = (field, value) => { const n = [...periods]; n[idx] = { ...n[idx], [field]: value }; onChange(n); };

  return (
    <div className="ay-carousel-wrap">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
        <button type="button" className="ay-carousel-arrow" onClick={() => setIdx((i) => i - 1)} disabled={idx === 0}><ChevL /></button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 18px", background: "linear-gradient(135deg,#25476a,#2e7db5)", borderRadius: "20px" }}>
            <span style={{ color: "#fff", fontSize: "13px", fontWeight: "700" }}>{p.name}</span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9CA3AF" }}>{idx + 1} of {total}</p>
        </div>
        <button type="button" className="ay-carousel-arrow" onClick={() => setIdx((i) => i + 1)} disabled={idx === total - 1}><ChevR /></button>
      </div>

      <div key={idx} className="ay-carousel-card" style={{ padding: "18px", backgroundColor: "#F8FAFF", borderRadius: "12px", border: "1.5px solid #E8F0FE" }}>
        <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: "700", color: "#25476a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Period Dates</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={fieldLabel}>Start date</label>
            <input type="date" value={p.startDate} onChange={(e) => upd("startDate", e.target.value)} className={`ay-input${pErr.startDate ? " err" : ""}`} />
            {pErr.startDate && <p style={errMsg}>{pErr.startDate}</p>}
          </div>
          <div>
            <label style={fieldLabel}>End date</label>
            <input type="date" value={p.endDate} onChange={(e) => upd("endDate", e.target.value)} className={`ay-input${pErr.endDate ? " err" : ""}`} />
            {pErr.endDate && <p style={errMsg}>{pErr.endDate}</p>}
          </div>
        </div>

        <div className="ay-break-divider">
          <div className="ay-break-line" />
          <span style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", whiteSpace: "nowrap", flexShrink: 0 }}>Mid-term Break <span style={{ fontWeight: "400" }}>(optional)</span></span>
          <div className="ay-break-line" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={fieldLabel}>Break start</label>
            <input type="date" value={p.breakStartDate} onChange={(e) => upd("breakStartDate", e.target.value)} className="ay-input" />
          </div>
          <div>
            <label style={fieldLabel}>Break end</label>
            <input type="date" value={p.breakEndDate} onChange={(e) => upd("breakEndDate", e.target.value)} className="ay-input" />
          </div>
        </div>
      </div>

      {total > 1 && (
        <div className="ay-carousel-dots">
          {periods.map((_, i) => (
            <button key={i} type="button" onClick={() => setIdx(i)} className={`ay-carousel-dot${i === idx ? " active" : ""}`} title={periods[i].name} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── PeriodCarouselView (read-only) ────────────────────────────────────── */

function PeriodCarouselView({ periods }) {
  const [idx, setIdx] = useState(0);
  const total = periods?.length || 0;
  if (!total) return <p style={{ fontSize: "13px", color: "#9CA3AF", margin: 0 }}>No period dates configured.</p>;

  const p        = periods[idx];
  const hasBreak = p.breakStartDate || p.breakEndDate;

  return (
    <div className="ay-carousel-wrap">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
        <button type="button" className="ay-carousel-arrow" onClick={() => setIdx((i) => i - 1)} disabled={idx === 0}><ChevL /></button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 18px", background: "linear-gradient(135deg,#25476a,#2e7db5)", borderRadius: "20px" }}>
            <span style={{ color: "#fff", fontSize: "13px", fontWeight: "700" }}>{p.name}</span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9CA3AF" }}>{idx + 1} of {total}</p>
        </div>
        <button type="button" className="ay-carousel-arrow" onClick={() => setIdx((i) => i + 1)} disabled={idx === total - 1}><ChevR /></button>
      </div>

      <div key={idx} className="ay-carousel-card" style={{ padding: "18px", backgroundColor: "#F8FAFF", borderRadius: "12px", border: "1.5px solid #E8F0FE" }}>
        <p style={{ margin: "0 0 12px", fontSize: "11px", fontWeight: "700", color: "#25476a", textTransform: "uppercase", letterSpacing: "0.06em" }}>Period Dates</p>
        {(p.startDate || p.endDate) ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[["FROM", p.startDate], ["TO", p.endDate]].map(([lbl, val]) => (
              <div key={lbl} style={{ padding: "10px 14px", backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #E8F0FE" }}>
                <p style={{ margin: "0 0 3px", fontSize: "10px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{lbl}</p>
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{fmtDate(val)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: "13px", color: "#D1D5DB", fontStyle: "italic" }}>No dates set for this period.</p>
        )}

        {hasBreak && (
          <>
            <div className="ay-break-divider">
              <div className="ay-break-line" />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", whiteSpace: "nowrap", flexShrink: 0 }}>Mid-term Break</span>
              <div className="ay-break-line" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[["BREAK FROM", p.breakStartDate], ["BREAK TO", p.breakEndDate]].map(([lbl, val]) => (
                <div key={lbl} style={{ padding: "10px 14px", backgroundColor: "#FFF7ED", borderRadius: "10px", border: "1px solid #FED7AA" }}>
                  <p style={{ margin: "0 0 3px", fontSize: "10px", fontWeight: "700", color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.06em" }}>{lbl}</p>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{fmtDate(val)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="ay-carousel-dots">
          {periods.map((_, i) => (
            <button key={i} type="button" onClick={() => setIdx(i)} className={`ay-carousel-dot${i === idx ? " active" : ""}`} title={periods[i].name} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── CreateGroupForm ───────────────────────────────────────────────────── */

function CreateGroupForm({ curriculum, publishedGroup, onSave, onCancel, isPending }) {
  const [label,     setLabel]     = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [periods,   setPeriods]   = useState(() => buildPeriods(curriculum?.periods, []));
  const [errors,    setErrors]    = useState({});

  const minStart = publishedGroup?.endDate || "";

  const validate = () => {
    const e = {};
    if (!label.trim()) e.label = "Year label is required (e.g. 2026-2027)";
    if (startDate && endDate && endDate < startDate) e.endDate = "End must be after start";
    if (minStart && startDate && startDate < minStart) e.startDate = `Must start after ${fmtDate(minStart)} (end of current published year)`;
    return e;
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({ label: label.trim(), startDate, endDate, periods });
  };

  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "ay-fadein 0.2s ease" }}>
      <div style={{ ...card, backgroundColor: "#F0F7FF", border: "1.5px solid #a8d5ee" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 3px", fontSize: "18px", fontWeight: "800", color: "#25476a" }}>New Academic Year</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#3B82F6" }}>Creates a new year group with an initial draft version of period dates.</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="ay-btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="ay-btn-primary" disabled={isPending}>
              {isPending ? <><Spinner /> Saving…</> : "Create Year"}
            </button>
          </div>
        </div>
      </div>

      <div style={card}>
        <h4 style={{ margin: "0 0 18px", fontSize: "14px", fontWeight: "700", color: "#111827", display: "flex", alignItems: "center", gap: "8px", paddingBottom: "14px", borderBottom: "1px solid #F3F4F6" }}>
          <span style={badge}>1</span> Year Details
        </h4>

        <div style={{ marginBottom: "16px" }}>
          <label style={fieldLabel}>Year Label <span style={{ color: "#EF4444" }}>*</span></label>
          <input type="text" value={label} onChange={(e) => { setLabel(e.target.value); setErrors((p) => ({ ...p, label: "" })); }} placeholder="e.g. 2026-2027" className={`ay-input${errors.label ? " err" : ""}`} />
          {errors.label && <p style={errMsg}>{errors.label}</p>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div>
            <label style={fieldLabel}>Year start</label>
            <input type="date" value={startDate} min={minStart} onChange={(e) => { setStartDate(e.target.value); setErrors((p) => ({ ...p, startDate: "" })); }} className={`ay-input${errors.startDate ? " err" : ""}`} />
            {errors.startDate ? <p style={errMsg}>{errors.startDate}</p> : minStart ? <p style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "4px", marginBottom: 0 }}>Must be on or after {fmtDate(minStart)}</p> : null}
          </div>
          <div>
            <label style={fieldLabel}>Year end</label>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setErrors((p) => ({ ...p, endDate: "" })); }} className={`ay-input${errors.endDate ? " err" : ""}`} />
            {errors.endDate && <p style={errMsg}>{errors.endDate}</p>}
          </div>
        </div>
      </div>

      {periods.length > 0 && (
        <div style={card}>
          <h4 style={{ margin: "0 0 18px", fontSize: "14px", fontWeight: "700", color: "#111827", display: "flex", alignItems: "center", gap: "8px", paddingBottom: "14px", borderBottom: "1px solid #F3F4F6" }}>
            <span style={badge}>2</span> Period Dates <span style={{ fontSize: "12px", fontWeight: "400", color: "#9CA3AF" }}>— optional, can be set later</span>
          </h4>
          <PeriodCarousel periods={periods} onChange={setPeriods} errors={errors.periods} />
        </div>
      )}
    </form>
  );
}

/* ── EditVersionForm ───────────────────────────────────────────────────── */

function EditVersionForm({ curriculum, sourceVersion, group, nextVersionNumber, onSave, onCancel, isPending }) {
  const [periods, setPeriods] = useState(() => buildPeriods(curriculum?.periods, sourceVersion?.periods));
  const [errors,  setErrors]  = useState({});

  const submit = (e) => {
    e.preventDefault();
    onSave({ periods });
  };

  return (
    <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "ay-fadein 0.2s ease" }}>
      <div style={{ ...card, backgroundColor: "#F0F7FF", border: "1.5px solid #a8d5ee" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 3px", fontSize: "18px", fontWeight: "800", color: "#25476a" }}>
              {group.label} — Version {nextVersionNumber}
            </h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#3B82F6" }}>
              Saves as a draft. The current published version stays live until you publish this.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" className="ay-btn-secondary" onClick={onCancel}>Cancel</button>
            <button type="submit" className="ay-btn-primary" disabled={isPending}>
              {isPending ? <><Spinner /> Saving…</> : `Save Draft v${nextVersionNumber}`}
            </button>
          </div>
        </div>
      </div>

      {periods.length > 0 && (
        <div style={card}>
          <h4 style={{ margin: "0 0 18px", fontSize: "14px", fontWeight: "700", color: "#111827", paddingBottom: "14px", borderBottom: "1px solid #F3F4F6" }}>
            Period Dates
          </h4>
          <PeriodCarousel periods={periods} onChange={setPeriods} errors={errors.periods} />
        </div>
      )}
    </form>
  );
}

/* ── VersionView ───────────────────────────────────────────────────────── */

function VersionView({ group, version, nextVersionNumber, onEdit, onPublish, isPublishing }) {
  const isPublished = version.status === "published";
  const isDraft     = version.status === "draft";
  const isInactive  = version.status === "inactive";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "ay-fadein 0.2s ease" }}>
      {/* Status banner */}
      {isPublished && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", backgroundColor: "#fff8e6", border: "1.5px solid #fcd97a", borderRadius: "12px" }}>
          <span style={{ fontSize: "16px" }}>✅</span>
          <p style={{ margin: 0, fontSize: "12px", color: "#b07800", fontWeight: "500" }}>
            This is the <strong>active version</strong> — currently in use for {group.label}.
          </p>
        </div>
      )}
      {isDraft && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", backgroundColor: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: "12px" }}>
          <span style={{ fontSize: "16px" }}>📋</span>
          <p style={{ margin: 0, fontSize: "12px", color: "#92400E", fontWeight: "500" }}>
            This draft is not yet in use. Publish it to make it the active version.
          </p>
        </div>
      )}
      {isInactive && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 16px", backgroundColor: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "12px" }}>
          <span style={{ fontSize: "16px" }}>🕐</span>
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", fontWeight: "500" }}>
            This is a historical version — no longer in use.
          </p>
        </div>
      )}

      {/* Header card */}
      <div style={{ ...card, ...(isPublished ? { border: "1.5px solid #fcd97a", backgroundColor: "#fff8e6" } : isDraft ? { border: "1.5px solid #a8d5ee", backgroundColor: "#F0F7FF" } : {}) }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0F2645" }}>{group.label}</h2>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#6B7280", backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: "20px", padding: "2px 10px" }}>v{version.versionNumber}</span>
              <StatusBadge status={version.status} />
            </div>
            {(group.startDate || group.endDate) && (
              <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{fmtDate(group.startDate)} → {fmtDate(group.endDate)}</p>
            )}
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9CA3AF" }}>Saved {fmtDate(version.createdAt)}</p>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", flexShrink: 0 }}>
            {isDraft && (
              <button type="button" className="ay-btn-publish" onClick={onPublish} disabled={isPublishing}>
                {isPublishing ? <><Spinner /> Publishing…</> : "🚀 Publish"}
              </button>
            )}
            {(isDraft || isPublished) && (
              <button type="button" className="ay-btn-ghost" onClick={onEdit}>
                ✏ Edit → v{nextVersionNumber}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Period dates */}
      <div style={card}>
        <h4 style={{ margin: "0 0 18px", fontSize: "14px", fontWeight: "700", color: "#111827", paddingBottom: "14px", borderBottom: "1px solid #F3F4F6" }}>
          Academic Period Dates
        </h4>
        <PeriodCarouselView periods={version.periods || []} />
      </div>
    </div>
  );
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */

function AcademicYearSidebar({
  groups, selectedVersionId,
  onSelectVersion, onAddYear, canAddYear, addYearDisabledReason,
}) {
  const [openGroupIds, setOpenGroupIds] = useState(() => {
    // Auto-open the group containing the selected version, or the first group
    const defaultGroup = groups.find((g) => g.versions.some((v) => v.id === selectedVersionId)) || groups[0];
    return defaultGroup ? new Set([defaultGroup.id]) : new Set();
  });

  const toggleGroup = (gid) => {
    setOpenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  return (
    <div className="ay-sidebar">
      <div className="ay-sidebar-head">
        <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase" }}>Academic Years</p>
        <p style={{ margin: "3px 0 0", fontSize: "11px", color: "rgba(255,255,255,0.6)" }}>
          {groups.length} {groups.length === 1 ? "year" : "years"}
        </p>
      </div>

      <div className="ay-sidebar-body">
        {groups.length === 0 && (
          <div style={{ padding: "24px 16px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", lineHeight: 1.6 }}>No academic years yet. Create the first one.</p>
          </div>
        )}

        {groups.map((group) => {
          const isOpen   = openGroupIds.has(group.id);
          const hasPub   = group.versions.some((v) => v.status === "published");
          const hasDraft = group.versions.some((v) => v.status === "draft");

          return (
            <div key={group.id}>
              {/* Group header */}
              <button
                type="button"
                className={`ay-group-header${isOpen ? " open" : ""}`}
                onClick={() => toggleGroup(group.id)}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {group.label}
                  </span>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {hasPub  && <span style={{ fontSize: "10px", fontWeight: "700", color: "#b07800", backgroundColor: "#fff8e6", border: "1px solid #fcd97a", borderRadius: "20px", padding: "1px 6px" }}>Live</span>}
                    {hasDraft && <span style={{ fontSize: "10px", fontWeight: "700", color: "#92400E", backgroundColor: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "20px", padding: "1px 6px" }}>Draft</span>}
                    <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{group.versions.length}v</span>
                  </div>
                </div>
                <span style={{ fontSize: "13px", color: "#9CA3AF", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
              </button>

              {/* Version entries */}
              {isOpen && group.versions.map((v) => {
                const isSelected  = v.id === selectedVersionId;
                const isPublished = v.status === "published";
                let cls = "ay-ver-entry";
                if (isSelected)  cls += " ver-selected";
                if (isPublished) cls += " ver-published";

                return (
                  <button key={v.id} type="button" className={cls} onClick={() => onSelectVersion(group, v)}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#374151" }}>v{v.versionNumber}</span>
                      <span style={{ fontSize: "10px", color: "#9CA3AF" }}>{fmtDate(v.createdAt)}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "3px" }}>
                      <StatusBadge status={v.status} />
                      {isPublished && <span style={{ fontSize: "9px", fontWeight: "700", color: "#b07800" }}>LIVE</span>}
                      {isSelected  && <span style={{ fontSize: "9px", fontWeight: "700", color: "#92400E" }}>VIEWING</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Add year button */}
      <button
        type="button"
        className="ay-add-year-btn"
        onClick={onAddYear}
        disabled={!canAddYear}
        title={!canAddYear ? addYearDisabledReason : "Create a new academic year"}
      >
        <span style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: canAddYear ? "#25476a" : "#E5E7EB", color: canAddYear ? "#fff" : "#9CA3AF", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", flexShrink: 0 }}>+</span>
        {canAddYear ? "Add Academic Year" : addYearDisabledReason || "Add Academic Year"}
      </button>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function AcademicYearPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const { data: curriculum, isLoading: lCurr } = useCurriculumQuery(id);
  const { data: ayData,     isLoading: lAY    } = useAcademicYears(id);

  const { mutate: createGroup,   isPending: creatingGroup   } = useCreateAcademicYearGroup(id);
  const { mutate: createVersion, isPending: creatingVersion } = useCreateAcademicYearVersion(id);
  const { mutate: changeStatus,  isPending: changingStatus  } = useChangeAcademicYearStatus(id);

  const groups          = ayData?.groups          || [];
  const publishedVersion = ayData?.publishedVersion || null;

  // Find the group that contains the published version
  const publishedGroup = publishedVersion
    ? groups.find((g) => g.versions.some((v) => v.id === publishedVersion.id)) || null
    : null;

  // Derive canAddYear: only if no published year OR today >= published year's end date
  const canAddYear = (() => {
    if (!publishedGroup) return true;
    if (!publishedGroup.endDate) return true;
    return new Date() >= new Date(publishedGroup.endDate);
  })();

  const addYearDisabledReason = !canAddYear
    ? `Available after ${fmtDate(publishedGroup?.endDate)}`
    : "";

  // mode: "view" | "create-group" | "create-version"
  const [mode, setMode]               = useState("view");
  const [selectedGroup,   setSelGroup]  = useState(null);
  const [selectedVersion, setSelVersion] = useState(null);

  // On load: auto-select the published version if nothing is selected
  useEffect(() => {
    if (!lAY && groups.length > 0 && !selectedVersion) {
      if (publishedVersion && publishedGroup) {
        setSelGroup(publishedGroup);
        setSelVersion(publishedVersion);
      } else {
        // Fall back to the isCurrent version of the first group
        const firstGroup = groups[0];
        const cur = firstGroup.versions.find((v) => v.isCurrent) || firstGroup.versions[0];
        if (cur) { setSelGroup(firstGroup); setSelVersion(cur); }
      }
    }
  }, [lAY, groups.length]);

  // Keep selectedVersion fresh after mutations
  useEffect(() => {
    if (!selectedVersion || !groups.length) return;
    const freshGroup = groups.find((g) => g.id === selectedGroup?.id);
    if (!freshGroup) return;
    const freshVer = freshGroup.versions.find((v) => v.id === selectedVersion.id);
    if (freshVer) {
      setSelGroup(freshGroup);
      setSelVersion(freshVer);
    }
  }, [ayData]);

  const handleSelectVersion = (group, version) => {
    setSelGroup(group);
    setSelVersion(version);
    setMode("view");
  };

  const handleCreateGroup = (data) => {
    createGroup(data, {
      onSuccess: (result) => {
        setSelGroup({ ...result.group, versions: [result.version] });
        setSelVersion(result.version);
        setMode("view");
      },
    });
  };

  const handleCreateVersion = (data) => {
    if (!selectedGroup) return;
    createVersion({ groupId: selectedGroup.id, data }, {
      onSuccess: (newVer) => {
        setSelVersion(newVer);
        setMode("view");
      },
    });
  };

  const handlePublish = () => {
    if (!selectedGroup || !selectedVersion) return;
    changeStatus(
      { groupId: selectedGroup.id, versionId: selectedVersion.id, status: "published" },
      { onSuccess: () => {} }
    );
  };

  const nextVersionNumber = selectedGroup
    ? Math.max(0, ...( (groups.find((g) => g.id === selectedGroup.id)?.versions || []).map((v) => v.versionNumber))) + 1
    : 1;

  const isLoading = lCurr || lAY;

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter,sans-serif" }}>
        <style>{CSS}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "380px", gap: "14px", color: "#6B7280", fontSize: "14px" }}>
          <span style={{ width: "28px", height: "28px", border: "3px solid #E5E7EB", borderTopColor: "#25476a", borderRadius: "50%", display: "inline-block", animation: "ay-spin 0.7s linear infinite" }} />
          Loading…
        </div>
      </div>
    );
  }

  const subtitleText = {
    "view":           selectedVersion ? `${selectedGroup?.label} · v${selectedVersion.versionNumber} · ${selectedVersion.status}` : "Select a version from the sidebar.",
    "create-group":   "Creating a new academic year.",
    "create-version": `Creating v${nextVersionNumber} for ${selectedGroup?.label}.`,
  }[mode];

  return (
    <div style={{ fontFamily: "Inter,sans-serif" }}>
      <style>{CSS}</style>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
            <button type="button" onClick={() => navigate("/curriculum")} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "12px", fontFamily: "Inter,sans-serif", cursor: "pointer", padding: 0 }}>Curriculum</button>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#9CA3AF", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{curriculum?.name}</span>
            <span style={{ color: "#E5E7EB" }}>/</span>
            <span style={{ fontSize: "12px", color: "#374151", fontWeight: "600" }}>Academic Year</span>
          </div>
          <h1 style={{ margin: "0 0 3px", fontSize: "22px", fontWeight: "800", color: "#0F2645" }}>Academic Year</h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{subtitleText}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <button type="button" onClick={() => navigate(`/curriculum/${id}/competencies`)} className="ay-btn-secondary">← Competencies</button>
          <button type="button" onClick={() => navigate(`/curriculum/${id}/versions`)} className="ay-btn-primary">Next: Version Control →</button>
        </div>
      </div>

      <StepIndicator current={4} />

      {/* Empty state (no groups) */}
      {groups.length === 0 && mode === "view" && (
        <div style={{ textAlign: "center", padding: "72px 32px", backgroundColor: "#FAFAFA", border: "2px dashed #E5E7EB", borderRadius: "20px", animation: "ay-fadein 0.2s ease" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📅</div>
          <p style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#374151" }}>No academic years yet</p>
          <p style={{ margin: "0 0 24px", fontSize: "13px", color: "#9CA3AF", maxWidth: "360px", marginInline: "auto" }}>
            Create the first academic year for this curriculum. Set the year label, overall dates, and period dates.
          </p>
          <button type="button" className="ay-btn-primary" onClick={() => setMode("create-group")}>+ Create Academic Year</button>
        </div>
      )}

      {/* Create group form (no sidebar needed) */}
      {mode === "create-group" && (
        <CreateGroupForm
          curriculum={curriculum}
          publishedGroup={publishedGroup}
          onSave={handleCreateGroup}
          onCancel={() => setMode(groups.length ? "view" : "view")}
          isPending={creatingGroup}
        />
      )}

      {/* Two-column layout */}
      {mode !== "create-group" && groups.length > 0 && (
        <div className="ay-layout">
          {/* LEFT: main content */}
          <div style={{ minWidth: 0 }}>
            {mode === "view" && selectedVersion && selectedGroup && (
              <VersionView
                group={selectedGroup}
                version={selectedVersion}
                nextVersionNumber={nextVersionNumber}
                onEdit={() => setMode("create-version")}
                onPublish={handlePublish}
                isPublishing={changingStatus}
              />
            )}
            {mode === "view" && !selectedVersion && (
              <div style={{ ...card, textAlign: "center", padding: "64px 24px", color: "#9CA3AF" }}>
                <p style={{ margin: 0, fontSize: "13px" }}>Select a version from the sidebar to view its details.</p>
              </div>
            )}
            {mode === "create-version" && selectedGroup && (
              <EditVersionForm
                curriculum={curriculum}
                sourceVersion={selectedVersion}
                group={selectedGroup}
                nextVersionNumber={nextVersionNumber}
                onSave={handleCreateVersion}
                onCancel={() => setMode("view")}
                isPending={creatingVersion}
              />
            )}
          </div>

          {/* RIGHT: sidebar */}
          <AcademicYearSidebar
            groups={groups}
            selectedVersionId={selectedVersion?.id}
            onSelectVersion={handleSelectVersion}
            onAddYear={() => setMode("create-group")}
            canAddYear={canAddYear}
            addYearDisabledReason={addYearDisabledReason}
          />
        </div>
      )}
    </div>
  );
}
