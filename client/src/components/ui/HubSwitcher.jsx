// Scopes the whole teacher-portal session to one assigned hub at a time. Renders nothing for
// the common case of a teacher assigned to a single hub — no clutter when there's no real
// choice to make.
export default function HubSwitcher({ hubs, selectedHubId, onChange }) {
  if (!hubs || hubs.length <= 1) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", fontFamily: "Inter, sans-serif" }}>Viewing:</span>
      <select
        value={selectedHubId || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "8px 30px 8px 12px", borderRadius: 10, border: "1.5px solid #a8d5ee",
          backgroundColor: "#e8f5fb", color: "#25476a", fontSize: 13, fontWeight: 700,
          fontFamily: "Inter, sans-serif", cursor: "pointer", appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 12 12'%3E%3Cpath fill='%2325476a' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
        }}
      >
        {hubs.map((h) => (
          <option key={h.id} value={h.id}>{h.name}</option>
        ))}
      </select>
    </div>
  );
}
