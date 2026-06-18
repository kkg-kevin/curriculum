import { useFormContext } from "react-hook-form";
import { FRAMEWORK_LABELS } from "../schemas/curriculum.schema";

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const CYCLE_MODEL_LABELS = {
  terms: "Terms",
  semesters: "Semesters",
  custom: "Custom",
};

const PERIOD_COLORS = [
  { bg: "#EFF6FF", border: "#BFDBFE", badge: "#1D4ED8" },
  { bg: "#F0FDF4", border: "#BBF7D0", badge: "#15803D" },
  { bg: "#FFF7ED", border: "#FED7AA", badge: "#C2410C" },
  { bg: "#FDF4FF", border: "#E9D5FF", badge: "#7E22CE" },
  { bg: "#FFF1F2", border: "#FECDD3", badge: "#BE123C" },
];

function PreviewField({ label, value, placeholder }) {
  return (
    <div style={{ marginBottom: "4px" }}>
      <span style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <p
        style={{
          margin: "2px 0 0 0",
          fontSize: "14px",
          color: value ? "#111827" : "#D1D5DB",
          fontStyle: value ? "normal" : "italic",
        }}
      >
        {value || placeholder}
      </p>
    </div>
  );
}

function PeriodPreviewCard({ period, index }) {
  const color = PERIOD_COLORS[index % PERIOD_COLORS.length];
  const startDate = formatDate(period.startDate);
  const endDate = formatDate(period.endDate);
  const breakStart = formatDate(period.midTermBreakStartDate);
  const breakEnd = formatDate(period.midTermBreakEndDate);

  return (
    <div
      style={{
        backgroundColor: color.bg,
        border: `1px solid ${color.border}`,
        borderRadius: "10px",
        padding: "12px 14px",
        marginBottom: "10px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            backgroundColor: color.badge,
            color: "#fff",
            fontSize: "11px",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <span style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>
          {period.name || <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>Period {index + 1}</span>}
        </span>
      </div>

      {(startDate || endDate) && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
          <span style={{ fontSize: "12px", color: "#6B7280" }}>📅</span>
          <span style={{ fontSize: "12px", color: "#374151" }}>
            {startDate || "—"} → {endDate || "—"}
          </span>
        </div>
      )}

      {(!startDate && !endDate) && (
        <p style={{ fontSize: "12px", color: "#D1D5DB", fontStyle: "italic", margin: "0" }}>
          Dates not set
        </p>
      )}

      {breakStart && breakEnd && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginTop: "6px",
            paddingTop: "6px",
            borderTop: `1px dashed ${color.border}`,
          }}
        >
          <span style={{ fontSize: "12px", color: "#6B7280" }}>☕</span>
          <span style={{ fontSize: "12px", color: "#6B7280" }}>
            Mid-term: {breakStart} → {breakEnd}
          </span>
        </div>
      )}
    </div>
  );
}

export default function CurriculumPreview() {
  const { watch } = useFormContext();
  const values = watch();

  const { name, code, academicYear, description, framework, academicCycleModel, periods = [] } = values;
  const hasDetails = name || code || academicYear || framework;
  const filledPeriods = periods.filter((p) => p);

  return (
    <div>
      {/* Header label */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#22C55E",
            boxShadow: "0 0 0 2px rgba(34,197,94,0.25)",
          }}
        />
        <span style={{ fontSize: "12px", fontWeight: "600", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Live Preview
        </span>
      </div>

      {/* Main preview card */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}
      >
        {/* Card top accent */}
        <div style={{ height: "4px", background: "linear-gradient(90deg, #0D47A1, #1976D2, #42A5F5)" }} />

        <div style={{ padding: "20px" }}>
          {/* Curriculum name */}
          <h3
            style={{
              margin: "0 0 4px 0",
              fontSize: "18px",
              fontWeight: "700",
              color: name ? "#111827" : "#D1D5DB",
              fontStyle: name ? "normal" : "italic",
              lineHeight: "1.3",
            }}
          >
            {name || "Curriculum Name"}
          </h3>

          {/* Badges row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
            {code ? (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  backgroundColor: "#EFF6FF",
                  color: "#1D4ED8",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: "1px solid #BFDBFE",
                }}
              >
                {code}
              </span>
            ) : (
              <span style={{ fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No code</span>
            )}

            {framework && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  backgroundColor: "#F0FDF4",
                  color: "#15803D",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: "1px solid #BBF7D0",
                }}
              >
                {framework}
              </span>
            )}

            {academicYear && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: "20px",
                  backgroundColor: "#FFF7ED",
                  color: "#C2410C",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: "1px solid #FED7AA",
                }}
              >
                {academicYear}
              </span>
            )}
          </div>

          {/* Details grid */}
          {hasDetails && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                padding: "14px",
                backgroundColor: "#F9FAFB",
                borderRadius: "10px",
                marginBottom: "16px",
              }}
            >
              <PreviewField label="Framework" value={framework ? FRAMEWORK_LABELS[framework] || framework : null} placeholder="Not selected" />
              <PreviewField label="Academic Year" value={academicYear} placeholder="Not set" />
              <PreviewField
                label="Cycle Model"
                value={academicCycleModel ? CYCLE_MODEL_LABELS[academicCycleModel] : null}
                placeholder="Not selected"
              />
              <PreviewField label="Total Periods" value={filledPeriods.length > 0 ? `${filledPeriods.length}` : null} placeholder="0" />
            </div>
          )}

          {/* Description */}
          {description && (
            <div style={{ marginBottom: "16px" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.6" }}>{description}</p>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "0 0 16px 0" }} />

          {/* Academic structure */}
          <div style={{ marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Academic Structure
              </h4>
              {filledPeriods.length > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "600",
                    color: "#0D47A1",
                    backgroundColor: "#EFF6FF",
                    padding: "2px 8px",
                    borderRadius: "20px",
                    border: "1px solid #BFDBFE",
                  }}
                >
                  {filledPeriods.length} {academicCycleModel === "semesters" ? "semester" : "period"}{filledPeriods.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {filledPeriods.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px 16px",
                  backgroundColor: "#F9FAFB",
                  borderRadius: "10px",
                  border: "1px dashed #E5E7EB",
                }}
              >
                <div style={{ fontSize: "24px", marginBottom: "8px" }}>📅</div>
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
                  Academic periods will appear here
                </p>
              </div>
            ) : (
              filledPeriods.map((period, index) => (
                <PeriodPreviewCard key={index} period={period} index={index} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Empty state hint */}
      {!hasDetails && filledPeriods.length === 0 && (
        <p style={{ textAlign: "center", fontSize: "12px", color: "#9CA3AF", marginTop: "12px" }}>
          Fill in the form to see a live preview
        </p>
      )}
    </div>
  );
}
