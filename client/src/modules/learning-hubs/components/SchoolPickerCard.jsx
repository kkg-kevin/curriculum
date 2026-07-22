import { useState } from "react";

const ACCENT = "#25476a";

function SchoolAvatar({ name, size = 46 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.27, background: "linear-gradient(135deg, #1a3550, #25476a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 2px 8px rgba(37,71,106,0.25)" }}>
      {name?.[0]?.toUpperCase() || "S"}
    </div>
  );
}

// A school-type-hub card for the "pick a school first" entry point shared by
// Classes/Teachers/Learners. Clicking anywhere on the card drills into that school's scoped
// list for the module. Classes/Teachers/Learners still only attach to school-type hubs, so
// every caller of this component must already have filtered its list down to hubType
// "school" before rendering these cards.
export default function SchoolPickerCard({ school, icon, count, countLabel, subStat, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#ffffff", borderRadius: 16, cursor: "pointer",
        boxShadow: hovered ? "0 8px 24px rgba(37,71,106,0.12), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        display: "flex", flexDirection: "column", overflow: "hidden",
        transition: "box-shadow 0.2s, transform 0.2s",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <SchoolAvatar name={school.name} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: "0 0 3px", fontSize: 15, fontWeight: 700, color: hovered ? ACCENT : "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.15s" }}>
              {school.name}
            </h3>
            <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>
              {school.address?.county ? `${school.address.county} County` : "No location set"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, backgroundColor: count > 0 ? "#e8f5fb" : "#F9FAFB", border: `1px solid ${count > 0 ? "#a8d5ee" : "#E5E7EB"}` }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: count > 0 ? ACCENT : "#9CA3AF", lineHeight: 1 }}>{count}</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6B7280" }}>
              {countLabel}{subStat ? ` · ${subStat}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: "10px 22px", borderTop: "1px solid #F3F4F6", backgroundColor: "#FAFBFF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#38aae1", display: "flex", alignItems: "center", gap: 4 }}>
          View
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </span>
      </div>
    </div>
  );
}
