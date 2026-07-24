import { FiEdit2, FiStar, FiZap } from "react-icons/fi";
import { T, cardStyle, NotOnRecord } from "./theme";
import Avatar from "../../../../components/ui/Avatar";

function MetaRow({ label, value }) {
  return (
    <div>
      <p style={{ margin: "0 0 1px", fontSize: 11, fontWeight: 600, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13.5, color: T.ink }}>{value}</p>
    </div>
  );
}

function StatusPill({ eyebrow, value, sub, icon }) {
  return (
    <div style={{ ...cardStyle(), padding: "12px 16px", display: "flex", flexDirection: "column", gap: 4, minWidth: 150, flex: 1 }}>
      <p style={{ margin: 0, fontSize: 10.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: "0.05em" }}>{eyebrow}</p>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.accent, display: "flex", alignItems: "center", gap: 6 }}>
        {icon}{value}
      </p>
      {sub && <p style={{ margin: 0, fontSize: 11.5, color: T.inkMuted }}>{sub}</p>}
    </div>
  );
}

// DCF ID is a real, deterministic value derived from this learner's actual record (creation
// year + a slice of their real database id) — not a fabricated external registry number, just
// a friendlier display format for data that already exists.
function deriveDcfId(learner) {
  if (!learner?.id) return null;
  const year = learner.createdAt ? new Date(learner.createdAt).getFullYear() : new Date().getFullYear();
  return `DCF-${year}-${learner.id.replace(/-/g, "").slice(0, 5).toUpperCase()}`;
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

export default function ProfileIdentityCard({ learner, stage, onEdit }) {
  const dcfId = deriveDcfId(learner);
  const age = computeAge(learner.dateOfBirth);

  return (
    <div style={{ ...cardStyle(), padding: 24, display: "flex", flexDirection: "column", gap: 20, flex: 2, minWidth: 320 }}>
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Avatar firstName={learner.firstName} lastName={learner.lastName} size={96} />
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit profile"
            title="Edit profile"
            style={{
              position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: "50%",
              backgroundColor: T.accent, border: "3px solid #fff", color: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <FiEdit2 size={12} />
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: T.ink, letterSpacing: "-0.3px" }}>
            {learner.firstName} {learner.lastName}
          </h1>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px 20px" }}>
            <MetaRow label="Age" value={age != null ? age : <NotOnRecord />} />
            <MetaRow label="DCF ID" value={dcfId || <NotOnRecord />} />
            <MetaRow label="Nationality" value={learner.nationality || <NotOnRecord />} />
            <MetaRow label="Languages" value={learner.languages || <NotOnRecord />} />
            <MetaRow label="Username" value={learner.username || <NotOnRecord />} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <StatusPill
          eyebrow="Developmental Academy"
          value={stage?.name || "Not yet placed"}
          sub={stage?.ageRange ? `(${stage.ageRange})` : "Set by a teacher or admin"}
        />
        <StatusPill eyebrow="Current Level Summary" value="Not yet available" icon={<FiStar size={13} />} />
        <StatusPill eyebrow="Learning Streak" value="Not tracked yet" icon={<FiZap size={13} />} />
      </div>
    </div>
  );
}
