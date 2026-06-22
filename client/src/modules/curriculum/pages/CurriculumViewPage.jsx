import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCurriculumQuery } from "../hooks/useCurriculum";
import { schoolApi } from "../../schools/services/schoolApi";
import VersionHistory from "../components/VersionHistory";

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

/* ── Course chip ──────────────────────────────────────────────────────── */

const BLUE_SHADES = [
  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  { bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
  { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  { bg: "#F0F7FF", color: "#1E40AF", border: "#C7D9F8" },
];

function CourseChip({ name, index }) {
  const shade = BLUE_SHADES[index % BLUE_SHADES.length];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 11px",
        backgroundColor: shade.bg,
        color: shade.color,
        border: `1px solid ${shade.border}`,
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "500",
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  );
}

/* ── View class row (accordion, read-only) ────────────────────────────── */

function ViewClassRow({ grade, isExpanded, onToggle }) {
  const courseCount = grade.courses?.length || 0;
  const hasCourses = courseCount > 0;

  return (
    <div
      style={{
        border: `1px solid ${isExpanded ? "#BFDBFE" : "#E5E7EB"}`,
        borderRadius: "10px",
        overflow: "hidden",
        backgroundColor: "#fff",
        transition: "border-color 0.15s",
      }}
    >
      {/* Header — click to toggle */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "11px 14px",
          backgroundColor: isExpanded ? "#EFF6FF" : "#fff",
          cursor: "pointer",
          transition: "background-color 0.15s",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: hasCourses ? "#16A34A" : "#D1D5DB",
            flexShrink: 0,
          }}
        />
        <span style={{ flex: 1, fontSize: "13px", fontWeight: "600", color: isExpanded ? "#0D47A1" : "#111827", transition: "color 0.15s" }}>
          {grade.name}
        </span>
        <span
          style={{
            padding: "2px 9px",
            backgroundColor: hasCourses ? "#DBEAFE" : "#F3F4F6",
            color: hasCourses ? "#1D4ED8" : "#9CA3AF",
            borderRadius: "20px",
            fontSize: "11px",
            fontWeight: "600",
            border: `1px solid ${hasCourses ? "#BFDBFE" : "#E5E7EB"}`,
            flexShrink: 0,
          }}
        >
          {courseCount} {courseCount === 1 ? "course" : "courses"}
        </span>
        <svg
          width="13" height="13" viewBox="0 0 24 24" fill="none"
          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", color: isExpanded ? "#0D47A1" : "#9CA3AF", flexShrink: 0 }}
        >
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Courses — only shown when expanded */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid #DBEAFE", padding: "12px 14px", backgroundColor: "#F8FBFF" }}>
          {hasCourses ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {grade.courses.map((course, ci) => (
                <CourseChip key={course.id} name={course.name} index={ci} />
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>
              No courses assigned yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── View term accordion ──────────────────────────────────────────────── */

function ViewTermAccordion({ period, termIndex, termData, model, isOpen, onToggle, expandedGrades, onToggleGrade }) {
  const grades = termData.grades || [];
  const totalCourses = grades.reduce((s, g) => s + (g.courses?.length || 0), 0);
  const isConfigured = grades.length > 0;
  const label = termLabel(period, termIndex, model);
  const startDate = formatDate(period.startDate);
  const endDate = formatDate(period.endDate);

  return (
    <div
      style={{
        borderRadius: "14px",
        border: `1.5px solid ${isOpen ? "#BFDBFE" : "#E5E7EB"}`,
        overflow: "hidden",
        backgroundColor: "#fff",
        boxShadow: isOpen ? "0 2px 12px rgba(13,71,161,0.07)" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Term header */}
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 18px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "Inter, sans-serif",
          backgroundColor: isOpen ? "#EFF6FF" : "#fff",
          borderLeft: `4px solid ${isOpen ? "#0D47A1" : "transparent"}`,
          transition: "background-color 0.15s, border-left-color 0.2s",
        }}
      >
        {/* Chevron */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease", color: isOpen ? "#0D47A1" : "#9CA3AF", flexShrink: 0 }}
        >
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Number badge */}
        <span
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "10px",
            backgroundColor: isOpen ? "#0D47A1" : (isConfigured ? "#DBEAFE" : "#F3F4F6"),
            color: isOpen ? "#fff" : (isConfigured ? "#1D4ED8" : "#9CA3AF"),
            fontSize: "13px",
            fontWeight: "800",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.2s",
          }}
        >
          {termIndex + 1}
        </span>

        {/* Label + dates */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: "700", color: isOpen ? "#0D47A1" : "#111827" }}>
            {label}
          </p>
          <p style={{ margin: 0, fontSize: "11px", color: "#9CA3AF" }}>
            {startDate && endDate ? `${startDate} – ${endDate}` : "No dates set"}
          </p>
        </div>

        {/* Stats badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          {isConfigured ? (
            <>
              <span style={{ padding: "3px 9px", backgroundColor: "#EFF6FF", color: "#1D4ED8", borderRadius: "20px", fontSize: "11px", fontWeight: "600", border: "1px solid #BFDBFE" }}>
                {grades.length} {grades.length === 1 ? "class" : "classes"}
              </span>
              <span style={{ padding: "3px 9px", backgroundColor: "#F0FDF4", color: "#15803D", borderRadius: "20px", fontSize: "11px", fontWeight: "600", border: "1px solid #BBF7D0" }}>
                {totalCourses} {totalCourses === 1 ? "course" : "courses"}
              </span>
            </>
          ) : (
            <span style={{ padding: "3px 9px", backgroundColor: "#F9FAFB", color: "#9CA3AF", borderRadius: "20px", fontSize: "11px", fontWeight: "500", border: "1px solid #E5E7EB" }}>
              Not configured
            </span>
          )}
        </div>
      </button>

      {/* Term body */}
      {isOpen && (
        <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px 18px 14px", backgroundColor: "#FAFBFF", display: "flex", flexDirection: "column", gap: "8px" }}>
          {grades.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "18px 20px",
                backgroundColor: "#fff",
                borderRadius: "10px",
                border: "1.5px dashed #E5E7EB",
              }}
            >
              <span style={{ fontSize: "22px" }}>🏫</span>
              <div>
                <p style={{ margin: "0 0 2px 0", fontSize: "13px", fontWeight: "600", color: "#374151" }}>
                  No classes for {label}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  Open the Structure Builder to add classes and courses.
                </p>
              </div>
            </div>
          ) : (
            grades.map((grade) => (
              <ViewClassRow
                key={grade.id}
                grade={grade}
                isExpanded={expandedGrades.has(grade.id)}
                onToggle={() => onToggleGrade(grade.id)}
              />
            ))
          )}
        </div>
      )}
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
  const location = useLocation();
  const { data: curriculum, isLoading, isError } = useCurriculumQuery(id);

  useEffect(() => {
    if (location.state?.scrollTo === "versions") {
      const el = document.getElementById("version-history");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.state]);
  const [expandedTerms, setExpandedTerms] = useState(() => new Set([0]));
  const [expandedGrades, setExpandedGrades] = useState(() => new Set());

  const toggleTerm = (i) => setExpandedTerms((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const toggleGrade = (id) => setExpandedGrades((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

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

  const { data: schoolsData } = useQuery({
    queryKey: ["schools", "byCurriculum", id],
    queryFn:  () => schoolApi.getAll({ curriculumId: id }),
    enabled:  !!id,
  });
  const assignedSchools = schoolsData?.data || [];

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

      {/* ── Schools using this curriculum ────────────────────────────── */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden", marginBottom: "24px" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>Schools Using This Curriculum</h2>
          <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>{assignedSchools.length}</span>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {assignedSchools.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "#9CA3AF" }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏫</div>
              <p style={{ margin: 0, fontSize: "13px" }}>No schools have been assigned this curriculum yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {assignedSchools.map((s) => (
                <div key={s.id} onClick={() => navigate(`/schools/${s.id}/view`)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: "10px", border: "1px solid #E5E7EB", cursor: "pointer", transition: "background-color 0.12s" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🏫</span>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{s.code}{s.address?.county ? ` · ${s.address.county}` : ""}</p>
                    </div>
                  </div>
                  <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: s.status === "active" ? "#ECFDF5" : "#F9FAFB", color: s.status === "active" ? "#065F46" : "#6B7280", border: `1px solid ${s.status === "active" ? "#A7F3D0" : "#E5E7EB"}` }}>
                    {s.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Version history ──────────────────────────────────────────── */}
      <div id="version-history">
        <VersionHistory curriculumId={id} />
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
        /* ── Accordion list ─────────────────────────────────────────── */
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {periods.map((period, i) => (
            <ViewTermAccordion
              key={i}
              period={period}
              termIndex={i}
              termData={structure[i] || { grades: [] }}
              model={model}
              isOpen={expandedTerms.has(i)}
              onToggle={() => toggleTerm(i)}
              expandedGrades={expandedGrades}
              onToggleGrade={toggleGrade}
            />
          ))}
        </div>
      )}

      {/* Bottom spacing */}
      <div style={{ height: "32px" }} />
    </div>
  );
}
