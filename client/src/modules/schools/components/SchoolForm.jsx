import { useFormContext } from "react-hook-form";
import { KENYA_COUNTIES } from "../schemas/school.schema";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";

const selectStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1.5px solid #E5E7EB",
  fontSize: "14px",
  fontFamily: "Inter, sans-serif",
  backgroundColor: "#F9FAFB",
  color: "#374151",
  outline: "none",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  cursor: "pointer",
};

function Field({ label, error, required, children, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label
        style={{
          fontSize: "13px",
          fontWeight: "600",
          color: "#374151",
          display: "flex",
          alignItems: "center",
          gap: "3px",
        }}
      >
        {label}
        {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      {children}
      {hint && !error && (
        <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>{hint}</p>
      )}
      {error && (
        <p style={{ margin: 0, fontSize: "12px", color: "#EF4444" }}>{error}</p>
      )}
    </div>
  );
}

function Input({ name, placeholder, type = "text", ...rest }) {
  const { register, formState: { errors } } = useFormContext();
  const keys = name.split(".");
  const error = keys.reduce((obj, k) => obj?.[k], errors)?.message;

  return (
    <Field label={rest.label} error={error} required={rest.required} hint={rest.hint}>
      <input
        type={type}
        placeholder={placeholder}
        {...register(name)}
        style={{
          padding: "10px 12px",
          borderRadius: "10px",
          border: `1.5px solid ${error ? "#FCA5A5" : "#E5E7EB"}`,
          fontSize: "14px",
          fontFamily: "Inter, sans-serif",
          backgroundColor: error ? "#FFF5F5" : "#F9FAFB",
          color: "#374151",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => { e.target.style.borderColor = "#b8d9ee"; e.target.style.backgroundColor = "#fff"; }}
        onBlur={(e) => { e.target.style.borderColor = error ? "#FCA5A5" : "#E5E7EB"; e.target.style.backgroundColor = error ? "#FFF5F5" : "#F9FAFB"; }}
      />
    </Field>
  );
}

export default function SchoolForm() {
  const { register, formState: { errors } } = useFormContext();
  const { data: curriculaData } = useCurriculaQuery();
  const curricula = curriculaData?.data || [];

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        border: "1.5px solid #E5E7EB",
        overflow: "hidden",
      }}
    >
      {/* Section: Basic info */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
          Basic Information
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input name="name" label="School Name" placeholder="e.g. Nairobi Academy" required />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input
              name="code"
              label="School Code"
              placeholder="e.g. NA-001"
              required
              hint="Letters, numbers, hyphens only"
            />
            {/* Status */}
            <Field label="Status" required>
              <select {...register("status")} style={selectStyle}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* Section: Contact */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
          Contact Details
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input name="email" label="Email Address" placeholder="info@school.ac.ke" type="email" />
            <Input name="phone" label="Phone Number" placeholder="+254 700 000 000" />
          </div>
        </div>
      </div>

      {/* Section: Address */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #F3F4F6" }}>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
          Address
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Input name="address.street" label="Street / Area" placeholder="e.g. Ngong Road, Karen" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <Input name="address.city" label="City / Town" placeholder="e.g. Nairobi" />
            <Field
              label="County"
              required
              error={errors?.address?.county?.message}
            >
              <select
                {...register("address.county")}
                style={{
                  ...selectStyle,
                  borderColor: errors?.address?.county ? "#FCA5A5" : "#E5E7EB",
                  backgroundColor: errors?.address?.county ? "#FFF5F5" : "#F9FAFB",
                }}
              >
                <option value="">Select county…</option>
                {KENYA_COUNTIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* Section: Curriculum */}
      <div style={{ padding: "20px 24px" }}>
        <h3 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
          Assigned Curriculum
        </h3>
        <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#9CA3AF" }}>
          The curriculum this school follows. Can be updated at any time.
        </p>
        <Field label="Curriculum" error={errors?.curriculumId?.message}>
          <select {...register("curriculumId")} style={selectStyle}>
            <option value="">No curriculum assigned</option>
            {curricula.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code}) — {c.framework} {c.academicYear}
              </option>
            ))}
          </select>
        </Field>
        {curricula.length === 0 && (
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#F59E0B" }}>
            No curricula found. Create a curriculum first to assign it here.
          </p>
        )}
      </div>
    </div>
  );
}
