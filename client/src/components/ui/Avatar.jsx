export default function Avatar({ firstName, lastName, photo, size = 64, borderColor = "#fff" }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  const border = `${Math.max(2, Math.round(size * 0.04))}px solid ${borderColor}`;

  if (photo) {
    return (
      <img
        src={photo}
        alt={`${firstName || ""} ${lastName || ""}`.trim() || "Profile"}
        style={{
          width: size, height: size, borderRadius: "50%", objectFit: "cover",
          border, boxShadow: "0 2px 8px rgba(0,0,0,0.12)", flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #25476a, #2e7db5)",
        border,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.32, fontWeight: 700, color: "#fff", flexShrink: 0,
      }}
    >
      {initials || "?"}
    </div>
  );
}
