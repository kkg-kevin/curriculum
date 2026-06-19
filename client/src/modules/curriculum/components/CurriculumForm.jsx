import { useFormContext } from "react-hook-form";

/* ── Shared styles ─────────────────────────────────────────────────────── */

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

const errorTextStyle = { fontSize: "12px", color: "#EF4444", marginTop: "4px", marginBottom: 0 };
const hintStyle = { fontSize: "12px", color: "#9CA3AF", marginTop: "4px", marginBottom: 0 };

function FieldError({ error }) {
  if (!error) return null;
  return <p style={errorTextStyle}>{error.message}</p>;
}

/* ── Code auto-generate helper ─────────────────────────────────────────── */

const SKIP_WORDS = new Set(["the", "and", "of", "for", "a", "an", "in", "on", "at", "to", "by"]);

function generateCode(name) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !SKIP_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return "";
  return words.map((w) => w[0].toUpperCase()).join("");
}

/* ── Main form ─────────────────────────────────────────────────────────── */

export default function CurriculumForm() {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext();

  const name = watch("name") || "";
  const description = watch("description") || "";
  const descLength = description.length;
  const canGenerate = name.trim().length > 0;

  const handleGenerateCode = () => {
    const generated = generateCode(name);
    if (generated) setValue("code", generated, { shouldValidate: true });
  };

  return (
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
            flexShrink: 0,
          }}
        >
          1
        </span>
        Basic Information
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

      {/* Code */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>
          Curriculum Code <span style={{ color: "#EF4444" }}>*</span>
        </label>
        <div style={{ display: "flex", gap: "6px" }}>
          <input
            type="text"
            {...register("code")}
            style={{ ...getInputStyle(!!errors.code), flex: 1 }}
            placeholder="e.g. KE-CBC-25"
          />
          <button
            type="button"
            onClick={handleGenerateCode}
            disabled={!canGenerate}
            title="Auto-generate from name"
            style={{
              flexShrink: 0,
              padding: "0 14px",
              borderRadius: "10px",
              border: "1px solid #E5E7EB",
              backgroundColor: canGenerate ? "#EFF6FF" : "#F9FAFB",
              color: canGenerate ? "#0D47A1" : "#D1D5DB",
              fontSize: "13px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: canGenerate ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            Auto
          </button>
        </div>
        {!errors.code && (
          <p style={hintStyle}>Use Auto to generate initials from the name.</p>
        )}
        <FieldError error={errors.code} />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>Description</label>
          <span
            style={{
              fontSize: "11px",
              color: descLength > 450 ? (descLength > 500 ? "#EF4444" : "#F59E0B") : "#9CA3AF",
            }}
          >
            {descLength} / 500
          </span>
        </div>
        <textarea
          {...register("description")}
          rows={4}
          style={{
            ...getInputStyle(!!errors.description),
            resize: "vertical",
            minHeight: "90px",
            lineHeight: "1.5",
          }}
          placeholder="Briefly describe the purpose and scope of this curriculum..."
        />
        <FieldError error={errors.description} />
      </div>
    </div>
  );
}
