import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useLearnersQuery, useDeleteLearner } from "../hooks/useLearners";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/services/classApi";
import { setFilter, resetFilters } from "../../../store/learnersSlice";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT    = "#BE185D";
const GRAD_FROM = "#831843";
const GRAD_TO   = "#BE185D";

const STATUS_STYLES = {
  active:      { bg: "#FDF2F8", color: "#831843", border: "#FBCFE8" },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  transferred: { bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE" },
  graduated:   { bg: "#F0FDF4", color: "#065F46", border: "#BBF7D0" },
};
const STATUS_LABELS = { active: "Active", inactive: "Inactive", transferred: "Transferred", graduated: "Graduated" };

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function Avatar({ firstName, lastName, size = 44 }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${GRAD_FROM}, ${GRAD_TO})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, color: "#ffffff", flexShrink: 0, letterSpacing: "0.02em" }}>
      {initials || "?"}
    </div>
  );
}

function MenuButton({ icon, label, onClick, danger = false }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "8px 10px", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: "Inter, sans-serif", cursor: "pointer", textAlign: "left", transition: "background-color 0.12s", backgroundColor: hov ? (danger ? "#FFF5F5" : "#F3F4F6") : "transparent", color: danger ? "#EF4444" : (hov ? ACCENT : "#374151") }}>
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: 0.85 }}>{icon}</span>
      {label}
    </button>
  );
}

