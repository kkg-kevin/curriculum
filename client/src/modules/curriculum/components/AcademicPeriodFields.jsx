import { useState, useEffect, useRef } from "react";
import { useFormContext, useFieldArray } from "react-hook-form";

const DEFAULT_PERIOD = {
  name: "",
  startDate: "",
  endDate: "",
  midTermBreakStartDate: "",
  midTermBreakEndDate: "",
};

const PRESET_PERIODS = {
  terms: [
    { ...DEFAULT_PERIOD, name: "Term 1" },
    { ...DEFAULT_PERIOD, name: "Term 2" },
    { ...DEFAULT_PERIOD, name: "Term 3" },
  ],
  semesters: [
    { ...DEFAULT_PERIOD, name: "Semester 1" },
    { ...DEFAULT_PERIOD, name: "Semester 2" },
  ],
  custom: [],
};

const inputStyle = (hasError) => ({
  width: "100%",
  padding: "10px 13px",
  borderRadius: "9px",
  border: `1.5px solid ${hasError ? "#EF4444" : "#E5E7EB"}`,
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: hasError ? "#FFF5F5" : "#ffffff",
  outline: "none",
  boxSizing: "border-box",
  color: "#111827",
  transition: "border-color 0.15s",
});

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: "500",
  color: "#6B7280",
  marginBottom: "6px",
};

const errorTextStyle = {
  fontSize: "11px",
  color: "#EF4444",
  marginTop: "4px",
  marginBottom: 0,
};

function FieldError({ error }) {
  if (!error) return null;
  return <p style={errorTextStyle}>{error.message}</p>;
}

// Returns "complete" | "partial" | "empty"
function getPeriodStatus(period) {
  if (!period) return "empty";
  if (period.startDate && period.endDate) return "complete";
  if (period.startDate || period.endDate) return "partial";
  return "empty";
}

function StatusDot({ status, isActive, onClick }) {
  const colors = {
    complete: { bg: "#22C55E", border: "#16A34A" },
    partial:  { bg: "#F59E0B", border: "#D97706" },
    empty:    { bg: "#E5E7EB", border: "#D1D5DB" },
  };
  const c = colors[status] || colors.empty;

  return (
    <button
      type="button"
      onClick={onClick}
      title={status === "complete" ? "Dates configured" : status === "partial" ? "Partially configured" : "Not configured"}
      style={{
        width: isActive ? "24px" : "9px",
        height: "9px",
        borderRadius: "20px",
        backgroundColor: isActive ? "#0D47A1" : c.bg,
        border: `1.5px solid ${isActive ? "#0D47A1" : c.border}`,
        cursor: "pointer",
        padding: 0,
        transition: "all 0.2s ease",
        flexShrink: 0,
      }}
    />
  );
}

function NavArrow({ direction, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "34px",
        height: "34px",
        borderRadius: "9px",
        border: "1.5px solid",
        borderColor: disabled ? "#E5E7EB" : "#CBD5E1",
        backgroundColor: disabled ? "#F9FAFB" : "#ffffff",
        color: disabled ? "#D1D5DB" : "#374151",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "16px",
        fontFamily: "Inter, sans-serif",
        transition: "all 0.15s",
        flexShrink: 0,
      }}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}

