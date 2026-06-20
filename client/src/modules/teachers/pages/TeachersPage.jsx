import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTeachersQuery, useDeleteTeacher } from "../hooks/useTeacher";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { setTeacherFilter, clearTeacherFilters } from "../../../store/teachersSlice";
import { TEACHER_STATUSES } from "../schemas/teacher.schema";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

/* ── Avatar ───────────────────────────────────────────────────────────── */

function Avatar({ firstName, lastName, size = 44 }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #7C3AED, #A78BFA)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: "700",
        color: "#ffffff",
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {initials || "?"}
    </div>
  );
}

/* ── Status badge ─────────────────────────────────────────────────────── */

const STATUS_STYLES = {
  active:   { bg: "#F5F3FF", color: "#5B21B6", border: "#C4B5FD" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
};
const STATUS_LABELS = { active: "Active", inactive: "Inactive", on_leave: "On Leave" };

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/* ── Menu button ──────────────────────────────────────────────────────── */

function MenuButton({ icon, label, onClick, danger = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "9px", width: "100%",
        padding: "8px 10px", border: "none", borderRadius: "8px",
        fontSize: "13px", fontWeight: "500", fontFamily: "Inter, sans-serif",
        cursor: "pointer", textAlign: "left", transition: "background-color 0.12s, color 0.12s",
        backgroundColor: hovered ? (danger ? "#FFF5F5" : "#F3F4F6") : "transparent",
        color: danger ? "#EF4444" : (hovered ? "#5B21B6" : "#374151"),
      }}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: 0.85 }}>{icon}</span>
      {label}
    </button>
  );
}

/* ── Teacher card ─────────────────────────────────────────────────────── */

