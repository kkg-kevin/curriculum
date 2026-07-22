import { useEffect, useRef, useState } from "react";
import { useCoursesQuery } from "../hooks/useCourse";

// Picks from real, existing courses only — no free text, so a Learning Area can
// never end up "linked" to a course that doesn't exist.
function AddCourseDropdown({ available, disabled, onAdd }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

  const trimmed = query.trim();
  const filtered = trimmed
    ? available.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : available;

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px",
          backgroundColor: disabled ? "#F3F4F6" : "#e8f5fb", color: disabled ? "#9CA3AF" : "#25476a",
          border: `1.5px solid ${disabled ? "#E5E7EB" : "#a8d5ee"}`,
          borderRadius: "9px", fontSize: "12.5px", fontWeight: "700", fontFamily: "Inter, sans-serif",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        + Add Course
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
          boxShadow: "0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          width: "280px", maxHeight: "320px", overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ position: "relative", flexShrink: 0, borderBottom: "1px solid #F0F2F5" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", border: "none",
                fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", color: "#111827", background: "#fff",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "6px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "22px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", marginBottom: "4px" }}>{available.length === 0 ? "✓" : "🔍"}</div>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  {available.length === 0 ? "All courses are already added." : "No matches found."}
                </p>
              </div>
            )}
            {filtered.map((course) => (
              <button
                key={course.id}
                type="button"
                onClick={() => { onAdd(course.id); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", width: "100%", padding: "8px 10px",
                  border: "none", borderRadius: "8px", background: "transparent", fontSize: "12.5px",
                  fontWeight: "600", fontFamily: "Inter, sans-serif", color: "#374151", textAlign: "left", cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Resolves the id list against the real courses catalog for display — never
// trusts free text. `value`/`onChange` carry course ids only.
export default function CoursePickerField({ value = [], onChange, color = "#25476a" }) {
  const { data: coursesResponse, isLoading } = useCoursesQuery();
  const allCourses = coursesResponse?.data || [];
  const selected = value
    .map((id) => allCourses.find((c) => c.id === id))
    .filter(Boolean);
  // Only Active courses are offered for new picks — Draft ones aren't ready yet and Archived
  // ones are retired. Courses saved before status existed have no status field at all, which
  // counts as Active (they were already in real use). Already-selected courses stay shown via
  // `selected` above regardless of status, so a course that's since moved to Draft/Archived
  // doesn't silently vanish from a tag it already has.
  const available = allCourses.filter((c) => !value.includes(c.id) && (c.status || "active") === "active");

  const addCourse = (id) => onChange([...value, id]);
  const removeCourse = (id) => onChange(value.filter((x) => x !== id));

  return (
    <div>
      <AddCourseDropdown available={available} disabled={isLoading} onAdd={addCourse} />
      {selected.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px", marginTop: "8px" }}>
          {selected.map((course) => (
            <span
              key={course.id}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 8px 4px 12px",
                borderRadius: "20px", border: "1px solid", fontSize: "12px", fontWeight: "600", fontFamily: "Inter, sans-serif",
                backgroundColor: `${color}12`, borderColor: `${color}40`, color,
              }}
            >
              {course.name}
              <button
                type="button"
                onClick={() => removeCourse(course.id)}
                title={`Remove ${course.name}`}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: 0, color: "inherit" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#9CA3AF" }}>
          No courses added yet — use "+ Add Course" to pick from existing courses.
        </p>
      )}
    </div>
  );
}
