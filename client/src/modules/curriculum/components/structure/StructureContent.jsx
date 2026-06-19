import { useState } from "react";

const genId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;

const formatDateShort = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const termLabel = (period, i, model) => {
  if (period?.name) return period.name;
  if (model === "semesters") return `Semester ${i + 1}`;
  if (model === "terms") return `Term ${i + 1}`;
  return `Period ${i + 1}`;
};

/* ── CoursePill ─────────────────────────────────────────────────────── */

const CHIP_COLORS = [
  { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0" },
  { bg: "#FFF7ED", color: "#C2410C", border: "#FED7AA" },
  { bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE" },
];

function CoursePill({ name, colorIndex = 0, onRemove }) {
  const c = CHIP_COLORS[colorIndex % CHIP_COLORS.length];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: onRemove ? "3px" : "0",
        padding: onRemove ? "3px 5px 3px 9px" : "3px 10px",
        backgroundColor: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "500",
        color: c.color,
        whiteSpace: "nowrap",
      }}
    >
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Remove"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: c.color,
            padding: "0 3px",
            lineHeight: 1,
            fontSize: "14px",
            opacity: 0.6,
            fontFamily: "Inter, sans-serif",
            display: "flex",
            alignItems: "center",
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

/* ── InlineInput ────────────────────────────────────────────────────── */

function InlineInput({ placeholder, onConfirm, onCancel, confirmLabel = "Add" }) {
  const [value, setValue] = useState("");

  const handleConfirm = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
    setValue("");
  };

  return (
    <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleConfirm();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: "7px 12px",
          border: "1.5px solid #93C5FD",
          borderRadius: "8px",
          fontSize: "13px",
          fontFamily: "Inter, sans-serif",
          outline: "none",
          backgroundColor: "#fff",
          minWidth: 0,
          color: "#111827",
        }}
      />
      <button
        type="button"
        onClick={handleConfirm}
        style={{
          padding: "7px 14px",
          backgroundColor: "#0D47A1",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          fontSize: "12px",
          fontWeight: "600",
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: "7px 12px",
          backgroundColor: "#F3F4F6",
          color: "#6B7280",
          border: "none",
          borderRadius: "8px",
          fontSize: "12px",
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Cancel
      </button>
    </div>
  );
}

/* ── ClassRow ───────────────────────────────────────────────────────── */

