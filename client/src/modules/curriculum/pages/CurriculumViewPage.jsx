import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCurriculumQuery } from "../hooks/useCurriculum";

/* ── Helpers ──────────────────────────────────────────────────────────── */

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const termLabel = (period, i, model) => {
  if (period?.name) return period.name;
  if (model === "semesters") return `Semester ${i + 1}`;
  if (model === "terms") return `Term ${i + 1}`;
  return `Period ${i + 1}`;
};

const cycleLabel = (model) => {
  if (model === "semesters") return "Semesters";
  if (model === "terms") return "Terms";
  return "Periods";
};

const FRAMEWORK_COLORS = {
  CBC:       { bg: "#1D4ED8", light: "#EFF6FF", border: "#BFDBFE" },
  IGCSE:     { bg: "#1565C0", light: "#DBEAFE", border: "#93C5FD" },
  IB:        { bg: "#1E40AF", light: "#EFF6FF", border: "#BFDBFE" },
  National:  { bg: "#0369A1", light: "#E0F2FE", border: "#BAE6FD" },
  Cambridge: { bg: "#1E3A8A", light: "#DBEAFE", border: "#93C5FD" },
  Custom:    { bg: "#374151", light: "#F9FAFB", border: "#E5E7EB" },
};

const getInitial = (name) => (name || "?").trim()[0].toUpperCase();

/* ── Course chip ──────────────────────────────────────────────────────── */

