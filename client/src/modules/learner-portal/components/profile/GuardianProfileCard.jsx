import { FiEdit2, FiUsers } from "react-icons/fi";
import { T, KID, cardStyle, KidHeading, NotOnRecord } from "./theme";
import { MetaRow } from "./ProfileIdentityCard";

// The guardian's own contact profile — deliberately separate from ProfileIdentityCard (the
// learner's own identity) now that the learner can have its own login distinct from the
// guardian's (see auth.service.js's setOrCreatePasswordByUsername). Always shown alongside it
// regardless of which of the two logins is currently active.
// `onOpenParent` (the staff learner page only): a link to its Parent tab — the parent's login, their
// other children, sign-ups and activity.
export default function GuardianProfileCard({ learner, onEdit, onOpenParent }) {
  return (
    <div style={{ ...cardStyle(), padding: 24, display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 260 }}>
      <KidHeading icon={FiUsers} tone={KID.navy} action={onEdit && <button
          type="button"
          onClick={onEdit}
          aria-label="Edit guardian profile"
          title="Edit guardian profile"
          style={{
            width: 36, height: 36, borderRadius: "50%",
            backgroundColor: KID.navy.color, border: "none", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <FiEdit2 size={15} />
        </button>}>Guardian Profile</KidHeading>

      <div style={{ display: "grid", gap: 14, padding: "14px 16px", borderRadius: 16, backgroundColor: KID.navy.soft }}>
        <MetaRow label="Guardian Name" value={learner.guardianName || <NotOnRecord />} />
        <MetaRow label="Guardian Phone" value={learner.guardianPhone || <NotOnRecord />} />
        <MetaRow label="Guardian Email" value={learner.guardianEmail || <NotOnRecord />} />
      </div>

      {onOpenParent && (
        <button
          type="button"
          onClick={onOpenParent}
          style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `2px solid ${KID.navy.color}`, background: "#fff", color: KID.navy.color, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          Parent's login, other children &amp; activity →
        </button>
      )}
    </div>
  );
}
