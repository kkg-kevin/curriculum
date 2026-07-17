import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useSchoolsQuery, useDeleteSchool } from "../hooks/useSchool";
import { useCurriculaQuery } from "../../curriculum/hooks/useCurriculum";
import { setSchoolFilter, clearSchoolFilters } from "../../../store/schoolsSlice";
import { KENYA_COUNTIES } from "../schemas/school.schema";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

/* ── School icon placeholder ──────────────────────────────────────────── */

function SchoolIcon({ size = 44 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.27,
        background: "linear-gradient(135deg, #1a3550, #25476a)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: size * 0.46,
        boxShadow: "0 2px 8px rgba(37,71,106,0.25)",
      }}
    >
      🏫
    </div>
  );
}

/* ── Status badge ─────────────────────────────────────────────────────── */

const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span
      style={{
        padding: "2px 9px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: "700",
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        textTransform: "capitalize",
        letterSpacing: "0.02em",
      }}
    >
      {status}
    </span>
  );
}

/* ── Kebab menu button ────────────────────────────────────────────────── */

function MenuButton({ icon, label, onClick, danger = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        width: "100%",
        padding: "8px 10px",
        backgroundColor: hovered ? (danger ? "#FFF5F5" : "#F3F4F6") : "transparent",
        border: "none",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: "500",
        fontFamily: "Inter, sans-serif",
        color: hovered ? (danger ? "#EF4444" : "#25476a") : (danger ? "#EF4444" : "#374151"),
        cursor: "pointer",
        textAlign: "left",
        transition: "background-color 0.12s, color 0.12s",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: 0.8 }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

/* ── School card ──────────────────────────────────────────────────────── */

function SchoolCard({ school, curriculaMap }) {
  const navigate = useNavigate();
  const { mutate: deleteSchool, isPending: isDeleting } = useDeleteSchool();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const curriculum = school.curriculumId ? curriculaMap[school.curriculumId] : null;
  const isActive = school.status === "active";

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
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
          ? "0 8px 24px rgba(37,71,106,0.12), 0 2px 6px rgba(0,0,0,0.05)"
          : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s, opacity 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        opacity: isDeleting ? 0.5 : 1,
        pointerEvents: isDeleting ? "none" : "auto",
      }}
    >
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <SchoolIcon size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
              <h3
                onClick={() => navigate(`/schools/${school.id}/view`)}
                style={{
                  margin: "0 0 3px 0",
                  fontSize: "15px",
                  fontWeight: "700",
                  color: hovered ? "#25476a" : "#111827",
                  cursor: "pointer",
                  transition: "color 0.15s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {school.name}
              </h3>
              {/* Kebab */}
              <button
                ref={triggerRef}
                type="button"
                onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
                title="More options"
                style={{
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: menuOpen ? "#e8f5fb" : "transparent",
                  border: `1.5px solid ${menuOpen ? "#b8d9ee" : "transparent"}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: menuOpen ? "#25476a" : "#9CA3AF",
                  transition: "all 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { if (!menuOpen) { e.currentTarget.style.backgroundColor = "#F3F4F6"; e.currentTarget.style.color = "#374151"; } }}
                onMouseLeave={(e) => { if (!menuOpen) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#9CA3AF"; } }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: "500" }}>{school.code}</span>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <StatusBadge status={school.status} />
            </div>
          </div>
        </div>

        {/* Location */}
        <div>
          <p style={{ margin: "0 0 5px", fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Location</p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: "#a8d5ee", flexShrink: 0 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span style={{ fontSize: "13px", color: "#374151" }}>
              {[school.address?.city, school.address?.county].filter(Boolean).join(", ") || "No address"}
            </span>
          </div>
        </div>

        {/* Curriculum */}
        <div>
          <p style={{ margin: "0 0 6px", fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Curriculum</p>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "10px",
              backgroundColor: curriculum ? "#e8f5fb" : "#F9FAFB",
              border: `1px solid ${curriculum ? "#a8d5ee" : "#E5E7EB"}`,
            }}
          >
            {curriculum ? (
              <div>
                <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#25476a" }}>
                  {curriculum.name}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#6B7280" }}>
                  {[curriculum.framework, curriculum.academicYear].filter(Boolean).join(" · ")}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "13px", color: "#9CA3AF" }}>No curriculum assigned</span>
                <button
                  type="button"
                  onClick={() => navigate(`/schools/${school.id}/edit`)}
                  style={{ background: "none", border: "none", fontSize: "11px", color: "#feb139", fontWeight: "700", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}
                >
                  Assign →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 20px", borderTop: "1px solid #F3F4F6", backgroundColor: "#FAFBFF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => navigate(`/schools/${school.id}/view`)}
          style={{ background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#38aae1", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}
        >
          View Details
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
            {isActive ? "Active" : "Inactive"}
          </span>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: isActive ? "#feb139" : "#D1D5DB", display: "inline-block" }} />
        </div>
      </div>

      {/* Portal dropdown */}
      {menuOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            right: menuPos.right,
            backgroundColor: "#ffffff",
            border: "1px solid #E5E7EB",
            borderRadius: "14px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            zIndex: 9999,
            minWidth: "192px",
            overflow: "hidden",
            padding: "6px",
          }}
        >
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: "4px" }}>
            <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{school.name}</p>
            <p style={{ margin: "1px 0 0", fontSize: "11px", color: "#9CA3AF" }}>{school.code}</p>
          </div>
          {[
            { label: "View", path: `/schools/${school.id}/view`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
            { label: "Edit", path: `/schools/${school.id}/edit`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          ].map(({ label, path, icon }) => (
            <MenuButton key={path} icon={icon} label={label} onClick={() => { setMenuOpen(false); navigate(path); }} />
          ))}
          <div style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "4px 0" }} />
          <MenuButton
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            label="Delete"
            onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
            danger
          />
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete School"
        message={`"${school.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteSchool(school.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onClearFilters, onCreateNew }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", margin: "0 auto 20px" }}>
        🏫
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
        {hasFilters ? "No results found" : "No schools yet"}
      </h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>
        {hasFilters ? "Try adjusting your filters." : "Add your first school to get started."}
      </p>
      {hasFilters ? (
        <button type="button" onClick={onClearFilters} style={{ padding: "10px 24px", backgroundColor: "transparent", color: "#25476a", border: "1.5px solid #25476a", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          Clear Filters
        </button>
      ) : (
        <button type="button" onClick={onCreateNew} style={{ padding: "10px 24px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 4px 12px rgba(254,177,57,0.35)" }}>
          + Add School
        </button>
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function SchoolsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const filters = useSelector((state) => state.schools.filters);

  const { data, isLoading, isError, error } = useSchoolsQuery();
  const { data: curriculaData } = useCurriculaQuery();

  const schools = data?.data || [];
  const curriculaMap = (curriculaData?.data || []).reduce((m, c) => { m[c.id] = c; return m; }, {});

  const hasFilters = !!filters.status || !!filters.county;
  const activeCount = schools.filter((s) => s.status === "active").length;
  const withCurriculum = schools.filter((s) => s.curriculumId).length;

  const selectStyle = {
    padding: "8px 32px 8px 12px",
    borderRadius: "8px",
    border: "1px solid #E5E7EB",
    fontSize: "13px",
    fontFamily: "Inter, sans-serif",
    backgroundColor: "#F9FAFB",
    color: "#374151",
    outline: "none",
    cursor: "pointer",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 10px center",
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* Hero strip */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "16px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Schools
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "480px" }}>
              Manage schools and their assigned curricula. Each school can be linked to learners and teachers.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => navigate("/locations/create")}
              title="Location Types — coming soon"
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}
            >
              <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
              Add Location
            </button>
            <button
              type="button"
              onClick={() => navigate("/schools/create")}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
            >
              <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
              Add School
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "16px" }}>
        {[
          { label: "Total Schools",      value: isLoading ? "—" : schools.length,     icon: "🏫", bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
          { label: "Active",             value: isLoading ? "—" : activeCount,         icon: "✅", bg: "#dff2fb", color: "#38aae1", border: "#a8d5ee" },
          { label: "Inactive",           value: isLoading ? "—" : schools.length - activeCount, icon: "⏸️", bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
          { label: "With Curriculum",    value: isLoading ? "—" : withCurriculum,      icon: "📋", bg: "#fff8e6", color: "#feb139", border: "#fcd97a" },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: "#ffffff", borderRadius: "14px", border: `1.5px solid ${stat.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "11px", backgroundColor: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ margin: "3px 0 0 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
        <select value={filters.status} onChange={(e) => dispatch(setSchoolFilter({ status: e.target.value }))} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={filters.county} onChange={(e) => dispatch(setSchoolFilter({ county: e.target.value }))} style={selectStyle}>
          <option value="">All Counties</option>
          {KENYA_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasFilters && (
          <button type="button" onClick={() => dispatch(clearSchoolFilters())} style={{ padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: "8px", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: "13px", color: "#9CA3AF" }}>
          {isLoading ? "Loading..." : `${schools.length} result${schools.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "#e8f5fb" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ height: "15px", width: "55%", backgroundColor: "#EEF2F7", borderRadius: "5px" }} />
                    <div style={{ height: "11px", width: "35%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                  </div>
                </div>
                <div style={{ height: "12px", width: "45%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                <div style={{ height: "60px", backgroundColor: "#F9FAFB", borderRadius: "10px" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
          ⚠ Failed to load schools: {error?.message}
        </div>
      ) : schools.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          onClearFilters={() => dispatch(clearSchoolFilters())}
          onCreateNew={() => navigate("/schools/create")}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {schools.map((school) => (
            <SchoolCard key={school.id} school={school} curriculaMap={curriculaMap} />
          ))}
        </div>
      )}
    </div>
  );
}