function CourseChip({ name, index }) {
  const shades = [
    { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
    { bg: "#F0F9FF", color: "#0369A1", border: "#BAE6FD" },
    { bg: "#EEF2FF", color: "#4338CA", border: "#C7D2FE" },
    { bg: "#F0FDFB", color: "#0F766E", border: "#99F6E4" }, // a teal-ish - on second thought let me make this more blue
  ];
  // Keep all in blue family
  const blueShades = [
    { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
    { bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
    { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
    { bg: "#F0F7FF", color: "#1E40AF", border: "#C7D9F8" },
  ];
  const shade = blueShades[index % blueShades.length];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 11px",
        backgroundColor: shade.bg,
        color: shade.color,
        border: `1px solid ${shade.border}`,
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "500",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );
}

/* ── Class card ───────────────────────────────────────────────────────── */

function ClassCard({ grade, termIndex }) {
  const [hovered, setHovered] = useState(false);
  const courseCount = grade.courses?.length || 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "14px",
        border: `1.5px solid ${hovered ? "#BFDBFE" : "#E8EFF8"}`,
        boxShadow: hovered
          ? "0 6px 20px rgba(13,71,161,0.12), 0 2px 6px rgba(0,0,0,0.04)"
          : "0 1px 4px rgba(0,0,0,0.05)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "border-color 0.15s, box-shadow 0.15s, transform 0.15s",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        cursor: "default",
      }}
    >
      {/* Class header */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Avatar */}
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #0D47A1 0%, #1976D2 100%)",
            color: "#fff",
            fontSize: "15px",
            fontWeight: "800",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            letterSpacing: "-0.5px",
          }}
        >
          {getInitial(grade.name)}
        </div>

        {/* Name + badge */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: "700",
              color: "#0F2645",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {grade.name}
          </p>
          <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#9CA3AF" }}>
            {courseCount} {courseCount === 1 ? "course" : "courses"}
          </p>
        </div>

        {/* Course count badge */}
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            backgroundColor: courseCount > 0 ? "#EFF6FF" : "#F3F4F6",
            color: courseCount > 0 ? "#1D4ED8" : "#9CA3AF",
            border: `1px solid ${courseCount > 0 ? "#BFDBFE" : "#E5E7EB"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: "700",
            flexShrink: 0,
          }}
        >
          {courseCount}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: "1px", backgroundColor: "#F0F4F8" }} />

      {/* Courses area */}
      {courseCount > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {grade.courses.map((course, ci) => (
            <CourseChip key={course.id} name={course.name} index={ci} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            padding: "14px 10px",
            backgroundColor: "#F8FAFF",
            borderRadius: "10px",
            border: "1.5px dashed #E0ECFF",
          }}
        >
          <span style={{ fontSize: "20px" }}>📭</span>
          <p style={{ margin: 0, fontSize: "11px", fontWeight: "600", color: "#9CA3AF" }}>
            No courses assigned
          </p>
          <p style={{ margin: 0, fontSize: "10px", color: "#C3D3E8", textAlign: "center", lineHeight: 1.4 }}>
            Open the Structure Builder to add courses to this class.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Term section ─────────────────────────────────────────────────────── */

function TermSection({ period, termIndex, termData, model, onPrev, onNext, canGoPrev, canGoNext }) {
  const grades = termData.grades || [];
  const totalCourses = grades.reduce((s, g) => s + (g.courses?.length || 0), 0);
  const isConfigured = grades.length > 0;
  const label = termLabel(period, termIndex, model);
  const startDate = formatDate(period.startDate);
  const endDate = formatDate(period.endDate);

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "18px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
        borderLeft: "4px solid",
        borderColor: isConfigured ? "#1565C0" : "#E5E7EB",
      }}
    >
      {/* Term header */}
      <div
        style={{
          padding: "16px 20px",
          background: isConfigured
            ? "linear-gradient(135deg, #F8FAFF 0%, #EFF6FF 100%)"
            : "#FAFAFA",
          borderBottom: "1px solid #F0F4F8",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* Prev arrow */}
        <button
          type="button"
          onClick={onPrev}
          disabled={!canGoPrev}
          title="Previous"
          style={{
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            border: `1.5px solid ${canGoPrev ? "#BFDBFE" : "#E5E7EB"}`,
            backgroundColor: canGoPrev ? "#EFF6FF" : "#F9FAFB",
            color: canGoPrev ? "#0D47A1" : "#D1D5DB",
            cursor: canGoPrev ? "pointer" : "not-allowed",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Number badge */}
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: isConfigured
              ? "linear-gradient(135deg, #0D47A1 0%, #1976D2 100%)"
              : "#E5E7EB",
            color: isConfigured ? "#ffffff" : "#9CA3AF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "15px",
            fontWeight: "800",
            flexShrink: 0,
            boxShadow: isConfigured ? "0 2px 8px rgba(13,71,161,0.25)" : "none",
          }}
        >
          {termIndex + 1}
        </div>

        {/* Label + dates */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: "0 0 2px 0",
              fontSize: "15px",
              fontWeight: "800",
              color: "#0F2645",
              letterSpacing: "-0.2px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {label}
          </h3>
          {startDate && endDate ? (
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", display: "flex", alignItems: "center", gap: "4px" }}>
              <span>{startDate}</span>
              <span style={{ color: "#D1D5DB" }}>–</span>
              <span>{endDate}</span>
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: "12px", color: "#C3D3E8", fontStyle: "italic" }}>
              No dates configured
            </p>
          )}
        </div>

        {/* Stats badges */}
        <div style={{ display: "flex", gap: "6px", flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isConfigured ? (
            <>
              <span
                style={{
                  padding: "3px 10px",
                  backgroundColor: "#EFF6FF",
                  color: "#1D4ED8",
                  border: "1px solid #BFDBFE",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {grades.length} {grades.length === 1 ? "class" : "classes"}
              </span>
              <span
                style={{
                  padding: "3px 10px",
                  backgroundColor: "#DBEAFE",
                  color: "#1565C0",
                  border: "1px solid #93C5FD",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: "600",
                }}
              >
                {totalCourses} {totalCourses === 1 ? "course" : "courses"}
              </span>
            </>
          ) : (
            <span
              style={{
                padding: "3px 10px",
                backgroundColor: "#F9FAFB",
                color: "#9CA3AF",
                border: "1px solid #E5E7EB",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: "500",
              }}
            >
              Not configured
            </span>
          )}
        </div>

        {/* Next arrow */}
        <button
          type="button"
          onClick={onNext}
          disabled={!canGoNext}
          title="Next"
          style={{
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "8px",
            border: `1.5px solid ${canGoNext ? "#0D47A1" : "#E5E7EB"}`,
            backgroundColor: canGoNext ? "#0D47A1" : "#F9FAFB",
            color: canGoNext ? "#ffffff" : "#D1D5DB",
            cursor: canGoNext ? "pointer" : "not-allowed",
            flexShrink: 0,
            transition: "all 0.15s",
            boxShadow: canGoNext ? "0 2px 6px rgba(13,71,161,0.25)" : "none",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 24px" }}>
        {grades.length === 0 ? (
          /* Empty term state */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "20px 24px",
              backgroundColor: "#F8FAFF",
              borderRadius: "12px",
              border: "1.5px dashed #DBEAFE",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "12px",
                backgroundColor: "#EFF6FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "22px",
                flexShrink: 0,
              }}
            >
              🏫
            </div>
            <div>
              <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "600", color: "#374151" }}>
                No classes added for {label}
              </p>
              <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                Use the Structure Builder to assign classes and courses to this period.
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            {grades.map((grade) => (
              <ClassCard key={grade.id} grade={grade} termIndex={termIndex} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Loading skeleton ─────────────────────────────────────────────────── */

function Skeleton({ w, h, radius = "8px", mb = "0" }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        backgroundColor: "#EEF2F7",
        marginBottom: mb,
        flexShrink: 0,
      }}
    />
  );
}

function LoadingState() {
  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Back button skeleton */}
      <Skeleton w="90px" h="32px" radius="8px" mb="20px" />

      {/* Header card skeleton */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "20px",
          overflow: "hidden",
          marginBottom: "24px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ height: "80px", background: "linear-gradient(135deg, #E8EFF8 0%, #EEF4FC 100%)" }} />
        <div style={{ padding: "20px 28px 24px" }}>
          <Skeleton w="60%" h="22px" radius="6px" mb="10px" />
          <Skeleton w="40%" h="14px" radius="6px" mb="20px" />
          <div style={{ display: "flex", gap: "12px" }}>
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} w="90px" h="56px" radius="12px" />
            ))}
          </div>
        </div>
      </div>

      {/* Term skeletons */}
      {[1, 2].map((n) => (
        <div
          key={n}
          style={{
            backgroundColor: "#fff",
            borderRadius: "18px",
            borderLeft: "4px solid #E5E7EB",
            overflow: "hidden",
            marginBottom: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div style={{ padding: "20px 24px", backgroundColor: "#FAFAFA", borderBottom: "1px solid #F0F4F8", display: "flex", gap: "14px", alignItems: "center" }}>
            <Skeleton w="42px" h="42px" radius="12px" />
            <div style={{ flex: 1 }}>
              <Skeleton w="120px" h="16px" radius="5px" mb="8px" />
              <Skeleton w="180px" h="12px" radius="5px" />
            </div>
          </div>
          <div style={{ padding: "20px 24px", display: "flex", gap: "12px" }}>
            {[1, 2, 3].map((m) => (
              <Skeleton key={m} w="200px" h="120px" radius="14px" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function CurriculumViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: curriculum, isLoading, isError } = useCurriculumQuery(id);
  const [activeTermIndex, setActiveTermIndex] = useState(0);

  if (isLoading) return <LoadingState />;

  if (isError || !curriculum) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            padding: "20px 24px",
            backgroundColor: "#FFF5F5",
            border: "1px solid #FECACA",
            borderRadius: "14px",
          }}
        >
          <span style={{ fontSize: "24px" }}>⚠️</span>
          <div>
            <p style={{ margin: "0 0 4px 0", fontWeight: "700", color: "#DC2626", fontSize: "14px" }}>
              Could not load curriculum
            </p>
            <p style={{ margin: 0, fontSize: "13px", color: "#EF4444" }}>
              The curriculum may not exist or there was a network error.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const structure = curriculum.structure || [];
  const periods = curriculum.periods || [];
  const model = curriculum.academicCycleModel || "terms";
  const fwColors = FRAMEWORK_COLORS[curriculum.framework] || FRAMEWORK_COLORS.Custom;

  const totalClasses = structure.reduce((s, t) => s + (t.grades?.length || 0), 0);
  const totalCourses = structure.reduce(
    (s, t) => s + (t.grades?.reduce((gs, g) => gs + (g.courses?.length || 0), 0) || 0),
    0
  );
  const configuredTerms = structure.filter((t) => (t.grades?.length || 0) > 0).length;
  const hasStructure = structure.some((t) => (t.grades?.length || 0) > 0);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Breadcrumb / back ──────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <button
          type="button"
          onClick={() => navigate("/curriculum")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 14px",
            backgroundColor: "#ffffff",
            color: "#374151",
            border: "1.5px solid #E5E7EB",
            borderRadius: "9px",
            fontSize: "13px",
            fontWeight: "500",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All Curricula
        </button>
        <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>
        <span
          style={{
            fontSize: "13px",
            color: "#6B7280",
            maxWidth: "220px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {curriculum.name}
        </span>
      </div>

      {/* ── Hero header card ──────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 4px 20px rgba(13,71,161,0.10), 0 1px 4px rgba(0,0,0,0.05)",
          overflow: "hidden",
          marginBottom: "24px",
        }}
      >
        {/* Gradient hero section */}
        <div
          style={{
            background: "linear-gradient(135deg, #0A3880 0%, #0D47A1 40%, #1565C0 70%, #1976D2 100%)",
            padding: "28px 32px 32px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "160px", height: "160px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: "-10px", right: "100px", width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: "10px", right: "200px", width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

          {/* Top row: framework badge + action buttons */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "16px", position: "relative" }}>
            <span
              style={{
                padding: "5px 14px",
                backgroundColor: "rgba(255,255,255,0.18)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: "700",
                letterSpacing: "0.04em",
                backdropFilter: "blur(4px)",
              }}
            >
              {curriculum.framework}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => navigate(`/curriculum/${id}/edit`)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 14px",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  color: "#ffffff",
                  border: "1px solid rgba(255,255,255,0.25)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                }}
              >
                ✏ Edit
              </button>
              <button
                type="button"
                onClick={() => navigate(`/curriculum/${id}/structure`)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 14px",
                  backgroundColor: "rgba(255,255,255,0.95)",
                  color: "#0D47A1",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "700",
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                }}
              >
                🏗 Structure Builder
              </button>
            </div>
          </div>

          {/* Name */}
          <h1
            style={{
              margin: "0 0 6px 0",
              fontSize: "26px",
              fontWeight: "900",
              color: "#ffffff",
              letterSpacing: "-0.5px",
              lineHeight: 1.2,
              position: "relative",
            }}
          >
            {curriculum.name}
          </h1>

          {/* Code · Year */}
          <p
            style={{
              margin: "0 0 10px 0",
              fontSize: "13px",
              color: "rgba(255,255,255,0.72)",
              fontWeight: "500",
              position: "relative",
            }}
          >
            {[curriculum.code, curriculum.academicYear, cycleLabel(model)].filter(Boolean).join("  ·  ")}
          </p>

          {/* Description */}
          {curriculum.description && (
            <p
              style={{
                margin: 0,
                fontSize: "13px",
                color: "rgba(255,255,255,0.75)",
                lineHeight: "1.65",
                maxWidth: "600px",
                position: "relative",
              }}
            >
              {curriculum.description}
            </p>
          )}
        </div>

        {/* Stats bar */}
        <div
          style={{
            padding: "20px 32px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            borderBottom: "1px solid #F0F4F8",
          }}
        >
          {[
            { label: cycleLabel(model), value: periods.length, icon: "📆", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
            { label: "Classes", value: totalClasses, icon: "🎓", bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
            { label: "Courses", value: totalCourses, icon: "📚", bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
            { label: "Configured", value: `${configuredTerms}/${periods.length}`, icon: "✅", bg: "#F0F7FF", color: "#1E40AF", border: "#C7D9F8" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 18px",
                backgroundColor: stat.bg,
                border: `1px solid ${stat.border}`,
                borderRadius: "12px",
                flex: "1 0 120px",
                minWidth: "100px",
              }}
            >
              <span style={{ fontSize: "20px", flexShrink: 0 }}>{stat.icon}</span>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    fontWeight: "800",
                    color: stat.color,
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </p>
                <p
                  style={{
                    margin: "2px 0 0 0",
                    fontSize: "10px",
                    fontWeight: "700",
                    color: stat.color,
                    opacity: 0.65,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Completion progress bar */}
        {periods.length > 0 && (
          <div style={{ padding: "14px 32px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#6B7280" }}>
                Setup progress
              </span>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#0D47A1" }}>
                {configuredTerms} of {periods.length} {cycleLabel(model).toLowerCase()} configured
              </span>
            </div>
            <div style={{ height: "6px", backgroundColor: "#EEF2F7", borderRadius: "10px", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${periods.length > 0 ? (configuredTerms / periods.length) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #0D47A1, #42A5F5)",
                  borderRadius: "10px",
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Academic structure section ────────────────────────────────── */}

      {/* Section heading */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: "800",
            color: "#6B7280",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
          }}
        >
          Academic Structure
        </h2>
        <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }} />
        {periods.length > 0 && (
          <span
            style={{
              padding: "3px 10px",
              backgroundColor: "#EFF6FF",
              color: "#1D4ED8",
              border: "1px solid #BFDBFE",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "600",
              whiteSpace: "nowrap",
            }}
          >
            {periods.length} {cycleLabel(model).toLowerCase()}
          </span>
        )}
      </div>

      {periods.length === 0 ? (
        /* ── No periods at all ──────────────────────────────────────── */
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "20px",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            padding: "56px 32px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "20px",
              background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
              border: "2px solid #BFDBFE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              margin: "0 auto 20px",
            }}
          >
            🏗
          </div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "800", color: "#0F2645" }}>
            Structure not set up yet
          </h3>
          <p style={{ margin: "0 0 28px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6", maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>
            No academic periods have been configured. Edit the curriculum to add periods, then use the Structure Builder to assign classes and courses.
          </p>
          <button
            type="button"
            onClick={() => navigate(`/curriculum/${id}/structure`)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 24px",
              backgroundColor: "#0D47A1",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "700",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(13,71,161,0.25)",
            }}
          >
            🏗 Open Structure Builder
          </button>
        </div>
      ) : (
        /* ── Carousel ───────────────────────────────────────────────── */
        <TermSection
          key={activeTermIndex}
          period={periods[activeTermIndex]}
          termIndex={activeTermIndex}
          termData={structure[activeTermIndex] || { grades: [] }}
          model={model}
          canGoPrev={activeTermIndex > 0}
          canGoNext={activeTermIndex < periods.length - 1}
          onPrev={() => setActiveTermIndex((i) => i - 1)}
          onNext={() => setActiveTermIndex((i) => i + 1)}
        />
      )}

      {/* Bottom spacing */}
      <div style={{ height: "32px" }} />
    </div>
  );
}
