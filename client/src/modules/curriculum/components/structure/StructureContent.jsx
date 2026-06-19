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

/* ── Shared ─────────────────────────────────────────────────────────── */

function CoursePill({ name, onRemove }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        padding: "4px 6px 4px 10px",
        backgroundColor: "#EFF6FF",
        border: "1px solid #BFDBFE",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: "500",
        color: "#1D4ED8",
      }}
    >
      <span style={{ lineHeight: 1.3 }}>{name}</span>
      <button
        type="button"
        onClick={onRemove}
        title="Remove course"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#93C5FD",
          padding: "1px 3px",
          lineHeight: 1,
          fontSize: "15px",
          display: "flex",
          alignItems: "center",
          fontFamily: "Inter, sans-serif",
          borderRadius: "50%",
        }}
      >
        ×
      </button>
    </div>
  );
}

function InlineInput({ placeholder, onConfirm, onCancel, confirmLabel = "Add" }) {
  const [value, setValue] = useState("");

  const handleConfirm = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
    setValue("");
  };

  return (
    <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
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
          padding: "8px 12px",
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
          padding: "8px 16px",
          backgroundColor: "#0D47A1",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          fontSize: "13px",
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
          padding: "8px 12px",
          backgroundColor: "#F3F4F6",
          color: "#6B7280",
          border: "none",
          borderRadius: "8px",
          fontSize: "13px",
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

/* ── Grade row (accordion inside the term panel) ────────────────────── */

function GradeRow({ grade, isOpen, onToggle, onRemove, onAddCourse, onRemoveCourse }) {
  const [addingCourse, setAddingCourse] = useState(false);
  const courseCount = grade.courses.length;

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: "10px",
        overflow: "hidden",
        backgroundColor: "#fff",
      }}
    >
      {/* Grade header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: isOpen ? "#F0F6FF" : "#fff",
          borderBottom: isOpen ? "1px solid #E5E7EB" : "none",
          transition: "background-color 0.15s",
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            fontFamily: "Inter, sans-serif",
            minWidth: 0,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            style={{
              transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              flexShrink: 0,
              color: "#6B7280",
            }}
          >
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              backgroundColor: "#EFF6FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              flexShrink: 0,
            }}
          >
            🎓
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "#111827",
              flex: 1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {grade.name}
          </span>
          <span
            style={{
              flexShrink: 0,
              padding: "2px 8px",
              backgroundColor: courseCount > 0 ? "#DBEAFE" : "#F3F4F6",
              color: courseCount > 0 ? "#1D4ED8" : "#9CA3AF",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "600",
            }}
          >
            {courseCount} {courseCount === 1 ? "course" : "courses"}
          </span>
        </button>

        <button
          type="button"
          onClick={onRemove}
          title="Remove class"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#D1D5DB",
            fontSize: "20px",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            lineHeight: 1,
            fontFamily: "Inter, sans-serif",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {isOpen && (
        <div style={{ padding: "12px 14px", backgroundColor: "#FAFBFF" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            {grade.courses.length === 0 && !addingCourse && (
              <span style={{ fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>
                No courses yet
              </span>
            )}
            {grade.courses.map((course) => (
              <CoursePill
                key={course.id}
                name={course.name}
                onRemove={() => onRemoveCourse(course.id)}
              />
            ))}
            {!addingCourse && (
              <button
                type="button"
                onClick={() => setAddingCourse(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                  padding: "4px 9px",
                  backgroundColor: "#EFF6FF",
                  color: "#0D47A1",
                  border: "1.5px dashed #93C5FD",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "600",
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: "14px", lineHeight: 1 }}>+</span> Add Course
              </button>
            )}
          </div>
          {addingCourse && (
            <InlineInput
              placeholder="e.g. Mathematics, English, Science..."
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

/* ── Term panel (full content for one term) ─────────────────────────── */

function TermPanel({ period, termIndex, termStruct, model, expandedGrades, onToggleGrade, onExpandGrade, onUpdateTerm }) {
  const [addingGrade, setAddingGrade] = useState(false);
  const label = termLabel(period, termIndex, model);
  const grades = termStruct.grades || [];
  const totalCourses = grades.reduce((s, g) => s + (g.courses?.length || 0), 0);
  const startDate = formatDateShort(period.startDate);
  const endDate = formatDateShort(period.endDate);

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
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Term header info strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 18px",
          backgroundColor: "#F0F6FF",
          borderRadius: "12px",
          border: "1px solid #DBEAFE",
        }}
      >
        <div>
          <p style={{ margin: "0 0 2px 0", fontSize: "16px", fontWeight: "800", color: "#0D47A1" }}>
            {label}
          </p>
          {startDate && endDate ? (
            <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>
              {startDate} → {endDate}
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontStyle: "italic" }}>
              No dates set
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {grades.length > 0 && (
            <>
              <span
                style={{
                  padding: "3px 10px",
                  backgroundColor: "#EFF6FF",
                  color: "#1D4ED8",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: "600",
                  border: "1px solid #BFDBFE",
                }}
              >
                {grades.length} {grades.length === 1 ? "class" : "classes"}
              </span>
              <span
                style={{
                  padding: "3px 10px",
                  backgroundColor: "#DBEAFE",
                  color: "#1565C0",
                  borderRadius: "20px",
                  fontSize: "11px",
                  fontWeight: "600",
                  border: "1px solid #93C5FD",
                }}
              >
                {totalCourses} {totalCourses === 1 ? "course" : "courses"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Grade rows */}
      {grades.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {grades.map((grade) => (
            <GradeRow
              key={grade.id}
              grade={grade}
              isOpen={expandedGrades.has(grade.id)}
              onToggle={() => onToggleGrade(grade.id)}
              onRemove={() => handleRemoveGrade(grade.id)}
              onAddCourse={(course) => handleAddCourse(grade.id, course)}
              onRemoveCourse={(courseId) => handleRemoveCourse(grade.id, courseId)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {grades.length === 0 && !addingGrade && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            padding: "36px 20px",
            backgroundColor: "#F9FAFB",
            borderRadius: "12px",
            border: "1.5px dashed #E5E7EB",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "32px" }}>🎓</div>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#374151" }}>
            No classes yet for {label}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
            Add a class to start assigning courses.
          </p>
          <button
            type="button"
            onClick={() => setAddingGrade(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "8px 16px",
              backgroundColor: "#0D47A1",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: "600",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "15px", lineHeight: 1 }}>+</span> Add Class
          </button>
        </div>
      )}

      {/* Add class input */}
      {addingGrade && (
        <InlineInput
          placeholder="Class / Grade name — e.g. Grade 7, Form 1, Year 1..."
          onConfirm={handleAddGrade}
          onCancel={() => setAddingGrade(false)}
          confirmLabel="Add Class"
        />
      )}

      {/* Add class button when grades exist */}
      {grades.length > 0 && !addingGrade && (
        <button
          type="button"
          onClick={() => setAddingGrade(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            alignSelf: "flex-start",
            padding: "7px 14px",
            backgroundColor: "transparent",
            color: "#0D47A1",
            border: "1.5px dashed #93C5FD",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: "15px", lineHeight: 1 }}>+</span> Add Class
        </button>
      )}
    </div>
  );
}

/* ── Stepper header ─────────────────────────────────────────────────── */

function StepperHeader({ periods, structure, model, activeIndex, onSelect }) {
  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Step circles + connecting lines */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {periods.map((period, i) => {
          const isActive = i === activeIndex;
          const isConfigured = (structure[i]?.grades?.length || 0) > 0;
          const isPast = i < activeIndex;

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < periods.length - 1 ? 1 : "none" }}>
              {/* Step button */}
              <button
                type="button"
                onClick={() => onSelect(i)}
                title={termLabel(period, i, model)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  backgroundColor: isActive
                    ? "#0D47A1"
                    : isConfigured
                    ? "#1976D2"
                    : "#F3F4F6",
                  color: isActive ? "#fff" : isConfigured ? "#fff" : "#9CA3AF",
                  border: isActive
                    ? "3px solid #0D47A1"
                    : isConfigured
                    ? "2px solid #1565C0"
                    : "2px solid #E5E7EB",
                  fontSize: "13px",
                  fontWeight: "800",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isActive ? "0 0 0 4px rgba(13,71,161,0.15)" : "none",
                  transition: "all 0.2s ease",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {isConfigured && !isActive ? "✓" : i + 1}
              </button>

              {/* Connector line */}
              {i < periods.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: "3px",
                    backgroundColor: isPast && isConfigured ? "#1976D2" : "#E5E7EB",
                    margin: "0 2px",
                    borderRadius: "2px",
                    transition: "background-color 0.2s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Term name labels */}
      <div style={{ display: "flex", marginTop: "8px" }}>
        {periods.map((period, i) => {
          const isActive = i === activeIndex;
          const isLast = i === periods.length - 1;
          const label = termLabel(period, i, model);

          return (
            <div
              key={i}
              style={{
                flex: isLast ? "none" : 1,
                textAlign: i === 0 ? "left" : isLast ? "right" : "center",
                paddingRight: isLast ? 0 : "2px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: isActive ? "700" : "500",
                  color: isActive ? "#0D47A1" : "#9CA3AF",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "block",
                  maxWidth: "80px",
                  transition: "color 0.15s",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main export ─────────────────────────────────────────────────────── */

export default function StructureContent({ curriculum, structure, onUpdateTerm }) {
  const periods = curriculum?.periods || [];
  const model = curriculum?.academicCycleModel || "terms";

  const [activeTermIndex, setActiveTermIndex] = useState(0);
  const [expandedGrades, setExpandedGrades] = useState(() => new Set());

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

  const goTo = (i) => {
    setActiveTermIndex(i);
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

  const canGoPrev = activeTermIndex > 0;
  const canGoNext = activeTermIndex < periods.length - 1;
  const currentPeriod = periods[activeTermIndex];
  const currentStruct = structure[activeTermIndex] || { grades: [] };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Stepper */}
      <StepperHeader
        periods={periods}
        structure={structure}
        model={model}
        activeIndex={activeTermIndex}
        onSelect={goTo}
      />

      {/* Term content card */}
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "16px",
          border: "1.5px solid #E5E7EB",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          overflow: "hidden",
          marginBottom: "16px",
        }}
      >
        <div style={{ padding: "20px" }}>
          <TermPanel
            key={activeTermIndex}
            period={currentPeriod}
            termIndex={activeTermIndex}
            termStruct={currentStruct}
            model={model}
            expandedGrades={expandedGrades}
            onToggleGrade={toggleGrade}
            onExpandGrade={expandGrade}
            onUpdateTerm={onUpdateTerm}
          />
        </div>
      </div>

      {/* Navigation footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        {/* Prev arrow */}
        <button
          type="button"
          onClick={() => canGoPrev && goTo(activeTermIndex - 1)}
          disabled={!canGoPrev}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            backgroundColor: canGoPrev ? "#fff" : "#F9FAFB",
            color: canGoPrev ? "#0D47A1" : "#D1D5DB",
            border: `1.5px solid ${canGoPrev ? "#BFDBFE" : "#E5E7EB"}`,
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: canGoPrev ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {canGoPrev ? termLabel(periods[activeTermIndex - 1], activeTermIndex - 1, model) : "Previous"}
        </button>

        {/* Step counter */}
        <span style={{ fontSize: "12px", color: "#9CA3AF", fontWeight: "500" }}>
          {activeTermIndex + 1} / {periods.length}
        </span>

        {/* Next arrow */}
        <button
          type="button"
          onClick={() => canGoNext && goTo(activeTermIndex + 1)}
          disabled={!canGoNext}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            backgroundColor: canGoNext ? "#0D47A1" : "#F9FAFB",
            color: canGoNext ? "#fff" : "#D1D5DB",
            border: `1.5px solid ${canGoNext ? "#0D47A1" : "#E5E7EB"}`,
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: canGoNext ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          {canGoNext ? termLabel(periods[activeTermIndex + 1], activeTermIndex + 1, model) : "Next"}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
