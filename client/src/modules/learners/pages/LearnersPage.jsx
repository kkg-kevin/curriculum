import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSchoolsQuery } from "../../schools/hooks/useSchool";
import { useAllLearnersQuery, useSchoolLearnersQuery, useDeleteLearner } from "../hooks/useLearners";
import { useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/services/classApi";
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

function LearnerCard({ learner, classesMap }) {
  const navigate = useNavigate();
  const { mutate: deleteLearner, isPending: isDeleting } = useDeleteLearner();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [menuPos, setMenuPos]         = useState({ top: 0, right: 0 });
  const [hovered, setHovered]         = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef  = useRef(null);
  const dropdownRef = useRef(null);

  const cls = learner.classId ? classesMap[learner.classId] : null;

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
              <button ref={triggerRef} type="button"
                onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
                style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: menuOpen ? "#FDF2F8" : "transparent", border: `1.5px solid ${menuOpen ? "#FBCFE8" : "transparent"}`, borderRadius: 8, cursor: "pointer", color: menuOpen ? ACCENT : "#9CA3AF", transition: "all 0.15s", flexShrink: 0 }}>
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
        confirmLabel="Remove" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteLearner(learner.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function SchoolCard({ school, learners, onClick }) {
  const [hov, setHov] = useState(false);
  const count       = learners.length;
  const active      = learners.filter((l) => l.status === "active").length;
  const transferred = learners.filter((l) => l.status === "transferred").length;
  const graduated   = learners.filter((l) => l.status === "graduated").length;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ cursor: "pointer", backgroundColor: "#ffffff", borderRadius: 16, border: `1.5px solid ${hov ? "#FBCFE8" : "#E5E7EB"}`, boxShadow: hov ? "0 8px 24px rgba(190,24,93,0.09), 0 2px 6px rgba(0,0,0,0.04)" : "0 1px 4px rgba(0,0,0,0.06)", transform: hov ? "translateY(-2px)" : "translateY(0)", transition: "all 0.2s", overflow: "hidden" }}
    >
      <div style={{ height: 3, background: `linear-gradient(90deg, ${GRAD_FROM}, ${GRAD_TO})` }} />
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: "#FDF2F8", border: "1px solid #FBCFE8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🏫</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: hov ? ACCENT : "#111827", transition: "color 0.15s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{school.name}</p>
            <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{school.code}{school.address?.county ? ` · ${school.address.county}` : ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{count}</span>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>learner{count !== 1 ? "s" : ""}</span>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {active > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#065F46", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "2px 7px" }}>{active} active</span>}
            {transferred > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#1E40AF", backgroundColor: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "2px 7px" }}>{transferred} transferred</span>}
            {graduated > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: "#166534", backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "2px 7px" }}>{graduated} graduated</span>}
            {count === 0 && <span style={{ fontSize: 11, color: "#D1D5DB", fontStyle: "italic" }}>No learners yet</span>}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: hov ? ACCENT : "#D1D5DB", transition: "color 0.2s", flexShrink: 0 }}>→</span>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard({ compact = false }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", height: compact ? 80 : 160 }}>
      <div style={{ height: 3, background: "linear-gradient(90deg, #FCE7F3, #FDF2F8)" }} />
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ height: 14, width: "45%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
        <div style={{ height: 12, width: "28%", backgroundColor: "#F3F4F6", borderRadius: 5 }} />
        {!compact && <div style={{ height: 28, width: "18%", backgroundColor: "#F3F4F6", borderRadius: 5, marginTop: 4 }} />}
      </div>
    </div>
  );
}

// ─── School grid ────────────────────────────────────────────────────────────

