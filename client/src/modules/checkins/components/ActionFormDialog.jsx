import { useState } from "react";
import { useCheckinMutation, useCheckinPeople } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import { CATEGORY_LABEL, Modal, PRIORITY, PersonSelect, ghostBtn, hint, input, label, primaryBtn } from "../shared";

// Add an issue (a challenge raised at the check-in) or a follow-up action to a check-in, or change
// one. Each is its own record from the moment it's saved, tracked after the check-in is done.
export default function ActionFormDialog({ sessionId, action, kind = "action", onClose }) {
  const { data: people = [] } = useCheckinPeople();
  const editing = Boolean(action);
  const [form, setForm] = useState(() => ({
    kind: action?.kind || kind,
    title: action?.title || "",
    description: action?.description || "",
    impact: action?.impact || "",
    recurring: Boolean(action?.recurring),
    category: action?.category || "",
    priority: action?.priority || "medium",
    assigneeId: action?.assigneeId || "",
    dueDate: action?.dueDate || "",
  }));
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const isIssue = form.kind === "issue";
  const save = useCheckinMutation(
    (body) => (editing ? checkinsApi.updateAction(action.id, body) : checkinsApi.createAction(sessionId, body)),
    editing ? "Saved" : isIssue ? "Issue added" : "Follow-up added",
  );
  const submit = () => {
    const body = {
      title: form.title.trim(), description: form.description.trim(), impact: isIssue ? form.impact.trim() : "", recurring: isIssue ? form.recurring : false,
      category: form.category, priority: form.priority, assigneeId: form.assigneeId || null, dueDate: form.dueDate || null,
    };
    save.mutate(editing ? body : { ...body, kind: form.kind }, { onSuccess: onClose });
  };

  return (
    <Modal
      title={editing ? `Edit ${isIssue ? "issue" : "follow-up"}` : isIssue ? "Add an issue" : "Add a follow-up action"}
      onClose={onClose}
      footer={<>
        <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
        <button type="button" onClick={submit} disabled={save.isPending || form.title.trim().length < 3 || !form.category} style={primaryBtn(save.isPending || form.title.trim().length < 3 || !form.category)}>{save.isPending ? "Saving…" : "Save"}</button>
      </>}
    >
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ca-title" style={label}>{isIssue ? "The issue" : "What needs doing"}</label>
          <input id="ca-title" autoFocus value={form.title} onChange={(e) => set("title")(e.target.value)} maxLength={200} placeholder={isIssue ? "e.g. Two laptops not charging" : "e.g. Replace the two laptop chargers"} style={input} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ca-desc" style={label}>Details</label>
          <textarea id="ca-desc" value={form.description} onChange={(e) => set("description")(e.target.value)} rows={3} maxLength={4000} style={{ ...input, resize: "vertical" }} />
        </div>
        {isIssue && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="ca-impact" style={label}>Impact on the hub or on training</label>
            <textarea id="ca-impact" value={form.impact} onChange={(e) => set("impact")(e.target.value)} rows={2} maxLength={2000} style={{ ...input, resize: "vertical" }} />
          </div>
        )}
        <div>
          <label htmlFor="ca-cat" style={label}>Category</label>
          <select id="ca-cat" value={form.category} onChange={(e) => set("category")(e.target.value)} style={input}>
            <option value="">Choose…</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ca-pri" style={label}>{isIssue ? "Severity" : "Priority"}</label>
          <select id="ca-pri" value={form.priority} onChange={(e) => set("priority")(e.target.value)} style={input}>
            {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ca-who" style={label}>Responsible person</label>
          <PersonSelect id="ca-who" value={form.assigneeId} onChange={set("assigneeId")} people={people} placeholder="Nobody yet" />
        </div>
        <div>
          <label htmlFor="ca-due" style={label}>Expected completion</label>
          <input id="ca-due" type="date" value={form.dueDate} onChange={(e) => set("dueDate")(e.target.value)} style={input} />
        </div>
        {isIssue && (
          <label style={{ gridColumn: "1 / -1", display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#374151" }}>
            <input type="checkbox" checked={form.recurring} onChange={(e) => set("recurring")(e.target.checked)} />
            A recurring concern (raised before)
          </label>
        )}
      </div>
      {!isIssue && <p style={{ ...hint, marginTop: 12 }}>A follow-up needs a responsible person and a date before the report can be submitted.</p>}
    </Modal>
  );
}
