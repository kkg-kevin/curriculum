import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiBookOpen, FiChevronRight, FiEdit2, FiEye, FiFilter, FiMoreVertical, FiSearch, FiTrash2 } from "react-icons/fi";
import { useCoursesQuery, useDeleteCourse } from "../hooks/useCourse";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

// Description is now rich-text HTML (from RichTextEditor) — strip tags for the plain-text card preview.
function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const SORT_OPTIONS = [
  { value: "recent", label: "Recently Added" },
  { value: "name-asc", label: "Name (A-Z)" },
  { value: "name-desc", label: "Name (Z-A)" },
];

function sortCourses(courses, sortBy) {
  const sorted = [...courses];
  if (sortBy === "name-asc") sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === "name-desc") sorted.sort((a, b) => b.name.localeCompare(a.name));
  else sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return sorted;
}

function MenuButton({ icon, label, onClick, danger = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "8px 10px",
        backgroundColor: hovered ? (danger ? "#FFF5F5" : "#F3F4F6") : "transparent",
        border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "500", fontFamily: "Inter, sans-serif",
        color: hovered ? (danger ? "#EF4444" : "#25476a") : (danger ? "#EF4444" : "#374151"),
        cursor: "pointer", textAlign: "left", transition: "background-color 0.12s, color 0.12s",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: 0.8 }}>{icon}</span>
      {label}
    </button>
  );
}

function CourseCard({ course }) {
  const navigate = useNavigate();
  const { mutate: deleteCourse, isPending: isDeleting } = useDeleteCourse();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  const sessionCount = course.sessionCount ?? 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/courses/${course.id}/view`)}
      style={{
        backgroundColor: "#ffffff", borderRadius: "16px", cursor: "pointer",
        boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.12), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s, opacity 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? "none" : "auto",
      }}
    >
      <div style={{ position: "relative", height: "140px", flexShrink: 0 }}>
        {course.coverImage ? (
          <img src={course.coverImage} alt={course.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1a3550, #25476a)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <FiBookOpen size={32} strokeWidth={1.8} />
          </div>
        )}
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => { e.stopPropagation(); menuOpen ? setMenuOpen(false) : openMenu(); }}
          title="More options"
          style={{ position: "absolute", top: "10px", right: "10px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.9)", border: "none", borderRadius: "8px", cursor: "pointer", color: "#25476a" }}
        >
          <FiMoreVertical size={14} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {course.name}
        </h3>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#38aae1", fontWeight: "600" }}>
          <FiBookOpen size={13} strokeWidth={2} />
          {sessionCount} lesson{sessionCount !== 1 ? "s" : ""}
        </div>

        <p style={{
          margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.6",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {stripHtml(course.description) || <span style={{ fontStyle: "italic", color: "#D1D5DB" }}>No description added</span>}
        </p>
      </div>

      {menuOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)", zIndex: 9999, minWidth: "180px", overflow: "hidden", padding: "6px" }}
        >
          {[
            { label: "View", path: `/courses/${course.id}/view`, icon: <FiEye size={14} strokeWidth={2} /> },
            { label: "Edit", path: `/courses/${course.id}/edit`, icon: <FiEdit2 size={14} strokeWidth={2} /> },
          ].map(({ label, path, icon }) => (
            <MenuButton key={path} icon={icon} label={label} onClick={(e) => { e?.stopPropagation?.(); setMenuOpen(false); navigate(path); }} />
          ))}
          <div style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "4px 0" }} />
          <MenuButton
            icon={<FiTrash2 size={14} strokeWidth={2} />}
            label="Delete"
            onClick={(e) => { e?.stopPropagation?.(); setMenuOpen(false); setConfirmOpen(true); }}
            danger
          />
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Course"
        message={`"${course.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteCourse(course.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function EmptyState({ onCreateNew }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", color: "#25476a", margin: "0 auto 20px" }}>
        <FiBookOpen size={32} strokeWidth={1.8} />
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>No courses yet</h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>Add your first course to get started.</p>
      <button type="button" onClick={onCreateNew} style={{ padding: "10px 24px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 4px 12px rgba(254,177,57,0.35)" }}>
        + Add Course
      </button>
    </div>
  );
}

const selectStyle = {
  border: "1.5px solid #E5E7EB", borderRadius: "10px", padding: "10px 14px", fontSize: "13px",
  fontFamily: "Inter, sans-serif", color: "#374151", backgroundColor: "#fff", outline: "none", cursor: "pointer",
};

export default function CoursesPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useCoursesQuery();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const courses = data?.data || [];

  const visibleCourses = useMemo(() => {
    const filtered = search.trim()
      ? courses.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
      : courses;
    return sortCourses(filtered, sortBy);
  }, [courses, search, sortBy]);

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Courses
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "480px" }}>
              Create and manage courses from scratch.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/courses/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Add Course
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", position: "relative" }}>
          <FiSearch size={15} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses..."
            style={{ ...selectStyle, width: "100%", boxSizing: "border-box", paddingLeft: "38px" }}
          />
        </div>

        <div style={{ ...selectStyle, display: "flex", alignItems: "center", gap: "8px", color: "#374151" }}>
          <FiFilter size={14} strokeWidth={2} />
          All Courses
        </div>

        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ height: "140px", backgroundColor: "#e8f5fb" }} />
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ height: "15px", width: "70%", backgroundColor: "#EEF2F7", borderRadius: "5px" }} />
                <div style={{ height: "11px", width: "35%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                <div style={{ height: "30px", backgroundColor: "#F9FAFB", borderRadius: "6px" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
          ⚠ Failed to load courses: {error?.message}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState onCreateNew={() => navigate("/courses/create")} />
      ) : visibleCourses.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "#fff", borderRadius: "16px", border: "1.5px solid #E5E7EB", color: "#9CA3AF", fontSize: "14px" }}>
          No courses match "{search}".
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
          {visibleCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </div>
  );
}
