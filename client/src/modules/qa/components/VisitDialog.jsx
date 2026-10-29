import { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useQaEducators, useQaMutation, useQaReviewers, useQaTemplates } from "../hooks/useQa";
import { qaApi } from "../services/qaApi";
import EducatorPicker from "./EducatorPicker";
import { FREQUENCY_LABEL, FREQUENCY_OPTIONS, Modal, T, VISIT_TYPE, btn, chip, hint, input, label, todayKe } from "../shared";

// Plans QA visits — one at a time (`mode` "visit") or regularly (`mode` "schedule") — or changes
// one (`visit` / `schedule` given). Who: the educator (fixed once planned), where (one of their
// hubs, optional), with which template, by whom (an admin picks an admin or supervisor; a
// supervisor always does their own), announced or a surprise, and when.
export default function VisitDialog({ mode = "visit", visit = null, schedule = null, teacherId = "", title: titleOverride, onClose, onSaved }) {
  const { user } = useAuth();
  const isSupervisor = user?.role === "supervisor";
  const editing = visit || schedule;
  const { data: educators = [] } = useQaEducators();
  const { data: templates = [] } = useQaTemplates({ status: "active" });
  const { data: reviewers = [] } = useQaReviewers({ enabled: !isSupervisor });
  const [form, setForm] = useState(() => ({
    teacherId: editing?.teacherId || teacherId || "",
    hubId: editing?.hubId || "",
    templateId: editing?.templateId || "",
    reviewerId: editing?.reviewerId || "",
    visitType: editing?.visitType || "announced",
    scheduledDate: visit?.scheduledDate || todayKe(),
    frequency: schedule?.frequency || "quarterly",
    startDate: schedule?.startDate || todayKe(),
  }));
  const [errors, setErrors] = useState([]);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const educator = educators.find((e) => e.id === form.teacherId) || null;
  // A template that has since been archived still shows for the visit using it.
  const templateOptions = editing && !templates.some((t) => t.id === form.templateId) && editing.templateName
    ? [...templates, { id: editing.templateId, name: `${editing.templateName} (archived)` }]
    : templates;
  const templateLocked = visit && visit.permissions && !visit.permissions.canChangeTemplate;

  const save = useQaMutation(
    (body) => {
      if (mode === "schedule") return schedule ? qaApi.updateSchedule(schedule.id, body) : qaApi.createSchedule(body);
      return visit ? qaApi.updateVisit(visit.id, body) : qaApi.createVisit(body);
    },
    mode === "schedule" ? (schedule ? "Schedule saved" : "Visits scheduled") : (visit ? "Visit updated" : "Visit planned"),
  );

  const submit = () => {
    setErrors([]);
    const common = { teacherId: form.teacherId, hubId: form.hubId || null, templateId: form.templateId, reviewerId: isSupervisor ? null : form.reviewerId || null, visitType: form.visitType };
    const body = mode === "schedule"
      ? { ...common, frequency: form.frequency, startDate: form.startDate }
      : { ...common, scheduledDate: form.scheduledDate };
    save.mutate(body, {
      onSuccess: (result) => { onSaved?.(result); onClose(); },
      onError: (err) => setErrors((err.errors || []).map((e) => e.message)),
    });
  };

  const title = titleOverride || (mode === "schedule" ? (schedule ? "Edit visit schedule" : "Schedule regular visits") : (visit ? "Change the visit" : "Plan a visit"));

  return (
    <Modal
      title={title}
      onClose={onClose}
      width={600}
      footer={<>
        <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" onClick={submit} disabled={save.isPending} style={btn("primary", { disabled: save.isPending })}>
          {save.isPending ? "Saving…" : editing ? "Save" : mode === "schedule" ? "Schedule visits" : titleOverride ? "Schedule" : "Plan visit"}
        </button>
      </>}
    >
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="qa-educator" style={label}>Educator</label>
          <EducatorPicker id="qa-educator" educators={educators} value={form.teacherId} onChange={(id) => setForm((f) => ({ ...f, teacherId: id, hubId: "", reviewerId: "" }))} disabled={!!editing || !!teacherId} />
          {educators.length === 0 && <p style={hint}>{isSupervisor ? "No educators are assigned to you yet — the admin assigns them on the educator form." : "No educators in this workspace yet."}</p>}
        </div>

        <div>
          <label htmlFor="qa-hub" style={label}>Hub <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span></label>
          <select id="qa-hub" value={form.hubId} onChange={(e) => set("hubId")(e.target.value)} style={input} disabled={!educator}>
            <option value="">{educator?.hubs?.length ? "Not tied to a hub" : "No hubs"}</option>
            {(educator?.hubs || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <p style={hint}>The hub sees its announced visits and a summary of each report.</p>
        </div>

        <div>
          <label htmlFor="qa-template" style={label}>Template</label>
          <select id="qa-template" value={form.templateId} onChange={(e) => set("templateId")(e.target.value)} style={input} disabled={templateLocked}>
            <option value="">Choose a template…</option>
            {templateOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {templateLocked && <p style={hint}>The review has been started on this template.</p>}
          {templates.length === 0 && <p style={hint}>Make a template first (Templates tab).</p>}
        </div>

        {!isSupervisor && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="qa-reviewer" style={label}>Done by</label>
            <select id="qa-reviewer" value={form.reviewerId} onChange={(e) => set("reviewerId")(e.target.value)} style={input}>
              <option value="">{educator?.supervisorName ? `${educator.supervisorName} (their supervisor)` : "Choose who visits…"}</option>
              {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.kind === "supervisor" ? "Supervisor" : "Admin"}</option>)}
            </select>
            {reviewers.length > 0 && !reviewers.some((r) => r.kind === "supervisor") && (
              <p style={hint}>No supervisors yet — add them in Settings → People &amp; sharing → Supervisors.</p>
            )}
          </div>
        )}

        <div style={{ gridColumn: "1 / -1" }}>
          <span style={label}>Visit</span>
          <div role="radiogroup" aria-label="Visit type" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(VISIT_TYPE).map(([key, look]) => (
              <button key={key} type="button" role="radio" aria-checked={form.visitType === key} onClick={() => set("visitType")(key)} style={chip(form.visitType === key)}>
                <look.icon size={13} style={{ marginRight: 6 }} />{look.label}
              </button>
            ))}
          </div>
          <p style={hint}>{VISIT_TYPE[form.visitType].help}</p>
        </div>

        {mode === "schedule" ? (
          <>
            <div>
              <label htmlFor="qa-freq" style={label}>How often</label>
              <select id="qa-freq" value={form.frequency} onChange={(e) => set("frequency")(e.target.value)} style={input}>
                {FREQUENCY_OPTIONS.map((k) => <option key={k} value={k}>{FREQUENCY_LABEL[k]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="qa-start" style={label}>First visit</label>
              <input id="qa-start" type="date" value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} style={input} />
            </div>
            {form.visitType === "surprise" && (
              <p style={{ ...hint, gridColumn: "1 / -1", marginTop: -6 }}>Each date is a target for you: you can do the visit any day around it and record the real date in the review.</p>
            )}
          </>
        ) : (
          <div>
            <label htmlFor="qa-date" style={label}>Date</label>
            <input id="qa-date" type="date" value={form.scheduledDate} onChange={(e) => set("scheduledDate")(e.target.value)} style={input} />
          </div>
        )}
      </div>
      {schedule && <p style={{ ...hint, marginTop: 12 }}>Changes apply to the upcoming visits not started yet. A new frequency or first date replaces them with a new set; visits already begun and reports stay.</p>}
      {errors.length > 1 && <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#B91C1C", fontSize: 12.5 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </Modal>
  );
}
