import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useCurriculaQuery, useDeleteCurriculum } from "../hooks/useCurriculum";
import { useDispatch, useSelector } from "react-redux";
import ConfirmDialog from "../components/ConfirmDialog";
import { setFilter, clearFilters } from "../../../store/curriculumSlice";
import { FRAMEWORKS } from "../schemas/curriculum.schema";

const FRAMEWORK_BADGE_COLORS = {
  CBC:       { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  IGCSE:     { bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
  IB:        { bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE" },
  National:  { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
  Cambridge: { bg: "#DBEAFE", color: "#1E3A8A", border: "#93C5FD" },
  Custom:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

const CYCLE_LABELS = { terms: "Terms", semesters: "Semesters", custom: "Custom" };

const STATUS_COLORS = {
  active: { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  draft:  { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

function FrameworkBadge({ framework }) {
  const colors = FRAMEWORK_BADGE_COLORS[framework] || FRAMEWORK_BADGE_COLORS.Custom;
  return (
    <span
      style={{
        padding: "2px 9px",
        borderRadius: "20px",
        fontSize: "11px",
        fontWeight: "600",
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {framework}
    </span>
  );
}

/* ── MenuButton ───────────────────────────────────────────────────────── */

function MenuButton({ icon, label, onClick, danger = false }) {
  const [hovered, setHovered] = useState(false);
  const base = danger ? "#EF4444" : "#374151";
  const hoverBg = danger ? "#FFF5F5" : "#F3F4F6";
  const hoverColor = danger ? "#EF4444" : "#0D47A1";

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
        backgroundColor: hovered ? hoverBg : "transparent",
        border: "none",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: "500",
        fontFamily: "Inter, sans-serif",
        color: hovered ? hoverColor : base,
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

/* ── Curriculum card ──────────────────────────────────────────────────── */

function CurriculumCard({ curriculum }) {
  const navigate = useNavigate();
  const { mutate: deleteCurriculum, isPending: isDeleting } = useDeleteCurriculum();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const handleDelete = () => {
    setMenuOpen(false);
    setConfirmOpen(true);
  };

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  };

  // Close on outside click — must check both trigger and portal dropdown
  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [menuOpen]);

  // Close on scroll or resize so the position never drifts
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuOpen]);

  const periodCount   = curriculum.periods?.length || 0;
  const classCount    = curriculum.classes?.length || 0;
  const rawStatus     = curriculum.status || "draft";
  const statusLabel   = rawStatus === "active" ? "Active" : "Draft";
  const sc            = STATUS_COLORS[rawStatus] || STATUS_COLORS.draft;
  const completionPct = (periodCount > 0 ? 50 : 0) + (classCount > 0 ? 50 : 0);
  const hasClasses    = classCount > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "16px",
        boxShadow: hovered
          ? "0 8px 24px rgba(13,71,161,0.12), 0 2px 6px rgba(0,0,0,0.05)"
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
      {/* Gradient top accent — thicker on hover */}
      <div
        style={{
          height: hovered ? "4px" : "3px",
          background: "linear-gradient(90deg, #0D47A1, #1976D2, #42A5F5)",
          transition: "height 0.2s",
        }}
      />

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
        {/* Top row: name + kebab */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3
              onClick={() => navigate(`/curriculum/${curriculum.id}/view`)}
              style={{
                margin: "0 0 4px 0",
                fontSize: "15px",
                fontWeight: "700",
                color: hovered ? "#0D47A1" : "#111827",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
            >
              {curriculum.name}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "#6B7280", fontWeight: "500" }}>
                {curriculum.code}
              </span>
            </div>
          </div>

          {/* Framework badge + type badge + kebab */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {curriculum.framework && <FrameworkBadge framework={curriculum.framework} />}
            <span style={{
              padding: "2px 9px", borderRadius: "20px",
              fontSize: "11px", fontWeight: "600",
              backgroundColor: curriculum.curriculumType ? "#F0FDF4" : "#F9FAFB",
              color: curriculum.curriculumType ? "#166534" : "#9CA3AF",
              border: `1px solid ${curriculum.curriculumType ? "#BBF7D0" : "#E5E7EB"}`,
            }}>
              {curriculum.curriculumType || "—"}
            </span>
            <div style={{ position: "relative" }}>
              {/* Trigger */}
              <button
                ref={triggerRef}
                type="button"
                onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
                title="More options"
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: menuOpen ? "#EFF6FF" : "transparent",
                  border: `1.5px solid ${menuOpen ? "#BFDBFE" : "transparent"}`,
                  borderRadius: "9px",
                  cursor: "pointer",
                  color: menuOpen ? "#0D47A1" : "#9CA3AF",
                  transition: "all 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!menuOpen) {
                    e.currentTarget.style.backgroundColor = "#F3F4F6";
                    e.currentTarget.style.color = "#374151";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!menuOpen) {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.color = "#9CA3AF";
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>

              {/* Dropdown — portaled to body so card overflow/transform can't clip it */}
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
                    minWidth: "196px",
                    overflow: "hidden",
                    padding: "6px",
                  }}
                >
                  {/* Context header */}
                  <div
                    style={{
                      padding: "8px 10px 10px",
                      borderBottom: "1px solid #F3F4F6",
                      marginBottom: "4px",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {curriculum.name}
                    </p>
                    <p style={{ margin: "1px 0 0", fontSize: "11px", color: "#9CA3AF" }}>
                      {curriculum.code}
                    </p>
                  </div>

                  {/* Group 1 — navigate */}
                  {[
                    {
                      label: "View",
                      path: `/curriculum/${curriculum.id}/view`,
                      icon: (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      ),
                    },
                    {
                      label: "Edit Details",
                      path: `/curriculum/${curriculum.id}/edit`,
                      icon: (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ),
                    },
                  ].map(({ label, path, icon }) => (
                    <MenuButton
                      key={path}
                      icon={icon}
                      label={label}
                      onClick={() => { setMenuOpen(false); navigate(path); }}
                    />
                  ))}

                  {/* Divider */}
                  <div style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "4px 0" }} />

                  {/* Group 2 — tools */}
                  {[
                    {
                      label: "Structure",
                      path: `/curriculum/${curriculum.id}/structure`,
                      icon: (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                          <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                          <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                          <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      ),
                    },
                    {
                      label: "Version Control",
                      path: `/curriculum/${curriculum.id}/versions`,
                      icon: (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ),
                    },
                  ].map(({ label, path, icon }) => (
                    <MenuButton
                      key={label}
                      icon={icon}
                      label={label}
                      onClick={() => { setMenuOpen(false); navigate(path); }}
                    />
                  ))}

                  {/* Divider */}
                  <div style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "4px 0" }} />

                  {/* Group 3 — destructive */}
                  <MenuButton
                    icon={
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                        <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    }
                    label="Delete"
                    onClick={handleDelete}
                    danger
                  />
                </div>,
              document.body)}
            </div>
          </div>
        </div>

        {/* Description */}
        {curriculum.description && (
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "#6B7280",
              lineHeight: "1.5",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {curriculum.description}
          </p>
        )}

        {/* Stats row */}
        <div style={{ display: "flex", gap: "16px", paddingTop: "10px", borderTop: "1px solid #F3F4F6" }}>
          <div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase" }}>
              Cycle
            </span>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "500", color: "#374151" }}>
              {CYCLE_LABELS[curriculum.academicCycleModel] || curriculum.academicCycleModel}
            </p>
          </div>
          <div>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase" }}>
              Periods
            </span>
            <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "500", color: "#374151" }}>
              {periodCount}
            </p>
          </div>
          {hasClasses && (
            <div>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase" }}>
                Classes
              </span>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "500", color: "#374151" }}>
                {classCount}
              </p>
            </div>
          )}
        </div>

        {/* ── Progress bar ── */}
        <div style={{ paddingTop: "10px", borderTop: "1px solid #F3F4F6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
            <span style={{ fontSize: "11px", color: "#9CA3AF" }}>
              {hasClasses
                ? `${classCount} ${classCount === 1 ? "class" : "classes"} · ${periodCount} ${periodCount === 1 ? "period" : "periods"}`
                : periodCount > 0 ? "No classes configured yet" : "No setup yet"}
            </span>
            <span
              style={{
                padding: "2px 8px",
                backgroundColor: sc.bg,
                color: sc.color,
                border: `1px solid ${sc.border}`,
                borderRadius: "20px",
                fontSize: "10px",
                fontWeight: "700",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {statusLabel}
            </span>
          </div>
          <div style={{ height: "5px", backgroundColor: "#F0F4F8", borderRadius: "10px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${completionPct}%`,
                background: completionPct === 100
                  ? "linear-gradient(90deg, #0D47A1, #42A5F5)"
                  : "linear-gradient(90deg, #1565C0, #64B5F6)",
                borderRadius: "10px",
                transition: "width 0.5s ease",
                minWidth: completionPct > 0 ? "8px" : "0",
              }}
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Curriculum"
        message={`"${curriculum.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteCurriculum(curriculum.id); }}
        onCancel={() => setConfirmOpen(false)}
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
          background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
          border: "2px solid #BFDBFE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "32px",
          margin: "0 auto 20px",
        }}
      >
        📚
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
            color: "#0D47A1",
            border: "1.5px solid #0D47A1",
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
            backgroundColor: "#0D47A1",
            color: "#ffffff",
            border: "none",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "600",
            fontFamily: "Inter, sans-serif",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(13,71,161,0.25)",
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
  const totalClasses   = curricula.reduce((s, c) => s + (c.classes?.length || 0), 0);
  const totalPeriods   = curricula.reduce((s, c) => s + (c.periods?.length || 0), 0);
  const frameworksUsed = new Set(curricula.map((c) => c.framework).filter(Boolean)).size;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Hero strip ──────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #0A3880 0%, #0D47A1 40%, #1565C0 75%, #1976D2 100%)",
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
              backgroundColor: "#ffffff",
              color: "#0D47A1",
              border: "none",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "700",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
          { label: "Total Curricula",  value: isLoading ? "—" : curricula.length, icon: "📋", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
          { label: "Total Classes",   value: isLoading ? "—" : totalClasses,     icon: "🎓", bg: "#DBEAFE", color: "#1565C0", border: "#93C5FD" },
          { label: "Total Periods",   value: isLoading ? "—" : totalPeriods,     icon: "📅", bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
          { label: "Frameworks in Use",value: isLoading ? "—" : frameworksUsed,  icon: "🏫", bg: "#F0F7FF", color: "#1E40AF", border: "#C7D9F8" },
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
            ✕ Clear
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
          ⚠ Failed to load curricula: {error?.message}
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
