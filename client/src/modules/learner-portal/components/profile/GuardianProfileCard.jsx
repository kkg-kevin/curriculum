import { FiEdit2, FiUsers } from "react-icons/fi";
import { T, cardStyle, sectionHeaderStyle, NotOnRecord } from "./theme";
import { MetaRow } from "./ProfileIdentityCard";

// The guardian's own contact profile — deliberately separate from ProfileIdentityCard (the
// learner's own identity) now that the learner can have its own login distinct from the
// guardian's (see auth.service.js's setOrCreatePasswordByUsername). Always shown alongside it
// regardless of which of the two logins is currently active.
export default function GuardianProfileCard({ learner, onEdit }) {
  return (
    <div style={{ ...cardStyle(), borderTop: `3px solid ${T.accentMid}`, padding: 24, display: "flex", flexDirection: "column", gap: 16, flex: 1, minWidth: 260 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: T.tintBg, color: T.accentMid, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FiUsers size={13} />
          </div>
          <p style={sectionHeaderStyle()}>Guardian Profile</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit guardian profile"
          title="Edit guardian profile"
          style={{
            width: 26, height: 26, borderRadius: "50%",
            backgroundColor: T.accent, border: "none", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}
        >
          <FiEdit2 size={12} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <MetaRow label="Guardian Name" value={learner.guardianName || <NotOnRecord />} />
        <MetaRow label="Guardian Phone" value={learner.guardianPhone || <NotOnRecord />} />
        <MetaRow label="Guardian Email" value={learner.guardianEmail || <NotOnRecord />} />
      </div>
    </div>
  );
}
