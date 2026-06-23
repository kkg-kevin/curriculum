import { useFormContext } from "react-hook-form";

/* ── Icons ─────────────────────────────────────────────────────────────── */

const NameIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const CodeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const DescIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
  </svg>
);

/* ── Styles ─────────────────────────────────────────────────────────────── */

const CSS = `
  .cf-input, .cf-textarea {
    width: 100%;
    padding: 11px 14px;
    border-radius: 10px;
    border: 1.5px solid #E5E7EB;
    font-size: 14px;
    font-family: Inter, sans-serif;
    background-color: #F9FAFB;
    color: #111827;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
    outline: none;
  }
  .cf-input:focus, .cf-textarea:focus {
    border-color: #0D47A1;
    background-color: #F0F7FF;
    box-shadow: 0 0 0 3px rgba(13,71,161,0.1);
  }
  .cf-input.cf-error, .cf-textarea.cf-error {
    border-color: #EF4444;
    background-color: #FFF5F5;
  }
  .cf-input.cf-error:focus, .cf-textarea.cf-error:focus {
    border-color: #EF4444;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.1);
    background-color: #FFF5F5;
  }
  .cf-textarea { resize: vertical; min-height: 96px; line-height: 1.6; }
  .cf-auto-btn {
    flex-shrink: 0;
    padding: 0 14px;
    height: 44px;
    border-radius: 10px;
    border: 1.5px solid #E5E7EB;
    font-size: 13px;
    font-weight: 600;
    font-family: Inter, sans-serif;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .cf-auto-btn:enabled {
    background-color: #EFF6FF;
    color: #0D47A1;
    border-color: #BFDBFE;
  }
  .cf-auto-btn:enabled:hover {
    background-color: #DBEAFE;
    border-color: #93C5FD;
  }
  .cf-auto-btn:disabled {
    background-color: #F9FAFB;
    color: #D1D5DB;
    cursor: not-allowed;
  }
`;

const sectionStyle = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "24px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
};

const sectionTitleStyle = {
  margin: "0 0 20px 0",
  fontSize: "15px",
  fontWeight: "600",
  color: "#111827",
  paddingBottom: "14px",
  borderBottom: "1px solid #F3F4F6",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const fieldGroupStyle = { marginBottom: "18px" };

const labelRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "7px",
};

const labelStyle = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "13px",
  fontWeight: "500",
  color: "#374151",
};

const errorStyle = { fontSize: "12px", color: "#EF4444", marginTop: "5px", marginBottom: 0 };
const hintStyle = { fontSize: "12px", color: "#9CA3AF", marginTop: "5px", marginBottom: 0 };
const counterStyle = (warn, over) => ({ fontSize: "12px", color: over ? "#EF4444" : warn ? "#F59E0B" : "#9CA3AF" });

function FieldError({ error }) {
  if (!error) return null;
  return <p style={errorStyle}>{error.message}</p>;
}

/* ── Code auto-generate helper ─────────────────────────────────────────── */

const SKIP = new Set(["the", "and", "of", "for", "a", "an", "in", "on", "at", "to", "by"]);

function generateCode(name) {
  const words = name.trim().split(/\s+/).filter((w) => w.length > 0 && !SKIP.has(w.toLowerCase()));
  if (words.length === 0) return "";
  return words.map((w) => w[0].toUpperCase()).join("");
}

/* ── Main form ─────────────────────────────────────────────────────────── */

export default function CurriculumForm() {
  const { register, setValue, watch, formState: { errors } } = useFormContext();

  const name = watch("name") || "";
  const description = watch("description") || "";
  const nameLen = name.length;
  const descLen = description.length;
  const canGenerate = name.trim().length > 0;

  const handleGenerateCode = () => {
    const gen = generateCode(name);
    if (gen) setValue("code", gen, { shouldValidate: true });
  };

  return (
    <div style={sectionStyle}>
      <style>{CSS}</style>

      <h3 style={sectionTitleStyle}>
        <span style={{
          width: "28px", height: "28px", borderRadius: "8px",
          backgroundColor: "#0D47A1", color: "#fff",
          fontSize: "13px", fontWeight: "700",
          display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>1</span>
        Basic Information
      </h3>

      {/* Curriculum Name */}
      <div style={fieldGroupStyle}>
        <div style={labelRowStyle}>
          <label style={labelStyle}>
            <NameIcon />
            Curriculum Name <span style={{ color: "#EF4444", marginLeft: "1px" }}>*</span>
          </label>
          <span style={counterStyle(nameLen > 85, nameLen > 100)}>{nameLen} / 100</span>
        </div>
        <input
          type="text"
          {...register("name")}
          className={`cf-input${errors.name ? " cf-error" : ""}`}
          placeholder="e.g. Kenya National Primary Curriculum"
        />
        <FieldError error={errors.name} />
      </div>

      {/* Curriculum Code */}
      <div style={fieldGroupStyle}>
        <div style={labelRowStyle}>
          <label style={labelStyle}>
            <CodeIcon />
            Curriculum Code <span style={{ color: "#EF4444", marginLeft: "1px" }}>*</span>
          </label>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            type="text"
            {...register("code")}
            className={`cf-input${errors.code ? " cf-error" : ""}`}
            style={{ flex: 1 }}
            placeholder="e.g. KE-CBC-25"
          />
          <button type="button" onClick={handleGenerateCode} disabled={!canGenerate} className="cf-auto-btn" title="Auto-generate from name">
            Auto
          </button>
        </div>
        {!errors.code && <p style={hintStyle}>Letters, numbers, and hyphens only. Click Auto to generate from the name.</p>}
        <FieldError error={errors.code} />
      </div>

      {/* Description */}
      <div style={{ marginBottom: 0 }}>
        <div style={labelRowStyle}>
          <label style={labelStyle}>
            <DescIcon />
            Description
          </label>
          <span style={counterStyle(descLen > 450, descLen > 500)}>{descLen} / 500</span>
        </div>
        <textarea
          {...register("description")}
          className={`cf-textarea${errors.description ? " cf-error" : ""}`}
          placeholder="Briefly describe the purpose and scope of this curriculum…"
        />
        <FieldError error={errors.description} />
      </div>
    </div>
  );
}
