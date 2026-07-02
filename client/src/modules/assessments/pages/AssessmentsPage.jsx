import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAssessmentsQuery, useDeleteAssessment } from "../hooks/useAssessment";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

const TYPE_LABELS = { quiz: "Quiz", exam: "Exam", project: "Project", assignment: "Assignment" };
const TYPE_ICONS = { quiz: "📝", exam: "🎓", project: "🛠️", assignment: "📄" };

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}`, textTransform: "capitalize", letterSpacing: "0.02em" }}>
      {status}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#fff8e6", color: "#b07800", border: "1px solid #fcd97a" }}>
      {TYPE_LABELS[type] || type}
    </span>
  );
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

function AssessmentCard({ assessment }) {
  const navigate = useNavigate();
  const { mutate: deleteAssessment, isPending: isDeleting } = useDeleteAssessment();
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

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#ffffff", borderRadius: "16px",
        boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.12), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s, opacity 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? "none" : "auto",
      }}
    >
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "linear-gradient(135deg, #1a3550, #25476a)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "20px" }}>
            {TYPE_ICONS[assessment.type] || "📋"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
              <h3
                onClick={() => navigate(`/assessments/${assessment.id}/view`)}
                style={{ margin: "0 0 3px 0", fontSize: "15px", fontWeight: "700", color: hovered ? "#25476a" : "#111827", cursor: "pointer", transition: "color 0.15s", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {assessment.name}
              </h3>
              <button
                ref={triggerRef}
                type="button"
                onClick={() => (menuOpen ? setMenuOpen(false) : openMenu())}
                title="More options"
                style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: menuOpen ? "#e8f5fb" : "transparent", border: `1.5px solid ${menuOpen ? "#b8d9ee" : "transparent"}`, borderRadius: "8px", cursor: "pointer", color: menuOpen ? "#25476a" : "#9CA3AF", transition: "all 0.15s", flexShrink: 0 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <TypeBadge type={assessment.type} />
              <StatusBadge status={assessment.status} />
            </div>
          </div>
        </div>

        <p style={{
          margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.6",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {assessment.description || <span style={{ fontStyle: "italic", color: "#D1D5DB" }}>No description added</span>}
        </p>
      </div>

      <div style={{ padding: "10px 20px", borderTop: "1px solid #F3F4F6", backgroundColor: "#FAFBFF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => navigate(`/assessments/${assessment.id}/view`)}
          style={{ background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#38aae1", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}
        >
          View Details
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {menuOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)", zIndex: 9999, minWidth: "180px", overflow: "hidden", padding: "6px" }}
        >
          {[
            { label: "View", path: `/assessments/${assessment.id}/view`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
            { label: "Edit", path: `/assessments/${assessment.id}/edit`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
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
        title="Delete Assessment"
        message={`"${assessment.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteAssessment(assessment.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

function EmptyState({ onCreateNew }) {
  return (
    <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", margin: "0 auto 20px" }}>
        📋
      </div>
      <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#111827" }}>No assessments yet</h3>
      <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>Create your first assessment to get started.</p>
      <button type="button" onClick={onCreateNew} style={{ padding: "10px 24px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 4px 12px rgba(254,177,57,0.35)" }}>
        + Add Assessment
      </button>
    </div>
  );
}

export default function AssessmentsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useAssessmentsQuery();
  const assessments = data?.data || [];

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px", lineHeight: 1.2 }}>
              Assessments
            </h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", lineHeight: "1.5", maxWidth: "480px" }}>
              Create and manage assessments from scratch.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/assessments/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(254,177,57,0.35)", whiteSpace: "nowrap" }}
          >
            <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span>
            Add Assessment
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
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
                <div style={{ height: "40px", backgroundColor: "#F9FAFB", borderRadius: "10px" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
          ⚠ Failed to load assessments: {error?.message}
        </div>
      ) : assessments.length === 0 ? (
        <EmptyState onCreateNew={() => navigate("/assessments/create")} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {assessments.map((assessment) => (
            <AssessmentCard key={assessment.id} assessment={assessment} />
          ))}
        </div>
      )}
    </div>
  );
}
