import { FiCompass, FiCreditCard, FiEdit2, FiGift, FiGlobe, FiLayers, FiMessageCircle, FiStar, FiTag, FiUser } from "react-icons/fi";
import { T, KID, GLASS, heroGradient } from "./theme";
import Avatar from "../../../../components/ui/Avatar";
import { formatAgeRange } from "../../utils/ageRange";
import { currentLevelName, levelCaption } from "../../utils/bandJourney";
import { usePathway } from "../../../curriculum/hooks/useCompetencies";
import { learnerAge } from "../../../../utils/learnerAge";

// Still exported — GuardianProfileCard uses it too, on a light card. A label, then its value, in
// plain readable sizes (no tiny spaced-out capitals).
export function MetaRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: "0 0 2px", fontSize: 12.5, fontWeight: 700, color: T.inkMuted }}>{label}</p>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.ink, overflowWrap: "anywhere" }}>{value}</p>
    </div>
  );
}

// One fact about the learner in the details card: a small icon, the label, the value.
function Fact({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.14)", color: "#FDE3B0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} strokeWidth={2.4} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.72)", lineHeight: 1.2 }}>{label}</p>
        <p style={{ margin: "1px 0 0", fontSize: 14, fontWeight: 800, color: "#fff", lineHeight: 1.25, overflowWrap: "anywhere" }}>{value}</p>
      </div>
    </div>
  );
}

// Facts about the record rather than the learner (how they joined, when it was added): the details
// card's footer, smaller, under a line.
function RecordLine({ items }) {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px", marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.16)", fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
      {items.map((m) => (
        <span key={m.label} style={{ display: "inline-flex", alignItems: "baseline", gap: 6, minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.65)" }}>{m.label}</span>
          <span style={{ fontWeight: 800, color: "#fff", overflowWrap: "anywhere" }}>{m.value}</span>
        </span>
      ))}
    </div>
  );
}

const faded = (text) => <span style={{ opacity: 0.7, fontStyle: "italic", fontWeight: 600 }}>{text}</span>;

