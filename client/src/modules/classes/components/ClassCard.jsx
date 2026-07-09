import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useDeleteClass } from "../hooks/useClasses";
import { useAuth } from "../../../context/AuthContext";
import { classPath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT    = "#25476a";
const GRAD_FROM = "#feb139";
const GRAD_TO   = "#f59e0b";

const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.inactive;
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status === "active" ? "Active" : "Inactive"}
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

export function ClassCard({ cls, teachersMap }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate: deleteClass, isPending: isDeleting } = useDeleteClass();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [menuPos, setMenuPos]         = useState({ top: 0, right: 0 });
  const [hovered, setHovered]         = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef  = useRef(null);
  const dropdownRef = useRef(null);

  const teacher = cls.classTeacherId ? teachersMap[cls.classTeacherId] : null;

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
      style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: hovered ? "0 8px 24px rgba(234,88,12,0.10), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", transform: hovered ? "translateY(-2px)" : "translateY(0)", opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? "none" : "auto" }}
    >
      <div style={{ height: hovered ? 4 : 3, background: `linear-gradient(90deg, ${GRAD_FROM}, ${GRAD_TO}, #38aae1)`, transition: "height 0.2s" }} />

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${GRAD_FROM}, ${GRAD_TO})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎓</div>
            <div style={{ minWidth: 0 }}>
              <h3
                onClick={() => navigate(classPath(user?.role, cls.id, "view"))}
                style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: hovered ? ACCENT : "#111827", cursor: "pointer", transition: "color 0.15s" }}
              >
                {cls.gradeName}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{cls.academicYear}</p>
            </div>
          </div>
          <button
            ref={triggerRef}
            type="button"
            onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
            style={{ width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: menuOpen ? "#FFF7ED" : "transparent", border: `1.5px solid ${menuOpen ? "#FED7AA" : "transparent"}`, borderRadius: 8, cursor: "pointer", color: menuOpen ? ACCENT : "#9CA3AF", transition: "all 0.15s", flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <span>👩‍🏫</span>
            {teacher
              ? `${teacher.firstName} ${teacher.lastName}`
              : <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>No class teacher</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <span>👥</span>
            <span>
              {cls.learnerCount ?? 0} learner{(cls.learnerCount ?? 0) !== 1 ? "s" : ""}
              {cls.capacity ? (
                <span style={{ color: (cls.learnerCount ?? 0) >= cls.capacity ? "#EF4444" : "#9CA3AF" }}>
                  {" "}· {cls.capacity} capacity
                </span>
              ) : null}
            </span>
          </div>
        </div>

        <div style={{ marginTop: "auto" }}>
          <StatusBadge status={cls.status} />
        </div>
      </div>

      {menuOpen && createPortal(
        <div ref={dropdownRef} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 192, overflow: "hidden", padding: 6 }}>
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: 4 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>{cls.gradeName}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9CA3AF" }}>{cls.academicYear}</p>
          </div>
          {[
            { label: "View", path: classPath(user?.role, cls.id, "view"), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
            { label: "Edit", path: classPath(user?.role, cls.id, "edit"), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
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
        title="Delete Class"
        message={`"${cls.gradeName} — ${cls.academicYear}" will be permanently deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteClass(cls.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
