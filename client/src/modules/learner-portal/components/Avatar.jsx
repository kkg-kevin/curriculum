import { T } from "./profile/theme";

export default function Avatar({ firstName, lastName, size = 64, borderColor = "#fff" }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, ${T.accent}, ${T.accentMid})`,
        border: `${Math.max(2, Math.round(size * 0.04))}px solid ${borderColor}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.32, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}
    >
      {initials || "?"}
    </div>
  );
}
