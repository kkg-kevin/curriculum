import { useState } from "react";
import { Link } from "react-router-dom";
import { FiPlus } from "react-icons/fi";
import { useCheckinMutation } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import RichTextEditor from "../../assessments/components/RichTextEditor";
import RichContent, { isEmptyHtml, stripHtml } from "../../assessments/components/RichContent";
import { Pill, TASK_STATE, T, control, formatDate, ghostBtn, hint, label, primaryBtn, useCheckinsBase } from "../shared";

// A task is rich text; where it has to be one line (a confirm box, a screen reader label), plain.
const shortText = (html, max = 80) => {
  const text = stripHtml(html);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const EMPTY = { title: "", assigneeId: "", dueDate: "" };

// One task: tick it off (the person it's for, or whoever set it), what, who, by when. On a
// check-in's page it can be changed or removed; in the Tasks tab it links to its check-in.
export function TaskRow({ task, onEdit, onRemove, showCheckin = false }) {
  const base = useCheckinsBase();
  const tick = useCheckinMutation((status) => checkinsApi.setTaskStatus(task.id, status), (r) => (r?.status === "done" ? "Task done" : "Task opened again"));
  const done = task.status === "done";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 18px", borderTop: "1px solid #F3F4F6" }}>
      <input
        type="checkbox"
        checked={done}
        disabled={!task.canTick || tick.isPending}
        onChange={() => tick.mutate(done ? "open" : "done")}
        aria-label={done ? `Mark "${shortText(task.title)}" not done` : `Mark "${shortText(task.title)}" done`}
        style={{ width: 17, height: 17, marginTop: 2, accentColor: "#047857", cursor: task.canTick ? "pointer" : "default", flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ textDecoration: done ? "line-through" : "none", opacity: done ? 0.65 : 1, wordBreak: "break-word" }}>
          <RichContent html={task.title} emptyText="—" />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4, fontSize: 12.5, color: T.inkMuted }}>
          <Pill look={TASK_STATE[task.state]} />
          <span>{task.assigneeName || "—"}</span>
          <span>By {formatDate(task.dueDate)}</span>
          {done && task.doneAt && <span>Done {formatDate(task.doneAt, { day: "numeric", month: "short" })}{task.doneByName ? ` by ${task.doneByName}` : ""}</span>}
          {showCheckin && (
            <Link to={`${base}/sessions/${task.sessionId}`} style={{ color: T.accentMid, textDecoration: "none", fontWeight: 600 }}>
              {task.hubName || "Hub"} check-in{task.checkinDate ? `, ${formatDate(task.checkinDate, { day: "numeric", month: "short" })}` : ""}
            </Link>
          )}
        </div>
      </div>
      {(onEdit || onRemove) && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {onEdit && <button type="button" onClick={onEdit} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12 }}>Edit</button>}
          {onRemove && <button type="button" onClick={onRemove} style={{ ...ghostBtn, padding: "5px 10px", fontSize: 12, color: "#B91C1C", borderColor: "#FECACA" }}>Remove</button>}
        </div>
      )}
    </div>
  );
}

function TaskForm({ session, initial, onDone }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [problem, setProblem] = useState("");
  const editing = !!initial?.id;
  const save = useCheckinMutation(
    (body) => (editing ? checkinsApi.updateTask(initial.id, body) : checkinsApi.createTask(session.id, body)),
    editing ? "Task updated" : "Task added",
  );
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (isEmptyHtml(form.title)) return setProblem("Write the task.");
    if (!form.assigneeId) return setProblem("Choose who does it.");
    if (!form.dueDate) return setProblem("Choose the deadline.");
    setProblem("");
    save.mutate({ title: form.title, assigneeId: form.assigneeId, dueDate: form.dueDate }, {
      onSuccess: () => { if (!editing) setForm(EMPTY); onDone?.(); },
      onError: (err) => setProblem(err?.errors?.[0]?.message || err?.message || "The task couldn't be saved."),
    });
  };

  return (
    <form onSubmit={submit} style={{ padding: "14px 18px", borderTop: "1px solid #F3F4F6", background: editing ? "#FAFCFF" : "transparent", display: "grid", gap: 10 }}>
      <div>
        <p style={label}>{editing ? "Task" : "New task"}</p>
        <p style={{ ...hint, margin: "0 0 6px" }}>What was agreed — e.g. book the lab every Tuesday.</p>
        <RichTextEditor value={form.title} onChange={(html) => setForm((f) => ({ ...f, title: html }))} minHeight={70} maxHeight={240} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <label htmlFor={`task-who-${initial?.id || "new"}`} style={label}>Who</label>
          <select id={`task-who-${initial?.id || "new"}`} value={form.assigneeId} onChange={set("assigneeId")} style={{ ...control, width: "100%", padding: "9px 11px" }}>
            <option value="">Choose who does it…</option>
            {(session.taskAssignees || []).map((a) => <option key={a.id} value={a.id}>{a.name} — {a.roleName}</option>)}
          </select>
        </div>
        <div style={{ flex: "0 1 180px" }}>
          <label htmlFor={`task-due-${initial?.id || "new"}`} style={label}>Deadline</label>
          <input id={`task-due-${initial?.id || "new"}`} type="date" value={form.dueDate} min={session.scheduledDate} onChange={set("dueDate")} style={{ ...control, width: "100%", padding: "8px 11px" }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {editing && <button type="button" onClick={onDone} style={ghostBtn}>Cancel</button>}
          <button type="submit" disabled={save.isPending} style={primaryBtn(save.isPending)}>
            {editing ? (save.isPending ? "Saving…" : "Save") : <><FiPlus size={14} /> {save.isPending ? "Adding…" : "Add task"}</>}
          </button>
        </div>
      </div>
      {problem && <p role="alert" style={{ margin: 0, color: "#B91C1C", fontSize: 12.5 }}>{problem}</p>}
    </form>
  );
}

// A check-in's tasks, from its resolutions — on the check-in's page.
export function SessionTasks({ session }) {
  const [editingId, setEditingId] = useState(null);
  const remove = useCheckinMutation((id) => checkinsApi.deleteTask(id), "Task removed");
  const canManage = session.permissions?.canManageTasks;
  const tasks = session.tasks || [];
  if (!canManage && tasks.length === 0) return null;
  const openCount = tasks.filter((t) => t.status !== "done").length;

  return (
    <>
      <div style={{ padding: "16px 18px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>Tasks</h2>
          {tasks.length > 0 && <span style={{ fontSize: 12, color: T.inkMuted }}>{openCount} open · {tasks.length - openCount} done</span>}
        </div>
        <p style={{ ...hint, margin: "4px 0 0" }}>
          {canManage
            ? "What was agreed in the resolutions: who does it and by when — the Account Manager, the Training Lead or an admin. They're told now, and reminded on the deadline."
            : "What was agreed in the resolutions, who does it and by when."}
        </p>
      </div>
      {tasks.map((t) => (editingId === t.id ? (
        <TaskForm key={t.id} session={session} initial={{ id: t.id, title: t.title, assigneeId: t.assigneeId, dueDate: t.dueDate }} onDone={() => setEditingId(null)} />
      ) : (
        <TaskRow
          key={t.id}
          task={t}
          onEdit={canManage ? () => setEditingId(t.id) : undefined}
          onRemove={canManage ? () => { if (window.confirm(`Remove the task "${shortText(t.title)}"?`)) remove.mutate(t.id); } : undefined}
        />
      )))}
      {canManage && !editingId && <TaskForm session={session} />}
    </>
  );
}
