import { useEffect, useRef } from "react";
import { useFormContext, useFieldArray, Controller } from "react-hook-form";

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
  padding: "9px 12px",
  borderRadius: "8px",
  border: `1px solid ${hasError ? "#EF4444" : "#E5E7EB"}`,
  fontSize: "13px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: hasError ? "#FFF5F5" : "#ffffff",
  outline: "none",
  boxSizing: "border-box",
  color: "#111827",
});

const labelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: "500",
  color: "#6B7280",
  marginBottom: "5px",
};

const errorTextStyle = {
  fontSize: "11px",
  color: "#EF4444",
  marginTop: "3px",
  marginBottom: 0,
};

function FieldError({ error }) {
  if (!error) return null;
  return <p style={errorTextStyle}>{error.message}</p>;
}

function PeriodCard({ index, onRemove, canRemove, cycleModel }) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const periodErrors = errors.periods?.[index] || {};

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "12px",
        backgroundColor: "#FAFAFA",
        position: "relative",
      }}
    >
      {/* Period header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              backgroundColor: "#0D47A1",
              color: "#fff",
              fontSize: "12px",
              fontWeight: "700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {index + 1}
          </div>
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
            {cycleModel === "semesters" ? `Semester ${index + 1}` : cycleModel === "terms" ? `Term ${index + 1}` : `Period ${index + 1}`}
          </span>
        </div>

        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 10px",
              backgroundColor: "transparent",
              color: "#EF4444",
              border: "1px solid #FCA5A5",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "500",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            ✕ Remove
          </button>
        )}
      </div>

      {/* Period Name */}
      <div style={{ marginBottom: "12px" }}>
        <label style={labelStyle}>
          Period Name <span style={{ color: "#EF4444" }}>*</span>
        </label>
        <input
          type="text"
          {...register(`periods.${index}.name`)}
          style={inputStyle(!!periodErrors.name)}
          placeholder={`e.g. ${cycleModel === "semesters" ? "Semester 1" : cycleModel === "terms" ? "Term 1" : "Period 1"}`}
        />
        <FieldError error={periodErrors.name} />
      </div>

      {/* Start Date & End Date */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
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
          borderRadius: "8px",
          padding: "12px",
        }}
      >
        <p
          style={{
            margin: "0 0 10px 0",
            fontSize: "12px",
            fontWeight: "600",
            color: "#0369A1",
          }}
        >
          ☕ Mid-Term Break{" "}
          <span style={{ fontWeight: "400", color: "#6B7280" }}>(optional)</span>
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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

  const { fields, replace, append, remove } = useFieldArray({
    control,
    name: "periods",
  });

  const prevCycleModel = useRef(cycleModel);

  useEffect(() => {
    if (prevCycleModel.current === cycleModel) return;
    prevCycleModel.current = cycleModel;
    if (cycleModel && PRESET_PERIODS[cycleModel] !== undefined) {
      replace(PRESET_PERIODS[cycleModel]);
    }
  }, [cycleModel, replace]);

  const handleAddPeriod = () => {
    append({ ...DEFAULT_PERIOD });
  };

  const periodsArrayError = errors.periods?.message || errors.periods?.root?.message;

  return (
    <div>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: "600",
              color: "#111827",
            }}
          >
            Academic Periods
          </h3>
          {cycleModel && (
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6B7280" }}>
              {cycleModel === "terms" && "3 terms pre-configured — edit dates below"}
              {cycleModel === "semesters" && "2 semesters pre-configured — edit dates below"}
              {cycleModel === "custom" && "Add and configure your custom academic periods"}
            </p>
          )}
        </div>

        <span
          style={{
            fontSize: "12px",
            fontWeight: "600",
            color: "#0D47A1",
            backgroundColor: "#EFF6FF",
            padding: "4px 10px",
            borderRadius: "20px",
            border: "1px solid #BFDBFE",
          }}
        >
          {fields.length} {fields.length === 1 ? "period" : "periods"}
        </span>
      </div>

      {/* Array-level error */}
      {periodsArrayError && (
        <div
          style={{
            padding: "10px 14px",
            backgroundColor: "#FFF5F5",
            border: "1px solid #FECACA",
            borderRadius: "8px",
            marginBottom: "12px",
          }}
        >
          <p style={{ margin: 0, fontSize: "13px", color: "#EF4444" }}>⚠ {periodsArrayError}</p>
        </div>
      )}

      {/* Period cards */}
      {fields.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px 20px",
            backgroundColor: "#F9FAFB",
            border: "1.5px dashed #E5E7EB",
            borderRadius: "12px",
            marginBottom: "12px",
          }}
        >
          <div style={{ fontSize: "28px", marginBottom: "8px" }}>📅</div>
          <p style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "500", color: "#374151" }}>
            No periods yet
          </p>
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
            {cycleModel === "custom"
              ? 'Click "Add Period" below to get started'
              : "Select an academic cycle model above to auto-populate periods"}
          </p>
        </div>
      ) : (
        fields.map((field, index) => (
          <PeriodCard
            key={field.id}
            index={index}
            cycleModel={cycleModel}
            canRemove={fields.length > 1 || cycleModel === "custom"}
            onRemove={() => remove(index)}
          />
        ))
      )}

      {/* Add Period button */}
      <button
        type="button"
        onClick={handleAddPeriod}
        style={{
          width: "100%",
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
        Add Period
      </button>
    </div>
  );
}
