import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarMonth as CalendarMonthIcon, Clear as ClearIcon, MenuBook as MenuBookIcon, School as SchoolIcon, WarningAmber as WarningAmberIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useCurriculaQuery, useDeleteCurriculum } from "../hooks/useCurriculum";
import { useDispatch, useSelector } from "react-redux";
import ConfirmDialog from "../components/ConfirmDialog";
import { setFilter, clearFilters } from "../../../store/curriculumSlice";
import { FRAMEWORKS } from "../schemas/curriculum.schema";

const CYCLE_LABELS = { terms: "Terms", semesters: "Semesters", custom: "Custom" };

const STATUS_COLORS = {
  active:    { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", dot: "#38aae1", label: "Active"    },
  published: { bg: "#fff8e6", color: "#b07800", border: "#fcd97a", dot: "#feb139", label: "Published" },
  draft:     { bg: "#FFFBEB", color: "#92400E", border: "#FCD34D", dot: "#F59E0B", label: "Draft"     },
  inactive:  { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", dot: "#9CA3AF", label: "Inactive"  },
};

/* ── MenuButton ───────────────────────────────────────────────────────── */

function MenuButton({ icon, label, onClick, danger = false }) {
  const [pressed, setPressed] = useState(false);
  const normalColor  = danger ? "#DC2626" : "#374151";
  const hoverBg      = danger ? "#FEF2F2" : "#e8f5fb";
  const hoverColor   = danger ? "#DC2626" : "#25476a";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        width: "100%",
        padding: "10px 12px",
        backgroundColor: pressed ? (danger ? "#FEE2E2" : "#d6edf8") : "transparent",
        border: "none",
        borderRadius: "8px",
        fontSize: "13.5px",
        fontWeight: "500",
        fontFamily: "Inter, sans-serif",
        color: normalColor,
        cursor: "pointer",
        textAlign: "left",
        transition: "background-color 0.1s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.color = hoverColor; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = normalColor; setPressed(false); }}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, color: danger ? "#DC2626" : "#6B7280" }}>
        {icon}
      </span>
      {label}
    </button>
  );
}

/* ── Curriculum card ──────────────────────────────────────────────────── */

function KebabMenu({ curriculum, navigate, onDelete }) {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [triggerHovered, setTriggerHovered] = useState(false);
  const [menuPos, setMenuPos]     = useState({ top: 0, right: 0 });
  const triggerRef  = useRef(null);
  const dropdownRef = useRef(null);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
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

  const go = (path) => { setMenuOpen(false); navigate(path); };

  const triggerBg    = menuOpen ? "#d6edf8" : triggerHovered ? "#F3F4F6" : "transparent";
  const triggerColor = menuOpen ? "#38aae1" : triggerHovered ? "#374151" : "#9CA3AF";
  const triggerBorder = menuOpen ? "1.5px solid #a8d5ee" : "1.5px solid transparent";

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
        onMouseEnter={() => setTriggerHovered(true)}
        onMouseLeave={() => setTriggerHovered(false)}
        title="More options"
        style={{
          width: "34px", height: "34px",
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: triggerBg,
          border: triggerBorder,
          borderRadius: "10px", cursor: "pointer",
          color: triggerColor,
          transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {menuOpen && createPortal(
        <>
          <style>{`
            @keyframes kebab-in {
              from { opacity: 0; transform: scale(0.96) translateY(-6px); }
              to   { opacity: 1; transform: scale(1)    translateY(0);    }
            }
            .kebab-dropdown { animation: kebab-in 0.15s cubic-bezier(0.16,1,0.3,1) both; }
          `}</style>
          <div
            ref={dropdownRef}
            className="kebab-dropdown"
            style={{
              position: "fixed", top: menuPos.top, right: menuPos.right,
              backgroundColor: "#fff",
              border: "1px solid #E5E7EB",
              borderRadius: "14px",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.07), 0 12px 32px -4px rgba(0,0,0,0.12)",
              zIndex: 9999, minWidth: "210px", padding: "6px",
              transformOrigin: "top right",
            }}
          >
            <div style={{ padding: "10px 12px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: "4px" }}>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{curriculum.name}</p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9CA3AF", fontWeight: "500" }}>{curriculum.code}</p>
            </div>
            {[
              { label: "View",            path: `/curriculum/${curriculum.id}/view`,           icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
              { label: "Edit Details",    path: `/curriculum/${curriculum.id}/edit`,            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
              { label: "Structure",       path: `/curriculum/${curriculum.id}/structure`,       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/></svg> },
              { label: "Competencies",   path: `/curriculum/${curriculum.id}/competencies`,   icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg> },
              { label: "Version Control", path: `/curriculum/${curriculum.id}/versions`,        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
            ].map(({ label, path, icon }) => (
              <MenuButton key={label} icon={icon} label={label} onClick={() => go(path)} />
            ))}
            <div style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "6px 0" }} />
            <MenuButton
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              label="Delete" onClick={onDelete} danger
            />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function CurriculumCard({ curriculum }) {
  const navigate = useNavigate();
  const { mutate: deleteCurriculum, isPending: isDeleting } = useDeleteCurriculum();
  const [hovered, setHovered]     = useState(false);
  const [confirmOpen, setConfirm] = useState(false);

  const periodCount  = curriculum.periods?.length  || 0;
  const classCount   = curriculum.classes?.length   || 0;
  const rawStatus    = curriculum.effectiveStatus || curriculum.status || "draft";
  const sc           = STATUS_COLORS[rawStatus] || STATUS_COLORS.draft;
  const cycle        = CYCLE_LABELS[curriculum.academicCycleModel] || curriculum.academicCycleModel || "—";
  const academicYear = curriculum.publishedAcademicYear || null;

  /* Setup completion: curriculumType(25) + periods(25) + classes(25) + academicYear(25) */
  const pct = (curriculum.curriculumType ? 25 : 0)
            + (periodCount > 0 ? 25 : 0)
            + (classCount  > 0 ? 25 : 0)
            + (academicYear    ? 25 : 0);

  const missingItems = [
    !curriculum.curriculumType && "type",
    periodCount === 0          && "periods",
    classCount  === 0          && "classes",
    !academicYear              && "academic year",
  ].filter(Boolean);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#ffffff", borderRadius: "16px",
        boxShadow: hovered
          ? "0 8px 24px rgba(37,71,106,0.12), 0 2px 6px rgba(0,0,0,0.05)"
          : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s, opacity 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        opacity: isDeleting ? 0.5 : 1,
        pointerEvents: isDeleting ? "none" : "auto",
      }}
    >
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>

        {/* ── Row 1: name | type badge + kebab ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
          <h3
            onClick={() => navigate(`/curriculum/${curriculum.id}/view`)}
            style={{
              margin: 0, fontSize: "14px", fontWeight: "700", lineHeight: "1.3",
              color: hovered ? "#25476a" : "#111827",
              cursor: "pointer", transition: "color 0.15s",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
              flex: 1, minWidth: 0,
            }}
          >
            {curriculum.name}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            {curriculum.curriculumType && (
              <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", backgroundColor: "#fff8e6", color: "#b07800", border: "1px solid #fcd97a", whiteSpace: "nowrap" }}>
                {curriculum.curriculumType}
              </span>
            )}
            <KebabMenu curriculum={curriculum} navigate={navigate} onDelete={() => setConfirm(true)} />
          </div>
        </div>

        {/* ── Row 2: code ── */}
        <span style={{ fontSize: "11px", color: "#9CA3AF", fontWeight: "600" }}>{curriculum.code}</span>

        {/* ── Description (1 line) ── */}
        {curriculum.description && (
          <p style={{ margin: 0, fontSize: "12px", color: "#6B7280", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {curriculum.description}
          </p>
        )}

        {/* ── Stats grid ── */}
        <div style={{ display: "flex", borderTop: "1px solid #F3F4F6", paddingTop: "10px", gap: "0" }}>
          {[
            { label: cycle,       value: periodCount, sub: "periods"  },
            { label: "Classes",   value: classCount,  sub: null       },
            ...(academicYear ? [{ label: "Year", value: academicYear, sub: null, isText: true }] : []),
          ].map((stat, i, arr) => (
            <div key={i} style={{ flex: stat.isText ? "1.4" : "1", textAlign: "center", borderRight: i < arr.length - 1 ? "1px solid #F3F4F6" : "none", padding: "0 6px" }}>
              {stat.isText ? (
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#25476a", lineHeight: 1.2, marginBottom: "2px" }}>{stat.value}</div>
              ) : (
                <div style={{ fontSize: "20px", fontWeight: "800", color: "#25476a", lineHeight: 1, marginBottom: "2px" }}>{stat.value}</div>
              )}
              <div style={{ fontSize: "9px", fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── Footer: completion bar + status badge ── */}
        <div style={{ paddingTop: "10px", borderTop: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "10px", color: "#9CA3AF" }}>
              {pct === 100
                ? "Setup complete"
                : missingItems.length
                  ? `Missing: ${missingItems.join(", ")}`
                  : "Setup in progress"}
            </span>
            <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "10px", fontWeight: "700", letterSpacing: "0.04em", backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
              {sc.label}
            </span>
          </div>
          <div style={{ height: "4px", backgroundColor: "#F0F4F8", borderRadius: "10px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${pct}%`,
              background: pct === 100 ? "linear-gradient(90deg, #feb139, #f59e0b)" : "linear-gradient(90deg, #25476a, #38aae1)",
              borderRadius: "10px", transition: "width 0.5s ease",
              minWidth: pct > 0 ? "8px" : "0",
            }} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Curriculum"
        message={`"${curriculum.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { setConfirm(false); deleteCurriculum(curriculum.id); }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}

/* ── Empty state ──────────────────────────────────────────────────────── */

function EmptyState({ hasFilters, onClearFilters, onCreateNew }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "64px 24px",
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, #e8f5fb, #d6edf8)",
          border: "2px solid #a8d5ee",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          margin: "0 auto 20px",
        }}
      >
        <MenuBookIcon fontSize="large" />
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
        {hasFilters ? "No results found" : "No curricula yet"}
      </h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>
        {hasFilters
          ? "Try adjusting your filters to see more results."
          : "Create your first curriculum to get started."}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          style={{
            padding: "10px 24px",
            backgroundColor: "transparent",
            color: "#25476a",
            border: "1.5px solid #25476a",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
          }}
        >
          Clear Filters
        </button>
      ) : (
        <button
          type="button"
          onClick={onCreateNew}
          style={{
            padding: "10px 24px",
            backgroundColor: "#feb139",
            color: "#25476a",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(254,177,57,0.35)",
          }}
        >
          + Create Curriculum
        </button>
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function CurriculumPage() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const filters   = useSelector((state) => state.curriculum.filters);
  const { data, isLoading, isError, error } = useCurriculaQuery();

  const curricula  = data?.data || [];
  const hasFilters = !!filters.framework || !!filters.academicYear;

  /* Aggregate stats */
  const totalClasses = curricula.reduce((s, c) => s + (c.classes?.length || 0), 0);
  const totalPeriods = curricula.reduce((s, c) => s + (c.periods?.length || 0), 0);
  const typesUsed    = new Set(curricula.map((c) => c.curriculumType).filter(Boolean)).size;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Hero strip ──────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A3880 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)",
          borderRadius: "20px",
          padding: "28px 32px",
          marginBottom: "16px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: "-40px", right: "-40px",  width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "120px", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "16px", right: "240px",   width: "50px",  height: "50px",  borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1
              style={{
                margin: "0 0 6px 0",
                fontSize: "24px",
                fontWeight: "900",
                color: "#ffffff",
                letterSpacing: "-0.4px",
                lineHeight: 1.2,
              }}
            >
              Curriculum
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "480px" }}>
              Manage your school's academic frameworks, terms, classes, and course assignments all in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/curriculum/create")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "11px 22px",
              backgroundColor: "#feb139",
              color: "#25476a",
              border: "none",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "700",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(254,177,57,0.35)",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Create Curriculum
          </button>
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        {[
          { label: "Total Curricula",  value: isLoading ? "—" : curricula.length, icon: <MenuBookIcon />, bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
          { label: "Total Classes",   value: isLoading ? "—" : totalClasses,     icon: <SchoolIcon />, bg: "#d6edf8", color: "#2e7db5", border: "#b8d9ee" },
          { label: "Total Periods",   value: isLoading ? "—" : totalPeriods,     icon: <CalendarMonthIcon />, bg: "#E0F2FE", color: "#38aae1", border: "#a8d5ee" },
          { label: "Types in Use",      value: isLoading ? "—" : typesUsed,       icon: <MenuBookIcon />, bg: "#F0F7FF", color: "#25476a", border: "#C7D9F8" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              border: `1.5px solid ${stat.border}`,
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "11px",
                backgroundColor: stat.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                flexShrink: 0,
              }}
            >
              {stat.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </p>
              <p style={{ margin: "3px 0 0 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          padding: "12px 16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <select
          value={filters.framework}
          onChange={(e) => dispatch(setFilter({ framework: e.target.value }))}
          style={{
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
          }}
        >
          <option value="">All Frameworks</option>
          {FRAMEWORKS.map((fw) => (
            <option key={fw} value={fw}>{fw}</option>
          ))}
        </select>

        <input
          type="text"
          value={filters.academicYear}
          onChange={(e) => dispatch(setFilter({ academicYear: e.target.value }))}
          placeholder="Filter by year..."
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            fontSize: "13px",
            fontFamily: "Inter, sans-serif",
            backgroundColor: "#F9FAFB",
            color: "#374151",
            outline: "none",
            width: "160px",
          }}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => dispatch(clearFilters())}
            style={{
              padding: "7px 14px",
              backgroundColor: "transparent",
              color: "#6B7280",
              border: "1px solid #E5E7EB",
              borderRadius: "8px",
              fontSize: "13px",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
            }}
          >
            <><ClearIcon fontSize="small" /> Clear</>
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: "13px", color: "#9CA3AF" }}>
          {isLoading ? "Loading..." : `${curricula.length} result${curricula.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isLoading ? (
        /* Loading skeleton */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "16px",
          }}
        >
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ height: "3px", background: "linear-gradient(90deg, #E8EFF8, #EEF4FC)" }} />
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: "16px", width: "60%", backgroundColor: "#EEF2F7", borderRadius: "6px", marginBottom: "8px" }} />
                    <div style={{ height: "12px", width: "40%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                  </div>
                  <div style={{ height: "22px", width: "56px", backgroundColor: "#EEF2F7", borderRadius: "20px" }} />
                </div>
                <div style={{ height: "12px", width: "80%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                <div style={{ height: "12px", width: "65%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
                <div style={{ paddingTop: "10px", borderTop: "1px solid #F3F4F6" }}>
                  <div style={{ height: "5px", backgroundColor: "#EEF2F7", borderRadius: "10px" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div
          style={{
            padding: "20px 24px",
            backgroundColor: "#FFF5F5",
            border: "1px solid #FECACA",
            borderRadius: "12px",
            color: "#EF4444",
            fontSize: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <WarningAmberIcon fontSize="small" />
            Failed to load curricula: {error?.message}
          </div>
        </div>
      ) : curricula.length === 0 ? (
        <EmptyState
          hasFilters={hasFilters}
          onClearFilters={() => dispatch(clearFilters())}
          onCreateNew={() => navigate("/curriculum/create")}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "16px",
          }}
        >
          {curricula.map((curriculum) => (
            <CurriculumCard key={curriculum.id} curriculum={curriculum} />
          ))}
        </div>
      )}
    </div>
  );
}
