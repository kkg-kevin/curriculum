import { FiCompass, FiCreditCard, FiEdit2, FiGift, FiGlobe, FiLayers, FiMessageCircle, FiStar, FiTag, FiUser } from "react-icons/fi";
import { T, KID, heroGradient } from "./theme";
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

// One fact about the learner as a "sticker" on the banner: an icon, a small label and the value.
function Sticker({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px 8px 8px", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)", border: "1.5px solid rgba(255,255,255,0.28)", minWidth: 0 }}>
      <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: "50%", backgroundColor: "#fff", color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} strokeWidth={2.4} />
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.8)", lineHeight: 1.2 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: "#fff", lineHeight: 1.25, overflowWrap: "anywhere" }}>{value}</p>
      </div>
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
// The age is the date of birth's, else the one given without it ("given" beside it).
export default function ProfileIdentityCard({ learner, stage, band, nextBand, onEdit, extraMeta = [], curriculumId, stageHint, greeting }) {
  const { age, fromBirthDate } = learnerAge(learner);
  const { data: pathways = [] } = usePathway(curriculumId, learner.id);
  const pathwayNames = [...new Set(pathways.map((p) => p.pathwayName).filter(Boolean))];

  const facts = [
    { icon: FiGift, label: "Age", value: age != null ? (fromBirthDate ? age : <>{age} {faded("(given)")}</>) : faded("Not on record") },
    { icon: FiCreditCard, label: "DCF ID", value: learner.registrationNumber || faded("Not on record") },
    { icon: FiGlobe, label: "Nationality", value: learner.nationality || faded("Not on record") },
    { icon: FiMessageCircle, label: "Languages", value: learner.languages || faded("Not on record") },
    { icon: FiUser, label: "Username", value: learner.username || faded("Not on record") },
    ...extraMeta.map((m) => ({ icon: FiTag, label: m.label, value: m.value || faded("Not on record") })),
  ];

  return (
    <div style={{ background: heroGradient(), borderRadius: 26, padding: "28px clamp(18px, 3vw, 32px)", display: "flex", flexDirection: "column", gap: 22, position: "relative", overflow: "hidden" }}>
      {/* playful background shapes */}
      <div aria-hidden="true" style={{ position: "absolute", top: -50, right: -30, width: 200, height: 200, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.10)", pointerEvents: "none" }} />
      <div aria-hidden="true" style={{ position: "absolute", bottom: -60, left: "38%", width: 160, height: 160, borderRadius: "50%", backgroundColor: "rgba(254,177,57,0.16)", pointerEvents: "none" }} />
      <FiStar aria-hidden="true" size={22} color="#feb139" style={{ position: "absolute", top: 20, right: 30, opacity: 0.9, pointerEvents: "none" }} />

      <div style={{ display: "flex", gap: 22, alignItems: "center", position: "relative", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flexShrink: 0, borderRadius: "50%", padding: 5, background: "linear-gradient(135deg, #feb139, #38aae1)" }}>
          <Avatar firstName={learner.firstName} lastName={learner.lastName} photo={learner.photo} size={100} borderColor="#fff" />
          {onEdit && <button
            type="button"
            onClick={onEdit}
            aria-label="Edit profile"
            title="Edit profile"
            style={{
              position: "absolute", bottom: 0, right: 0, width: 36, height: 36, borderRadius: "50%",
              backgroundColor: T.gold, border: "3px solid #fff", color: T.accentDeep, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
            }}
          >
            <FiEdit2 size={15} />
          </button>}
        </div>

        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>{greeting || "Learner profile"}</p>
          <h1 style={{ margin: 0, fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {learner.firstName} {learner.lastName}
          </h1>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, position: "relative" }}>
        {facts.map((f) => <Sticker key={f.label} {...f} />)}
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
