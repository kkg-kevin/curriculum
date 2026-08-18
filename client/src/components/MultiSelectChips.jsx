import { useState } from "react";

// Past this many options, showing the whole list up front turns into an unscannable wall of
// chips (e.g. the 26-language picker on LearnerForm.jsx/EditProfileModal.jsx) — small option
// sets (a handful of amenities, say) keep the old always-expanded behavior unchanged.
const SEARCH_THRESHOLD = 8;

function Chip({ option, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "7px 13px", borderRadius: "20px",
        border: `1.5px solid ${active ? "#38aae1" : "#E5E7EB"}`,
        backgroundColor: active ? "#e8f5fb" : "#fff",
        color: active ? "#25476a" : "#6B7280",
        fontSize: "12.5px", fontWeight: active ? "700" : "500", fontFamily: "Inter, sans-serif",
        cursor: "pointer", transition: "all 0.15s",
        display: "inline-flex", alignItems: "center", gap: "6px",
      }}
    >
      {option}{active && <span style={{ fontSize: "13px", lineHeight: 1 }}>×</span>}
    </button>
  );
}

// Generic multi-select chip toggle — click a chip to add/remove it from `value`. Same visual
// pattern as the amenities picker in LearningHubForm.jsx. Works on a plain string array; callers
// that persist a comma-joined string (e.g. learner.languages) convert at the boundary, not here.
//
// Past SEARCH_THRESHOLD options, the browse grid stays collapsed behind a search box (or a "Show
// all options" fallback for browsing without knowing the exact spelling) instead of dumping every
// option on screen at once — selected chips always stay visible up top regardless, so what's
// already picked is never hidden by a filter.
export default function MultiSelectChips({ options, value = [], onChange, itemLabel = "options" }) {
  const [query, setQuery] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const toggle = (option) => {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  };

  const selected = options.filter((o) => value.includes(o));
  const useSearch = options.length > SEARCH_THRESHOLD;
  const q = query.trim().toLowerCase();
  const unselected = options.filter((o) => !value.includes(o));
  const candidates = q ? unselected.filter((o) => o.toLowerCase().includes(q)) : unselected;
  const showGrid = !useSearch || q.length > 0 || browsing;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {selected.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {selected.map((option) => <Chip key={option} option={option} active onClick={() => toggle(option)} />)}
        </div>
      )}

      {useSearch && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${itemLabel}…`}
            style={{
              padding: "8px 12px", borderRadius: "10px", border: "1.5px solid #E5E7EB", fontSize: "13px",
              fontFamily: "Inter, sans-serif", backgroundColor: "#F9FAFB", color: "#374151", outline: "none",
              width: "220px", maxWidth: "100%", boxSizing: "border-box",
            }}
          />
          {!q && !browsing && (
            <button
              type="button"
              onClick={() => setBrowsing(true)}
              style={{ padding: 0, background: "none", border: "none", color: "#25476a", fontWeight: "600", fontSize: "12.5px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
            >
              Show all {itemLabel}
            </button>
          )}
        </div>
      )}

      {showGrid && (
        candidates.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {candidates.map((option) => <Chip key={option} option={option} active={false} onClick={() => toggle(option)} />)}
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: "12px", color: "#9CA3AF" }}>No matches.</p>
        )
      )}
    </div>
  );
}
