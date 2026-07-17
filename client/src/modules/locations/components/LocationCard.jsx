import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useDeleteLocation } from "../hooks/useLocation";
import { LOCATION_TYPES } from "../schemas/location.schema";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

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

export function LocationCard({ location, curriculaMap }) {
  const navigate = useNavigate();
  const { mutate: deleteLocation, isPending: isDeleting } = useDeleteLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const [hovered, setHovered] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const typeLabel = LOCATION_TYPES.find((t) => t.value === location.locationType)?.label || location.locationType;
  const curriculum = location.curriculumId ? curriculaMap?.[location.curriculumId] : null;

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
      style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.10), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", transform: hovered ? "translateY(-2px)" : "translateY(0)", opacity: isDeleting ? 0.5 : 1, pointerEvents: isDeleting ? "none" : "auto" }}
    >
      {location.photos?.length > 0 ? (
        <div style={{ height: 110, overflow: "hidden" }}>
          <img src={location.photos[0]} alt={location.name} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.2s", transform: hovered ? "scale(1.04)" : "scale(1)" }} />
        </div>
      ) : (
        <div style={{ height: hovered ? 4 : 3, background: "linear-gradient(90deg, #25476a, #2e7db5, #38aae1)", transition: "height 0.2s" }} />
      )}

      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #1a3550, #2e7db5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: location.locationType === "school" ? 20 : 19, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
              {location.locationType === "school" ? "🏫" : (location.name?.[0]?.toUpperCase() || "📍")}
            </div>
            <div style={{ minWidth: 0 }}>
              <h3
                onClick={() => navigate(`/locations/${location.id}/view`)}
                style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: hovered ? ACCENT : "#111827", cursor: "pointer", transition: "color 0.15s" }}
              >
                {location.name}
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{typeLabel}</p>
                {location.code && (
                  <>
                    <span style={{ color: "#D1D5DB" }}>·</span>
                    <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}>{location.code}</p>
                  </>
                )}
              </div>
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

        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #F3F4F6", paddingTop: 10, fontSize: 13, color: "#6B7280" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>📍</span>
            <span>{[location.address?.city, location.address?.county].filter(Boolean).join(", ") || "No address"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span>📘</span>
            {curriculum ? <span>{curriculum.name}</span> : <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>No curriculum assigned</span>}
          </div>
          {(location.amenities?.length > 0 || location.spaces?.length > 0) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#9CA3AF" }}>
              {location.amenities?.length > 0 && <span>✨ {location.amenities.length} amenities</span>}
              {location.spaces?.length > 0 && <span>🪑 {location.spaces.length} bookable space{location.spaces.length !== 1 ? "s" : ""}</span>}
            </div>
          )}
        </div>

        <div style={{ marginTop: "auto" }}>
          <StatusBadge status={location.status} />
        </div>
      </div>

      {menuOpen && createPortal(
        <div ref={dropdownRef} style={{ position: "fixed", top: menuPos.top, right: menuPos.right, backgroundColor: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 14, boxShadow: "0 8px 28px rgba(0,0,0,0.12)", zIndex: 9999, minWidth: 192, overflow: "hidden", padding: 6 }}>
          <div style={{ padding: "8px 10px 10px", borderBottom: "1px solid #F3F4F6", marginBottom: 4 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#111827" }}>{location.name}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9CA3AF" }}>{typeLabel}</p>
          </div>
          {[
            { label: "View", path: `/locations/${location.id}/view`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/></svg> },
            { label: "Edit", path: `/locations/${location.id}/edit`, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
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
        title="Delete Location"
        message={`"${location.name}" will be permanently deleted.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { setConfirmOpen(false); deleteLocation(location.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
