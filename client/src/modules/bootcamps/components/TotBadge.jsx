import { FiUsers } from "react-icons/fi";

// Marks a TOT (training of trainers) bootcamp — `audience` "educators" — wherever bootcamps are
// listed or shown. Renders nothing for a learners' bootcamp. `onDark` for the bootcamp page's
// dark header.
export const isTotBootcamp = (bootcamp) => bootcamp?.audience === "educators";

export default function TotBadge({ bootcamp, onDark = false, style }) {
  if (!isTotBootcamp(bootcamp)) return null;
  return (
    <span
      title="Training of trainers — for educators"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        color: onDark ? "#fff" : "#6D28D9",
        backgroundColor: onDark ? "rgba(255,255,255,0.18)" : "#F3E8FF",
        border: onDark ? "1px solid rgba(255,255,255,0.35)" : "1px solid #E9D5FF",
        ...style,
      }}
    >
      <FiUsers size={11} strokeWidth={2.5} /> TOT · Educators
    </span>
  );
}
