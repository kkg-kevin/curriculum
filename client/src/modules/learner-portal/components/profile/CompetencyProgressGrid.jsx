import { T, cardStyle, sectionHeaderStyle, PreviewTag } from "./theme";
import { iconFor } from "./competencyIcons";

export default function CompetencyProgressGrid({ competencies, isLoading }) {
  const items = (competencies || []).slice(0, 8);

  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={sectionHeaderStyle()}>Competency Progress</h2>
        <PreviewTag />
      </div>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>
          No competencies adopted on this learner's curriculum yet.
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {items.map((c) => {
            const Icon = iconFor(c.name);
            return (
              <div key={c.id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: T.tintBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} />
                </div>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.3, minHeight: 32 }}>{c.name}</p>
                <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: T.inkFaint }}>Not yet scored</p>
                <div style={{ height: 6, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
                  <div style={{ width: "0%", height: "100%", backgroundColor: T.tintBorder }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