// The three things a learner most wants to know about themselves — their stage, pathway and level —
// as bright white cards with a big icon, sitting on the banner.
function StatusCard({ icon: Icon, tone, eyebrow, value, sub }) {
  return (
    <div style={{ backgroundColor: "#fff", borderRadius: 20, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", minWidth: 200, flex: 1, boxShadow: "0 8px 22px rgba(15, 40, 80, 0.18)" }}>
      <span aria-hidden="true" style={{ width: 46, height: 46, borderRadius: 15, color: tone.color, backgroundColor: tone.soft, border: `1.5px solid ${tone.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={22} strokeWidth={2.3} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: tone.color }}>{eyebrow}</p>
        <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 900, color: T.ink, lineHeight: 1.25 }}>{value}</p>
        {sub && <p style={{ margin: "3px 0 0", fontSize: 12.5, fontWeight: 600, color: T.inkMuted, lineHeight: 1.4 }}>{sub}</p>}
      </div>
    </div>
  );
}

// The learner's banner at the top of their profile: photo, name, a few facts as stickers, and their
// stage / pathway / level cards. Current Level Summary reads exactly like the Progress Arc card
// below (currentLevelName / levelCaption in bandJourney.js).
// No `onEdit`, no pencil (staff previewing the learner's view). `extraMeta` — [{ label, value }]
// added after the learner's own facts; the staff learner page's record details.
// `curriculumId` — the selected hub's curriculum, for the pathways the learner is on there (the
// same list as the Pathway tab, CompetencyService.getPathway). `stageHint` — why there's no stage
// yet (utils/learnerAge.js's stagePendingReason), shown under "Not yet placed".
// `greeting` — the learner's own page says hello ("Hi, Amara!"); others show "Learner profile".
// `extraMeta` items with `record: true` go in the details card's footer instead.
// `activity` — the assessment activity graph (AssessmentActivity), top right of the banner.
// The age is the date of birth's, else the one given without it ("given" beside it).
export default function ProfileIdentityCard({ learner, stage, band, nextBand, onEdit, extraMeta = [], curriculumId, stageHint, greeting, activity }) {
  const { age, fromBirthDate } = learnerAge(learner);
  const { data: pathways = [] } = usePathway(curriculumId, learner.id);
  const pathwayNames = [...new Set(pathways.map((p) => p.pathwayName).filter(Boolean))];

  const facts = [
    { icon: FiGift, label: "Age", value: age != null ? (fromBirthDate ? age : <>{age} {faded("(given)")}</>) : faded("Not on record") },
    { icon: FiCreditCard, label: "DCF ID", value: learner.registrationNumber || faded("Not on record") },
    { icon: FiGlobe, label: "Nationality", value: learner.nationality || faded("Not on record") },
    { icon: FiMessageCircle, label: "Languages", value: learner.languages || faded("Not on record") },
    { icon: FiUser, label: "Username", value: learner.username || faded("Not on record") },
    ...extraMeta.filter((m) => !m.record).map((m) => ({ icon: m.icon || FiTag, label: m.label, value: m.value || faded("Not on record") })),
  ];
  const recordFacts = extraMeta.filter((m) => m.record && m.value);

  return (
    <div style={{ background: heroGradient(), borderRadius: 26, padding: "28px clamp(18px, 3vw, 32px)", display: "flex", flexDirection: "column", gap: 20, position: "relative", overflow: "hidden" }}>
      {/* playful background shapes */}
      <div aria-hidden="true" style={{ position: "absolute", top: -50, right: -30, width: 200, height: 200, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.10)", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", bottom: -60, left: "38%", width: 160, height: 160, borderRadius: "50%", backgroundColor: "rgba(254,177,57,0.16)", pointerEvents: "none" }} />
      {!activity && <FiStar aria-hidden="true" size={22} color="#feb139" style={{ position: "absolute", top: 20, right: 30, opacity: 0.9, pointerEvents: "none" }} />}

      {/* Top: two matching cards — who they are (photo, name, details) and their year of assessments. */}
      <div style={{ display: "flex", gap: 16, alignItems: "stretch", position: "relative", flexWrap: "wrap" }}>
        <section aria-label="About the learner" style={{ ...GLASS, flex: "1 1 420px", minWidth: 0, padding: "18px 18px 16px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flexShrink: 0, borderRadius: "50%", padding: 4, background: "linear-gradient(135deg, #feb139, #38aae1)" }}>
              <Avatar firstName={learner.firstName} lastName={learner.lastName} photo={learner.photo} size={84} borderColor="#fff" />
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  aria-label="Edit profile"
                  title="Edit profile"
                  style={{
                    position: "absolute", bottom: -2, right: -2, width: 34, height: 34, borderRadius: "50%",
                    backgroundColor: T.gold, border: "3px solid #fff", color: T.accentDeep, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
                  }}
                >
                  <FiEdit2 size={14} />
                </button>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <p style={{ margin: "0 0 3px", fontSize: 16, fontWeight: 900, color: "rgba(255,255,255,0.9)" }}>{greeting || "Learner profile"}</p>
              <h1 style={{ margin: 0, fontSize: "clamp(24px, 3.4vw, 32px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                {learner.firstName} {learner.lastName}
              </h1>
            </div>
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.16)", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 130px), 1fr))", gap: "14px 12px" }}>
            {facts.map((f) => <Fact key={f.label} {...f} />)}
          </div>

          <RecordLine items={recordFacts} />
        </section>

        {activity && <div style={{ flex: "1 1 560px", minWidth: 0, maxWidth: "100%", display: "flex" }}>{activity}</div>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, position: "relative" }}>
        <StatusCard
          icon={FiLayers}
          tone={KID.navy}
          eyebrow="Developmental stage"
          value={stage?.name || "Not yet placed"}
          sub={stage ? (formatAgeRange(stage.minAge, stage.maxAge) ? `(${formatAgeRange(stage.minAge, stage.maxAge)})` : null) : (stageHint || "Set by a teacher or admin")}
        />
        <StatusCard
          icon={FiCompass}
          tone={KID.sky}
          eyebrow={pathwayNames.length > 1 ? "Pathways" : "Pathway"}
          value={pathwayNames.length ? pathwayNames.join(", ") : "Not on a pathway yet"}
          sub={pathwayNames.length ? null : stage ? "No pathway set up for this stage yet" : "Follows the developmental stage"}
        />
        <StatusCard
          icon={FiStar}
          tone={KID.gold}
          eyebrow={greeting ? "My level" : "Current level"}
          value={currentLevelName(band, nextBand)}
          sub={levelCaption(band, nextBand)}
        />
      </div>
    </div>
  );
}
