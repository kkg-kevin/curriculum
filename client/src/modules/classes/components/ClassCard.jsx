import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FiBookOpen, FiEdit2, FiEye, FiMoreVertical, FiTrash2, FiUserCheck, FiUsers } from "react-icons/fi";
import { useDeleteClass } from "../hooks/useClasses";
import { useCurriculumCurrentCourses } from "../../curriculum/hooks/useCurriculumVersion";
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
  const { data: courses } = useCurriculumCurrentCourses(cls.curriculumId, cls.gradeName);
  const courseCount = courses?.length ?? 0;

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
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${GRAD_FROM}, ${GRAD_TO})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}>
              <FiBookOpen size={20} strokeWidth={1.8} />
            </div>
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
            <FiMoreVertical size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <FiUserCheck size={14} strokeWidth={2} color="#6B7280" />
            {teacher
              ? `${teacher.firstName} ${teacher.lastName}`
              : <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>No class teacher</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <FiUsers size={14} strokeWidth={2} color="#6B7280" />
            <span>
              {cls.learnerCount ?? 0} learner{(cls.learnerCount ?? 0) !== 1 ? "s" : ""}
              {cls.capacity ? (
                <span style={{ color: (cls.learnerCount ?? 0) >= cls.capacity ? "#EF4444" : "#9CA3AF" }}>
                  {" "}· {cls.capacity} capacity
                </span>
              ) : null}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <FiBookOpen size={14} strokeWidth={2} color="#6B7280" />
            <span>{courseCount} course{courseCount !== 1 ? "s" : ""}</span>
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
            { label: "View", path: classPath(user?.role, cls.id, "view"), icon: <FiEye size={14} strokeWidth={2} /> },
            { label: "Edit", path: classPath(user?.role, cls.id, "edit"), icon: <FiEdit2 size={14} strokeWidth={2} /> },
          ].map(({ label, path, icon }) => (
            <MenuButton key={path} icon={icon} label={label} onClick={() => { setMenuOpen(false); navigate(path); }} />
          ))}
          <div style={{ height: 1, backgroundColor: "#F3F4F6", margin: "4px 0" }} />
          <MenuButton
            icon={<FiTrash2 size={14} strokeWidth={2} />}
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
