import { useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle } from "react-icons/fi";
import { useCheckinAction, useCheckinMutation } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import ActionFormDialog from "./ActionFormDialog";
import {
  ACTION_STATUS, CATEGORY_LABEL, KIND_LABEL, Modal, PRIORITY, Pill, T, dangerBtn, formatDate, formatDateTime, ghostBtn, hint, input, label, primaryBtn,
} from "../shared";

const UPDATE_LABEL = { created: "Raised", assigned: "Assigned to", status: "Status", note: "Note", escalated: "Escalated", edited: "Edited" };

// One issue or follow-up: its details, history, and what can be done next — start, resolve (with
// how), close, reopen, add a note, escalate. Resolving or closing it never depends on its
// check-in, and completing the check-in never touches it.
export default function ActionDialog({ actionId, onClose }) {
  const { data: action, isLoading, isError } = useCheckinAction(actionId);
  const [mode, setMode] = useState(null); // "resolve" | "note" | "escalate" | "edit"
  const [text, setText] = useState("");
  const status = useCheckinMutation((body) => checkinsApi.setActionStatus(actionId, body), "Updated");
  const note = useCheckinMutation((value) => checkinsApi.addActionNote(actionId, value), "Note added");
  const escalate = useCheckinMutation((value) => checkinsApi.escalateAction(actionId, value), "Escalated to the managers");
  const remove = useCheckinMutation(() => checkinsApi.deleteAction(actionId), "Removed");
  const busy = status.isPending || note.isPending || escalate.isPending || remove.isPending;
  const done = () => { setMode(null); setText(""); };

  if (mode === "edit" && action) return <ActionFormDialog action={action} onClose={() => setMode(null)} />;

  const canChange = action?.permissions?.canChange;
  const outstanding = action && ["open", "assigned", "in_progress"].includes(action.status);

  return (
    <Modal title={action ? `${KIND_LABEL[action.kind]}: ${action.title}` : "Action"} onClose={onClose} width={620}>
      {isLoading && <p style={hint}>Loading…</p>}
      {isError && <p style={{ ...hint, color: "#B91C1C" }}>This action couldn't be loaded, or you don't have access to it.</p>}
      {action && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Pill look={ACTION_STATUS[action.status]} />
            <span style={{ fontSize: 12, fontWeight: 800, color: PRIORITY[action.priority]?.color }}>{PRIORITY[action.priority]?.label} {action.kind === "issue" ? "severity" : "priority"}</span>
            <span style={{ fontSize: 12, color: T.inkMuted }}>{CATEGORY_LABEL[action.category]}</span>
            {action.recurring && <Pill look={{ bg: "#F5F3FF", color: "#6D28D9" }}>Recurring</Pill>}
            {action.isOverdue && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, color: "#B91C1C" }}><FiAlertTriangle size={12} /> Overdue</span>}
          </div>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 14px", fontSize: 13 }}>
            <dt style={{ color: T.inkMuted }}>Hub</dt><dd style={{ margin: 0 }}>{action.hubName}</dd>
            <dt style={{ color: T.inkMuted }}>From check-in</dt><dd style={{ margin: 0 }}>{action.session ? <Link to={`/checkins/sessions/${action.session.id}`} onClick={onClose} style={{ color: T.accentMid, fontWeight: 600 }}>{formatDate(action.session.scheduledDate)}</Link> : "—"}</dd>
            <dt style={{ color: T.inkMuted }}>Responsible</dt><dd style={{ margin: 0 }}>{action.assigneeName || "Nobody yet"}</dd>
            <dt style={{ color: T.inkMuted }}>Due</dt><dd style={{ margin: 0 }}>{action.dueDate ? formatDate(action.dueDate) : "—"}</dd>
            {action.escalatedAt && <><dt style={{ color: T.inkMuted }}>Escalated</dt><dd style={{ margin: 0, color: "#B91C1C" }}>{formatDateTime(action.escalatedAt)} by {action.escalatedByName || "someone"} — {action.escalationNote}</dd></>}
            {action.resolvedAt && <><dt style={{ color: T.inkMuted }}>Resolved</dt><dd style={{ margin: 0 }}>{formatDateTime(action.resolvedAt)} by {action.resolvedByName || "someone"}</dd></>}
          </dl>
          {action.description && <p style={{ margin: 0, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>{action.description}</p>}
          {action.impact && <p style={{ margin: 0, fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}><strong>Impact:</strong> {action.impact}</p>}
          {action.resolutionNotes && <p style={{ margin: 0, padding: "10px 12px", borderRadius: 10, background: "#ECFDF5", fontSize: 13, color: "#065F46", whiteSpace: "pre-wrap" }}><strong>How it was resolved:</strong> {action.resolutionNotes}</p>}

          {canChange && !mode && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["open", "assigned"].includes(action.status) && action.assigneeId && <button type="button" disabled={busy} onClick={() => status.mutate({ status: "in_progress" })} style={ghostBtn}>Start</button>}
              {outstanding && <button type="button" disabled={busy} onClick={() => setMode("resolve")} style={primaryBtn(busy)}>Mark resolved</button>}
              {action.status === "resolved" && <button type="button" disabled={busy} onClick={() => status.mutate({ status: "closed" })} style={primaryBtn(busy)}>Close</button>}
              {outstanding && action.permissions.isManager && <button type="button" disabled={busy} onClick={() => status.mutate({ status: "closed", note: "Closed without resolving" })} style={ghostBtn}>Close without resolving</button>}
              {["resolved", "closed"].includes(action.status) && <button type="button" disabled={busy} onClick={() => status.mutate({ status: "open", note: "Reopened" })} style={ghostBtn}>Reopen</button>}
              {outstanding && <button type="button" onClick={() => setMode("edit")} style={ghostBtn}>Edit / assign</button>}
              <button type="button" onClick={() => setMode("note")} style={ghostBtn}>Add a note</button>
              {outstanding && <button type="button" onClick={() => setMode("escalate")} style={dangerBtn}>Escalate</button>}
              {action.session?.status !== "completed" && (action.permissions.isManager || action.createdBy) && (
                <button type="button" disabled={busy} onClick={() => { if (window.confirm("Remove this item? Use this only for something added by mistake.")) remove.mutate(undefined, { onSuccess: onClose }); }} style={{ ...ghostBtn, color: T.inkMuted }}>Remove</button>
              )}
            </div>
          )}
          {!canChange && outstanding && (
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setMode("escalate")} style={dangerBtn}>Escalate</button>
            </div>
          )}

          {mode && mode !== "edit" && (
            <div>
              <label htmlFor="ca-text" style={label}>{mode === "resolve" ? "How was it resolved?" : mode === "escalate" ? "Why does it need escalating?" : "Note"}</label>
              <textarea id="ca-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={mode === "escalate" ? 500 : 2000} style={{ ...input, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={done} style={ghostBtn}>Cancel</button>
                <button
                  type="button"
                  disabled={busy || text.trim().length < 2}
                  onClick={() => {
                    if (mode === "resolve") status.mutate({ status: "resolved", resolutionNotes: text.trim() }, { onSuccess: done });
                    if (mode === "note") note.mutate(text.trim(), { onSuccess: done });
                    if (mode === "escalate") escalate.mutate(text.trim(), { onSuccess: done });
                  }}
                  style={mode === "escalate" ? { ...primaryBtn(busy || text.trim().length < 2), background: "#B91C1C" } : primaryBtn(busy || text.trim().length < 2)}
                >
                  {mode === "resolve" ? "Mark resolved" : mode === "escalate" ? "Escalate" : "Add note"}
                </button>
              </div>
            </div>
          )}

          <div>
            <p style={{ margin: "4px 0 6px", fontSize: 11, fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: T.inkMuted }}>History</p>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {action.updates.map((u) => (
                <li key={u.id} style={{ fontSize: 12.5, color: "#374151" }}>
                  <span style={{ color: T.inkFaint }}>{formatDateTime(u.createdAt)}</span> · <strong>{u.userName || "Someone"}</strong> — {UPDATE_LABEL[u.kind] || u.kind}
                  {u.kind === "status" && u.toStatus ? `: ${ACTION_STATUS[u.fromStatus]?.label || u.fromStatus} → ${ACTION_STATUS[u.toStatus]?.label || u.toStatus}` : ""}
                  {u.note ? `${u.kind === "assigned" ? " " : " — "}${u.note}` : ""}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Modal>
  );
}
