import { useNavigate } from "react-router-dom";

export default function Breadcrumbs({ items }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {i > 0 && <span style={{ color: "#D1D5DB", fontSize: "13px" }}>/</span>}
            {item.to && !isLast ? (
              <button
                type="button"
                onClick={() => navigate(item.to)}
                style={{ background: "none", border: "none", padding: 0, color: "#6B7280", fontSize: "13px", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                {item.label}
              </button>
            ) : (
              <span style={{ fontSize: "13px", color: isLast ? "#111827" : "#6B7280", fontWeight: isLast ? "500" : "400" }}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
