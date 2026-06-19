import { useFormContext } from "react-hook-form";
import { FRAMEWORK_LABELS } from "../schemas/curriculum.schema";

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatShortDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const periodUnitLabel = (cycleModel, count) => {
  const singular = cycleModel === "semesters" ? "Semester" : cycleModel === "terms" ? "Term" : "Period";
  const plural   = cycleModel === "semesters" ? "Semesters" : cycleModel === "terms" ? "Terms" : "Periods";
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
};

const cycleModelLabel = (model) => {
  if (model === "terms") return "Terms";
  if (model === "semesters") return "Semesters";
  if (model === "custom") return "Custom";
  return "—";
};

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="3" width="14" height="12" rx="2" stroke="#93C5FD" strokeWidth="1.5" fill="none" />
      <path d="M1 7h14" stroke="#93C5FD" strokeWidth="1.5" />
      <path d="M5 1v4M11 1v4" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BreakIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 2h8v8a4 4 0 01-8 0V2z" stroke="#93C5FD" strokeWidth="1.5" fill="none" />
      <path d="M12 5h2a2 2 0 010 4h-2" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 14h4" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MetaBox({ label, value, placeholder, accent }) {
  return (
    <div
      style={{
        backgroundColor: accent || "#F0F6FF",
        borderRadius: "10px",
        padding: "10px 12px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <p style={{ margin: "0 0 2px 0", fontSize: "10px", fontWeight: "700", color: "#93A8C9", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "13px",
          fontWeight: "600",
          color: value ? "#1E3A5F" : "#C3D3E8",
          fontStyle: value ? "normal" : "italic",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value || placeholder}
      </p>
    </div>
  );
}

function PeriodCard({ period, index, cycleModel }) {
  const startDate  = formatShortDate(period.startDate);
  const endDate    = formatShortDate(period.endDate);
  const breakStart = formatShortDate(period.midTermBreakStartDate);
  const breakEnd   = formatShortDate(period.midTermBreakEndDate);
  const hasBreak   = breakStart && breakEnd;
  const hasDates   = startDate || endDate;

  const label =
    cycleModel === "terms"     ? `Term ${index + 1}` :
    cycleModel === "semesters" ? `Semester ${index + 1}` :
    `Period ${index + 1}`;

  const displayName = period.name || label;

  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        backgroundColor: "#EFF6FF",
        border: "1.5px solid #BFDBFE",
        borderRadius: "12px",
        padding: "14px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {/* Period number badge + name */}
      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
        <div
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #0D47A1, #1976D2)",
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
        </div>
        <span
          style={{
            fontSize: "13px",
            fontWeight: "700",
            color: "#1E3A5F",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {displayName}
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "#BFDBFE" }} />

      {/* Dates */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <CalendarIcon />
          {hasDates ? (
            <span style={{ fontSize: "11px", color: "#2563EB", fontWeight: "500", lineHeight: "1.3" }}>
              {startDate || "—"}
              <br />
              <span style={{ color: "#6B7280" }}>→ {endDate || "—"}</span>
            </span>
          ) : (
            <span style={{ fontSize: "11px", color: "#C3D3E8", fontStyle: "italic" }}>No dates set</span>
          )}
        </div>

        {/* Mid-term break */}
        {hasBreak && (
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "5px",
              backgroundColor: "#F0F6FF",
              border: "1px solid #BFDBFE",
              borderRadius: "6px",
              padding: "4px 6px",
              marginTop: "2px",
            }}
          >
            <div style={{ marginTop: "1px", flexShrink: 0 }}>
              <BreakIcon />
            </div>
            <span style={{ fontSize: "10px", color: "#1E40AF", fontWeight: "500", lineHeight: "1.4" }}>
              Break<br />{breakStart} – {breakEnd}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CurriculumPreview() {
  const { watch } = useFormContext();
  const { name, code, academicYear, description, framework, academicCycleModel, periods = [] } = watch();

  const filledPeriods = (periods || []).filter(Boolean);
  const isEmpty = !name && !code && !academicYear && !framework && filledPeriods.length === 0;

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

      {/* ── Main card ── */}
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

        {/* Card body */}
        <div style={{ padding: "20px 20px 0 20px" }}>

          {/* ── Title section ── */}
          <div style={{ marginBottom: "16px" }}>
            <h3
              style={{
                margin: "0 0 6px 0",
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
              <span style={{ fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>No code assigned</span>
            )}
          </div>

          {/* ── Meta boxes row ── */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <MetaBox
              label="Framework"
              value={framework || null}
              placeholder="—"
              accent="#EFF6FF"
            />
            <MetaBox
              label="Academic Year"
              value={academicYear || null}
              placeholder="—"
              accent="#E0F2FE"
            />
            <MetaBox
              label="Cycle"
              value={academicCycleModel ? cycleModelLabel(academicCycleModel) : null}
              placeholder="—"
              accent="#DBEAFE"
            />
            <MetaBox
              label={academicCycleModel === "semesters" ? "Semesters" : academicCycleModel === "terms" ? "Terms" : "Periods"}
              value={filledPeriods.length > 0 ? String(filledPeriods.length) : null}
              placeholder="0"
              accent="#EFF6FF"
            />
          </div>

          {/* ── Description ── */}
          {description ? (
            <div
              style={{
                backgroundColor: "#F8FAFF",
                borderLeft: "3px solid #BFDBFE",
                borderRadius: "0 8px 8px 0",
                padding: "10px 12px",
                marginBottom: "18px",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", color: "#4B5563", lineHeight: "1.65" }}>
                {description}
              </p>
            </div>
          ) : (
            <div style={{ marginBottom: "18px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", fontStyle: "italic" }}>
                No description provided
              </p>
            </div>
          )}

          {/* ── Divider ── */}
          <div
            style={{
              height: "1px",
              background: "linear-gradient(90deg, #DBEAFE 0%, #E0F2FE 50%, transparent 100%)",
              marginBottom: "16px",
            }}
          />

          {/* ── Academic structure ── */}
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: "800",
                  color: "#6B8EBF",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Academic Structure
              </span>
              {filledPeriods.length > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "#1D4ED8",
                    backgroundColor: "#EFF6FF",
                    padding: "2px 9px",
                    borderRadius: "20px",
                    border: "1px solid #BFDBFE",
                  }}
                >
                  {periodUnitLabel(academicCycleModel, filledPeriods.length)}
                </span>
              )}
            </div>

            {filledPeriods.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "28px 16px",
                  backgroundColor: "#F8FAFF",
                  borderRadius: "12px",
                  border: "1.5px dashed #BFDBFE",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: "#EFF6FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 10px auto",
                    fontSize: "18px",
                  }}
                >
                  📅
                </div>
                <p style={{ margin: 0, fontSize: "12px", color: "#93C5FD", fontWeight: "500" }}>
                  Academic periods will appear here
                </p>
              </div>
            ) : (
              /* Horizontal period cards */
              <div style={{ display: "flex", gap: "10px", flexWrap: filledPeriods.length > 3 ? "wrap" : "nowrap" }}>
                {filledPeriods.map((period, index) => (
                  <PeriodCard
                    key={index}
                    period={period}
                    index={index}
                    cycleModel={academicCycleModel}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Empty state hint */}
      {isEmpty && (
        <p style={{ textAlign: "center", fontSize: "11px", color: "#C3D3E8", marginTop: "10px" }}>
          Start filling in the form to see a live preview
        </p>
      )}
    </div>
  );
}
