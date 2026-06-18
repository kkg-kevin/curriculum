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

export default function CurriculumForm() {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext();

  const cycleModel = watch("academicCycleModel");

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
          <select
            {...register("framework")}
            style={{
              ...getInputStyle(!!errors.framework),
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
