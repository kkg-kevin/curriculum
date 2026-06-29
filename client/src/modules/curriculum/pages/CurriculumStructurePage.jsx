import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useCurriculumQuery, useUpdateCurriculum } from "../hooks/useCurriculum";
import { CURRICULUM_TYPES } from "../schemas/curriculum.schema";

/* ── Constants ───────────────────────────────────────────────────────────── */

const PREDEFINED_PERIODS = {
  terms: ["Term 1", "Term 2", "Term 3"],
  semesters: ["Semester 1", "Semester 2"],
};

const CYCLE_OPTIONS = [
  { value: "terms",     label: "3 Terms",     sub: "Three academic terms" },
  { value: "semesters", label: "2 Semesters", sub: "Two academic semesters" },
  { value: "custom",    label: "Custom",       sub: "Define your own" },
];

const STEPS = [
  { n: 1, label: "Basic Info" },
  { n: 2, label: "Structure" },
  { n: 3, label: "Competencies" },
  { n: 4, label: "Academic Year" },
  { n: 5, label: "Version Control" },
];

/* ── CSS ─────────────────────────────────────────────────────────────────── */

const CSS = `
  @keyframes spin { to { transform: rotate(360deg); } }

  .csp-input, .csp-select {
    width: 100%;
    padding: 11px 14px;
    border-radius: 10px;
    border: 1.5px solid #E5E7EB;
    font-size: 14px;
    font-family: Inter, sans-serif;
    background-color: #F9FAFB;
    color: #111827;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
  }
  .csp-input:focus, .csp-select:focus {
    border-color: #25476a;
    background-color: #F0F7FF;
    box-shadow: 0 0 0 3px rgba(37,71,106,0.1);
  }
  .csp-input.err { border-color: #EF4444; background-color: #FFF5F5; }
  .csp-select {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
    cursor: pointer;
  }

  .csp-layout {
    display: flex;
    gap: 24px;
    align-items: flex-start;
  }
  .csp-col-left  { flex: 0 0 340px; display: flex; flex-direction: column; gap: 20px; }
  .csp-col-right { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 20px; }

  @media (max-width: 900px) {
    .csp-layout { flex-direction: column; }
    .csp-col-left  { flex: none; width: 100%; }
  }

  .csp-steps {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 28px;
  }
  .csp-connector { width: 60px; }
  @media (max-width: 520px) {
    .csp-connector { width: 36px; }
    .csp-steps { justify-content: flex-start; overflow-x: auto; padding-bottom: 4px; }
  }

  .cycle-btn {
    flex: 1;
    padding: 13px 8px;
    border-radius: 10px;
    border: 1.5px solid #E5E7EB;
    background: #fff;
    cursor: pointer;
    text-align: center;
    font-family: Inter, sans-serif;
    transition: all 0.15s;
  }
  .cycle-btn:hover { border-color: #b8d9ee; background: #F8FBFF; }
  .cycle-btn.active { border: 2px solid #25476a; background: #e8f5fb; }

  .period-preview-grid {
    display: grid;
    gap: 12px;
  }

  .period-card {
    background: #fff;
    border: 1.5px solid #E5E7EB;
    border-radius: 12px;
    overflow: hidden;
  }
  .period-card-head {
    padding: 10px 14px;
    background: linear-gradient(135deg, #25476a 0%, #2e7db5 100%);
    color: #fff;
    font-size: 13px;
    font-weight: 700;
    font-family: Inter, sans-serif;
    letter-spacing: 0.01em;
  }
  .period-card-body {
    padding: 10px 14px;
    min-height: 72px;
  }

  .class-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 6px 5px 12px;
    background: #e8f5fb;
    border: 1px solid #a8d5ee;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    color: #25476a;
  }
  .class-chip-x {
    background: none;
    border: none;
    cursor: pointer;
    color: #b8d9ee;
    font-size: 15px;
    line-height: 1;
    padding: 0 3px;
    display: flex;
    align-items: center;
    font-family: Inter, sans-serif;
    transition: color 0.1s;
  }
  .class-chip-x:hover { color: #EF4444; }
`;

/* ── Shared style objects ────────────────────────────────────────────────── */

const card = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "22px 24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
};