function ClassRow({ grade, isExpanded, onToggle, onAddCourse, onRemoveCourse }) {
  const [addingCourse, setAddingCourse] = useState(false);
  const courseCount = grade.courses.length;
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
      {/* Class header row — click to toggle */}
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
        {/* Status dot */}
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: hasCourses ? "#16A34A" : "#D1D5DB",
            flexShrink: 0,
            transition: "background-color 0.15s",
          }}
        />

        {/* Class name */}
        <span style={{ flex: 1, fontSize: "13px", fontWeight: "600", color: isExpanded ? "#0D47A1" : "#111827", transition: "color 0.15s" }}>
          {grade.name}
        </span>

        {/* Course count badge */}
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

        {/* Chevron */}
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            color: isExpanded ? "#0D47A1" : "#9CA3AF",
            flexShrink: 0,
          }}
        >
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Courses body — only visible when expanded */}
      {isExpanded && (
        <div style={{ borderTop: "1px solid #DBEAFE", padding: "12px 14px", backgroundColor: "#F8FBFF" }}>
          {/* Course chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            {courseCount === 0 && !addingCourse && (
              <span style={{ fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>
                No courses yet — add one below.
              </span>
            )}
            {grade.courses.map((c, idx) => (
              <CoursePill
                key={c.id}
                name={c.name}
                colorIndex={idx}
                onRemove={() => onRemoveCourse(c.id)}
              />
            ))}
            {!addingCourse && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setAddingCourse(true); }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "3px 9px",
                  backgroundColor: "transparent",
                  color: "#1D4ED8",
                  border: "1.5px dashed #93C5FD",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "600",
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                + Add Course
              </button>
            )}
          </div>

          {/* Add course input */}
          {addingCourse && (
            <InlineInput
              placeholder="Course name — e.g. Mathematics, English, Science..."
              onConfirm={(name) => {
                onAddCourse({ id: genId(), name });
                setAddingCourse(false);
              }}
              onCancel={() => setAddingCourse(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ── TermAccordion ──────────────────────────────────────────────────── */

function TermAccordion({
  period, termIndex, termStruct, model,
  isOpen, onToggle,
  expandedGrades, onToggleGrade, onExpandGrade,
  onUpdateTerm,
}) {
  const [addingGrade, setAddingGrade] = useState(false);
  const label = termLabel(period, termIndex, model);
  const grades = termStruct.grades || [];
  const totalCourses = grades.reduce((s, g) => s + (g.courses?.length || 0), 0);
  const startDate = formatDateShort(period.startDate);
  const endDate = formatDateShort(period.endDate);
  const isConfigured = grades.length > 0;

  const handleAddGrade = (name) => {
    const newGrade = { id: genId(), name, courses: [] };
    onUpdateTerm(termIndex, { grades: [...grades, newGrade] });
    onExpandGrade(newGrade.id);
    setAddingGrade(false);
  };

  const handleRemoveGrade = (gradeId) => {
    onUpdateTerm(termIndex, { grades: grades.filter((g) => g.id !== gradeId) });
  };

  const handleAddCourse = (gradeId, course) => {
    onUpdateTerm(termIndex, {
      grades: grades.map((g) =>
        g.id === gradeId ? { ...g, courses: [...g.courses, course] } : g
      ),
    });
  };

  const handleRemoveCourse = (gradeId, courseId) => {
    onUpdateTerm(termIndex, {
      grades: grades.map((g) =>
        g.id === gradeId
          ? { ...g, courses: g.courses.filter((c) => c.id !== courseId) }
          : g
      ),
    });
  };

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
      {/* ── Term header ── */}
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
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          style={{
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
            flexShrink: 0,
            color: isOpen ? "#0D47A1" : "#9CA3AF",
          }}
        >
          <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* Term number badge */}
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

      {/* ── Term body ── */}
      {isOpen && (
        <div style={{ borderTop: "1px solid #E5E7EB" }}>
          {/* Section heading row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px 10px",
              backgroundColor: "#FAFBFF",
              borderBottom: grades.length > 0 ? "1px solid #F0F0F0" : "none",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#374151" }}>
                Courses by Class
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                Manage courses for each class in this term.
              </p>
            </div>
            {!addingGrade && (
              <button
                type="button"
                onClick={() => setAddingGrade(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "7px 13px",
                  backgroundColor: "#0D47A1",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "600",
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                + Add Class
              </button>
            )}
          </div>

          <div style={{ padding: "12px 18px 14px", backgroundColor: "#FAFBFF", display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Add class input */}
            {addingGrade && (
              <InlineInput
                placeholder="Class / Grade name — e.g. Grade 7, Form 1, Year 1..."
                onConfirm={handleAddGrade}
                onCancel={() => setAddingGrade(false)}
                confirmLabel="Add Class"
              />
            )}

            {/* Empty state */}
            {grades.length === 0 && !addingGrade && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "8px",
                  padding: "28px 20px",
                  backgroundColor: "#fff",
                  borderRadius: "10px",
                  border: "1.5px dashed #E5E7EB",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "28px" }}>🎓</div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#374151" }}>
                  No classes for {label} yet
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  Click <strong>+ Add Class</strong> above to get started.
                </p>
              </div>
            )}

            {/* Class rows */}
            {grades.map((grade) => (
              <ClassRow
                key={grade.id}
                grade={grade}
                isExpanded={expandedGrades.has(grade.id)}
                onToggle={() => onToggleGrade(grade.id)}
                onAddCourse={(course) => handleAddCourse(grade.id, course)}
                onRemoveCourse={(courseId) => handleRemoveCourse(grade.id, courseId)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────── */

export default function StructureContent({ curriculum, structure, onUpdateTerm }) {
  const periods = curriculum?.periods || [];
  const model = curriculum?.academicCycleModel || "terms";

  const [expandedTerms, setExpandedTerms] = useState(() => new Set([0]));
  const [expandedGrades, setExpandedGrades] = useState(() => new Set());

  const toggleTerm = (i) => {
    setExpandedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleGrade = (id) => {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandGrade = (id) => {
    setExpandedGrades((prev) => new Set([...prev, id]));
  };

  if (periods.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          backgroundColor: "#F8FAFF",
          borderRadius: "16px",
          border: "2px dashed #BFDBFE",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px", color: "#9CA3AF" }}>
          No academic periods found. Set up periods in the curriculum first.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontFamily: "Inter, sans-serif" }}>
      {periods.map((period, i) => (
        <TermAccordion
          key={i}
          period={period}
          termIndex={i}
          termStruct={structure[i] || { grades: [] }}
          model={model}
          isOpen={expandedTerms.has(i)}
          onToggle={() => toggleTerm(i)}
          expandedGrades={expandedGrades}
          onToggleGrade={toggleGrade}
          onExpandGrade={expandGrade}
          onUpdateTerm={onUpdateTerm}
        />
      ))}
    </div>
  );
}