function TeacherCard({ teacher, schoolsMap }) {
  const navigate  = useNavigate();
  const { mutate: deleteTeacher, isPending: isDeleting } = useDeleteTeacher();
  const [menuOpen, setMenuOpen]     = useState(false);
  const [menuPos, setMenuPos]       = useState({ top: 0, right: 0 });
  const [hovered, setHovered]       = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef  = useRef(null);
  const dropdownRef = useRef(null);

  const school   = teacher.schoolId ? schoolsMap[teacher.schoolId] : null;
  const subjects = teacher.subjects || [];
  const VISIBLE  = 3;

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [menuOpen]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: hovered
          ? "0 8px 24px rgba(124,58,237,0.10), 0 2px 6px rgba(0,0,0,0.05)"
          : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s, opacity 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        opacity: isDeleting ? 0.5 : 1,
        pointerEvents: isDeleting ? "none" : "auto",
      }}
    >
      {/* Accent */}
      <div style={{ height: hovered ? "4px" : "3px", background: "linear-gradient(90deg, #5B21B6, #7C3AED, #A78BFA)", transition: "height 0.2s" }} />

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <Avatar firstName={teacher.firstName} lastName={teacher.lastName} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
              <h3
                onClick={() => navigate(`/teachers/${teacher.id}/view`)}
                style={{ margin: "0 0 3px", fontSize: "15px", fontWeight: "700", color: hovered ? "#5B21B6" : "#111827", cursor: "pointer", transition: "color 0.15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {teacher.firstName} {teacher.lastName}
              </h3>
              {/* Kebab */}
              <button
                ref={triggerRef}
                type="button"
                onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
                style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: menuOpen ? "#F5F3FF" : "transparent", border: `1.5px solid ${menuOpen ? "#C4B5FD" : "transparent"}`, borderRadius: "8px", cursor: "pointer", color: menuOpen ? "#5B21B6" : "#9CA3AF", transition: "all 0.15s", flexShrink: 0 }}
                onMouseEnter={(e) => { if (!menuOpen) { e.currentTarget.style.backgroundColor = "#F3F4F6"; e.currentTarget.style.color = "#374151"; } }}
                onMouseLeave={(e) => { if (!menuOpen) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#9CA3AF"; } }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                </svg>
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: "500" }}>{teacher.employeeId}</span>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <StatusBadge status={teacher.status} />
            </div>
          </div>
        </div>

        {/* School */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "16px" }}>🏫</span>
          <span style={{ fontSize: "13px", color: "#6B7280" }}>
            {school ? school.name : <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>No school assigned</span>}
          </span>
        </div>

        {/* Qualification */}
        {teacher.qualification && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "16px" }}>🎓</span>
            <span style={{ fontSize: "13px", color: "#6B7280" }}>{teacher.qualification}</span>
          </div>
        )}

        {/* Subjects */}
        {subjects.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", paddingTop: "6px", borderTop: "1px solid #F3F4F6" }}>
            {subjects.slice(0, VISIBLE).map((s) => (
              <span key={s} style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", backgroundColor: "#F5F3FF", color: "#5B21B6", border: "1px solid #DDD6FE" }}>
                {s}
              </span>
            ))}
            {subjects.length > VISIBLE && (
              <span style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "600", backgroundColor: "#F3F4F6", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                +{subjects.length - VISIBLE} more
              </span>
            )}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: "12px", color: "#D1D5DB", paddingTop: "6px", borderTop: "1px solid #F3F4F6", fontStyle: "italic" }}>
            No subjects assigned
          </p>
        )}
      </div>

      {/* Dropdown portal */}
      {menuOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", boxShadow: "0 8px 28px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: "192px", overflow: "hidden", padding: "6px" }}
        >
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: "4px" }}>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#111827" }}>{teacher.firstName} {teacher.lastName}</p>
            <p style={{ margin: "1px 0 0", fontSize: "11px", color: "#9CA3AF" }}>{teacher.employeeId}</p>
          </div>
          {[
            { label: "View",  path: `/teachers/${teacher.id}/view`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
            { label: "Edit",  path: `/teachers/${teacher.id}/edit`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          ].map(({ label, path, icon }) => (
            <MenuButton key={path} icon={icon} label={label} onClick={() => { setMenuOpen(false); navigate(path); }} />
          ))}
          <div style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "4px 0" }} />
          <MenuButton
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            label="Delete" onClick={() => { setMenuOpen(false); setConfirmOpen(true); }} danger
          />
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Remove Teacher"
        message={`"${teacher.firstName} ${teacher.lastName}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteTeacher(teacher.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onClear, onCreate }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)", border: "2px solid #C4B5FD", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", margin: "0 auto 20px" }}>👩‍🏫</div>
      <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
        {hasFilters ? "No results found" : "No teachers yet"}
      </h3>
      <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>
        {hasFilters ? "Try adjusting your filters." : "Add your first teacher to get started."}
      </p>
      {hasFilters
        ? <button type="button" onClick={onClear} style={{ padding: "10px 24px", backgroundColor: "transparent", color: "#5B21B6", border: "1.5px solid #5B21B6", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Clear Filters</button>
        : <button type="button" onClick={onCreate} style={{ padding: "10px 24px", backgroundColor: "#5B21B6", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 4px 12px rgba(91,33,182,0.25)" }}>+ Add Teacher</button>
      }
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function TeachersPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const filters  = useSelector((state) => state.teachers.filters);

  const { data, isLoading, isError, error } = useTeachersQuery();
  const { data: schoolsData } = useSchoolsQuery();

  const teachers   = data?.data || [];
  const schoolsMap = (schoolsData?.data || []).reduce((m, s) => { m[s.id] = s; return m; }, {});
  const schools    = schoolsData?.data || [];

  const hasFilters   = !!filters.schoolId || !!filters.status;
  const activeCount  = teachers.filter((t) => t.status === "active").length;
  const onLeaveCount = teachers.filter((t) => t.status === "on_leave").length;

  const selectStyle = { padding: "8px 32px 8px 12px", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #2E1065 0%, #4C1D95 40%, #5B21B6 75%, #7C3AED 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "16px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>Teachers</h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "480px" }}>
              Manage teaching staff, their school assignments, and the subjects they teach.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/teachers/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#ffffff", color: "#5B21B6", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Add Teacher
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        {[
          { label: "Total Teachers", value: isLoading ? "—" : teachers.length,   icon: "👩‍🏫", bg: "#F5F3FF", color: "#4C1D95", border: "#C4B5FD" },
          { label: "Active",         value: isLoading ? "—" : activeCount,        icon: "✅",   bg: "#F0FDF4", color: "#065F46", border: "#BBF7D0" },
          { label: "On Leave",       value: isLoading ? "—" : onLeaveCount,       icon: "🏖️",  bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
          { label: "Inactive",       value: isLoading ? "—" : teachers.length - activeCount - onLeaveCount, icon: "⏸️", bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: "#ffffff", borderRadius: "14px", border: `1.5px solid ${stat.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "11px", backgroundColor: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{stat.icon}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ margin: "3px 0 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <select value={filters.schoolId} onChange={(e) => dispatch(setTeacherFilter({ schoolId: e.target.value }))} style={selectStyle}>
          <option value="">All Schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => dispatch(setTeacherFilter({ status: e.target.value }))} style={selectStyle}>
          <option value="">All Statuses</option>
          {TEACHER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {hasFilters && (
          <button type="button" onClick={() => dispatch(clearTeacherFilters())} style={{ padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: "13px", color: "#9CA3AF" }}>
          {isLoading ? "Loading…" : `${teachers.length} result${teachers.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ height: "3px", background: "linear-gradient(90deg, #EDE9FE, #F5F3FF)" }} />
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", backgroundColor: "#EDE9FE" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ height: "15px", width: "50%", backgroundColor: "#EEF2F7", borderRadius: "5px" }} />
                    <div style={{ height: "11px", width: "30%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                  </div>
                </div>
                <div style={{ height: "12px", width: "55%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                <div style={{ display: "flex", gap: "6px" }}>
                  {[1, 2, 3].map((i) => <div key={i} style={{ height: "22px", width: "70px", backgroundColor: "#F3F4F6", borderRadius: "6px" }} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
          ⚠ Failed to load teachers: {error?.message}
        </div>
      ) : teachers.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onClear={() => dispatch(clearTeacherFilters())} onCreate={() => navigate("/teachers/create")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
          {teachers.map((t) => <TeacherCard key={t.id} teacher={t} schoolsMap={schoolsMap} />)}
        </div>
      )}
    </div>
  );
}
