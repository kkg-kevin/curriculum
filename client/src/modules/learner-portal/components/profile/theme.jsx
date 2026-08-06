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

// Same gradient every other portal's own profile page uses for its hero banner (teacher-portal,
// school-portal) — this page was the one built without it, so cards had nothing to visually
// anchor against. Purely presentational; callers still own their own layout/content.
export function heroGradient() {
  return "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)";
}

// A lighter-weight card variant for sections that are reference/context rather than this
// learner's own data (the framework legend, supporting rail info) — same shape as cardStyle()
// so it still reads as part of the same design system, just visually a half-step quieter.
export function tintCardStyle(extra = {}) {
  return {
    backgroundColor: T.tintBg,
    borderRadius: 16,
    border: `1px solid ${T.tintBorder}`,
    ...extra,
  };
}

// Consistent "nothing here yet" presentation — icon + message — for the several empty states on
// this page, replacing plain centered gray text with something that reads as informative rather
// than broken.
export function EmptyState({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "24px 12px", textAlign: "center" }}>
      {Icon && (
        // White + border rather than the tintBg fill used elsewhere — this needs to read clearly
        // whether it sits on a plain white card or one of tintCardStyle()'s own tinted containers.
        <div style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#fff", border: `1px solid ${T.tintBorder}`, color: T.accentMid, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} />
        </div>
      )}
      <p style={{ margin: 0, fontSize: 12.5, color: T.inkFaint, maxWidth: 260, lineHeight: 1.5 }}>{children}</p>
    </div>
  );
}
