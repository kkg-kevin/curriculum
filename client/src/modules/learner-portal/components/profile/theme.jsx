export const T = {
  accent: "#25476a",
  accentDeep: "#1a3550",
  accentMid: "#2e7db5",
  accentLight: "#38aae1",
  tintBg: "#e8f5fb",
  tintBorder: "#a8d5ee",
  ink: "#111827",
  inkMuted: "#6B7280",
  inkFaint: "#9CA3AF",
  border: "#E5E7EB",
  gold: "#feb139",
};

export function cardStyle(extra = {}) {
  return {
    backgroundColor: "#fff",
    borderRadius: 16,
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    border: `1px solid ${T.border}`,
    ...extra,
  };
}

export function sectionHeaderStyle() {
  return {
    margin: 0,
    fontSize: 11,
    fontWeight: 700,
    color: T.accentLight,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  };
}

// Small tag used on every section that isn't backed by real per-learner data yet — keeps
// mock content from ever being mistaken for a fact about this specific learner.
export function PreviewTag() {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "#92400E",
        backgroundColor: "#FFFBEB",
        border: "1px solid #FDE68A",
      }}
    >
      Preview
    </span>
  );
}

export function NotOnRecord({ children = "Not on record" }) {
  return <span style={{ color: T.inkFaint, fontStyle: "italic" }}>{children}</span>;
}
