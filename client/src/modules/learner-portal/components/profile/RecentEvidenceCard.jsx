import { FiFileText } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle, PreviewTag } from "./theme";

const SAMPLE_EVIDENCE = [
  { title: "Traffic Light with Sensors", type: "Robotics Project" },
  { title: "AI Chatbot Prototype", type: "AI Project" },
  { title: "Data Analysis Project", type: "Data Literacy Assignment" },
];

export default function RecentEvidenceCard() {
  return (
    <div style={{ ...cardStyle(), padding: 20, flex: 1, minWidth: 260 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={sectionHeaderStyle()}>Recent Evidence</h2>
        <PreviewTag />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {SAMPLE_EVIDENCE.map((e) => (
          <div key={e.title} style={{ display: "flex", gap: 10, opacity: 0.6 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: "#F3F4F6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkFaint }}>
              <FiFileText size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</p>
              <p style={{ margin: 0, fontSize: 11.5, color: T.inkMuted }}>{e.type}</p>
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: "14px 0 0", fontSize: 11.5, color: T.inkFaint, lineHeight: 1.5 }}>
        Evidence portfolio isn't wired up yet — this will show real project work, submissions, and artifacts once that feature ships.
      </p>
    </div>
  );
}
