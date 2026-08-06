import { FiAward } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle, EmptyState } from "./theme";
import { iconFor } from "./competencyIcons";
import { useLearnerCompetencyScores } from "../../../curriculum/hooks/useCompetencies";

// Same curriculum-weighted band shown on the Competencies tab (BandBadge there) — kept here as
// its own small component rather than shared, matching this codebase's per-file badge pattern.
function BandBadge({ band }) {
  if (!band) return null;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, backgroundColor: T.tintBg, border: `1px solid ${T.tintBorder}`, borderRadius: 20, padding: "1px 7px", whiteSpace: "nowrap" }}>
      {band.name}
    </span>
  );
}

export default function CompetencyProgressGrid({ competencies, isLoading, learnerId, curriculumId }) {
  const items = (competencies || []).slice(0, 8);
  // The curriculum's own weighted score (Evidence Type → Assessment Type → scoring engines,
  // configured on the curriculum's Score Evidence panel) — the only source of truth for a
  // competency's percent. Do not reintroduce a client-side average of raw indicator marks here;
  // that bypasses the curriculum's configured weighting entirely.
  const { data: scoreRows = [] } = useLearnerCompetencyScores(curriculumId, learnerId);
  const scoreByCompetencyId = new Map(scoreRows.map((r) => [r.competencyId, r]));

  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <h2 style={{ ...sectionHeaderStyle(), marginBottom: 16 }}>Competency Progress</h2>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState icon={FiAward}>No competencies adopted on this learner's curriculum yet.</EmptyState>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {items.map((c) => {
            const Icon = iconFor(c.name);
            const scoreEntry = scoreByCompetencyId.get(c.id);
            const percent = scoreEntry?.score ?? null;
            return (
              <div key={c.id} style={{ border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: T.tintBg, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={16} />
                </div>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: T.ink, lineHeight: 1.3, minHeight: 32 }}>{c.name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: percent == null ? T.inkFaint : percent >= 60 ? "#059669" : "#DC2626" }}>
                    {percent == null ? "Not yet scored" : `${percent}%`}
                  </p>
                  <BandBadge band={scoreEntry?.band} />
                </div>
                <div style={{ height: 6, borderRadius: 4, backgroundColor: "#F3F4F6", overflow: "hidden" }}>
                  <div style={{ width: `${percent || 0}%`, height: "100%", backgroundColor: percent == null ? T.tintBorder : percent >= 60 ? "#059669" : "#DC2626" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
