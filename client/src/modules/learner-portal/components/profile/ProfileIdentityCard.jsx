import { FiEdit2, FiStar } from "react-icons/fi";
import { T, heroGradient } from "./theme";
import Avatar from "../../../../components/ui/Avatar";

// Unchanged, still exported — GuardianProfileCard uses this too, and it stays on a light card
// (never moves onto the hero gradient below), so its light-background styling is untouched.
export function MetaRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: "0 0 1px", fontSize: 11, fontWeight: 600, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13.5, color: T.ink }}>{value}</p>
    </div>
  );
}

// White-on-gradient sibling of MetaRow above, for use only inside this file's own hero banner —
// kept local (not exported) since nowhere else needs a dark-background meta row.
function HeroMetaRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: "0 0 1px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13.5, color: "#fff" }}>{value}</p>
    </div>
  );
}

function StatusPill({ eyebrow, value, sub, icon }) {
  return (
    <div style={{ backgroundColor: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 14, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 150, flex: 1, backdropFilter: "blur(2px)" }}>
      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{eyebrow}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
        {icon}{value}
      </p>
      {sub && <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>{sub}</p>}
    </div>
  );
}

function computeAge(dateOfBirth) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

// Same gradient-hero treatment teacher-portal/school-portal already use for their own profile
// pages — this was the one profile page in the app still using a plain white card here, which is
// why it read as visually flat next to every other section repeating the same card style.
// "X% to <next band>" when there's a level still ahead, a trophy note when the learner has
// reached the top of the ladder, or a nudge to get started when nothing's been reached yet —
// same motivating framing as the Level Journey card below (both read the same band data via
// deriveBandJourney, so this line can never disagree with what that card shows).
function levelSummarySub(band, nextBand) {
  if (nextBand) return `${nextBand.completion}% of the way to ${nextBand.name}`;
  if (band) return "Highest level reached!";
  return "Complete graded work to begin";
}

export default function ProfileIdentityCard({ learner, stage, band, nextBand, onEdit }) {
  const age = computeAge(learner.dateOfBirth);

  return (
    <div style={{ background: heroGradient(), borderRadius: 20, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 22, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", position: "relative" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar firstName={learner.firstName} lastName={learner.lastName} photo={learner.photo} size={88} borderColor="rgba(255,255,255,0.3)" />
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit profile"
            title="Edit profile"
            style={{
              position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: "50%",
              backgroundColor: "#fff", border: `3px solid ${T.accent}`, color: T.accent, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <FiEdit2 size={12} />
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Learner Profile</p>
          <h1 style={{ margin: "0 0 12px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>
            {learner.firstName} {learner.lastName}
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px 20px" }}>
            <HeroMetaRow label="Age" value={age != null ? age : <span style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>Not on record</span>} />
            <HeroMetaRow label="DCF ID" value={learner.registrationNumber || <span style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>Not on record</span>} />
            <HeroMetaRow label="Nationality" value={learner.nationality || <span style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>Not on record</span>} />
            <HeroMetaRow label="Languages" value={learner.languages || <span style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>Not on record</span>} />
            <HeroMetaRow label="Username" value={learner.username || <span style={{ color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>Not on record</span>} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, position: "relative" }}>
        <StatusPill
          eyebrow="Developmental Academy"
          value={stage?.name || "Not yet placed"}
          sub={stage?.ageRange ? `(${stage.ageRange})` : "Set by a teacher or admin"}
        />
        <StatusPill
          eyebrow="Current Level Summary"
          value={band?.name || "Not yet placed"}
          sub={levelSummarySub(band, nextBand)}
          icon={<FiStar size={13} />}
        />
      </div>
    </div>
  );
}
