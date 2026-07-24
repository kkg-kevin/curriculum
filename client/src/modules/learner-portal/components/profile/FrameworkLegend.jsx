import { FiAward, FiBookOpen, FiClipboard, FiFileText, FiLayers, FiMapPin, FiTrendingUp, FiUsers } from "react-icons/fi";
import { T } from "./theme";

const ITEMS = [
  { icon: FiLayers,    label: "Curriculum",    sub: "Defines what is learned" },
  { icon: FiAward,     label: "Competencies",  sub: "Define what learners can do" },
  { icon: FiTrendingUp,label: "Indicators",    sub: "Show mastery at each level" },
  { icon: FiBookOpen,  label: "Courses",       sub: "Learning journeys" },
  { icon: FiFileText,  label: "Lessons",       sub: "Daily learning experiences" },
  { icon: FiClipboard, label: "Assessments",   sub: "Measure growth & mastery" },
  { icon: FiUsers,     label: "Teachers",      sub: "Guide, coach, mentor" },
  { icon: FiMapPin,    label: "Learning Hubs", sub: "Where learning happens" },
];

export default function FrameworkLegend() {
  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", gap: "18px 28px",
        padding: "16px 20px", borderTop: `1px solid ${T.border}`,
        backgroundColor: "#fff", borderRadius: 16,
      }}
    >
      {ITEMS.map(({ icon: Icon, label, sub }) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 150 }}>
          <div style={{ color: T.accentMid, flexShrink: 0 }}>
            <Icon size={18} />
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
