import { FiAward, FiBookOpen, FiClipboard, FiFileText, FiLayers, FiMapPin, FiTrendingUp, FiUsers } from "react-icons/fi";
import { T, tintCardStyle } from "./theme";

const ITEMS = [
  { icon: FiLayers,    label: "Curriculum",    sub: "Defines what is learned" },
  { icon: FiAward,     label: "Competencies",  sub: "Define what learners can do" },
  { icon: FiTrendingUp,label: "Indicators",    sub: "Show mastery at each level" },
  { icon: FiBookOpen,  label: "Courses",       sub: "Multi-lesson learning units" },
  { icon: FiFileText,  label: "Lessons",       sub: "Daily learning experiences" },
  { icon: FiClipboard, label: "Assessments",   sub: "Measure growth & mastery" },
  { icon: FiUsers,     label: "Teachers",      sub: "Guide, coach, mentor" },
  { icon: FiMapPin,    label: "Learning Hubs", sub: "Where learning happens" },
];

// Tinted (see tintCardStyle) rather than plain white — this is an app-wide glossary, not this
// learner's own data, so it deliberately reads as reference material sitting below the real
// profile content above it, not competing with it for the same visual weight.
export default function FrameworkLegend() {
  return (
    <div style={{ ...tintCardStyle({ display: "flex", flexWrap: "wrap", gap: "18px 28px", padding: "16px 20px" }) }}>
      {ITEMS.map(({ icon: Icon, label, sub }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 150 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: "#fff", border: `1px solid ${T.tintBorder}`, color: T.accentMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={16} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink }}>{label}</p>
            <p style={{ margin: 0, fontSize: 11, color: T.inkFaint }}>{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
