import { useState } from "react";
import { useFormContext } from "react-hook-form";
import AcademicPeriodFields from "./AcademicPeriodFields";
import { FRAMEWORKS, FRAMEWORK_LABELS } from "../schemas/curriculum.schema";

const sectionStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "22px 24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
  marginBottom: "20px",
};

const sectionTitleStyle = {
  margin: "0 0 18px 0",
  fontSize: "15px",
  fontWeight: "600",
  color: "#111827",
  paddingBottom: "14px",
  borderBottom: "1px solid #F3F4F6",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const fieldGroupStyle = { marginBottom: "16px" };

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

const errorTextStyle = {
  fontSize: "12px",
  color: "#EF4444",
  marginTop: "4px",
  marginBottom: 0,
};

const hintStyle = {
  fontSize: "12px",
  color: "#9CA3AF",
  marginTop: "4px",
  marginBottom: 0,
};

function FieldError({ error }) {
  if (!error) return null;
  return <p style={errorTextStyle}>{error.message}</p>;
}

const CYCLE_OPTIONS = [
  {
    value: "terms",
    label: "Terms",
    description: "3 academic terms",
    icon: "📚",
  },
  {
    value: "semesters",
    label: "Semesters",
    description: "2 academic semesters",
    icon: "🎓",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Flexible structure",
    icon: "⚙️",
  },
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
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: isSelected ? "700" : "600",
                  color: isSelected ? "#0D47A1" : "#374151",
                  marginBottom: "2px",
                }}
              >
                {option.label}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: isSelected ? "#1565C0" : "#9CA3AF",
                }}
              >
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

const STANDARD_FRAMEWORKS = FRAMEWORKS.filter((f) => f !== "Custom");

export default function CurriculumForm() {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext();

  const cycleModel      = watch("academicCycleModel");
  const frameworkValue  = watch("framework");

  // Detect custom mode: either "Custom" is the stored value, or the stored value
  // isn't in the standard list (i.e. loaded from a previously saved custom framework).
  const isLoadedCustom =
    frameworkValue && !STANDARD_FRAMEWORKS.includes(frameworkValue) && frameworkValue !== "";

  const [isCustomMode, setIsCustomMode] = useState(!!isLoadedCustom);
  const [customText,   setCustomText]   = useState(isLoadedCustom ? frameworkValue : "");

  const selectDisplayValue = isCustomMode ? "Custom" : (frameworkValue || "");

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

  return (
    <div>
      {/* Section 1: Curriculum Details */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              backgroundColor: "#0D47A1",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "700",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            1
          </span>
          Curriculum Details
        </h3>

        {/* Name */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>
            Curriculum Name <span style={{ color: "#EF4444" }}>*</span>
          </label>
          <input
            type="text"
            {...register("name")}
            style={getInputStyle(!!errors.name)}
            placeholder="e.g. Kenya National Primary Curriculum"
          />
          <FieldError error={errors.name} />
        </div>

        {/* Code + Academic Year */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <div>
            <label style={labelStyle}>
              Curriculum Code <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              type="text"
              {...register("code")}
              style={getInputStyle(!!errors.code)}
              placeholder="e.g. KE-CBC-2025"
            />
            <FieldError error={errors.code} />
          </div>
          <div>
            <label style={labelStyle}>
              Academic Year <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              type="text"
              {...register("academicYear")}
              style={getInputStyle(!!errors.academicYear)}
              placeholder="e.g. 2025/2026"
            />
            <FieldError error={errors.academicYear} />
          </div>
        </div>

        {/* Description */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Description</label>
          <textarea
            {...register("description")}
            rows={3}
            style={{
              ...getInputStyle(!!errors.description),
              resize: "vertical",
              minHeight: "80px",
              lineHeight: "1.5",
            }}
            placeholder="Briefly describe the purpose and scope of this curriculum..."
          />
          <FieldError error={errors.description} />
        </div>
      </div>

      {/* Section 2: Settings */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              backgroundColor: "#0D47A1",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "700",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            2
          </span>
          Curriculum Settings
        </h3>

        {/* Framework */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>
            Curriculum Framework <span style={{ color: "#EF4444" }}>*</span>
          </label>

          {/* Dropdown — always visible */}
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
              <option key={fw} value={fw}>
                {FRAMEWORK_LABELS[fw]}
              </option>
            ))}
          </select>

          {/* Custom name input — revealed when "Custom" is selected */}
          {isCustomMode && (
            <div
              style={{
                marginTop: "10px",
                padding: "14px 16px",
                backgroundColor: "#F0F7FF",
                border: "1.5px solid #BFDBFE",
                borderRadius: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span
                  style={{
                    fontSize: "12px",
                    fontWeight: "700",
                    color: "#0D47A1",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  ✏ Custom Framework Name
                </span>
                <button
                  type="button"
                  onClick={exitCustomMode}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "#6B7280",
                    fontFamily: "Inter, sans-serif",
                    padding: "0",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  ← Use standard framework
                </button>
              </div>
              <input
                autoFocus
                type="text"
                value={customText}
                onChange={handleCustomTextChange}
                placeholder="e.g. Montessori, Waldorf, Reggio Emilia..."
                style={{
                  ...getInputStyle(!!errors.framework),
                  backgroundColor: "#ffffff",
                }}
              />
              {!errors.framework && (
                <p style={hintStyle}>
                  This name will appear as the framework label across the curriculum.
                </p>
              )}
            </div>
          )}

          <FieldError error={errors.framework} />
        </div>

        {/* Cycle Model */}
        <div style={fieldGroupStyle}>
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

      {/* Section 3: Academic Periods */}
      <div style={sectionStyle}>
        <h3 style={{ ...sectionTitleStyle, marginBottom: "20px" }}>
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              backgroundColor: "#0D47A1",
              color: "#fff",
              fontSize: "13px",
              fontWeight: "700",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            3
          </span>
          Academic Periods
        </h3>

        <AcademicPeriodFields />
      </div>
    </div>
  );
}
