import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Link } from "react-router-dom";
import { useCompetencies as useGlobalCompetencies } from "../../settings/hooks/useCompetencies";
import { Field } from "./formFields";

const PALETTE = [
  "#25476a", "#38aae1", "#059669", "#7C3AED",
  "#DC2626", "#D97706", "#0891B2", "#BE185D",
];

function AddCompetencyDropdown({ available, onAdd }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px",
          backgroundColor: "#e8f5fb", color: "#25476a", border: "1.5px solid #a8d5ee",
          borderRadius: "9px", fontSize: "12.5px", fontWeight: "700", fontFamily: "Inter, sans-serif",
          cursor: "pointer",
        }}
      >
        + Add Competency
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)",
          minWidth: "240px", maxHeight: "260px", overflowY: "auto", padding: "4px",
        }}>
          {available.length === 0 ? (
            <div style={{ padding: "14px 12px", fontSize: "12px", color: "#9CA3AF", textAlign: "center" }}>
              All competencies are already added.
            </div>
          ) : (
            available.map((comp) => (
              <button
                key={comp.id}
                type="button"
                onClick={() => { onAdd(comp.id); setOpen(false); }}
                style={{
                  display: "block", width: "100%", padding: "8px 10px", border: "none", borderRadius: "7px",
                  background: "transparent", fontSize: "12.5px", fontWeight: "600", fontFamily: "Inter, sans-serif",
                  color: "#374151", textAlign: "left", cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {comp.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function CompetenciesField({ name, label, hint }) {
  const { watch, setValue } = useFormContext();
  const { data: allComps = [], isLoading } = useGlobalCompetencies();
  const selectedIds = watch(name) || [];

  const selected = selectedIds
    .map((id) => allComps.find((c) => c.id === id))
    .filter(Boolean);
  const available = allComps.filter((c) => !selectedIds.includes(c.id));

  const addCompetency = (id) => {
    setValue(name, [...selectedIds, id], { shouldDirty: true });
  };
  const removeCompetency = (id) => {
    setValue(name, selectedIds.filter((x) => x !== id), { shouldDirty: true });
  };

  return (
    <Field label={label} hint={hint}>
      {isLoading ? (
        <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>Loading competencies…</p>
      ) : allComps.length === 0 ? (
        <div style={{ padding: "12px 14px", backgroundColor: "#F9FAFB", border: "1.5px dashed #E5E7EB", borderRadius: "10px" }}>
          <p style={{ margin: "0 0 6px", fontSize: "12.5px", color: "#6B7280" }}>
            No competencies have been defined yet.
          </p>
          <Link to="/settings" style={{ fontSize: "12.5px", fontWeight: "700", color: "#38aae1", textDecoration: "none" }}>
            + Define Competencies in Settings →
          </Link>
        </div>
      ) : (
        <div>
          {selected.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
              {selected.map((comp, idx) => {
                const color = PALETTE[idx % PALETTE.length];
                return (
                  <span
                    key={comp.id}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "7px",
                      padding: "5px 8px 5px 12px", borderRadius: "20px",
                      backgroundColor: `${color}12`, border: `1.5px solid ${color}30`, color,
                      fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {comp.name}
                    <button
                      type="button"
                      onClick={() => removeCompetency(comp.id)}
                      title="Remove"
                      style={{
                        width: "16px", height: "16px", borderRadius: "50%", border: "none",
                        background: "rgba(0,0,0,0.08)", color: "inherit", cursor: "pointer",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: "11px", fontWeight: "900", padding: 0, flexShrink: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          <AddCompetencyDropdown available={available} onAdd={addCompetency} />
        </div>
      )}
    </Field>
  );
}
