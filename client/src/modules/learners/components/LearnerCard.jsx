import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Groups as GroupsIcon, School as SchoolIcon } from "@mui/icons-material";
import { useDeleteLearner } from "../hooks/useLearners";
import { useAuth } from "../../../context/AuthContext";
import { learnerPath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

const STATUS_STYLES = {
  active:      { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Active"      },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Inactive"    },
  transferred: { bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee", label: "Transferred" },
  graduated:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Graduated"   },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
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

export function LearnerCard({ learner, classMap }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate: deleteLearner, isPending: isDeleting } = useDeleteLearner();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [menuPos, setMenuPos]         = useState({ top: 0, right: 0 });
  const [hovered, setHovered]         = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef  = useRef(null);
  const dropdownRef = useRef(null);

  const gradeName = classMap?.[learner.classId]?.gradeName || "—";

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

  const initials = `${learner.firstName?.[0] ?? ""}${learner.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.10), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", transform: hovered ? "translateY(-2px)" : "translateY(0)", opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? "none" : "auto" }}
    >
      <div style={{ height: hovered ? 4 : 3, background: "linear-gradient(90deg, #25476a, #2e7db5, #38aae1)", transition: "height 0.2s" }} />

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
              {initials || "?"}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                onClick={() => navigate(learnerPath(user?.role, learner.id, "view"))}
                style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: hovered ? ACCENT : "#111827", cursor: "pointer", transition: "color 0.15s" }}
              >
                {learner.firstName} {learner.lastName}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{learner.admissionNumber || "No ID"}</p>
            </div>
          </div>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
            style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: menuOpen ? "#e8f5fb" : "transparent", border: `1.5px solid ${menuOpen ? "#a8d5ee" : "transparent"}`, borderRadius: 8, cursor: "pointer", color: menuOpen ? ACCENT : "#9CA3AF", transition: "all 0.15s", flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <SchoolIcon fontSize="small" sx={{ color: ACCENT }} />
            {gradeName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <GroupsIcon fontSize="small" sx={{ color: ACCENT }} />
            {learner.guardianName
              ? learner.guardianName
              : <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>No guardian on file</span>}
          </div>
        </div>

        <div style={{ marginTop: "auto" }}>
          <StatusBadge status={learner.status} />
        </div>
      </div>

      {menuOpen && createPortal(
        <div ref={dropdownRef} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 192, overflow: "hidden", padding: 6 }}>
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: 4 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>{learner.firstName} {learner.lastName}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9CA3AF" }}>{learner.admissionNumber}</p>
          </div>
          {[
            { label: "View", path: learnerPath(user?.role, learner.id, "view"), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
            { label: "Edit", path: learnerPath(user?.role, learner.id, "edit"), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          ].map(({ label, path, icon }) => (
            <MenuButton key={path} icon={icon} label={label} onClick={() => { setMenuOpen(false); navigate(path); }} />
          ))}
          <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "4px 0" }} />
          <MenuButton
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            label="Delete" onClick={() => { setMenuOpen(false); setConfirmOpen(true); }} danger
          />
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Learner"
        message={`"${learner.firstName} ${learner.lastName}" will be permanently deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteLearner(learner.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
