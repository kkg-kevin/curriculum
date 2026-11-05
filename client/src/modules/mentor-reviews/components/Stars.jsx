import { useState } from "react";

// Star ratings for parent feedback — a 1–5 picker (radio buttons under the hood, so it works by
// keyboard and screen reader) and a read-only display. Gold from the system palette.
const GOLD = "#feb139";
const EMPTY = "#D9DEE7";

function Star({ filled, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.53L12 17.5l-5.87 3.07 1.12-6.53L2.5 9.41l6.56-.95z" fill={filled ? GOLD : EMPTY} />
    </svg>
  );
}

const WORDS = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very good", 5: "Excellent" };

export function StarInput({ value, onChange, label, size = 30, name }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  return (
    <div role="radiogroup" aria-label={label} style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", gap: 2 }} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} onMouseEnter={() => setHover(n)} style={{ cursor: "pointer", padding: 2, borderRadius: 6 }} title={`${n} — ${WORDS[n]}`}>
            <input type="radio" name={name || label} value={n} checked={value === n} onChange={() => onChange(n)} aria-label={`${n} star${n === 1 ? "" : "s"} — ${WORDS[n]}`}
              style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} />
            <Star filled={n <= shown} size={size} />
          </label>
        ))}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: shown ? "#7A4F00" : "#9CA3AF", minWidth: 70 }}>{shown ? WORDS[shown] : "Not rated"}</span>
    </div>
  );
}

// Read-only: a value (may be a decimal average) as filled stars, plus the number.
export function StarsShown({ value, size = 15, showNumber = true, count }) {
  if (value == null) return <span style={{ fontSize: 12.5, color: "#9CA3AF" }}>No ratings yet</span>;
  const rounded = Math.round(Number(value));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} aria-label={`${value} out of 5`}>
      <span style={{ display: "inline-flex", gap: 1 }}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} filled={n <= rounded} size={size} />)}</span>
      {showNumber && <span style={{ fontSize: 12.5, fontWeight: 800, color: "#374151" }}>{Number(value).toFixed(1)}{count != null ? <span style={{ fontWeight: 500, color: "#6B7280" }}> · {count} review{count === 1 ? "" : "s"}</span> : null}</span>}
    </span>
  );
}
