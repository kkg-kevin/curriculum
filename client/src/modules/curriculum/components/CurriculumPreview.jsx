import { useFormContext } from "react-hook-form";

const StructureIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export default function CurriculumPreview() {
  const { watch } = useFormContext();
  const { name, code, description } = watch();

  const isEmpty = !name && !code && !description;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Label */}
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "12px" }}>
        <div style={{
          width: "7px", height: "7px", borderRadius: "50%",
          backgroundColor: "#25476a", boxShadow: "0 0 0 3px rgba(37,71,106,0.15)",
        }} />
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Live Preview
        </span>
      </div>

      {/* Card */}
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "18px",
        boxShadow: "0 4px 24px rgba(37,71,106,0.09), 0 1px 4px rgba(0,0,0,0.05)",
        overflow: "hidden",
        border: "1px solid #E8F0FE",
      }}>
        {/* Top gradient bar */}
        <div style={{ height: "5px", background: "linear-gradient(90deg, #25476a 0%, #2e7db5 40%, #42A5F5 100%)" }} />

        <div style={{ padding: "22px" }}>

          {/* Name */}
          <h3 style={{
            margin: "0 0 10px 0",
            fontSize: "19px",
            fontWeight: "800",
            color: name ? "#0F2645" : "#D1D5DB",
            fontStyle: name ? "normal" : "italic",
            lineHeight: "1.25",
            letterSpacing: "-0.3px",
          }}>
            {name || "Curriculum Name"}
          </h3>

          {/* Code chip */}
          <div style={{ marginBottom: "18px" }}>
            {code ? (
              <span style={{
                display: "inline-flex", alignItems: "center",
                padding: "3px 10px", borderRadius: "20px",
                backgroundColor: "#e8f5fb", color: "#25476a",
                fontSize: "11px", fontWeight: "700",
                border: "1px solid #a8d5ee", letterSpacing: "0.04em",
              }}>
                {code}
              </span>
            ) : (
              <span style={{ fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No code assigned</span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: "1px", background: "linear-gradient(90deg, #d6edf8, #E0F2FE, transparent)", marginBottom: "16px" }} />

          {/* Description */}
          {description ? (
            <div style={{
              backgroundColor: "#F8FAFF", borderLeft: "3px solid #a8d5ee",
              borderRadius: "0 8px 8px 0", padding: "10px 13px", marginBottom: "20px",
            }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#4B5563", lineHeight: "1.65" }}>
                {description}
              </p>
            </div>
          ) : (
            <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#D1D5DB", fontStyle: "italic" }}>
              No description provided
            </p>
          )}

          {/* Ghost sections — upcoming steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

            {/* Step 2 ghost */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 14px", borderRadius: "10px",
              border: "1.5px dashed #E5E7EB", backgroundColor: "#FAFAFA",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <div style={{
                  width: "30px", height: "30px", borderRadius: "8px",
                  backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#9CA3AF",
                }}>
                  <StructureIcon />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#9CA3AF" }}>Structure</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#C4C9D4" }}>Framework · Cycle · Classes</p>
                </div>
              </div>
              <span style={{
                fontSize: "11px", fontWeight: "600", color: "#CBD5E1",
                border: "1px solid #E5E7EB", borderRadius: "20px", padding: "2px 8px",
                backgroundColor: "#F9FAFB",
              }}>
                Step 2
              </span>
            </div>

            {/* Step 3 ghost */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "11px 14px", borderRadius: "10px",
              border: "1.5px dashed #E5E7EB", backgroundColor: "#FAFAFA",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                <div style={{
                  width: "30px", height: "30px", borderRadius: "8px",
                  backgroundColor: "#F3F4F6", border: "1px solid #E5E7EB",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#9CA3AF",
                }}>
                  <CalendarIcon />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#9CA3AF" }}>Academic Year</p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#C4C9D4" }}>Periods · Dates · Status</p>
                </div>
              </div>
              <span style={{
                fontSize: "11px", fontWeight: "600", color: "#CBD5E1",
                border: "1px solid #E5E7EB", borderRadius: "20px", padding: "2px 8px",
                backgroundColor: "#F9FAFB",
              }}>
                Step 3
              </span>
            </div>

          </div>
        </div>
      </div>

      {isEmpty && (
        <p style={{ textAlign: "center", fontSize: "11px", color: "#C3D3E8", marginTop: "10px" }}>
          Start filling in the form to see a live preview
        </p>
      )}
    </div>
  );
}
