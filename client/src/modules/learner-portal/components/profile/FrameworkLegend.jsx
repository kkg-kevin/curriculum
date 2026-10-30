import { T, tintCardStyle } from "./theme";
import { FiAward, FiBookOpen, FiClipboard, FiFileText, FiLayers, FiMapPin, FiTrendingUp, FiUsers } from "react-icons/fi";

// What each word on this page means, in a young learner's words.
const ITEMS = [
  { icon: FiLayers,     label: "Curriculum",    sub: "Everything you'll learn" },
  { icon: FiAward,      label: "Competencies",  sub: "Skills you're growing" },
  { icon: FiTrendingUp, label: "Indicators",    sub: "Small steps inside a skill" },
  { icon: FiBookOpen,   label: "Courses",       sub: "A set of lessons" },
  { icon: FiFileText,   label: "Lessons",       sub: "What you do each day" },
  { icon: FiClipboard,  label: "Assessments",   sub: "Show what you've learned" },
  { icon: FiUsers,      label: "Teachers",      sub: "Help you learn" },
  { icon: FiMapPin,     label: "Learning Hubs", sub: "Where you learn" },
];

// Tinted (see tintCardStyle) rather than plain white — this is an app-wide glossary, not this
// learner's own data, so it deliberately reads as reference material sitting below the real
// profile content above it, not competing with it for the same visual weight.
export default function FrameworkLegend() {
  return (
    <div style={{ ...tintCardStyle({ display: "flex", flexWrap: "wrap", gap: "18px 28px", padding: "20px 22px" }) }}>
      {ITEMS.map(({ icon: Icon, label, sub }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 160 }}>
          <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", border: `1.5px solid ${T.tintBorder}`, color: T.accentMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={18} strokeWidth={2.3} />
          </span>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.ink }}>{label}</p>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: T.inkMuted }}>{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