function LearnerCard({ learner, schoolsMap, classesMap }) {
  const navigate = useNavigate();
  const { mutate: deleteLearner, isPending: isDeleting } = useDeleteLearner();
  const [menuOpen, setMenuOpen]     = useState(false);
  const [menuPos, setMenuPos]       = useState({ top: 0, right: 0 });
  const [hovered, setHovered]       = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef  = useRef(null);
  const dropdownRef = useRef(null);

  const school = schoolsMap[learner.schoolId];
  const cls    = learner.classId ? classesMap[learner.classId] : null;

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
      style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: hovered ? "0 8px 24px rgba(190,24,93,0.10), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", transform: hovered ? "translateY(-2px)" : "translateY(0)", opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? "none" : "auto" }}
    >
      <div style={{ height: hovered ? 4 : 3, background: `linear-gradient(90deg, ${GRAD_FROM}, ${GRAD_TO}, #F472B6)`, transition: "height 0.2s" }} />

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <Avatar firstName={learner.firstName} lastName={learner.lastName} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <h3
                onClick={() => navigate(`/learners/${learner.id}/view`)}
                style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: hovered ? ACCENT : "#111827", cursor: "pointer", transition: "color 0.15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {learner.firstName} {learner.lastName}
              </h3>
              <button
                ref={triggerRef}
                type="button"
                onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
                style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: menuOpen ? "#FDF2F8" : "transparent", border: `1.5px solid ${menuOpen ? "#FBCFE8" : "transparent"}`, borderRadius: 8, cursor: "pointer", color: menuOpen ? ACCENT : "#9CA3AF", transition: "all 0.15s", flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>{learner.admissionNumber}</span>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <StatusBadge status={learner.status} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 5, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          {school && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
              <span>🏫</span> {school.name}
            </div>
          )}
          {cls && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
              <span>📚</span> {cls.gradeName}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <span>👤</span> {learner.guardianName}
          </div>
        </div>
      </div>

      {menuOpen && createPortal(
        <div ref={dropdownRef} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 192, overflow: "hidden", padding: 6 }}>
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: 4 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>{learner.firstName} {learner.lastName}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9CA3AF" }}>{learner.admissionNumber}</p>
          </div>
          {[
            { label: "View", path: `/learners/${learner.id}/view`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
            { label: "Edit", path: `/learners/${learner.id}/edit`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          ].map(({ label, path, icon }) => (
            <MenuButton key={path} icon={icon} label={label} onClick={() => { setMenuOpen(false); navigate(path); }} />
          ))}
          <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "4px 0" }} />
          <MenuButton
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            label="Remove" onClick={() => { setMenuOpen(false); setConfirmOpen(true); }} danger
          />
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Remove Learner"
        message={`"${learner.firstName} ${learner.lastName}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteLearner(learner.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function EmptyState({ hasFilters, onClear, onCreate }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #FDF2F8, #FCE7F3)", border: "2px solid #FBCFE8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>🎒</div>
      <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
        {hasFilters ? "No results found" : "No learners yet"}
      </h3>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
        {hasFilters ? "Try adjusting your filters." : "Enroll your first learner to get started."}
      </p>
      {hasFilters
        ? <button type="button" onClick={onClear} style={{ padding: "10px 24px", backgroundColor: "transparent", color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Clear Filters</button>
        : <button type="button" onClick={onCreate} style={{ padding: "10px 24px", backgroundColor: ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>+ Enroll Learner</button>
      }
    </div>
  );
}

export default function LearnersPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const filters  = useSelector((state) => state.learners.filters);

  const { data, isLoading, isError, error } = useLearnersQuery();
  const { data: schoolsData } = useSchoolsQuery();

  const learners   = data?.data || [];
  const schools    = schoolsData?.data || [];
  const schoolsMap = schools.reduce((m, s) => { m[s.id] = s; return m; }, {});

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", filters.schoolId],
    queryFn:  () => classApi.getAll({ schoolId: filters.schoolId || undefined }),
    enabled:  !!filters.schoolId,
  });
  const { data: allClassesData } = useQuery({
    queryKey: ["classes", "all"],
    queryFn:  () => classApi.getAll({}),
  });
  const classes    = filters.schoolId ? (classesData?.data || []) : [];
  const classesMap = (allClassesData?.data || []).reduce((m, c) => { m[c.id] = c; return m; }, {});

  const activeCount = learners.filter((l) => l.status === "active").length;
  const hasFilters  = !!filters.schoolId || !!filters.classId || !!filters.status;

  const selectStyle = { padding: "8px 32px 8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #9D174D 40%, #BE185D 75%, #DB2777 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>Learners</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>
              Manage enrolled learners, their class assignments, and guardian contacts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/learners/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 22px", backgroundColor: "#ffffff", color: ACCENT, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Enroll Learner
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {[
          { label: "Total Learners",  value: isLoading ? "—" : learners.length, icon: "🎒", bg: "#FDF2F8", color: "#831843", border: "#FBCFE8" },
          { label: "Active",          value: isLoading ? "—" : activeCount,      icon: "✅",  bg: "#F0FDF4", color: "#065F46", border: "#BBF7D0" },
          { label: "Transferred",     value: isLoading ? "—" : learners.filter((l) => l.status === "transferred").length, icon: "🔄", bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE" },
          { label: "Graduated",       value: isLoading ? "—" : learners.filter((l) => l.status === "graduated").length,   icon: "🎓", bg: "#F0FDF4", color: "#166534", border: "#BBF7D0" },
        ].map((stat) => (
          <div key={stat.label} style={{ backgroundColor: "#ffffff", borderRadius: 14, border: `1.5px solid ${stat.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{stat.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={filters.schoolId} onChange={(e) => { dispatch(setFilter({ key: "schoolId", value: e.target.value })); dispatch(setFilter({ key: "classId", value: "" })); }} style={selectStyle}>
          <option value="">All Schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.classId} onChange={(e) => dispatch(setFilter({ key: "classId", value: e.target.value }))} disabled={!filters.schoolId} style={{ ...selectStyle, opacity: !filters.schoolId ? 0.5 : 1 }}>
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.gradeName}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => dispatch(setFilter({ key: "status", value: e.target.value }))} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="transferred">Transferred</option>
          <option value="graduated">Graduated</option>
        </select>
        {hasFilters && (
          <button type="button" onClick={() => dispatch(resetFilters())} style={{ padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#9CA3AF" }}>
          {isLoading ? "Loading…" : `${learners.length} result${learners.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ height: 3, background: "linear-gradient(90deg, #FCE7F3, #FDF2F8)" }} />
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#FCE7F3" }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ height: 15, width: "50%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                    <div style={{ height: 11, width: "30%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
                  </div>
                </div>
                <div style={{ height: 12, width: "60%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 12, color: "#EF4444", fontSize: 14 }}>
          ⚠ Failed to load learners: {error?.message}
        </div>
      ) : learners.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onClear={() => dispatch(resetFilters())} onCreate={() => navigate("/learners/create")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {learners.map((l) => <LearnerCard key={l.id} learner={l} schoolsMap={schoolsMap} classesMap={classesMap} />)}
        </div>
      )}
    </div>
  );
}
