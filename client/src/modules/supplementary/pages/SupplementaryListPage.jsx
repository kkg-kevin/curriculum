import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useSupplementaryListQuery, useDeleteSupplementary } from "../hooks/useSupplementary";
import { SUPPLEMENTARY_TYPE_META } from "../schemas/supplementary.schema";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

function TypeBadge({ type }) {
  const meta = SUPPLEMENTARY_TYPE_META[type] || {};
  return (
    <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, textTransform: "uppercase", letterSpacing: "0.03em" }}>
      {meta.label}
    </span>
  );
}

function MenuButton({ icon, label, onClick, danger = false }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "8px 10px", backgroundColor: hov ? (danger ? "#FFF5F5" : "#F3F4F6") : "transparent", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "500", fontFamily: "Inter, sans-serif", color: hov ? (danger ? "#EF4444" : "#0D47A1") : (danger ? "#EF4444" : "#374151"), cursor: "pointer", textAlign: "left", transition: "background-color 0.12s, color 0.12s" }}>
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0, opacity: 0.8 }}>{icon}</span>
      {label}
    </button>
  );
}

function SupplementaryCard({ sup }) {
  const navigate = useNavigate();
  const { mutate: deleteSup, isPending: isDeleting } = useDeleteSupplementary();
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
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) setMenuOpen(false);
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

  const meta = SUPPLEMENTARY_TYPE_META[sup.type] || {};
  const supCourseCount = (sup.grades || []).reduce((s, g) => s + (g.courses?.length || 0), 0);
  const gradeCount = (sup.grades || []).filter((g) => g.courses?.length > 0).length;

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: hovered ? "0 8px 24px rgba(13,71,161,0.12), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", transform: hovered ? "translateY(-2px)" : "translateY(0)", opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? "none" : "auto" }}>
      <div style={{ height: hovered ? "4px" : "3px", background: sup.type === "complementary" ? "linear-gradient(90deg, #16A34A, #4ADE80)" : "linear-gradient(90deg, #D97706, #FCD34D)", transition: "height 0.2s" }} />

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 onClick={() => navigate(`/supplementary/${sup.id}/view`)}
              style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: "700", color: hovered ? "#0D47A1" : "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer", transition: "color 0.15s" }}>
              {sup.name}
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF", fontWeight: "500" }}>{sup.code}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <TypeBadge type={sup.type} />
            <div style={{ position: "relative" }}>
              <button ref={triggerRef} type="button" onClick={() => menuOpen ? setMenuOpen(false) : openMenu()}
                style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: menuOpen ? "#EFF6FF" : "transparent", border: `1.5px solid ${menuOpen ? "#BFDBFE" : "transparent"}`, borderRadius: "9px", cursor: "pointer", color: menuOpen ? "#0D47A1" : "#9CA3AF", transition: "all 0.15s" }}
                onMouseEnter={(e) => { if (!menuOpen) { e.currentTarget.style.backgroundColor = "#F3F4F6"; e.currentTarget.style.color = "#374151"; } }}
                onMouseLeave={(e) => { if (!menuOpen) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#9CA3AF"; } }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
              </button>

              {menuOpen && createPortal(
                <div ref={dropdownRef} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: "14px", boxShadow: "0 8px 28px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: "196px", overflow: "hidden", padding: "6px" }}>
                  <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: "4px" }}>
                    <p style={{ margin: 0, fontSize: "12px", fontWeight: "700", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sup.name}</p>
                    <p style={{ margin: "1px 0 0", fontSize: "11px", color: "#9CA3AF" }}>{sup.termName} · {sup.schoolName}</p>
                  </div>
                  <MenuButton label="View" onClick={() => { setMenuOpen(false); navigate(`/supplementary/${sup.id}/view`); }}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" /></svg>} />
                  <MenuButton label="Edit Courses" onClick={() => { setMenuOpen(false); navigate(`/supplementary/${sup.id}/editor`); }}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" /></svg>} />
                  <MenuButton label="Edit Details" onClick={() => { setMenuOpen(false); navigate(`/supplementary/${sup.id}/edit`); }}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
                  <div style={{ height: "1px", backgroundColor: "#F3F4F6", margin: "4px 0" }} />
                  <MenuButton danger label="Delete" onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
                    icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>} />
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>

        {/* Term + school */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", color: "#374151", backgroundColor: "#F3F4F6", borderRadius: "6px", padding: "2px 8px", fontWeight: "600" }}>{sup.termName}</span>
          <span style={{ fontSize: "12px", color: "#6B7280", backgroundColor: "#F9FAFB", borderRadius: "6px", padding: "2px 8px" }}>{sup.schoolName}</span>
        </div>

        {sup.description && (
          <p style={{ margin: 0, fontSize: "13px", color: "#6B7280", lineHeight: "1.5", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {sup.description}
          </p>
        )}

        <div style={{ display: "flex", gap: "16px", paddingTop: "10px", borderTop: "1px solid #F3F4F6" }}>
          {[
            { label: "Grades", value: gradeCount },
            { label: sup.type === "complementary" ? "Added" : "Replaced", value: supCourseCount },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ margin: "0 0 1px", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase" }}>{label}</p>
              <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#374151" }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog isOpen={confirmOpen} title="Delete Supplementary Curriculum"
        message={`"${sup.name}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete" cancelLabel="Cancel" variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteSup(sup.id); }}
        onCancel={() => setConfirmOpen(false)} />
    </div>
  );
}

export default function SupplementaryListPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useSupplementaryListQuery();
  const list = data?.data || [];

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #0A3880 0%, #0D47A1 40%, #1565C0 75%, #1976D2 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "16px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative" }}>
          <div>
            <h1 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px" }}>Supplementary Curriculum</h1>
            <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.72)", maxWidth: "480px" }}>
              Add complementary or substitutional courses on top of a school's base curriculum, term by term.
            </p>
          </div>
          <button type="button" onClick={() => navigate("/supplementary/create")}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "11px 22px", backgroundColor: "#ffffff", color: "#0D47A1", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: "16px" }}>+</span> Create Supplementary
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Total",          value: isLoading ? "—" : list.length,                                          bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
          { label: "Complementary",  value: isLoading ? "—" : list.filter((s) => s.type === "complementary").length, bg: "#F0FDF4", color: "#16A34A", border: "#BBF7D0" },
          { label: "Substitutional", value: isLoading ? "—" : list.filter((s) => s.type === "substitutional").length, bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
        ].map(({ label, value, bg, color, border }) => (
          <div key={label} style={{ backgroundColor: "#ffffff", borderRadius: "14px", border: `1.5px solid ${border}`, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <p style={{ margin: 0, fontSize: "24px", fontWeight: "800", color, lineHeight: 1 }}>{value}</p>
            <p style={{ margin: "3px 0 0", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ backgroundColor: "#ffffff", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ height: "3px", background: "linear-gradient(90deg, #E8EFF8, #EEF4FC)" }} />
              <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ height: "16px", width: "60%", backgroundColor: "#EEF2F7", borderRadius: "6px" }} />
                <div style={{ height: "12px", width: "40%", backgroundColor: "#F3F4F6", borderRadius: "5px" }} />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div style={{ padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
          Failed to load: {error?.message}
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", backgroundColor: "#ffffff", borderRadius: "16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)", border: "2px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 17l10 5 10-5" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M2 12l10 5 10-5" stroke="#93C5FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: "700", color: "#111827" }}>No supplementary curricula yet</h3>
          <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#6B7280", lineHeight: "1.6" }}>
            Create your first supplementary curriculum by selecting a school and a term from their base curriculum.
          </p>
          <button type="button" onClick={() => navigate("/supplementary/create")}
            style={{ padding: "10px 24px", backgroundColor: "#0D47A1", color: "#ffffff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
            + Create Supplementary Curriculum
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
          {list.map((sup) => <SupplementaryCard key={sup.id} sup={sup} />)}
        </div>
      )}
    </div>
  );
}
