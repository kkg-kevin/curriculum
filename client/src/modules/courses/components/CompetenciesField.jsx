import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Link } from "react-router-dom";
import { useCompetencies as useGlobalCompetencies } from "../../settings/competencies/hooks/useCompetencies";
import { Field } from "./formFields";
import CreateCompetencyModal from "./CreateCompetencyModal";

const PALETTE = [
  "#25476a", "#38aae1", "#059669", "#7C3AED",
  "#DC2626", "#D97706", "#0891B2", "#BE185D",
];

function AddCompetencyDropdown({ available, allComps, onAdd, onRequestCreate }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
    else setQuery("");
  }, [open]);

  const trimmed = query.trim();
  const filtered = trimmed
    ? available.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : available;
  // Only offer "create" when the name is genuinely new — otherwise we'd let this
  // field silently mint duplicate catalog entries for something that already exists.
  const canCreate = trimmed !== "" && !allComps.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());

  const handleCreate = () => {
    onRequestCreate(trimmed);
    setOpen(false);
  };

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
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
          boxShadow: "0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          width: "280px", maxHeight: "320px", overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ position: "relative", flexShrink: 0, borderBottom: "1px solid #F0F2F5" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }}>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search or create…"
              onKeyDown={(e) => { if (e.key === "Enter" && canCreate && filtered.length === 0) { e.preventDefault(); handleCreate(); } }}
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", border: "none",
                fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", color: "#111827", background: "#fff",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "6px" }}>
            {filtered.length === 0 && !canCreate && (
              <div style={{ padding: "22px 12px", textAlign: "center" }}>
                <div style={{ fontSize: "22px", marginBottom: "4px" }}>{available.length === 0 ? "✓" : "🔍"}</div>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  {available.length === 0 ? "All competencies are already added." : "No matches found."}
                </p>
              </div>
            )}
            {filtered.map((comp) => (
              <button
                key={comp.id}
                type="button"
                onClick={() => { onAdd(comp.id); setOpen(false); }}
                style={{
                  display: "block", width: "100%", padding: "8px 10px", border: "none", borderRadius: "8px",
                  background: "transparent", fontSize: "12.5px", fontWeight: "600", fontFamily: "Inter, sans-serif",
                  color: "#374151", textAlign: "left", cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {comp.name}
              </button>
            ))}
            {canCreate && (
              <>
                {filtered.length > 0 && (
                  <div style={{ margin: "6px 4px 4px", paddingTop: "6px", borderTop: "1px dashed #E5E7EB", fontSize: "10px", fontWeight: "700", color: "#B0B8C4", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Create new
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCreate}
                  style={{
                    display: "flex", alignItems: "center", gap: "9px", width: "100%", padding: "9px 10px",
                    border: "none", borderRadius: "8px", background: "#F0F7FF", fontSize: "12.5px", fontWeight: "700",
                    fontFamily: "Inter, sans-serif", color: "#25476a", textAlign: "left", cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e0f0fb"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#F0F7FF"; }}
                >
                  <span style={{
                    width: "18px", height: "18px", borderRadius: "50%", flexShrink: 0,
                    backgroundColor: "#25476a", color: "#fff", fontSize: "12px", fontWeight: "900",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
                  }}>+</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Create "{trimmed}"
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CompetenciesField({ name, label, hint }) {
  const { watch, setValue } = useFormContext();
  const { data: allComps = [], isLoading } = useGlobalCompetencies();
  const [createQuery, setCreateQuery] = useState(null);
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
          <AddCompetencyDropdown available={available} allComps={allComps} onAdd={addCompetency} onRequestCreate={setCreateQuery} />
        </div>
      )}
      {createQuery !== null && (
        <CreateCompetencyModal
          initialName={createQuery}
          onClose={() => setCreateQuery(null)}
          onCreated={addCompetency}
        />
      )}
    </Field>
  );
}
