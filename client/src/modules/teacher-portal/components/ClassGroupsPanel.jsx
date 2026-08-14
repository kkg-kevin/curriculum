import { useState } from "react";
import { FiPlus, FiTrash2, FiX, FiUsers } from "react-icons/fi";
import {
  useClassGroups,
  useCreateClassGroup,
  useRenameClassGroup,
  useDeleteClassGroup,
  useAddGroupMember,
  useRemoveGroupMember,
} from "../../classes/hooks/useClassGroups";

const T = { accent: "#25476a", accentMid: "#2e7db5", tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB" };
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", overflow: "hidden" };

function MemberChip({ member, onRemove }) {
  const initials = `${member.firstName?.[0] ?? ""}${member.lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px 4px 4px", backgroundColor: "#FAFBFF", border: `1px solid ${T.border}`, borderRadius: 20 }}>
      <span style={{ width: 22, height: 22, borderRadius: "50%", background: `linear-gradient(135deg, ${T.accent}, ${T.accentMid})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
        {initials || "?"}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: T.ink }}>{member.firstName} {member.lastName}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} title="Remove from group" style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex", color: T.inkFaint }}>
          <FiX size={12} />
        </button>
      )}
    </span>
  );
}

// One group's card — rename inline (click the name), remove a member (x on their chip), add a
// still-ungrouped learner via the picker. Reused across groups, so adding one learner here
// removes them from `ungroupedLearners` in the next query invalidation, keeping every other
// group's picker in sync automatically.
function GroupCard({ classId, group, ungroupedLearners }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [pickerLearnerId, setPickerLearnerId] = useState("");
  const rename = useRenameClassGroup();
  const del = useDeleteClassGroup();
  const addMember = useAddGroupMember();
  const removeMember = useRemoveGroupMember();

  const handleRename = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== group.name) rename.mutate({ id: group.id, name: trimmed, classId });
    else setName(group.name);
    setRenaming(false);
  };

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            style={{ fontSize: 13, fontWeight: 700, color: T.ink, border: `1.5px solid ${T.tintBorder}`, borderRadius: 8, padding: "4px 8px", flex: 1, fontFamily: "Inter, sans-serif" }}
          />
        ) : (
          <p onClick={() => setRenaming(true)} title="Click to rename" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: T.ink, cursor: "text", flex: 1 }}>{group.name}</p>
        )}
        <span style={{ fontSize: 11, color: T.inkFaint, whiteSpace: "nowrap" }}>{group.members.length} member{group.members.length === 1 ? "" : "s"}</span>
        <button
          type="button"
          onClick={() => { if (window.confirm(`Delete "${group.name}"?`)) del.mutate({ id: group.id, classId }); }}
          disabled={del.isPending}
          title="Delete group"
          style={{ border: "none", background: "none", cursor: "pointer", padding: 4, display: "flex", color: "#DC2626" }}
        >
          <FiTrash2 size={14} />
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {group.members.length === 0 ? (
          <span style={{ fontSize: 12, color: T.inkFaint }}>No learners yet.</span>
        ) : (
          group.members.map((m) => (
            <MemberChip key={m.id} member={m} onRemove={() => removeMember.mutate({ groupId: group.id, learnerId: m.id, classId })} />
          ))
        )}
      </div>

      {ungroupedLearners.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={pickerLearnerId}
            onChange={(e) => setPickerLearnerId(e.target.value)}
            style={{ flex: 1, fontSize: 12, padding: "6px 8px", borderRadius: 8, border: `1px solid ${T.border}`, color: T.ink, fontFamily: "Inter, sans-serif" }}
          >
            <option value="">Add a learner…</option>
            {ungroupedLearners.map((l) => (
              <option key={l.id} value={l.id}>{l.firstName} {l.lastName}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { if (pickerLearnerId) { addMember.mutate({ groupId: group.id, learnerId: pickerLearnerId, classId }); setPickerLearnerId(""); } }}
            disabled={!pickerLearnerId || addMember.isPending}
            style={{ padding: "6px 12px", backgroundColor: T.tintBg, color: T.accent, border: `1.5px solid ${T.tintBorder}`, borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: pickerLearnerId ? "pointer" : "not-allowed" }}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// Reusable class-level group management — set up once per class, reused across every
// group-mode assessment issued to that class (not recreated per assessment).
export default function ClassGroupsPanel({ classId }) {
  const { data, isLoading } = useClassGroups(classId);
  const groups = data?.groups || [];
  const ungroupedLearners = data?.ungroupedLearners || [];
  const createGroup = useCreateClassGroup();
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createGroup.mutate({ classId, name }, { onSuccess: () => setNewName("") });
  };

  return (
    <div style={cardStyle}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FiUsers style={{ color: T.accent }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.ink }}>Groups</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="New group name"
            style={{ fontSize: 12.5, padding: "7px 10px", borderRadius: 8, border: `1px solid ${T.border}`, minWidth: 160, fontFamily: "Inter, sans-serif" }}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || createGroup.isPending}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: newName.trim() ? "pointer" : "not-allowed" }}
          >
            <FiPlus size={14} /> New Group
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 18px" }}>
        {isLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center" }}>Loading groups…</p>
        ) : groups.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: T.inkFaint, textAlign: "center" }}>
            No groups yet. Create one above, then add learners for group-based assessments.
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {groups.map((g) => (
              <GroupCard key={g.id} classId={classId} group={g} ungroupedLearners={ungroupedLearners} />
            ))}
          </div>
        )}

        {!isLoading && ungroupedLearners.length > 0 && groups.length > 0 && (
          <div style={{ marginTop: 14, padding: "10px 12px", backgroundColor: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10 }}>
            <p style={{ margin: 0, fontSize: 12, color: "#92400E" }}>
              {ungroupedLearners.length} learner{ungroupedLearners.length === 1 ? "" : "s"} not yet in a group: {ungroupedLearners.map((l) => `${l.firstName} ${l.lastName}`).join(", ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
