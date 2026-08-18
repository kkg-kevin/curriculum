import { useEffect, useRef, useState } from "react";
import { FiCheck, FiSearch } from "react-icons/fi";
import { useFormContext } from "react-hook-form";
import { Link } from "react-router-dom";
import { useCourseCompetencies } from "../hooks/useCourse";
import { Field } from "./formFields";

const PALETTE = [
  "#25476a", "#38aae1", "#059669", "#7C3AED",
  "#DC2626", "#D97706", "#0891B2", "#BE185D",
];

function AddIndicatorDropdown({ available, onAdd }) {
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

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? available.filter((i) => i.name.toLowerCase().includes(trimmed) || i.competencyName.toLowerCase().includes(trimmed))
    : available;

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
        + Add Indicator
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20,
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: "12px",
          boxShadow: "0 10px 28px rgba(15,38,69,0.14), 0 2px 8px rgba(0,0,0,0.06)",
          width: "300px", maxHeight: "320px", overflow: "hidden", display: "flex", flexDirection: "column",
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
              placeholder="Search indicators…"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px 10px 34px", border: "none",
                fontSize: "13px", fontFamily: "Inter, sans-serif", outline: "none", color: "#111827", background: "#fff",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", padding: "6px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "22px 12px", textAlign: "center" }}>
                <div style={{ display: "flex", justifyContent: "center", color: "#9CA3AF", marginBottom: "4px" }}>{available.length === 0 ? <FiCheck size={20} /> : <FiSearch size={20} />}</div>
                <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>
                  {available.length === 0 ? "All indicators from this course's competencies are already added." : "No matches found."}
                </p>
              </div>
            )}
            {filtered.map((ind) => (
              <button
                key={ind.id}
                type="button"
                onClick={() => { onAdd(ind.id); setOpen(false); }}
                style={{
                  display: "block", width: "100%", padding: "8px 10px", border: "none", borderRadius: "8px",
                  background: "transparent", textAlign: "left", cursor: "pointer",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <p style={{ margin: 0, fontSize: "12.5px", fontWeight: "600", color: "#374151" }}>{ind.name}</p>
                <p style={{ margin: 0, fontSize: "10.5px", color: "#9CA3AF" }}>{ind.competencyName}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// "Just attach" tagging, same posture as CompetenciesField.jsx — no scoring/behavior wired to
// this today. Available options are the indicators belonging to competencies already attached
// to this SESSION'S COURSE (not the whole global catalog), since a session's indicators are
// meant to be a subset of what its own course already claims to teach.
export default function IndicatorsField({ name, label, hint, courseId }) {
  const { watch, setValue } = useFormContext();
  const { data: competencies = [], isLoading } = useCourseCompetencies(courseId);
  const allIndicators = competencies.flatMap((c) => (c.indicators || []).map((i) => ({ ...i, competencyName: c.name })));
  const selectedIds = watch(name) || [];

  const selected = selectedIds.map((id) => allIndicators.find((i) => i.id === id)).filter(Boolean);
  const available = allIndicators.filter((i) => !selectedIds.includes(i.id));

  const addIndicator = (id) => setValue(name, [...selectedIds, id], { shouldDirty: true });
  const removeIndicator = (id) => setValue(name, selectedIds.filter((x) => x !== id), { shouldDirty: true });

  return (
    <Field label={label} hint={hint}>
      {isLoading ? (
        <p style={{ margin: 0, fontSize: "12.5px", color: "#9CA3AF" }}>Loading indicators…</p>
      ) : competencies.length === 0 ? (
        <div style={{ padding: "12px 14px", backgroundColor: "#F9FAFB", border: "1.5px dashed #E5E7EB", borderRadius: "10px" }}>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#6B7280" }}>
            This course has no competencies attached yet — attach one from the course's Competencies tab to make its indicators available here.
          </p>
        </div>
      ) : allIndicators.length === 0 ? (
        <div style={{ padding: "12px 14px", backgroundColor: "#F9FAFB", border: "1.5px dashed #E5E7EB", borderRadius: "10px" }}>
          <p style={{ margin: "0 0 6px", fontSize: "12.5px", color: "#6B7280" }}>
            None of this course's attached competencies have indicators defined yet.
          </p>
          <Link to="/settings" style={{ fontSize: "12.5px", fontWeight: "700", color: "#38aae1", textDecoration: "none" }}>
            + Add indicators in Settings →
          </Link>
        </div>
      ) : (
        <div>
          {selected.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
              {selected.map((ind, idx) => {
                const color = PALETTE[idx % PALETTE.length];
                return (
                  <span
                    key={ind.id}
                    title={ind.competencyName}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "7px",
                      padding: "5px 8px 5px 12px", borderRadius: "20px",
                      backgroundColor: `${color}12`, border: `1.5px solid ${color}30`, color,
                      fontSize: "12px", fontWeight: "700", fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {ind.name}
                    <button
                      type="button"
                      onClick={() => removeIndicator(ind.id)}
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
          <AddIndicatorDropdown available={available} onAdd={addIndicator} />
        </div>
      )}
    </Field>
  );
}