function PeriodPane({ index, cycleModel, canRemove, onRemove }) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const periodErrors = errors.periods?.[index] || {};
  const isCustom = cycleModel === "custom";

  const placeholder =
    isCustom
      ? `e.g. Quarter ${index + 1}, Module ${index + 1}...`
      : cycleModel === "semesters"
      ? `Semester ${index + 1}`
      : `Term ${index + 1}`;

  return (
    <div style={{ padding: "20px" }}>
      {/* Period Name */}
      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>
          {isCustom ? "Period Name" : "Period Name"}
          <span style={{ color: "#EF4444" }}> *</span>
          {isCustom && (
            <span style={{ marginLeft: "6px", fontSize: "11px", color: "#9CA3AF", fontWeight: "400" }}>
              — give it any name you like
            </span>
          )}
        </label>
        <input
          type="text"
          {...register(`periods.${index}.name`)}
          style={inputStyle(!!periodErrors.name)}
          placeholder={placeholder}
        />
        <FieldError error={periodErrors.name} />
      </div>

      {/* Start / End Date */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div>
          <label style={labelStyle}>
            Start Date <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <input
            type="date"
            {...register(`periods.${index}.startDate`)}
            style={inputStyle(!!periodErrors.startDate)}
          />
          <FieldError error={periodErrors.startDate} />
        </div>
        <div>
          <label style={labelStyle}>
            End Date <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <input
            type="date"
            {...register(`periods.${index}.endDate`)}
            style={inputStyle(!!periodErrors.endDate)}
          />
          <FieldError error={periodErrors.endDate} />
        </div>
      </div>

      {/* Mid-Term Break */}
      <div
        style={{
          backgroundColor: "#F0F9FF",
          border: "1px solid #E0F2FE",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: canRemove ? "16px" : "0",
        }}
      >
        <p style={{ margin: "0 0 10px 0", fontSize: "12px", fontWeight: "600", color: "#0369A1" }}>
          ☕ Mid-Term Break{" "}
          <span style={{ fontWeight: "400", color: "#6B7280" }}>(optional)</span>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Break Start</label>
            <input
              type="date"
              {...register(`periods.${index}.midTermBreakStartDate`)}
              style={inputStyle(!!periodErrors.midTermBreakStartDate)}
            />
            <FieldError error={periodErrors.midTermBreakStartDate} />
          </div>
          <div>
            <label style={labelStyle}>Break End</label>
            <input
              type="date"
              {...register(`periods.${index}.midTermBreakEndDate`)}
              style={inputStyle(!!periodErrors.midTermBreakEndDate)}
            />
            <FieldError error={periodErrors.midTermBreakEndDate} />
          </div>
        </div>
      </div>

      {/* Remove button — only for custom or when more than 1 period */}
      {canRemove && (
        <div style={{ paddingTop: "14px", display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onRemove}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 14px",
              backgroundColor: "#FFF5F5",
              color: "#EF4444",
              border: "1px solid #FECACA",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "500",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            🗑 Remove this period
          </button>
        </div>
      )}
    </div>
  );
}

export default function AcademicPeriodFields() {
  const {
    control,
    watch,
    formState: { errors },
  } = useFormContext();

  const cycleModel = watch("academicCycleModel");
  const periods = watch("periods") || [];

  const { fields, replace, append, remove } = useFieldArray({ control, name: "periods" });

  const [activeIndex, setActiveIndex] = useState(0);
  const prevCycleModel = useRef(cycleModel);

  // When cycle model changes, reset periods and jump to first
  useEffect(() => {
    if (prevCycleModel.current === cycleModel) return;
    prevCycleModel.current = cycleModel;
    setActiveIndex(0);
    if (cycleModel && PRESET_PERIODS[cycleModel] !== undefined) {
      replace(PRESET_PERIODS[cycleModel]);
    }
  }, [cycleModel, replace]);

  // Clamp activeIndex if periods are removed
  useEffect(() => {
    if (fields.length > 0 && activeIndex >= fields.length) {
      setActiveIndex(fields.length - 1);
    }
  }, [fields.length, activeIndex]);

  const handleAddPeriod = () => {
    const newIndex = fields.length;
    append({ ...DEFAULT_PERIOD, name: `Period ${newIndex + 1}` });
    setActiveIndex(newIndex);
  };

  const handleRemove = (index) => {
    remove(index);
    // clamp effect above will adjust if needed
  };

  const isCustom = cycleModel === "custom";
  const canGoPrev = activeIndex > 0;
  const canGoNext = activeIndex < fields.length - 1;
  const periodsArrayError = errors.periods?.message || errors.periods?.root?.message;

  const cycleLabel =
    cycleModel === "semesters" ? "Semester" : cycleModel === "terms" ? "Term" : "Period";

  // ── Empty state for custom before any periods are added ──
  if (fields.length === 0) {
    return (
      <div>
        {periodsArrayError && (
          <div style={{ padding: "10px 14px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "8px", marginBottom: "12px" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#EF4444" }}>⚠ {periodsArrayError}</p>
          </div>
        )}
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            backgroundColor: "#F9FAFB",
            border: "1.5px dashed #E5E7EB",
            borderRadius: "14px",
          }}
        >
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>📅</div>
          <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600", color: "#374151" }}>
            No periods yet
          </p>
          <p style={{ margin: "0 0 18px 0", fontSize: "13px", color: "#9CA3AF" }}>
            {isCustom
              ? "Add your first custom period below"
              : "Select an academic cycle model above"}
          </p>
          {isCustom && (
            <button
              type="button"
              onClick={handleAddPeriod}
              style={{
                padding: "9px 20px",
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
              + Add First Period
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Array-level error */}
      {periodsArrayError && (
        <div style={{ padding: "10px 14px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "8px", marginBottom: "12px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#EF4444" }}>⚠ {periodsArrayError}</p>
        </div>
      )}

      {/* Paginated card */}
      <div
        style={{
          border: "1.5px solid #E5E7EB",
          borderRadius: "14px",
          backgroundColor: "#ffffff",
          overflow: "hidden",
          boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        }}
      >
        {/* ── Navigation header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            backgroundColor: "#F8FAFF",
            borderBottom: "1px solid #E5E7EB",
            gap: "10px",
          }}
        >
          {/* Prev arrow */}
          <NavArrow direction="prev" onClick={() => setActiveIndex((i) => i - 1)} disabled={!canGoPrev} />

          {/* Centre: title + dot indicators */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: "700", color: "#0D47A1" }}>
              {fields[activeIndex]
                ? fields[activeIndex].name || `${cycleLabel} ${activeIndex + 1}`
                : `${cycleLabel} ${activeIndex + 1}`}
            </p>

            {/* Dot indicators */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
              {fields.map((_, i) => (
                <StatusDot
                  key={i}
                  status={getPeriodStatus(periods[i])}
                  isActive={i === activeIndex}
                  onClick={() => setActiveIndex(i)}
                />
              ))}
            </div>

            <p style={{ margin: "6px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>
              {activeIndex + 1} of {fields.length}
              {" · "}
              {fields.filter((_, i) => getPeriodStatus(periods[i]) === "complete").length} configured
            </p>
          </div>

          {/* Next arrow */}
          <NavArrow direction="next" onClick={() => setActiveIndex((i) => i + 1)} disabled={!canGoNext} />
        </div>

        {/* ── Period form fields ── */}
        <PeriodPane
          key={fields[activeIndex]?.id}
          index={activeIndex}
          cycleModel={cycleModel}
          canRemove={isCustom && fields.length > 1}
          onRemove={() => handleRemove(activeIndex)}
        />
      </div>

      {/* ── Progress bar (how many periods are fully configured) ── */}
      {fields.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span style={{ fontSize: "11px", color: "#9CA3AF" }}>Configuration progress</span>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#374151" }}>
              {fields.filter((_, i) => getPeriodStatus(periods[i]) === "complete").length} / {fields.length} periods
            </span>
          </div>
          <div style={{ height: "5px", backgroundColor: "#F3F4F6", borderRadius: "10px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                borderRadius: "10px",
                backgroundColor: "#22C55E",
                width: `${(fields.filter((_, i) => getPeriodStatus(periods[i]) === "complete").length / fields.length) * 100}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          {/* Legend */}
          <div style={{ display: "flex", gap: "14px", marginTop: "6px" }}>
            {[
              { color: "#22C55E", label: "Complete" },
              { color: "#F59E0B", label: "Partial" },
              { color: "#E5E7EB", label: "Empty" },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color, flexShrink: 0 }} />
                <span style={{ fontSize: "11px", color: "#9CA3AF" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Add Period button — custom only ── */}
      {isCustom && (
        <button
          type="button"
          onClick={handleAddPeriod}
          style={{
            width: "100%",
            marginTop: "14px",
            padding: "11px 16px",
            backgroundColor: "#EFF6FF",
            color: "#0D47A1",
            border: "1.5px dashed #93C5FD",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "500",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span>
          Add Another Period
        </button>
      )}
    </div>
  );
}
