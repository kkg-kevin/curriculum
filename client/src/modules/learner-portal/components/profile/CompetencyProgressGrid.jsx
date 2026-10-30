import { T, KID, cardStyle, KidHeading, EmptyState } from "./theme";

const TILE_TONES = [KID.sky, KID.navy, KID.gold];
import { iconFor } from "./competencyIcons";
import { useLearnerCompetencyScores } from "../../../curriculum/hooks/useCompetencies";
import { FiStar, FiTrendingUp } from "react-icons/fi";

// Same curriculum-weighted band shown on the Competencies tab (BandBadge there) — kept here as
// its own small component rather than shared, matching this codebase's per-file badge pattern.
function BandBadge({ band }) {
  if (!band) return null;
  return (
    <span style={{ fontSize: 11.5, fontWeight: 800, color: KID.navy.color, backgroundColor: "#fff", border: `1.5px solid ${KID.navy.border}`, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
      <FiStar size={11} strokeWidth={2.6} style={{ verticalAlign: "-1px", marginRight: 3 }} />{band.name}
    </span>
  );
}

// `hubId` — the hub shown: its stage decides the bands.
export default function CompetencyProgressGrid({ competencies, isLoading, learnerId, curriculumId, hubId }) {
  const items = (competencies || []).slice(0, 8);
  // The curriculum's own weighted score (Evidence Type → Assessment Type → scoring engines,
  // configured on the curriculum's Score Evidence panel) — the only source of truth for a
  // competency's percent. Do not reintroduce a client-side average of raw indicator marks here;
  // that bypasses the curriculum's configured weighting entirely.
  const { data: scoreRows = [] } = useLearnerCompetencyScores(curriculumId, learnerId, hubId);
  const scoreByCompetencyId = new Map(scoreRows.map((r) => [r.competencyId, r]));

  return (
    <div style={{ ...cardStyle(), padding: 20 }}>
      <KidHeading icon={FiTrendingUp} tone={KID.navy} sub="How you're doing in each skill.">Competency Progress</KidHeading>

      {isLoading ? (
        <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center", padding: "20px 0" }}>Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState icon={FiTrendingUp}>No skills to show yet — they appear once your curriculum adds them.</EmptyState>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
          {items.map((c, i) => {
            const Icon = iconFor(c.name);
            const tone = TILE_TONES[i % TILE_TONES.length];
            // Not there yet reads as "keep going" (sunny), never as a red failure, for a young learner.
            const scoreEntry = scoreByCompetencyId.get(c.id);
            const percent = scoreEntry?.score ?? null;
            const barColor = percent == null ? T.border : percent >= 60 ? KID.sky.fill : KID.gold.fill;
            return (
              <div key={c.id} style={{ border: `1.5px solid ${tone.border}`, backgroundColor: tone.soft, borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", color: tone.color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.06)" }}>
                  <Icon size={19} />
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.ink, lineHeight: 1.3, minHeight: 36 }}>{c.name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <p style={{ margin: 0, fontSize: percent == null ? 12.5 : 16, fontWeight: 900, color: percent == null ? T.inkFaint : percent >= 60 ? KID.sky.color : KID.gold.color }}>
                    {percent == null ? "Not started yet" : `${percent}%`}
                  </p>
                  <BandBadge band={scoreEntry?.band} />
                </div>
                <div style={{ height: 10, borderRadius: 999, backgroundColor: "#fff", overflow: "hidden", border: `1px solid ${tone.border}` }}>
                  <div style={{ width: `${percent || 0}%`, height: "100%", borderRadius: 999, backgroundColor: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
