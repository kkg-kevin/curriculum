import { FiAward, FiFileText } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle, PreviewTag } from "./theme";

const SAMPLE_BADGES = ["Code Master", "AI Explorer", "Problem Solver", "Team Player"];

export default function BadgesCertificatesCard() {
  return (
    <div style={{ ...cardStyle(), padding: 20, flex: 1, minWidth: 260, display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={sectionHeaderStyle()}>Badges & Achievements</h2>
          <PreviewTag />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {SAMPLE_BADGES.map((b) => (
            <div key={b} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: 68, opacity: 0.5 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, display: "flex", alignItems: "center", justifyContent: "center", color: T.accent }}>
                <FiAward size={20} />
              </div>
              <p style={{ margin: 0, fontSize: 10, textAlign: "center", color: T.inkMuted, lineHeight: 1.2 }}>{b}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
        <h2 style={{ ...sectionHeaderStyle(), marginBottom: 12 }}>Certificates</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: 0.5 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", color: T.inkFaint, flexShrink: 0 }}>
            <FiFileText size={18} />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>No certificates issued yet.</p>
        </div>
      </div>
    </div>
  );
}