function SchoolGridView({ onSelectSchool }) {
  const navigate = useNavigate();
  const { data: schoolsData,   isLoading: schoolsLoading }  = useSchoolsQuery();
  const { data: allLearnersData, isLoading: learnersLoading } = useAllLearnersQuery();

  const schools     = schoolsData?.data || [];
  const allLearners = allLearnersData?.data || [];
  const isLoading   = schoolsLoading || learnersLoading;

  const totalLearners   = allLearners.length;
  const totalActive     = allLearners.filter((l) => l.status === "active").length;
  const totalTransferred = allLearners.filter((l) => l.status === "transferred").length;
  const totalGraduated  = allLearners.filter((l) => l.status === "graduated").length;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #9D174D 40%, ${GRAD_TO} 75%, #DB2777 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.4px" }}>Learners</h1>
            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
              Browse by school — click a school card to see its enrolled learners.
            </p>
          </div>
          <button type="button" onClick={() => navigate("/learners/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "11px 22px", backgroundColor: "#ffffff", color: ACCENT, border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Enroll Learner
          </button>
        </div>
      </div>

      {/* Global stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Learners",  value: isLoading ? "—" : totalLearners,    icon: "🎒", bg: "#FDF2F8", color: "#831843", border: "#FBCFE8" },
          { label: "Active",          value: isLoading ? "—" : totalActive,       icon: "✅",  bg: "#F0FDF4", color: "#065F46", border: "#BBF7D0" },
          { label: "Transferred",     value: isLoading ? "—" : totalTransferred,  icon: "🔄", bg: "#EFF6FF", color: "#1E40AF", border: "#BFDBFE" },
          { label: "Graduated",       value: isLoading ? "—" : totalGraduated,    icon: "🎓", bg: "#F0FDF4", color: "#166534", border: "#BBF7D0" },
        ].map((s) => (
          <div key={s.label} style={{ backgroundColor: "#ffffff", borderRadius: 14, border: `1.5px solid ${s.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, backgroundColor: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Section header */}
      <div style={{ marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#111827" }}>
          Schools{" "}
          <span style={{ fontSize: 13, fontWeight: 500, color: "#9CA3AF" }}>
            {!isLoading && `(${schools.length})`}
          </span>
        </h2>
      </div>

      {/* School cards */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
        </div>
      ) : schools.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#9CA3AF" }}>No schools found. Add schools first before enrolling learners.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {schools.map((school) => (
            <SchoolCard
              key={school.id}
              school={school}
              learners={allLearners.filter((l) => l.schoolId === school.id)}
              onClick={() => onSelectSchool(school.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Per-school learner list ─────────────────────────────────────────────────

function SchoolLearnersView({ schoolId, onBack }) {
  const navigate = useNavigate();
  const { data: schoolsData }                                      = useSchoolsQuery();
  const { data: learnersData, isLoading, isError, error }          = useSchoolLearnersQuery(schoolId);
  const { data: classesData }                                      = useQuery({
    queryKey: ["classes", "bySchool", schoolId],
    queryFn:  () => classApi.getAll({ schoolId }),
    enabled:  !!schoolId,
  });

  const [classFilter,  setClassFilter]  = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const school    = (schoolsData?.data || []).find((s) => s.id === schoolId);
  const allSchoolLearners = learnersData?.data || [];
  const classes   = classesData?.data || [];
  const classesMap = classes.reduce((m, c) => { m[c.id] = c; return m; }, {});

  const filtered = allSchoolLearners
    .filter((l) => !classFilter  || l.classId === classFilter)
    .filter((l) => !statusFilter || l.status  === statusFilter);

  const activeCount = allSchoolLearners.filter((l) => l.status === "active").length;
  const hasFilter   = !!classFilter || !!statusFilter;

  const selectStyle = { padding: "8px 32px 8px 12px", borderRadius: 8, border: "1px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none", cursor: "pointer", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Back + header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <button type="button" onClick={onBack}
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px 5px 8px", backgroundColor: "transparent", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer", color: "#6B7280" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            All Schools
          </button>
          <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{school?.name ?? "School"}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, color: "#111827" }}>{school?.name}</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>
              {isLoading ? "Loading…" : `${allSchoolLearners.length} learner${allSchoolLearners.length !== 1 ? "s" : ""}`}
              {!isLoading && activeCount > 0 && ` · ${activeCount} active`}
            </p>
          </div>
          <button type="button" onClick={() => navigate("/learners/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", backgroundColor: ACCENT, color: "#ffffff", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Enroll Learner
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} style={selectStyle}>
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.gradeName}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="transferred">Transferred</option>
          <option value="graduated">Graduated</option>
        </select>
        {hasFilter && (
          <button type="button" onClick={() => { setClassFilter(""); setStatusFilter(""); }}
            style={{ padding: "7px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            ✕ Clear
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#9CA3AF" }}>
          {isLoading ? "Loading…" : `${filtered.length} result${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Learner grid */}
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
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: 12, color: "#EF4444", fontSize: 14 }}>
          ⚠ Failed to load learners: {error?.message}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 72, height: 72, borderRadius: 18, background: "linear-gradient(135deg, #FDF2F8, #FCE7F3)", border: "2px solid #FBCFE8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 20px" }}>🎒</div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "#111827" }}>
            {hasFilter ? "No results found" : "No learners yet"}
          </h3>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
            {hasFilter ? "Try adjusting your filters." : `No learners enrolled at ${school?.name ?? "this school"} yet.`}
          </p>
          {hasFilter
            ? <button type="button" onClick={() => { setClassFilter(""); setStatusFilter(""); }} style={{ padding: "10px 24px", backgroundColor: "transparent", color: ACCENT, border: `1.5px solid ${ACCENT}`, borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Clear Filters</button>
            : <button type="button" onClick={() => navigate("/learners/create")} style={{ padding: "10px 24px", backgroundColor: ACCENT, color: "#ffffff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>+ Enroll Learner</button>
          }
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map((l) => <LearnerCard key={l.id} learner={l} classesMap={classesMap} />)}
        </div>
      )}
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function LearnersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSchoolId = searchParams.get("schoolId");

  return selectedSchoolId
    ? <SchoolLearnersView schoolId={selectedSchoolId} onBack={() => setSearchParams({})} />
    : <SchoolGridView onSelectSchool={(id) => setSearchParams({ schoolId: id })} />;
}
