import { useState, useEffect, useRef } from "react";
import { FiMail, FiPhone } from "react-icons/fi";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useDeleteTeacher, useUpdateTeacherStatus } from "../hooks/useTeacher";
import { useAuth } from "../../../context/AuthContext";
import { teacherPath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee", label: "Active"   },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB", label: "Inactive" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A", label: "On Leave" },
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

export function TeacherCard({ teacher }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mutate: deleteTeacher, isPending: isDeleting } = useDeleteTeacher();
  const { mutate: updateTeacherStatus } = useUpdateTeacherStatus();
  const [menuOpen, setMenuOpen]       = useState(false);
  const [menuPos, setMenuPos]         = useState({ top: 0, right: 0 });
  const [hovered, setHovered]         = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const triggerRef  = useRef(null);
  const dropdownRef = useRef(null);

  // Deactivate/activate is admin- and school-controlled (matches PATCH /api/teachers/:id/status).
  const canToggleStatus = user?.role === "admin" || user?.role === "school";
  const isInactive = teacher.status === "inactive";

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

  const initials = `${teacher.firstName?.[0] ?? ""}${teacher.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.10), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", transform: hovered ? "translateY(-2px)" : "translateY(0)", opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? "none" : "auto" }}
    >
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {teacher.photo ? (
              <img src={teacher.photo} alt={`${teacher.firstName} ${teacher.lastName}`} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {initials || "?"}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h3
                onClick={() => navigate(teacherPath(user?.role, teacher.id, "view"))}
                style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: hovered ? ACCENT : "#111827", cursor: "pointer", transition: "color 0.15s" }}
              >
                {teacher.firstName} {teacher.lastName}
              </h3>
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
            <FiMail size={13} />
            {teacher.email
              ? teacher.email
              : <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>No email</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <FiPhone size={13} />
            {teacher.phone
              ? teacher.phone
              : <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>No phone</span>}
          </div>
        </div>

        <div style={{ marginTop: "auto" }}>
          <StatusBadge status={teacher.status} />
        </div>
      </div>

      {menuOpen && createPortal(
        <div ref={dropdownRef} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 192, overflow: "hidden", padding: 6 }}>
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: 4 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>{teacher.firstName} {teacher.lastName}</p>
          </div>
          {[
            { label: "View", path: teacherPath(user?.role, teacher.id, "view"), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
            { label: "Edit", path: teacherPath(user?.role, teacher.id, "edit"), icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          ].map(({ label, path, icon }) => (
            <MenuButton key={path} icon={icon} label={label} onClick={() => { setMenuOpen(false); navigate(path); }} />
          ))}
          <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "4px 0" }} />
          {canToggleStatus && (
            <MenuButton
              icon={isInactive
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><line x1="10" y1="9" x2="10" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="14" y1="9" x2="14" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
              label={isInactive ? "Activate account" : "Deactivate account"}
              onClick={() => { setMenuOpen(false); setConfirmStatus(true); }}
              danger={!isInactive}
            />
          )}
          <MenuButton
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            label="Delete" onClick={() => { setMenuOpen(false); setConfirmOpen(true); }} danger
          />
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete Educator"
        message={`"${teacher.firstName} ${teacher.lastName}" will be permanently deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteTeacher(teacher.id); }}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={confirmStatus}
        title={isInactive ? "Activate Educator Account" : "Deactivate Educator Account"}
        message={
          isInactive
            ? `"${teacher.firstName} ${teacher.lastName}" will be marked active again and regain portal access.`
            : `"${teacher.firstName} ${teacher.lastName}" will be marked inactive and lose teacher-portal access immediately. Their record, hub assignments, and class history are kept.`
        }
        confirmLabel={isInactive ? "Activate" : "Deactivate"}
        cancelLabel="Cancel"
        variant={isInactive ? "default" : "danger"}
        onConfirm={() => {
          setConfirmStatus(false);
          updateTeacherStatus({ id: teacher.id, status: isInactive ? "active" : "inactive" });
        }}
        onCancel={() => setConfirmStatus(false)}
      />
    </div>
  );
}
