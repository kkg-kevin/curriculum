import { useFormContext } from "react-hook-form";

export default function CurriculumPreview() {
  const { watch } = useFormContext();
  const { name, code, description } = watch();

  const isEmpty = !name && !code && !description;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Live preview label */}
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px" }}>
        <div
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            backgroundColor: "#0D47A1",
            boxShadow: "0 0 0 3px rgba(13,71,161,0.15)",
          }}
        />
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Live Preview
        </span>
      </div>

      {/* Card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 4px 20px rgba(13,71,161,0.08), 0 1px 4px rgba(0,0,0,0.06)",
          overflow: "hidden",
          border: "1px solid #E8F0FE",
        }}
      >
        {/* Blue gradient bar */}
        <div
          style={{
            height: "5px",
            background: "linear-gradient(90deg, #0D47A1 0%, #1565C0 40%, #42A5F5 100%)",
          }}
        />

        <div style={{ padding: "20px" }}>
          {/* Name */}
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "19px",
              fontWeight: "800",
              color: name ? "#0F2645" : "#D1D5DB",
              fontStyle: name ? "normal" : "italic",
              lineHeight: "1.25",
              letterSpacing: "-0.3px",
            }}
          >
            {name || "Curriculum Name"}
          </h3>

          {/* Code pill */}
          <div style={{ marginBottom: "16px" }}>
            {code ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  backgroundColor: "#EFF6FF",
                  color: "#1D4ED8",
                  fontSize: "11px",
                  fontWeight: "700",
                  border: "1px solid #BFDBFE",
                  letterSpacing: "0.03em",
                }}
              >
                {code}
              </span>
            ) : (
              <span style={{ fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>
                No code assigned
              </span>
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              height: "1px",
              background: "linear-gradient(90deg, #DBEAFE 0%, #E0F2FE 50%, transparent 100%)",
              marginBottom: "16px",
            }}
          />

          {/* Description */}
          {description ? (
            <div
              style={{
                backgroundColor: "#F8FAFF",
                borderLeft: "3px solid #BFDBFE",
                borderRadius: "0 8px 8px 0",
                padding: "10px 12px",
              }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "#4B5563", lineHeight: "1.65" }}>
                {description}
              </p>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "13px", color: "#D1D5DB", fontStyle: "italic" }}>
              No description provided
            </p>
          )}
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
