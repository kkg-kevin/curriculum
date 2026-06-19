import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCurriculumQuery, useUpdateCurriculum, useUpdateStructure } from "../hooks/useCurriculum";
import {
  curriculumSettingsSchema,
  FRAMEWORKS,
  FRAMEWORK_LABELS,
} from "../schemas/curriculum.schema";
import StructureContent from "../components/structure/StructureContent";
import StructureOverview from "../components/structure/StructureOverview";
import AcademicPeriodFields from "../components/AcademicPeriodFields";

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;

/* ── Shared style helpers ──────────────────────────────────────────────── */

const labelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: "500",
  color: "#374151",
  marginBottom: "6px",
};

const getInputStyle = (hasError) => ({
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${hasError ? "#EF4444" : "#E5E7EB"}`,
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: hasError ? "#FFF5F5" : "#F9FAFB",
  outline: "none",
  boxSizing: "border-box",
  color: "#111827",
  transition: "border-color 0.15s",
});

const errorTextStyle = { fontSize: "12px", color: "#EF4444", marginTop: "4px", marginBottom: 0 };
const hintStyle     = { fontSize: "12px", color: "#9CA3AF", marginTop: "4px", marginBottom: 0 };

function FieldError({ error }) {
  if (!error) return null;
  return <p style={errorTextStyle}>{error.message}</p>;
}

/* ── CycleModelSelector ────────────────────────────────────────────────── */

const CYCLE_OPTIONS = [
  { value: "terms",     label: "Terms",     description: "3 academic terms",    icon: "📚" },
  { value: "semesters", label: "Semesters", description: "2 academic semesters", icon: "🎓" },
  { value: "custom",    label: "Custom",    description: "Flexible structure",   icon: "⚙️" },
];

function CycleModelSelector({ value, onChange, error }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
        {CYCLE_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                padding: "12px 10px",
                borderRadius: "10px",
                border: isSelected ? "2px solid #0D47A1" : "1.5px solid #E5E7EB",
                backgroundColor: isSelected ? "#EFF6FF" : "#ffffff",
                cursor: "pointer",
                textAlign: "center",
                fontFamily: "Inter, sans-serif",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: "20px", marginBottom: "4px" }}>{option.icon}</div>
              <div style={{ fontSize: "13px", fontWeight: isSelected ? "700" : "600", color: isSelected ? "#0D47A1" : "#374151", marginBottom: "2px" }}>
                {option.label}
              </div>
              <div style={{ fontSize: "11px", color: isSelected ? "#1565C0" : "#9CA3AF" }}>
                {option.description}
              </div>
            </button>
          );
        })}
      </div>
      {error && <p style={errorTextStyle}>{error.message}</p>}
    </div>
  );
}

/* ── ClassInlineInput ──────────────────────────────────────────────────── */

function ClassInlineInput({ onConfirm, onCancel }) {
  const [val, setVal] = useState("");
  return (
    <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
      <input
        autoFocus
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); if (val.trim()) onConfirm(val.trim()); }
          if (e.key === "Escape") onCancel();
        }}
        placeholder="e.g. Grade 7, Form 1, Year 1..."
        style={{
          flex: 1,
          padding: "9px 12px",
          borderRadius: "9px",
          border: "1.5px solid #BFDBFE",
          fontSize: "13px",
          fontFamily: "Inter, sans-serif",
          outline: "none",
          backgroundColor: "#F0F7FF",
          color: "#111827",
        }}
      />
      <button
        type="button"
        onClick={() => { if (val.trim()) onConfirm(val.trim()); }}
        style={{
          padding: "9px 16px",
          backgroundColor: "#0D47A1",
          color: "#fff",
          border: "none",
          borderRadius: "9px",
          fontSize: "13px",
          fontWeight: "600",
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
        }}
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: "9px 12px",
          backgroundColor: "transparent",
          color: "#6B7280",
          border: "1px solid #E5E7EB",
          borderRadius: "9px",
          fontSize: "14px",
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

/* ── SetupPanel ────────────────────────────────────────────────────────── */

const STANDARD_FRAMEWORKS = FRAMEWORKS.filter((f) => f !== "Custom");

function getClassListFromStructure(structure) {
  for (const term of structure) {
    if (term.grades && term.grades.length > 0) {
      return term.grades.map((g) => ({ id: g.id, name: g.name }));
    }
  }
  return [];
}

function SetupPanel({ curriculum, structure, onClassSync }) {
  const { mutate: updateCurriculum, isPending: isSavingSettings } = useUpdateCurriculum();

  const isConfigured = !!(curriculum.framework) && (curriculum.periods?.length || 0) > 0;
  const [panelOpen, setPanelOpen] = useState(!isConfigured);

  // Framework custom mode
  const savedIsCustom = !!(curriculum.framework) && !STANDARD_FRAMEWORKS.includes(curriculum.framework);
  const [isCustomMode, setIsCustomMode] = useState(savedIsCustom);
  const [customText,   setCustomText]   = useState(savedIsCustom ? curriculum.framework : "");

  // Class list
  const [classList,   setClassList]   = useState(() => getClassListFromStructure(structure));
  const [addingClass, setAddingClass] = useState(false);
  const panelWasOpen = useRef(panelOpen);

  // Refresh class list when panel opens
  useEffect(() => {
    if (panelOpen && !panelWasOpen.current) {
      setClassList(getClassListFromStructure(structure));
    }
    panelWasOpen.current = panelOpen;
  }, [panelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync form when curriculum is updated externally
  const methods = useForm({
    resolver: zodResolver(curriculumSettingsSchema),
    defaultValues: {
      framework: curriculum.framework || "",
      academicCycleModel: curriculum.academicCycleModel || "terms",
      periods: curriculum.periods || [],
    },
    mode: "onTouched",
  });

  const { handleSubmit, setValue, watch, reset, formState: { errors } } = methods;
  const cycleModel      = watch("academicCycleModel");
  const frameworkValue  = watch("framework");
  const selectDisplayValue = isCustomMode ? "Custom" : (frameworkValue || "");

  useEffect(() => {
    const fw = curriculum.framework || "";
    const nowCustom = !!(fw) && !STANDARD_FRAMEWORKS.includes(fw);
    setIsCustomMode(nowCustom);
    setCustomText(nowCustom ? fw : "");
    reset({
      framework: fw,
      academicCycleModel: curriculum.academicCycleModel || "terms",
      periods: curriculum.periods || [],
    });
  }, [curriculum.updatedAt, reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFrameworkSelect = (e) => {
    const val = e.target.value;
    if (val === "Custom") {
      setIsCustomMode(true);
      setCustomText("");
      setValue("framework", "", { shouldValidate: false });
    } else {
      setIsCustomMode(false);
      setCustomText("");
      setValue("framework", val, { shouldValidate: true });
    }
  };

  const handleCustomTextChange = (e) => {
    const val = e.target.value;
    setCustomText(val);
    setValue("framework", val, { shouldValidate: true });
  };

  const exitCustomMode = () => {
    setIsCustomMode(false);
    setCustomText("");
    setValue("framework", "", { shouldValidate: false });
  };

  const handleAddClass = (name) => {
    setClassList((prev) => [...prev, { id: genId(), name }]);
    setAddingClass(false);
  };

  const handleRemoveClass = (id) => {
    setClassList((prev) => prev.filter((c) => c.id !== id));
  };

  const onSubmit = (data) => {
    updateCurriculum(
      { id: curriculum.id, data },
      {
        onSuccess: () => {
          onClassSync(classList, data.periods);
          setPanelOpen(false);
        },
      }
    );
  };

  const cycleLabel =
    curriculum.academicCycleModel === "semesters" ? "Semesters"
    : curriculum.academicCycleModel === "terms"   ? "Terms"
    : "Periods";

  return (
    <div
      style={{
        marginBottom: "20px",
        borderRadius: "14px",
        border: isConfigured ? "1.5px solid #BFDBFE" : "1.5px solid #FCD34D",
        backgroundColor: "#ffffff",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      }}
    >
      {/* ── Panel header ── */}
      <button
        type="button"
        onClick={() => setPanelOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          backgroundColor: panelOpen ? "#EFF6FF" : isConfigured ? "#F8FAFF" : "#FFFBEB",
          textAlign: "left",
          borderBottom: panelOpen ? "1px solid #E5E7EB" : "none",
          transition: "background-color 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: isConfigured ? "#0D47A1" : "#D97706",
              color: "#fff",
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isConfigured ? "⚙" : "!"}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: isConfigured ? "#1E3A5F" : "#92400E" }}>
              {isConfigured ? "Curriculum Settings" : "Setup Required"}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: "12px", color: isConfigured ? "#6B7280" : "#B45309" }}>
              {isConfigured
                ? `${curriculum.framework} · ${curriculum.periods.length} ${cycleLabel}${classList.length > 0 ? ` · ${classList.length} classes` : ""}`
                : "Configure framework and academic periods to enable the structure"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {isConfigured && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: "#1D4ED8",
                backgroundColor: "#EFF6FF",
                border: "1px solid #BFDBFE",
                borderRadius: "20px",
                padding: "2px 10px",
              }}
            >
              Configured
            </span>
          )}
          <span style={{ fontSize: "18px", color: "#9CA3AF", lineHeight: 1 }}>
            {panelOpen ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {/* ── Panel body ── */}
      {panelOpen && (
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ padding: "20px 22px 22px" }}>

            {/* Framework + Cycle model */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
              {/* Framework */}
              <div>
                <label style={{ ...labelStyle, marginBottom: "8px" }}>
                  Curriculum Framework <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <select
                  value={selectDisplayValue}
                  onChange={handleFrameworkSelect}
                  style={{
                    ...getInputStyle(!isCustomMode && !!errors.framework),
                    appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 14px center",
                    paddingRight: "36px",
                    cursor: "pointer",
                  }}
                >
                  <option value="">Select a framework...</option>
                  {FRAMEWORKS.map((fw) => (
                    <option key={fw} value={fw}>{FRAMEWORK_LABELS[fw]}</option>
                  ))}
                </select>

                {isCustomMode && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "12px 14px",
                      backgroundColor: "#F0F7FF",
                      border: "1.5px solid #BFDBFE",
                      borderRadius: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#0D47A1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        ✏ Custom Framework
                      </span>
                      <button
                        type="button"
                        onClick={exitCustomMode}
                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#6B7280", fontFamily: "Inter, sans-serif", padding: 0 }}
                      >
                        ← Use standard
                      </button>
                    </div>
                    <input
                      autoFocus
                      type="text"
                      value={customText}
                      onChange={handleCustomTextChange}
                      placeholder="e.g. Montessori, Waldorf..."
                      style={{ ...getInputStyle(!!errors.framework), backgroundColor: "#ffffff" }}
                    />
                    {!errors.framework && <p style={hintStyle}>This name will appear as the framework label.</p>}
                  </div>
                )}
                <FieldError error={errors.framework} />
              </div>

              {/* Cycle model */}
              <div>
                <label style={{ ...labelStyle, marginBottom: "10px" }}>
                  Academic Cycle Model <span style={{ color: "#EF4444" }}>*</span>
                </label>
                <CycleModelSelector
                  value={cycleModel}
                  onChange={(val) => setValue("academicCycleModel", val, { shouldValidate: true })}
                  error={errors.academicCycleModel}
                />
              </div>
            </div>

            {/* Academic periods */}
            <div style={{ marginBottom: "24px" }}>
              <label style={{ ...labelStyle, marginBottom: "12px" }}>
                Academic Periods <span style={{ color: "#EF4444" }}>*</span>
              </label>
              <AcademicPeriodFields />
            </div>

            {/* ── Classes ── */}
            <div
              style={{
                borderTop: "1px solid #F3F4F6",
                paddingTop: "20px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>
                    Classes
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6B7280" }}>
                    Defined once — automatically applied to every term.
                  </p>
                </div>
                {!addingClass && (
                  <button
                    type="button"
                    onClick={() => setAddingClass(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "7px 13px",
                      backgroundColor: "#EFF6FF",
                      color: "#0D47A1",
                      border: "1.5px solid #BFDBFE",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "600",
                      fontFamily: "Inter, sans-serif",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    + Add Class
                  </button>
                )}
              </div>

              {/* Class chips */}
              {classList.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: addingClass ? "0" : "0" }}>
                  {classList.map((cls) => (
                    <span
                      key={cls.id}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "5px 6px 5px 12px",
                        backgroundColor: "#EFF6FF",
                        border: "1px solid #BFDBFE",
                        borderRadius: "20px",
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "#1D4ED8",
                      }}
                    >
                      {cls.name}
                      <button
                        type="button"
                        onClick={() => handleRemoveClass(cls.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#93C5FD",
                          fontSize: "15px",
                          lineHeight: 1,
                          padding: "0 4px",
                          display: "flex",
                          alignItems: "center",
                        }}
                        title="Remove class"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                !addingClass && (
                  <div
                    style={{
                      padding: "20px",
                      backgroundColor: "#F9FAFB",
                      border: "1.5px dashed #E5E7EB",
                      borderRadius: "10px",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
                      No classes defined yet. Click <strong>+ Add Class</strong> to get started.
                    </p>
                  </div>
                )
              )}

              {/* Inline add input */}
              {addingClass && (
                <ClassInlineInput
                  onConfirm={handleAddClass}
                  onCancel={() => setAddingClass(false)}
                />
              )}
            </div>

            {/* Save / Cancel */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              {isConfigured && (
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "transparent",
                    color: "#374151",
                    border: "1.5px solid #E5E7EB",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "600",
                    fontFamily: "Inter, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSavingSettings}
                style={{
                  padding: "10px 24px",
                  backgroundColor: isSavingSettings ? "#93C5FD" : "#0D47A1",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "600",
                  fontFamily: "Inter, sans-serif",
                  cursor: isSavingSettings ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background-color 0.15s",
                }}
              >
                {isSavingSettings ? (
                  <>
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.4)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        display: "inline-block",
                        animation: "spin 0.7s linear infinite",
                      }}
                    />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </button>
            </div>
          </form>
        </FormProvider>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function CurriculumStructurePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: curriculum, isLoading, isError } = useCurriculumQuery(id);
  const { mutate: saveStructure, isPending: isSaving } = useUpdateStructure();

  const [structure, setStructure]           = useState([]);
  const [pendingClassSync, setPendingClassSync] = useState(null);

  // Initialise / re-initialise structure whenever curriculum changes.
  // If a class sync is pending (queued after settings save), apply it now.
  useEffect(() => {
    if (!curriculum) return;

    const existing = curriculum.structure || [];
    const initialized = (curriculum.periods || []).map(
      (_, i) => existing[i] || { grades: [] }
    );

    if (pendingClassSync) {
      const { classList, periodCount } = pendingClassSync;
      const synced = Array.from({ length: periodCount }, (_, i) => {
        const term = initialized[i] || { grades: [] };
        return {
          ...term,
          grades: classList.map((cls) => {
            const existing = term.grades.find((g) => g.name === cls.name);
            return existing || { id: genId(), name: cls.name, courses: [] };
          }),
        };
      });
      setPendingClassSync(null);
      setStructure(synced);
      saveStructure({ id: curriculum.id, structure: synced });
    } else {
      setStructure(initialized);
    }
  }, [curriculum]); // eslint-disable-line react-hooks/exhaustive-deps

  // Called by SetupPanel when Save Settings succeeds.
  // Queues a class sync that runs after the curriculum refetch re-initialises structure.
  const handleClassSync = (classList, periods) => {
    setPendingClassSync({ classList, periodCount: periods.length });
  };

  const handleUpdateTerm = (termIndex, termData) => {
    setStructure((prev) =>
      prev.map((t, i) => (i === termIndex ? { ...t, ...termData } : t))
    );
  };

  const handleSave = () => {
    saveStructure({ id, structure });
  };

  /* ── Loading ──────────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "400px",
          fontFamily: "Inter, sans-serif",
          gap: "14px",
          color: "#6B7280",
          fontSize: "14px",
        }}
      >
        <span
          style={{
            width: "28px",
            height: "28px",
            border: "3px solid #E5E7EB",
            borderTopColor: "#0D47A1",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        Loading curriculum...
      </div>
    );
  }

  /* ── Error ────────────────────────────────────────────────────────── */
  if (isError || !curriculum) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", textAlign: "center", padding: "60px 20px" }}>
        <p style={{ fontSize: "16px", color: "#EF4444", marginBottom: "16px" }}>
          Could not load curriculum.
        </p>
        <button
          type="button"
          onClick={() => navigate("/curriculum")}
          style={{
            padding: "10px 20px",
            backgroundColor: "#0D47A1",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
          }}
        >
          ← Back to Curriculum
        </button>
      </div>
    );
  }

  /* ── Page ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <button
              type="button"
              onClick={() => navigate("/curriculum")}
              style={{
                background: "none",
                border: "none",
                color: "#6B7280",
                fontSize: "13px",
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                padding: 0,
              }}
            >
              ← Curriculum
            </button>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#6B7280", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {curriculum.name}
            </span>
            <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
            <span style={{ fontSize: "13px", color: "#111827", fontWeight: "500" }}>Structure</span>
          </div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "700", color: "#111827" }}>
            {curriculum.name}
          </h1>
          <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#6B7280" }}>
            Expand each term to add classes and courses
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => navigate("/curriculum")}
            style={{
              padding: "10px 20px",
              backgroundColor: "transparent",
              color: "#374151",
              border: "1.5px solid #E5E7EB",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            Done
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "10px 24px",
              backgroundColor: isSaving ? "#93C5FD" : "#0D47A1",
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: isSaving ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "background-color 0.15s",
            }}
          >
            {isSaving ? (
              <>
                <span
                  style={{
                    width: "14px",
                    height: "14px",
                    border: "2px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }}
                />
                Saving...
              </>
            ) : (
              "💾  Save Structure"
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SetupPanel
            curriculum={curriculum}
            structure={structure}
            onClassSync={handleClassSync}
          />
          <StructureContent
            curriculum={curriculum}
            structure={structure}
            onUpdateTerm={handleUpdateTerm}
          />
        </div>

        <div
          style={{
            width: "270px",
            flexShrink: 0,
            position: "sticky",
            top: "24px",
            alignSelf: "flex-start",
          }}
        >
          <StructureOverview
            curriculum={curriculum}
            structure={structure}
            onSave={handleSave}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  );
}