const sectionTitle = (extra = {}) => ({
  margin: "0 0 18px 0",
  paddingBottom: "14px",
  borderBottom: "1px solid #F3F4F6",
  fontSize: "14px", fontWeight: "700", color: "#111827",
  display: "flex", alignItems: "center", gap: "8px",
  ...extra,
});

const stepBadge = {
  width: "26px", height: "26px", borderRadius: "8px",
  backgroundColor: "#25476a", color: "#fff",
  fontSize: "12px", fontWeight: "700",
  display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};

const fieldLabel = {
  display: "block", fontSize: "13px", fontWeight: "500",
  color: "#374151", marginBottom: "7px",
};

const errMsg  = { fontSize: "12px", color: "#EF4444", marginTop: "5px", marginBottom: 0 };
const hintMsg = { fontSize: "12px", color: "#9CA3AF", marginTop: "5px", marginBottom: 0 };

/* ── StepIndicator (same pattern as Phase 1) ─────────────────────────────── */

function StepIndicator({ current }) {
  return (
    <div className="csp-steps">
      {STEPS.map((step, i) => {
        const done   = step.n < current;
        const active = step.n === current;
        return (
          <div key={step.n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%",
                backgroundColor: done || active ? "#25476a" : "#F3F4F6",
                border: `2px solid ${done || active ? "#25476a" : "#E5E7EB"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: done || active ? "#fff" : "#9CA3AF",
                fontSize: done ? "15px" : "13px", fontWeight: "700",
                transition: "all 0.2s", flexShrink: 0,
              }}>
                {done ? "✓" : step.n}
              </div>
              <span style={{
                fontSize: "11px",
                fontWeight: active ? "600" : "400",
                color: active ? "#25476a" : done ? "#374151" : "#9CA3AF",
                whiteSpace: "nowrap",
              }}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="csp-connector" style={{
                height: "2px",
                backgroundColor: done ? "#25476a" : "#E5E7EB",
                margin: "0 6px", marginBottom: "20px", flexShrink: 0,
                transition: "background-color 0.2s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      width: "14px", height: "14px",
      border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff",
      borderRadius: "50%", display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function derivePeriodNames(cycleModel, customNames) {
  if (cycleModel === "custom") return customNames.filter((n) => n.trim());
  return PREDEFINED_PERIODS[cycleModel] ?? PREDEFINED_PERIODS.terms;
}

/* ── Main page ───────────────────────────────────────────────────────────── */

export default function CurriculumStructurePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: curriculum, isLoading, isError } = useCurriculumQuery(id);
  const { mutate: updateCurriculum, isPending } = useUpdateCurriculum();

  /* Settings */
  const [curriculumType, setCurriculumType] = useState("");
  const [cycleModel,   setCycleModel]   = useState("terms");

  /* Custom cycle */
  const [customPeriodCount, setCustomPeriodCount] = useState(3);
  const [customPeriodNames, setCustomPeriodNames] = useState(["Period 1", "Period 2", "Period 3"]);

  /* Classes */
  const [classes,    setClasses]    = useState([]);
  const [classInput, setClassInput] = useState("");

  /* Validation */
  const [errors, setErrors] = useState({});

  /* Seed state from loaded curriculum */
  useEffect(() => {
    if (!curriculum) return;

    setCurriculumType(curriculum.curriculumType || "");

    const model = curriculum.academicCycleModel || "terms";
    setCycleModel(model);

    if (model === "custom" && curriculum.periods?.length) {
      const names = curriculum.periods.map((p) => p.name || "");
      setCustomPeriodCount(names.length);
      setCustomPeriodNames(names);
    }

    setClasses(curriculum.classes || []);
  }, [curriculum?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Custom period count sync */
  const handleCustomCount = (n) => {
    const count = Math.max(1, Math.min(12, n));
    setCustomPeriodCount(count);
    setCustomPeriodNames((prev) => {
      const next = [...prev];
      while (next.length < count) next.push(`Period ${next.length + 1}`);
      return next.slice(0, count);
    });
  };

  /* Classes */
  const addClasses = () => {
    if (!classInput.trim()) return;
    const typed    = classInput.split(",").map((c) => c.trim()).filter(Boolean);
    const incoming = typed.filter((c) => !classes.includes(c));
    if (incoming.length) {
      setClasses((p) => [...p, ...incoming]);
    } else {
      toast.error(typed.length === 1 ? `"${typed[0]}" is already in the list` : "All typed classes are already in the list");
    }
    setClassInput("");
  };

  const handleClassKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); addClasses(); }
  };

  const removeClass = (name) => setClasses((p) => p.filter((c) => c !== name));

  /* Save + navigate */
  const handleSave = (destination) => {
    const errs = {};
    if (cycleModel === "custom") {
      if (customPeriodNames.some((n) => !n.trim())) errs.periods = "Please fill in all period names";
      if (!customPeriodNames.some((n) => n.trim())) errs.periods = "Enter at least one period name";
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const periodNames = derivePeriodNames(cycleModel, customPeriodNames);
    const periods     = periodNames.map((name) => ({ name }));

    updateCurriculum(
      { id: curriculum.id, data: { academicCycleModel: cycleModel, periods, classes, curriculumType } },
      { onSuccess: () => navigate(destination) }
    );
  };

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", fontFamily: "Inter, sans-serif", gap: "14px", color: "#6B7280", fontSize: "14px" }}>
        <span style={{ width: "28px", height: "28px", border: "3px solid #E5E7EB", borderTopColor: "#25476a", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        Loading curriculum…
      </div>
    );
  }

  if (isError || !curriculum) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", textAlign: "center", padding: "60px 20px" }}>
        <p style={{ fontSize: "16px", color: "#EF4444", marginBottom: "16px" }}>Could not load curriculum.</p>
        <button type="button" onClick={() => navigate("/curriculum")} style={{ padding: "10px 20px", backgroundColor: "#25476a", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Back to Curriculum
        </button>
      </div>
    );
  }

  const periodNames = derivePeriodNames(cycleModel, customPeriodNames);
  const gridCols    = Math.min(periodNames.length, 3);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{CSS}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <button type="button" onClick={() => navigate("/curriculum")} style={{ background: "none", border: "none", color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer", padding: 0 }}>
              ← Curriculum
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#6B7280", maxWidth: "160px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{curriculum.name}</span>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Structure</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>Curriculum Structure</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Set the framework, academic cycle, and grade classes.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <button type="button" onClick={() => handleSave("/curriculum")} disabled={isPending} style={{ padding: "10px 20px", backgroundColor: "transparent", color: "#374151", border: "1.5px solid #E5E7EB", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer" }}>
            Done
          </button>
          <button type="button" onClick={() => handleSave(`/curriculum/${id}/competencies`)} disabled={isPending} style={{ padding: "10px 24px", backgroundColor: isPending ? "#b8d9ee" : "#25476a", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: isPending ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "background-color 0.15s" }}>
            {isPending ? <><Spinner /> Saving…</> : "Next: Competencies →"}
          </button>
        </div>
      </div>

      {/* ── Step indicator ─────────────────────────────────────────────── */}
      <StepIndicator current={2} />

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="csp-layout">

        {/* LEFT: settings */}
        <div className="csp-col-left">

          {/* Framework */}
          <div style={card}>
            <h4 style={sectionTitle()}>
              <span style={stepBadge}>1</span>
              Curriculum Framework
            </h4>

            <label style={fieldLabel}>
              Curriculum Type
            </label>
            <select
              value={curriculumType}
              onChange={(e) => setCurriculumType(e.target.value)}
              className="csp-select"
            >
              <option value="">Select type…</option>
              {CURRICULUM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p style={hintMsg}>How this curriculum is categorised in the learning framework.</p>
          </div>

          {/* Cycle */}
          <div style={card}>
            <h4 style={sectionTitle()}>
              <span style={stepBadge}>2</span>
              Academic Cycle
            </h4>

            <div style={{ display: "flex", gap: "10px", marginBottom: cycleModel === "custom" ? "20px" : 0 }}>
              {CYCLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCycleModel(opt.value)}
                  className={`cycle-btn${cycleModel === opt.value ? " active" : ""}`}
                >
                  <div style={{ fontSize: "13px", fontWeight: cycleModel === opt.value ? "700" : "600", color: cycleModel === opt.value ? "#25476a" : "#374151", marginBottom: "3px" }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: "11px", color: cycleModel === opt.value ? "#2e7db5" : "#9CA3AF" }}>
                    {opt.sub}
                  </div>
                </button>
              ))}
            </div>

            {cycleModel === "custom" && (
              <div>
                <div style={{ marginBottom: "14px" }}>
                  <label style={fieldLabel}>Number of periods</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={customPeriodCount}
                    onChange={(e) => handleCustomCount(Number(e.target.value))}
                    className="csp-input"
                    style={{ maxWidth: "110px" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {customPeriodNames.map((name, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "500", color: "#9CA3AF", width: "62px", flexShrink: 0 }}>
                        Period {i + 1}
                      </span>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          const next = [...customPeriodNames];
                          next[i] = e.target.value;
                          setCustomPeriodNames(next);
                          setErrors((p) => ({ ...p, periods: "" }));
                        }}
                        placeholder={`e.g. Quarter ${i + 1}`}
                        className={`csp-input${errors.periods ? " err" : ""}`}
                      />
                    </div>
                  ))}
                </div>
                {errors.periods && <p style={{ ...errMsg, marginTop: "8px" }}>{errors.periods}</p>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: classes + structure preview */}
        <div className="csp-col-right">

          {/* Classes */}
          <div style={card}>
            <h4 style={sectionTitle()}>
              <span style={stepBadge}>3</span>
              Grade Classes
              <span style={{ fontSize: "12px", fontWeight: "400", color: "#9CA3AF" }}>
                — applied to all {cycleModel === "semesters" ? "semesters" : "periods"}
              </span>
            </h4>

            {/* Input */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input
                type="text"
                value={classInput}
                onChange={(e) => setClassInput(e.target.value)}
                onKeyDown={handleClassKey}
                placeholder="e.g. Grade 1, Grade 2, PP1, PP2"
                className="csp-input"
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={addClasses}
                style={{
                  flexShrink: 0, padding: "0 20px", height: "44px",
                  backgroundColor: "#25476a", color: "#fff",
                  border: "none", borderRadius: "10px",
                  fontSize: "13px", fontWeight: "600",
                  fontFamily: "Inter, sans-serif", cursor: "pointer",
                  transition: "background-color 0.15s",
                }}
              >
                Add
              </button>
            </div>
            <p style={{ ...hintMsg, marginBottom: "14px" }}>
              Separate multiple classes with commas. Press Enter or click Add.
            </p>

            {/* Chips */}
            {classes.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {classes.map((cls) => (
                  <span key={cls} className="class-chip">
                    {cls}
                    <button type="button" className="class-chip-x" onClick={() => removeClass(cls)} title="Remove">×</button>
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ padding: "22px", backgroundColor: "#F9FAFB", border: "1.5px dashed #E5E7EB", borderRadius: "10px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
                  No classes added yet. Type class names above separated by commas.
                </p>
              </div>
            )}
          </div>

          {/* Structure preview */}
          <div style={card}>
            <h4 style={sectionTitle({ marginBottom: "16px" })}>
              Structure Preview
              {periodNames.length > 0 && classes.length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: "600", color: "#38aae1", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee", borderRadius: "20px", padding: "2px 10px" }}>
                  {periodNames.length} {cycleModel === "semesters" ? "semester" : "period"}{periodNames.length !== 1 ? "s" : ""} · {classes.length} class{classes.length !== 1 ? "es" : ""}
                </span>
              )}
            </h4>

            {periodNames.length === 0 ? (
              <div style={{ padding: "32px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
                  {cycleModel === "custom"
                    ? "Fill in the period names above to see the structure preview."
                    : "Select an academic cycle to see the structure preview."}
                </p>
              </div>
            ) : (
              <div
                className="period-preview-grid"
                style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
              >
                {periodNames.map((pName) => (
                  <div key={pName} className="period-card">
                    <div className="period-card-head">{pName}</div>
                    <div className="period-card-body">
                      {classes.length > 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                          {classes.map((cls) => (
                            <div key={cls} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "3px 0" }}>
                              <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "#25476a", flexShrink: 0 }} />
                              <span style={{ fontSize: "12px", color: "#374151", fontWeight: "500" }}>{cls}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>
                          No classes yet
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
