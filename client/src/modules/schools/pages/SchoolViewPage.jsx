import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSchoolQuery } from "../hooks/useSchool";
import { useCurriculumQuery } from "../../curriculum/hooks/useCurriculum";
import { useSupplementaryBySchoolQuery } from "../../supplementary/hooks/useSupplementary";
import { SUPPLEMENTARY_TYPE_META } from "../../supplementary/schemas/supplementary.schema";
import { teacherApi } from "../../teachers/services/teacherApi";
import { classApi } from "../../classes/services/classApi";
import { learnerApi } from "../../learners/services/learnerApi";

const TEAL = "#047857";

/* ── Chevron icon ────────────────────────────────────────────────────── */

function Chevron({ open }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      style={{
        transition: "transform 0.25s ease",
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Collapsible section wrapper (curriculum panels) ─────────────────── */

function AccordionSection({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        border: "1.5px solid #E5E7EB",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          backgroundColor: "transparent",
          border: "none",
          borderBottom: open ? "1px solid #F3F4F6" : "1px solid transparent",
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          textAlign: "left",
          transition: "border-color 0.25s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>
            {title}
          </h2>
          {count !== undefined && (
            <span
              style={{
                padding: "2px 9px",
                borderRadius: "20px",
                fontSize: "11px",
                fontWeight: "700",
                backgroundColor: "#F0FDF4",
                color: TEAL,
                border: "1px solid #BBF7D0",
              }}
            >
              {count}
            </span>
          )}
        </div>
        <span style={{ color: "#9CA3AF" }}>
          <Chevron open={open} />
        </span>
      </button>

      <div
        style={{
          maxHeight: open ? "4000px" : "0px",
          overflow: "hidden",
          transition: "max-height 0.3s ease",
        }}
      >
        <div style={{ padding: "16px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

/* ── Collapsible row for each supplementary item ─────────────────────── */

function AccordionItem({ sup, meta, navigate, baseStructure }) {
  const [open, setOpen] = useState(false);
  const isComp        = sup.type === "complementary";
  const termGrades    = baseStructure[sup.termIndex]?.grades || [];
  const supGrades     = sup.grades || [];
  const hasAnyCourses = supGrades.some((g) => g.courses?.length > 0);

  return (
    <div
      style={{
        border: `1.5px solid ${meta.border || "#E5E7EB"}`,
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* Clickable header row */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 14px",
          backgroundColor: meta.bg || "#F9FAFB",
          border: "none",
          borderBottom: open ? `1px solid ${meta.border || "#E5E7EB"}` : "1px solid transparent",
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          textAlign: "left",
          transition: "border-color 0.25s",
        }}
      >
        <span
          style={{
            padding: "2px 8px",
            borderRadius: "20px",
            fontSize: "10px",
            fontWeight: "700",
            backgroundColor: "#ffffff",
            color: meta.color,
            border: `1px solid ${meta.border}`,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {meta.label}
        </span>

        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: "700",
            color: "#111827",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sup.name}
        </p>

        <span style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", flexShrink: 0 }}>
          {sup.termName}
        </span>

        {/* View button — stop propagation so it doesn't toggle the accordion */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/supplementary/${sup.id}/view`);
          }}
          style={{
            background: "none",
            border: "none",
            color: meta.color,
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            padding: 0,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          View →
        </button>

        <span style={{ color: "#9CA3AF", flexShrink: 0 }}>
          <Chevron open={open} />
        </span>
      </button>

      {/* Collapsible body — per-grade course breakdown */}
      <div
        style={{
          maxHeight: open ? "2000px" : "0px",
          overflow: "hidden",
          transition: "max-height 0.3s ease",
        }}
      >
        <div style={{ padding: "10px 14px" }}>
          {!hasAnyCourses ? (
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>
              No courses added yet.{" "}
              <button
                type="button"
                onClick={() => navigate(`/supplementary/${sup.id}/editor`)}
                style={{
                  background: "none",
                  border: "none",
                  color: meta.color,
                  fontWeight: "600",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "12px",
                  padding: 0,
                }}
              >
                Edit courses →
              </button>
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {termGrades.map((grade) => {
                const supGrade    = supGrades.find((g) => g.gradeId === grade.id);
                const baseCourses = grade.courses || [];
                const supCourses  = supGrade?.courses || [];
                if (baseCourses.length === 0 && supCourses.length === 0) return null;
                return (
                  <div key={grade.id}>
                    <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#374151" }}>
                      {grade.name}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {baseCourses.map((c) => (
                        <span
                          key={c.id}
                          style={{
                            padding: "2px 7px",
                            backgroundColor: "#F3F4F6",
                            border: "1px solid #E5E7EB",
                            borderRadius: "5px",
                            fontSize: "10px",
                            color: "#6B7280",
                            textDecoration:
                              !isComp && supCourses.length > 0 ? "line-through" : "none",
                          }}
                        >
                          {c.name}
                        </span>
                      ))}
                      {supCourses.length > 0 && (
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#9CA3AF",
                            alignSelf: "center",
                            padding: "0 2px",
                          }}
                        >
                          {isComp ? "+" : "→"}
                        </span>
                      )}
                      {supCourses.map((c) => (
                        <span
                          key={c.id}
                          style={{
                            padding: "2px 7px",
                            backgroundColor: meta.bg,
                            border: `1px solid ${meta.border}`,
                            borderRadius: "5px",
                            fontSize: "10px",
                            color: meta.color,
                            fontWeight: "600",
                          }}
                        >
                          {c.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Plain section (Teachers, Classes, Learners) ─────────────────────── */

function Section({ title, count, children }) {
  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        border: "1.5px solid #E5E7EB",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #F3F4F6",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#111827" }}>
          {title}
        </h2>
        {count !== undefined && (
          <span
            style={{
              padding: "2px 9px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "700",
              backgroundColor: "#F0FDF4",
              color: TEAL,
              border: "1px solid #BBF7D0",
            }}
          >
            {count}
          </span>
        )}
      </div>
      <div style={{ padding: "16px 20px" }}>{children}</div>
    </div>
  );
}

/* ── Shared sub-components ───────────────────────────────────────────── */

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ color: "#9CA3AF", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div>
        <p
          style={{
            margin: "0 0 1px 0",
            fontSize: "11px",
            fontWeight: "600",
            color: "#9CA3AF",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {label}
        </p>
        <p style={{ margin: 0, fontSize: "14px", color: "#111827" }}>{value}</p>
      </div>
    </div>
  );
}

const STATUS_TEACHER = {
  active:   { bg: "#F5F3FF", color: "#5B21B6", border: "#C4B5FD" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
};
const STATUS_TEACHER_LABEL = { active: "Active", inactive: "Inactive", on_leave: "On Leave" };

const STATUS_CLASS = {
  active:   { bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

const STATUS_LEARNER = {
  active:      { bg: "#FDF2F8", color: "#831843", border: "#FBCFE8" },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  transferred: { bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE" },
  graduated:   { bg: "#F0FDF4", color: "#065F46", border: "#BBF7D0" },
};
const STATUS_LEARNER_LABEL = {
  active: "Active",
  inactive: "Inactive",
  transferred: "Transferred",
  graduated: "Graduated",
};

function Badge({ status, map, labelMap }) {
  const s = map[status] || map.inactive;
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: "700",
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}
    >
      {labelMap?.[status] ?? status}
    </span>
  );
}

function EmptyList({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
      <div style={{ fontSize: "24px", marginBottom: "8px" }}>{icon}</div>
      <p style={{ margin: 0, fontSize: "13px" }}>{text}</p>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */

export default function SchoolViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: school, isLoading, isError } = useSchoolQuery(id);
  const { data: curriculum } = useCurriculumQuery(school?.curriculumId);
  const { data: suppData }   = useSupplementaryBySchoolQuery(id);

  const { data: teachersData } = useQuery({
    queryKey: ["teachers", "bySchool", id],
    queryFn:  () => teacherApi.getAll({ schoolId: id }),
    enabled:  !!id,
  });
  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", id],
    queryFn:  () => classApi.getAll({ schoolId: id }),
    enabled:  !!id,
  });
  const { data: learnersData } = useQuery({
    queryKey: ["learners", "bySchool", id],
    queryFn:  () => learnerApi.getAll({ schoolId: id }),
    enabled:  !!id,
  });

  const teachers = teachersData?.data || [];
  const classes  = classesData?.data  || [];
  const learners = learnersData?.data  || [];

  if (isLoading) {
    return (
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "200px",
          color: "#9CA3AF",
          fontSize: "14px",
        }}
      >
        Loading school…
      </div>
    );
  }
  if (isError || !school) {
    return (
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          padding: "20px 24px",
          backgroundColor: "#FFF5F5",
          border: "1px solid #FECACA",
          borderRadius: "12px",
          color: "#EF4444",
          fontSize: "14px",
        }}
      >
        ⚠ School not found.
      </div>
    );
  }

  const statusStyle =
    school.status === "active"
      ? { bg: "#ECFDF5", color: "#065F46", border: "#A7F3D0" }
      : { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" };

  const address = [
    school.address?.street,
    school.address?.city,
    school.address?.county ? `${school.address.county} County` : null,
    "Kenya",
  ]
    .filter(Boolean)
    .join(", ");

  const supList      = suppData || [];
  const baseStructure = curriculum?.structure || [];

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Header banner ──────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #064E3B 0%, #047857 50%, #059669 100%)",
          borderRadius: "20px",
          padding: "28px 32px",
          marginBottom: "20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-40px",
            right: "-40px",
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            backgroundColor: "rgba(255,255,255,0.05)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={() => navigate("/schools")}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.65)",
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                padding: 0,
              }}
            >
              Schools
            </button>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: "500" }}>
              {school.name}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.15)",
                  border: "1.5px solid rgba(255,255,255,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                  flexShrink: 0,
                }}
              >
                🏫
              </div>
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "4px",
                  }}
                >
                  <h1
                    style={{
                      margin: 0,
                      fontSize: "22px",
                      fontWeight: "900",
                      color: "#ffffff",
                      letterSpacing: "-0.3px",
                    }}
                  >
                    {school.name}
                  </h1>
                  <span
                    style={{
                      padding: "2px 9px",
                      borderRadius: "20px",
                      fontSize: "11px",
                      fontWeight: "700",
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.color,
                      border: `1px solid ${statusStyle.border}`,
                      textTransform: "capitalize",
                    }}
                  >
                    {school.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                  {school.code}
                  {school.address?.county ? ` · ${school.address.county} County` : ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/schools/${id}/edit`)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "10px 20px",
                backgroundColor: "#ffffff",
                color: TEAL,
                border: "none",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "700",
                fontFamily: "Inter, sans-serif",
                cursor: "pointer",
                flexShrink: 0,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Edit School
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Teachers", value: teachers.length, icon: "👩‍🏫", bg: "#F5F3FF", color: "#4C1D95", border: "#C4B5FD" },
          { label: "Classes",  value: classes.length,  icon: "🏫",   bg: "#FFF7ED", color: "#9A3412", border: "#FED7AA" },
          { label: "Learners", value: learners.length, icon: "🎒",   bg: "#FDF2F8", color: "#831843", border: "#FBCFE8" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 14,
              border: `1.5px solid ${s.border}`,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                backgroundColor: s.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {s.icon}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                {s.value}
              </p>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#9CA3AF",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 360px",
          gap: "16px",
          alignItems: "start",
        }}
      >
        {/* ── LEFT column ────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Assigned Curriculum — accordion, open by default */}
          <AccordionSection title="Assigned Curriculum" defaultOpen>
            {curriculum ? (
              <div
                onClick={() => navigate(`/curriculum/${curriculum.id}/view`)}
                style={{
                  borderRadius: "12px",
                  backgroundColor: "#F0FDF4",
                  border: "1px solid #BBF7D0",
                  cursor: "pointer",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        backgroundColor: "#D1FAE5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        flexShrink: 0,
                      }}
                    >
                      📋
                    </div>
                    <div>
                      <p
                        style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "#065F46" }}
                      >
                        {curriculum.name}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
                        {curriculum.framework} · {curriculum.academicCycleModel} · {curriculum.academicYear}
                      </p>
                    </div>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ color: "#6EE7B7", flexShrink: 0 }}
                  >
                    <path
                      d="M9 18l6-6-6-6"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                {(curriculum.structure || []).length > 0 && (
                  <div
                    style={{
                      padding: "8px 16px 12px",
                      display: "flex",
                      gap: "6px",
                      flexWrap: "wrap",
                      borderTop: "1px solid #BBF7D0",
                    }}
                  >
                    {(curriculum.structure || []).map((term, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: "11px",
                          fontWeight: "600",
                          color: "#065F46",
                          backgroundColor: "#D1FAE5",
                          border: "1px solid #6EE7B7",
                          borderRadius: "6px",
                          padding: "2px 9px",
                        }}
                      >
                        {term.termName || term.name || `Period ${i + 1}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  padding: "24px 16px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "28px" }}>📋</div>
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>
                  No curriculum assigned yet.
                </p>
                <button
                  type="button"
                  onClick={() => navigate(`/schools/${id}/edit`)}
                  style={{
                    padding: "8px 18px",
                    backgroundColor: TEAL,
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "600",
                    fontFamily: "Inter, sans-serif",
                    cursor: "pointer",
                  }}
                >
                  Assign Curriculum
                </button>
              </div>
            )}
          </AccordionSection>

          {/* Supplementary Curricula — accordion section, items collapsed by default */}
          {supList.length > 0 && (
            <AccordionSection title="Supplementary Curricula" count={supList.length} defaultOpen>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {supList.map((sup) => {
                  const meta = SUPPLEMENTARY_TYPE_META[sup.type] || {};
                  return (
                    <AccordionItem
                      key={sup.id}
                      sup={sup}
                      meta={meta}
                      navigate={navigate}
                      baseStructure={baseStructure}
                    />
                  );
                })}
              </div>
            </AccordionSection>
          )}

          {/* Teachers */}
          <Section title="Teachers" count={teachers.length}>
            {teachers.length === 0 ? (
              <EmptyList icon="👩‍🏫" text="No teachers assigned to this school yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {teachers.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => navigate(`/teachers/${t.id}/view`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      cursor: "pointer",
                      transition: "background-color 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #5B21B6, #7C3AED)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {(t.firstName?.[0] || "") + (t.lastName?.[0] || "")}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>
                          {t.firstName} {t.lastName}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>{t.employeeId}</p>
                      </div>
                    </div>
                    <Badge status={t.status} map={STATUS_TEACHER} labelMap={STATUS_TEACHER_LABEL} />
                  </div>
                ))}
                {teachers.length >= 5 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/teachers?schoolId=${id}`)}
                    style={{
                      padding: "8px",
                      background: "none",
                      border: "none",
                      color: TEAL,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "Inter, sans-serif",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    View all in Teachers →
                  </button>
                )}
              </div>
            )}
          </Section>

          {/* Classes */}
          <Section title="Classes" count={classes.length}>
            {classes.length === 0 ? (
              <EmptyList icon="🏫" text="No classes created for this school yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {classes.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/classes/${c.id}/view`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      cursor: "pointer",
                      transition: "background-color 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>
                        {c.gradeName}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>
                        Academic Year {c.academicYear}
                        {c.capacity ? ` · Capacity ${c.capacity}` : ""}
                      </p>
                    </div>
                    <Badge status={c.status} map={STATUS_CLASS} />
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Learners */}
          <Section title="Learners" count={learners.length}>
            {learners.length === 0 ? (
              <EmptyList icon="🎒" text="No learners enrolled in this school yet." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {learners.slice(0, 8).map((l) => (
                  <div
                    key={l.id}
                    onClick={() => navigate(`/learners/${l.id}/view`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #E5E7EB",
                      cursor: "pointer",
                      transition: "background-color 0.12s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F9FAFB")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #831843, #BE185D)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {(l.firstName?.[0] || "") + (l.lastName?.[0] || "")}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>
                          {l.firstName} {l.lastName}
                        </p>
                        <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>
                          {l.admissionNumber}
                        </p>
                      </div>
                    </div>
                    <Badge status={l.status} map={STATUS_LEARNER} labelMap={STATUS_LEARNER_LABEL} />
                  </div>
                ))}
                {learners.length > 8 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/learners?schoolId=${id}`)}
                    style={{
                      padding: "8px",
                      background: "none",
                      border: "none",
                      color: TEAL,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "Inter, sans-serif",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    View all {learners.length} learners →
                  </button>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* ── RIGHT column ───────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Section title="School Details">
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <DetailRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                }
                label="Email"
                value={school.email}
              />
              <DetailRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                }
                label="Phone"
                value={school.phone}
              />
              {address && (
                <DetailRow
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  }
                  label="Address"
                  value={address}
                />
              )}
              {!school.email && !school.phone && !address && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "#9CA3AF",
                    textAlign: "center",
                    padding: "12px 0",
                  }}
                >
                  No contact details yet.{" "}
                  <button
                    type="button"
                    onClick={() => navigate(`/schools/${id}/edit`)}
                    style={{
                      background: "none",
                      border: "none",
                      color: TEAL,
                      fontWeight: "600",
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                      fontSize: "13px",
                      padding: 0,
                    }}
                  >
                    Add them →
                  </button>
                </p>
              )}
            </div>
          </Section>

          <Section title="Record Info">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <DetailRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                    <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/>
                    <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/>
                    <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                }
                label="Created"
                value={new Date(school.createdAt).toLocaleDateString("en-KE", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
              <DetailRow
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                }
                label="Last Updated"
                value={new Date(school.updatedAt).toLocaleDateString("en-KE", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
