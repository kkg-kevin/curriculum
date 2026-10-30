// The learner profile's look — made for young learners (many are 5–12): big rounded cards, chunky
// readable headings with an icon badge, larger text and plain words, all in the system's own
// colours. Shared by the learner's own profile (ProfilePage), the parent's view of a child and the
// staff learner page, so staff see the profile the way the learner does. Presentation only.

export const T = {
  accent: "#25476a",
  accentDeep: "#1a3550",
  accentMid: "#2e7db5",
  accentLight: "#38aae1",
  tintBg: "#EAF6FD",
  tintBorder: "#BFE3F7",
  ink: "#1F2937",
  inkMuted: "#5B6475",
  inkFaint: "#8C94A3",
  border: "#E8ECF4",
  gold: "#feb139",
};

// Accents from the system's own palette — navy, mid blue, sky blue and gold — each card picks one,
// so the page reads as clear blocks without leaving the brand colours. `color` is for icons and
// text on the light `soft` fill; `fill` is the solid colour.
export const KID = {
  sky: { color: "#2e7db5", fill: "#38aae1", soft: "#E8F5FB", border: "#A8D5EE" },
  navy: { color: "#25476a", fill: "#25476a", soft: "#EDF2F8", border: "#C5D4E5" },
  gold: { color: "#B87708", fill: "#feb139", soft: "#FFF5E1", border: "#FDD89A" },
};

// The rounded, friendly font for the learner's own pages (loaded in main.jsx); Inter behind it.
export const KID_FONT = "'Nunito', Inter, sans-serif";

export function cardStyle(extra = {}) {
  return {
    backgroundColor: "#fff",
    borderRadius: 22,
    boxShadow: "0 6px 20px rgba(37, 71, 106, 0.07)",
    border: `1.5px solid ${T.border}`,
    ...extra,
  };
}

// Section headings: big, bold and in plain sentence case — easier for a young reader than tiny
// spaced-out capitals.
export function sectionHeaderStyle() {
  return {
    margin: 0,
    fontSize: 16,
    fontWeight: 800,
    color: T.accentDeep,
    letterSpacing: "-0.01em",
  };
}

// A section heading with its icon in a coloured bubble: <KidHeading icon={FiHome} tone={KID.sky}>…
// `sub` is an optional friendly line underneath; `action` sits at the right.
export function KidHeading({ icon: Icon, tone = KID.sky, children, sub, action, as: Tag = "h2" }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: sub ? 14 : 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {Icon && (
          <span
            aria-hidden="true"
            style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              color: tone.color, backgroundColor: tone.soft, border: `1.5px solid ${tone.border}`,
            }}
          >
            <Icon size={18} strokeWidth={2.4} />
          </span>
        )}
        <div style={{ minWidth: 0 }}>
          <Tag style={sectionHeaderStyle()}>{children}</Tag>
          {sub && <p style={{ margin: "2px 0 0", fontSize: 13, color: T.inkMuted, lineHeight: 1.45 }}>{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

// Small tag used on every section that isn't backed by real per-learner data yet — keeps
// mock content from ever being mistaken for a fact about this specific learner.
export function PreviewTag() {
  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 800,
        color: "#92400E",
        backgroundColor: "#FFF4D6",
        border: "1.5px solid #FFDF8E",
      }}
    >
      Preview
    </span>
  );
}

export function NotOnRecord({ children = "Not on record" }) {
  return <span style={{ color: T.inkFaint, fontStyle: "italic" }}>{children}</span>;
}

// The learner's hero banner — the same navy-to-sky gradient as every other portal's profile.
export function heroGradient() {
  return "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)";
}

// A lighter-weight card for sections that are reference/context rather than this learner's own
// data (the framework legend, supporting rail info) — same shape as cardStyle(), a half-step quieter.
export function tintCardStyle(extra = {}) {
  return {
    backgroundColor: T.tintBg,
    borderRadius: 22,
    border: `1.5px solid ${T.tintBorder}`,
    ...extra,
  };
}

// "Nothing here yet" — an icon and a short, friendly message.
export function EmptyState({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "26px 12px", textAlign: "center" }}>
      {Icon && (
        <div style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: T.tintBg, border: `1.5px solid ${T.tintBorder}`, color: T.accentMid, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={22} />
        </div>
      )}
      <p style={{ margin: 0, fontSize: 14, color: T.inkMuted, maxWidth: 300, lineHeight: 1.5, fontWeight: 600 }}>{children}</p>
    </div>
  );
}
