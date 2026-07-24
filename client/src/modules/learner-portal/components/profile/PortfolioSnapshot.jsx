import { T, cardStyle, sectionHeaderStyle, PreviewTag } from "./theme";

function Stat({ value, label, isReal }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: isReal ? T.accent : T.inkFaint }}>{value}</p>
      <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>{label}</p>
    </div>
  );
}

export default function PortfolioSnapshot({ coursesCompleted }) {
  return (
    <div style={{ ...cardStyle(), padding: 20, flex: 1, minWidth: 220 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={sectionHeaderStyle()}>Portfolio Snapshot</h2>
        <PreviewTag />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px 12px" }}>
        <Stat value="—" label="Competencies On Track" />
        <Stat value="—" label="Evidence Items Collected" />
        <Stat value={coursesCompleted} label="Courses Completed" isReal />
        <Stat value="—" label="Badges Earned" />
      </div>
    </div>
  );
}
