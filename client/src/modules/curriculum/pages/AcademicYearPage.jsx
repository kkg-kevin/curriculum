import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import {
  useAcademicYears,
  useCreateAcademicYear,
  useEditAcademicYear,
  useChangeAcademicYearStatus,
} from "../hooks/useAcademicYear";

/* ── Constants ───────────────────────────────────────────────────────────── */

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Academic Year" },
  { n: 4, label: "Version Control" },
];

const STATUSES = [
  { value: "draft",    label: "Draft",    bg: "#FFFBEB", border: "#FCD34D", color: "#92400E", dot: "#F59E0B" },
  { value: "inactive", label: "Inactive", bg: "#F9FAFB", border: "#E5E7EB", color: "#6B7280", dot: "#9CA3AF" },
];

/* ── CSS ─────────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeIn  { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }

  .ayp-input {
    width: 100%; padding: 11px 14px; border-radius: 10px;
    border: 1.5px solid #E5E7EB; font-size: 14px; font-family: Inter, sans-serif;
    background-color: #F9FAFB; color: #111827; box-sizing: border-box; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
  }
  .ayp-input:focus { border-color: #0D47A1; background-color: #F0F7FF; box-shadow: 0 0 0 3px rgba(13,71,161,0.1); }
  .ayp-input.err   { border-color: #EF4444 !important; background-color: #FFF5F5 !important; }
  .ayp-input[type="date"] { cursor: pointer; }

  /* Step indicator */
  .ayp-steps { display: flex; align-items: center; justify-content: center; margin-bottom: 28px; }
  .ayp-connector { width: 80px; }
  @media (max-width: 520px) { .ayp-connector { width: 36px; } .ayp-steps { justify-content: flex-start; overflow-x: auto; padding-bottom: 4px; } }

  /* Layout */
  .ayp-layout { display: flex; gap: 24px; align-items: flex-start; }
  .ayp-main   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px; }
  @media (max-width: 860px) { .ayp-layout { flex-direction: column; } }

  /* Carousel */
  .carousel-wrap  { position: relative; }
  .carousel-arrow {
    width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
    border: 1.5px solid #E5E7EB; background: #fff; display: flex;
    align-items: center; justify-content: center; cursor: pointer;
    color: #374151; transition: all 0.15s;
  }
  .carousel-arrow:enabled:hover { border-color: #0D47A1; background: #EFF6FF; color: #0D47A1; }
  .carousel-arrow:disabled { opacity: 0.25; cursor: not-allowed; }

  .carousel-card { animation: slideIn 0.18s ease; }

  .carousel-dots { display: flex; gap: 6px; justify-content: center; margin-top: 18px; }
  .carousel-dot  { width: 8px; height: 8px; border-radius: 50%; background: #E5E7EB; border: none; cursor: pointer; padding: 0; transition: all 0.2s; }
  .carousel-dot.active { background: #0D47A1; width: 22px; border-radius: 4px; }

  .break-divider {
    display: flex; align-items: center; gap: 10px; margin: 18px 0 14px;
  }
  .break-line { flex: 1; height: 1px; background: repeating-linear-gradient(90deg, #E5E7EB 0, #E5E7EB 4px, transparent 4px, transparent 8px); }

  /* Status */
  .status-btn {
    flex: 1; padding: 7px 8px; border-radius: 8px;
    border: 1.5px solid #E5E7EB; background: #fff;
    font-size: 12px; font-weight: 600; font-family: Inter, sans-serif;
    cursor: pointer; text-align: center; transition: all 0.15s;
  }
  .status-btn:hover { border-color: #93C5FD; }
  .status-btn.sel-draft    { border-color: #FCD34D; background: #FFFBEB; color: #92400E; }
  .status-btn.sel-inactive { border-color: #D1D5DB; background: #F3F4F6; color: #6B7280; }

  /* Version history */
  .version-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: 10px; border: 1px solid #F3F4F6; background: #FAFAFA; font-family: Inter, sans-serif; }
  .version-row.cur { border-color: #BFDBFE; background: #EFF6FF; }

  /* Buttons */
  .ayp-btn-primary   { padding: 7px 16px; background: #0D47A1; color: #fff; border: none; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: Inter, sans-serif; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: background-color 0.15s; }
  .ayp-btn-primary:disabled { background: #93C5FD; cursor: not-allowed; }
  .ayp-btn-secondary { padding: 7px 14px; background: transparent; color: #374151; border: 1.5px solid #E5E7EB; border-radius: 8px; font-size: 13px; font-weight: 600; font-family: Inter, sans-serif; cursor: pointer; transition: all 0.15s; }
  .ayp-btn-secondary:hover { background: #F9FAFB; }
  .ayp-btn-ghost     { padding: 6px 12px; background: #EFF6FF; color: #0D47A1; border: 1.5px solid #BFDBFE; border-radius: 8px; font-size: 12px; font-weight: 600; font-family: Inter, sans-serif; cursor: pointer; transition: all 0.15s; }
  .ayp-btn-ghost:hover { background: #DBEAFE; }
`;

/* ── Style objects ───────────────────────────────────────────────────────── */

const card = {
  backgroundColor: "#fff", borderRadius: "16px", padding: "22px 24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
};
const sectionTitle = {
  margin: "0 0 18px 0", paddingBottom: "14px", borderBottom: "1px solid #F3F4F6",
  fontSize: "14px", fontWeight: "700", color: "#111827", display: "flex", alignItems: "center", gap: "8px",
};
const fieldLabel = { display: "block", fontSize: "13px", fontWeight: "500", color: "#374151", marginBottom: "7px" };
const errMsg  = { fontSize: "12px", color: "#EF4444", marginTop: "5px", marginBottom: 0 };
const hintMsg = { fontSize: "12px", color: "#9CA3AF", marginTop: "5px", marginBottom: 0 };
const badge = { width: "26px", height: "26px", borderRadius: "8px", backgroundColor: "#0D47A1", color: "#fff", fontSize: "12px", fontWeight: "700", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

/* ── Icons ───────────────────────────────────────────────────────────────── */

const ChevLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function buildPeriods(curriculumPeriods, existingPeriods) {
  const base = (curriculumPeriods || []).map((p) => ({
    name: p.name, startDate: "", endDate: "", breakStartDate: "", breakEndDate: "",
  }));
  if (!existingPeriods?.length) return base;
  return base.map((b) => {
    const m = existingPeriods.find((p) => p.name === b.name);
    return m
      ? { ...b, startDate: m.startDate || "", endDate: m.endDate || "", breakStartDate: m.breakStartDate || "", breakEndDate: m.breakEndDate || "" }
      : b;
  });
}

/* ── StepIndicator ───────────────────────────────────────────────────────── */

function StepIndicator({ current }) {
  return (
    <div className="ayp-steps">
      {STEPS.map((step, i) => {
        const done = step.n < current, active = step.n === current;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", backgroundColor: done || active ? "#0D47A1" : "#F3F4F6", border: `2px solid ${done || active ? "#0D47A1" : "#E5E7EB"}`, display: "flex", alignItems: "center", justifyContent: "center", color: done || active ? "#fff" : "#9CA3AF", fontSize: done ? "15px" : "13px", fontWeight: "700", flexShrink: 0 }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{ fontSize: "11px", fontWeight: active ? "600" : "400", color: active ? "#0D47A1" : done ? "#374151" : "#9CA3AF", whiteSpace: "nowrap" }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className="ayp-connector" style={{ height: "2px", backgroundColor: done ? "#0D47A1" : "#E5E7EB", margin: "0 6px", marginBottom: "20px", flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}

function Spinner() {
  return <span style={{ width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />;
}

function StatusDot({ status }) {
  const s = STATUSES.find((x) => x.value === status) || STATUSES[0];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 12px", borderRadius: "20px", backgroundColor: s.bg, border: `1.5px solid ${s.border}`, color: s.color, fontSize: "12px", fontWeight: "700" }}>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: s.dot, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

function StatusSelector({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {STATUSES.map((s) => (
        <button key={s.value} type="button" onClick={() => onChange(s.value)} className={`status-btn${value === s.value ? ` sel-${s.value}` : ""}`}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: value === s.value ? s.dot : "#D1D5DB", flexShrink: 0 }} />
            {s.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── PeriodCarousel (form / edit mode) ───────────────────────────────────── */

function PeriodCarousel({ periods, onChange, errors }) {
  const [idx, setIdx] = useState(0);
  const total = periods.length;
  if (total === 0) return null;

  const period = periods[idx];
  const pErr   = errors?.[idx] || {};

  const update = (field, value) => {
    const next = [...periods];
    next[idx] = { ...next[idx], [field]: value };
    onChange(next);
  };

  const hasBreak = period.breakStartDate || period.breakEndDate;

  return (
    <div className="carousel-wrap">
      {/* ── Navigation header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button type="button" className="carousel-arrow" onClick={() => setIdx((i) => i - 1)} disabled={idx === 0}>
          <ChevLeft />
        </button>

        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 18px", background: "linear-gradient(135deg, #0D47A1, #1565C0)", borderRadius: "20px" }}>
            <span style={{ color: "#fff", fontSize: "14px", fontWeight: "700" }}>{period.name}</span>
          </div>
          <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
            {idx + 1} of {total}
          </p>
        </div>

        <button type="button" className="carousel-arrow" onClick={() => setIdx((i) => i + 1)} disabled={idx === total - 1}>
          <ChevRight />
        </button>
      </div>

      {/* ── Period card content ── */}
      <div key={idx} className="carousel-card" style={{ padding: "20px", backgroundColor: "#F8FAFF", borderRadius: "12px", border: "1.5px solid #E8F0FE" }}>
        {/* Period dates */}
        <p style={{ margin: "0 0 12px", fontSize: "12px", fontWeight: "700", color: "#0D47A1", textTransform: "uppercase", letterSpacing: "0.06em" }}>Period Dates</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "0" }}>
          <div>
            <label style={fieldLabel}>Start date</label>
            <input type="date" value={period.startDate} onChange={(e) => update("startDate", e.target.value)} className={`ayp-input${pErr.startDate ? " err" : ""}`} />
            {pErr.startDate && <p style={errMsg}>{pErr.startDate}</p>}
          </div>
          <div>
            <label style={fieldLabel}>End date</label>
            <input type="date" value={period.endDate} onChange={(e) => update("endDate", e.target.value)} className={`ayp-input${pErr.endDate ? " err" : ""}`} />
            {pErr.endDate && <p style={errMsg}>{pErr.endDate}</p>}
          </div>
        </div>

        {/* Break divider */}
        <div className="break-divider">
          <div className="break-line" />
          <span style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", whiteSpace: "nowrap", flexShrink: 0 }}>
            Mid-term Break <span style={{ fontWeight: "400" }}>(optional)</span>
          </span>
          <div className="break-line" />
        </div>

        {/* Break dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={fieldLabel}>Break start</label>
            <input type="date" value={period.breakStartDate} onChange={(e) => update("breakStartDate", e.target.value)} className={`ayp-input${pErr.breakStartDate ? " err" : ""}`} />
            {pErr.breakStartDate && <p style={errMsg}>{pErr.breakStartDate}</p>}
          </div>
          <div>
            <label style={fieldLabel}>Break end</label>
            <input type="date" value={period.breakEndDate} onChange={(e) => update("breakEndDate", e.target.value)} className={`ayp-input${pErr.breakEndDate ? " err" : ""}`} />
            {pErr.breakEndDate && <p style={errMsg}>{pErr.breakEndDate}</p>}
          </div>
        </div>
        {(period.breakStartDate && !period.breakEndDate) || (!period.breakStartDate && period.breakEndDate)
          ? <p style={{ ...errMsg, marginTop: "8px" }}>Both break start and end dates are required.</p>
          : null}
      </div>

      {/* ── Dot indicators ── */}
      {total > 1 && (
        <div className="carousel-dots">
          {periods.map((_, i) => (
            <button key={i} type="button" onClick={() => setIdx(i)} className={`carousel-dot${i === idx ? " active" : ""}`} title={periods[i].name} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── PeriodCarouselView (read-only) ──────────────────────────────────────── */

function PeriodCarouselView({ periods }) {
  const [idx, setIdx] = useState(0);
  const total = periods.length;
  if (total === 0) return <p style={{ ...hintMsg, margin: 0 }}>No periods configured.</p>;

  const p = periods[idx];
  const hasBreak = p.breakStartDate || p.breakEndDate;

  return (
    <div className="carousel-wrap">
      {/* Nav header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
        <button type="button" className="carousel-arrow" onClick={() => setIdx((i) => i - 1)} disabled={idx === 0}>
          <ChevLeft />
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 18px", background: "linear-gradient(135deg, #0D47A1, #1565C0)", borderRadius: "20px" }}>
            <span style={{ color: "#fff", fontSize: "14px", fontWeight: "700" }}>{p.name}</span>
          </div>
          <p style={{ margin: "5px 0 0", fontSize: "11px", color: "#9CA3AF" }}>{idx + 1} of {total}</p>
        </div>
        <button type="button" className="carousel-arrow" onClick={() => setIdx((i) => i + 1)} disabled={idx === total - 1}>
          <ChevRight />
        </button>
      </div>

      {/* Content */}
      <div key={idx} className="carousel-card" style={{ padding: "20px", backgroundColor: "#F8FAFF", borderRadius: "12px", border: "1.5px solid #E8F0FE" }}>
        <p style={{ margin: "0 0 12px", fontSize: "12px", fontWeight: "700", color: "#0D47A1", textTransform: "uppercase", letterSpacing: "0.06em" }}>Period Dates</p>
        {(p.startDate || p.endDate) ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {[["FROM", p.startDate], ["TO", p.endDate]].map(([lbl, val]) => (
              <div key={lbl} style={{ padding: "12px 14px", backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #E8F0FE" }}>
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
            <div className="break-divider">
              <div className="break-line" />
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", whiteSpace: "nowrap", flexShrink: 0 }}>Mid-term Break</span>
              <div className="break-line" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[["BREAK FROM", p.breakStartDate], ["BREAK TO", p.breakEndDate]].map(([lbl, val]) => (
                <div key={lbl} style={{ padding: "12px 14px", backgroundColor: "#FFF7ED", borderRadius: "10px", border: "1px solid #FED7AA" }}>
                  <p style={{ margin: "0 0 3px", fontSize: "10px", fontWeight: "700", color: "#C2410C", textTransform: "uppercase", letterSpacing: "0.06em" }}>{lbl}</p>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>{fmtDate(val)}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {!hasBreak && (p.startDate || p.endDate) && (
          <div className="break-divider">
            <div className="break-line" />
            <span style={{ fontSize: "11px", color: "#D1D5DB", whiteSpace: "nowrap", flexShrink: 0 }}>No mid-term break</span>
            <div className="break-line" />
          </div>
        )}
      </div>

      {total > 1 && (
        <div className="carousel-dots">
          {periods.map((_, i) => (
            <button key={i} type="button" onClick={() => setIdx(i)} className={`carousel-dot${i === idx ? " active" : ""}`} title={periods[i].name} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── AcademicYearForm ────────────────────────────────────────────────────── */

function AcademicYearForm({ curriculum, initialData, isEdit, versionNumber, onSave, onCancel, isPending }) {
  const [label,     setLabel]     = useState(initialData?.label     || "");
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate,   setEndDate]   = useState(initialData?.endDate   || "");
  const [status,    setStatus]    = useState(initialData?.status    || "draft");
  const [periods,   setPeriods]   = useState(() => buildPeriods(curriculum.periods, initialData?.periods));
  const [errors,    setErrors]    = useState({});

  const validate = () => {
    const errs = {};
    if (!label.trim()) errs.label = "Year label is required";
    if (startDate && endDate && endDate < startDate) errs.endDate = "End date must be after start date";

    const pErrs = periods.map((p) => {
      const e = {};
      if (p.startDate && p.endDate && p.endDate < p.startDate) e.endDate = "End must be after start";
      if (p.breakStartDate && !p.breakEndDate) e.breakEndDate = "Break end date is required";
      if (!p.breakStartDate && p.breakEndDate) e.breakStartDate = "Break start date is required";
      if (p.breakStartDate && p.breakEndDate && p.breakEndDate < p.breakStartDate) e.breakEndDate = "Break end must be after start";
      return Object.keys(e).length ? e : null;
    });
    if (pErrs.some(Boolean)) errs.periods = pErrs;
    return errs;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({ label: label.trim(), startDate, endDate, status, periods });
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="ayp-main">
      {isEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", backgroundColor: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: "10px" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0D47A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: "13px", color: "#1E3A8A" }}>Saving will create <strong>Version {versionNumber}</strong> and archive the current version.</span>
        </div>
      )}

      {/* Year details */}
      <div style={card}>
        <h4 style={sectionTitle}><span style={badge}>1</span> Academic Year Details</h4>

        <div style={{ marginBottom: "16px" }}>
          <label style={fieldLabel}>Year Label <span style={{ color: "#EF4444" }}>*</span></label>
          <input type="text" value={label} onChange={(e) => { setLabel(e.target.value); setErrors((p) => ({ ...p, label: "" })); }} placeholder="e.g. 2025-2026" className={`ayp-input${errors.label ? " err" : ""}`} />
          {errors.label && <p style={errMsg}>{errors.label}</p>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
          <div>
            <label style={fieldLabel}>Year start</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="ayp-input" />
          </div>
          <div>
            <label style={fieldLabel}>Year end</label>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setErrors((p) => ({ ...p, endDate: "" })); }} className={`ayp-input${errors.endDate ? " err" : ""}`} />
            {errors.endDate && <p style={errMsg}>{errors.endDate}</p>}
          </div>
        </div>

        <div>
          <label style={{ ...fieldLabel, marginBottom: "10px" }}>Status</label>
          <StatusSelector value={status} onChange={setStatus} />
        </div>
      </div>

      {/* Periods carousel */}
      {periods.length > 0 ? (
        <div style={card}>
          <h4 style={sectionTitle}><span style={badge}>2</span> Academic Periods <span style={{ fontSize: "12px", fontWeight: "400", color: "#9CA3AF" }}>— add dates for each period</span></h4>
          <PeriodCarousel periods={periods} onChange={setPeriods} errors={errors.periods} />
        </div>
      ) : (
        <div style={{ ...card, textAlign: "center", padding: "32px 24px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
            No periods found. Go back to <strong>Structure</strong> and set an academic cycle first.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} className="ayp-btn-secondary">Cancel</button>
        <button type="submit" disabled={isPending} className="ayp-btn-primary">
          {isPending ? <><Spinner /> Saving…</> : isEdit ? "Save New Version" : "Create Academic Year"}
        </button>
      </div>
    </form>
  );
}

/* ── AcademicYearView ────────────────────────────────────────────────────── */

function AcademicYearView({ current, history, curriculumId, onEdit, onNewFresh }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { mutate: changeStatus, isPending: changingStatus } = useChangeAcademicYearStatus(curriculumId);

  return (
    <div className="ayp-main">
      {/* Overview */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "800", color: "#0F2645" }}>{current.label}</h2>
              <StatusDot status={current.status} />
              {current.versionNumber > 1 && (
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#6B7280", backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: "20px", padding: "2px 8px" }}>v{current.versionNumber}</span>
              )}
            </div>
            {(current.startDate || current.endDate) && (
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280" }}>{fmtDate(current.startDate)} → {fmtDate(current.endDate)}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button type="button" onClick={onNewFresh} className="ayp-btn-secondary" style={{ fontSize: "13px", padding: "9px 16px" }}>New from Scratch</button>
            <button type="button" onClick={onEdit} className="ayp-btn-ghost">Edit → New Version</button>
          </div>
        </div>

        {/* Status change */}
        <div style={{ marginTop: "18px", paddingTop: "16px", borderTop: "1px solid #F3F4F6" }}>
          <p style={{ ...fieldLabel, marginBottom: "10px" }}>Change status</p>
          <div style={{ display: "flex", gap: "8px", opacity: changingStatus ? 0.6 : 1 }}>
            {STATUSES.map((s) => (
              <button key={s.value} type="button" disabled={changingStatus} onClick={() => { if (s.value !== current.status) changeStatus({ yearId: current.id, status: s.value }); }} className={`status-btn${current.status === s.value ? ` sel-${s.value}` : ""}`}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: current.status === s.value ? s.dot : "#D1D5DB", flexShrink: 0 }} />
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Periods carousel */}
      {(current.periods || []).length > 0 && (
        <div style={card}>
          <h4 style={sectionTitle}>Academic Periods</h4>
          <PeriodCarouselView periods={current.periods} />
        </div>
      )}

      {/* Version history */}
      {history.length > 0 && (
        <div style={card}>
          <button type="button" onClick={() => setHistoryOpen((o) => !o)} style={{ width: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "Inter, sans-serif", padding: 0 }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0D47A1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4"/><polyline points="3 16 3 11 8 11"/></svg>
              Version History
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#6B7280", backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: "20px", padding: "2px 8px" }}>{history.length}</span>
            </h4>
            <span style={{ fontSize: "16px", color: "#9CA3AF" }}>{historyOpen ? "▲" : "▼"}</span>
          </button>

          {historyOpen && (
            <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="version-row cur">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#1D4ED8", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "20px", padding: "2px 10px" }}>v{current.versionNumber} · Current</span>
                  <span style={{ fontSize: "12px", color: "#6B7280" }}>{fmtDate(current.updatedAt)}</span>
                </div>
                <StatusDot status={current.status} />
              </div>
              {history.map((v) => (
                <div key={v.id} className="version-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#6B7280", backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: "20px", padding: "2px 10px" }}>v{v.versionNumber}</span>
                    <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{fmtDate(v.updatedAt)}</span>
                    {v.label && <span style={{ fontSize: "12px", color: "#374151" }}>{v.label}</span>}
                  </div>
                  <StatusDot status={v.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AcademicYearPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: curriculum, isLoading: loadingCurriculum } = useCurriculumQuery(id);
  const { data: yearData,   isLoading: loadingYears }      = useAcademicYears(id);

  const { mutate: createYear, isPending: creating } = useCreateAcademicYear(id);
  const { mutate: editYear,   isPending: editing }  = useEditAcademicYear(id);

  const [mode, setMode] = useState("view");

  const current = yearData?.current || null;
  const history = yearData?.history || [];
  const isLoading = loadingCurriculum || loadingYears;

  useEffect(() => {
    if (!loadingYears && !current) setMode("create");
  }, [loadingYears, current]);

  const handleCreate = (data) => createYear({ ...data, isFresh: false }, { onSuccess: () => setMode("view") });
  const handleEdit   = (data) => editYear({ yearId: current.id, data }, { onSuccess: () => setMode("view") });

  const handleNewFresh = () => {
    if (!window.confirm("Start completely fresh? This will archive the current academic year.")) return;
    createYear(
      { label: "", startDate: "", endDate: "", status: "draft", periods: buildPeriods(curriculum?.periods), isFresh: true },
      { onSuccess: () => setMode("create") }
    );
  };

  const isPending = creating || editing;

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", fontFamily: "Inter, sans-serif", gap: "14px", color: "#6B7280", fontSize: "14px" }}>
        <span style={{ width: "28px", height: "28px", border: "3px solid #E5E7EB", borderTopColor: "#0D47A1", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
        Loading…
      </div>
    );
  }

  const nextVersionNumber = current ? current.versionNumber + 1 : 1;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <button type="button" onClick={() => navigate("/curriculum")} style={{ background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer", padding: 0 }}>← Curriculum</button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#6B7280", maxWidth: "160px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{curriculum?.name}</span>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Academic Year</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Academic Year</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            {mode === "edit" ? "Editing — saving creates a new version." : mode === "create" ? "Set up the academic year and period dates." : "Manage periods, dates, and status."}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <button type="button" onClick={() => navigate(`/curriculum/${id}/structure`)} className="ayp-btn-secondary">← Structure</button>
          <button type="button" onClick={() => navigate("/curriculum")} className="ayp-btn-secondary">Done</button>
          <button type="button" onClick={() => navigate(`/curriculum/${id}/versions`)} className="ayp-btn-primary">Next: Version Control →</button>
        </div>
      </div>

      <StepIndicator current={3} />

      {(mode === "create" || mode === "edit") ? (
        <AcademicYearForm
          curriculum={curriculum || { periods: [] }}
          initialData={mode === "edit" ? current : null}
          isEdit={mode === "edit"}
          versionNumber={nextVersionNumber}
          onSave={mode === "edit" ? handleEdit : handleCreate}
          onCancel={() => setMode(current ? "view" : "create")}
          isPending={isPending}
        />
      ) : (
        current && (
          <AcademicYearView
            current={current}
            history={history}
            curriculumId={id}
            onEdit={() => setMode("edit")}
            onNewFresh={handleNewFresh}
          />
        )
      )}
    </div>
  );
}
