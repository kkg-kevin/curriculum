import { useState } from "react";
import { Link } from "react-router-dom";
import { useCheckinHubs, useCheckinMutation } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import { templateSource, useSourceTemplates } from "../../qa/templateSources";
import ParticipantPicker from "./ParticipantPicker";
import { FORMAT_LABEL, FREQUENCY_LABEL, FREQUENCY_OPTIONS, Modal, T, chip, ghostBtn, hint, input, label, primaryBtn } from "../shared";

const today = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const EMPTY = { hubId: "", frequency: "monthly", startDate: today(), format: "in_person", templateId: "", participantIds: [], meetingLink: "" };

// Set up or change a hub's check-ins (managers): the hub, how often, the first check-in, online
// or in person, and the template its reports follow (optional — Templates tab). Its Account Manager and Training Lead are the hub's own — named on the hub
// (Learning Hubs → the hub → Edit), and shown here. Editing changes the upcoming check-ins that
// haven't been reported; reports already written keep their own record.
export default function ScheduleDialog({ schedule, onClose }) {
  const { data: hubs = [] } = useCheckinHubs();
  const [form, setForm] = useState(() => (schedule ? {
    hubId: schedule.hubId,
    // A schedule from before 26 Oct 2026 may be quarterly or one-off; editing it picks one of the four.
    frequency: FREQUENCY_OPTIONS.includes(schedule.frequency) ? schedule.frequency : "monthly",
    startDate: schedule.startDate, format: schedule.format, templateId: schedule.templateId || "",
    participantIds: (schedule.participants || []).map((p) => p.userId), meetingLink: schedule.meetingLink || "",
  } : EMPTY));
  const { data: templates = [] } = useSourceTemplates(templateSource("checkins"), { status: "active" });
  // The schedule's own template stays choosable even once archived.
  const templateOptions = schedule?.templateId && !templates.some((t) => t.id === schedule.templateId)
    ? [...templates, { id: schedule.templateId, name: `${schedule.templateName || "Current template"} (archived)` }]
    : templates;
  const [errors, setErrors] = useState([]);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const save = useCheckinMutation(
    (body) => (schedule ? checkinsApi.updateSchedule(schedule.id, body) : checkinsApi.createSchedule(body)),
    schedule ? "Schedule saved" : "Check-ins set up",
  );
  const hub = hubs.find((h) => h.id === form.hubId) || null;
  const missingPeople = hub && (!hub.accountManagerId || !hub.trainingLeadId);

  const submit = () => {
    setErrors([]);
    save.mutate({ ...form, templateId: form.templateId || null, meetingLink: form.format === "online" ? form.meetingLink.trim() || null : null }, { onSuccess: onClose, onError: (err) => setErrors((err.errors || []).map((e) => e.message)) });
  };

  return (
    <Modal
      title={schedule ? "Edit check-ins" : "Set up check-ins"}
      onClose={onClose}
      width={640}
      footer={<>
        <button type="button" className="ci-btn" onClick={onClose} style={ghostBtn}>Cancel</button>
        <button type="button" className="ci-btn" onClick={submit} disabled={save.isPending || missingPeople} style={primaryBtn(save.isPending || missingPeople)}>{save.isPending ? "Saving…" : schedule ? "Save" : "Set up"}</button>
      </>}
    >
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ci-hub" style={label}>Hub</label>
          <select id="ci-hub" value={form.hubId} onChange={(e) => set("hubId")(e.target.value)} disabled={!!schedule} style={input}>
            <option value="">Choose the hub…</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {schedule && <p style={hint}>A schedule stays with its hub. For another hub, end this one and set up a new one.</p>}
        </div>

        {hub && (
          <div style={{ gridColumn: "1 / -1", padding: "10px 12px", borderRadius: 10, background: missingPeople ? "#FFFBEB" : T.tint, border: `1px solid ${missingPeople ? "#FDE68A" : "#CFE6F5"}` }}>
            {missingPeople ? (
              <p style={{ margin: 0, fontSize: 12.5, color: "#92400E", lineHeight: 1.5 }}>
                {hub.name} doesn&apos;t have its {!hub.accountManagerId && !hub.trainingLeadId ? "Account Manager and Training Lead" : !hub.accountManagerId ? "Account Manager" : "Training Lead"} named yet.{" "}
                <Link to={`/settings/learning-hubs/${hub.id}/edit`} style={{ color: T.accentMid, fontWeight: 700 }}>Name them on the hub</Link>, then set up its check-ins.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: "#374151", lineHeight: 1.5 }}>
                Run by <strong>{hub.accountManagerName}</strong> (Account Manager) and <strong>{hub.trainingLeadName}</strong> (Training Lead) — the hub&apos;s own. To change them, edit the hub.
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="ci-freq" style={label}>How often</label>
          <select id="ci-freq" value={form.frequency} onChange={(e) => set("frequency")(e.target.value)} style={input}>
            {FREQUENCY_OPTIONS.map((k) => <option key={k} value={k}>{FREQUENCY_LABEL[k]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ci-start" style={label}>First check-in</label>
          <input id="ci-start" type="date" value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} style={input} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={label}>Held</span>
          <div role="radiogroup" aria-label="Held" style={{ display: "flex", gap: 8 }}>
            {Object.entries(FORMAT_LABEL).map(([key, text]) => (
              <button key={key} type="button" role="radio" aria-checked={form.format === key} onClick={() => set("format")(key)} style={chip(form.format === key)}>{text}</button>
            ))}
          </div>
        </div>
        {form.format === "online" && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="ci-link" style={label}>Link to join <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span></label>
            <input id="ci-link" type="url" value={form.meetingLink} onChange={(e) => set("meetingLink")(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij — or a Zoom or Teams link" style={input} maxLength={500} />
            <p style={hint}>Everyone taking part gets it with each reminder, and a Join button on the check-in.</p>
          </div>
        )}
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={label}>Who takes part</span>
          <ParticipantPicker hubId={form.hubId} value={form.participantIds} onChange={set("participantIds")} leads={hub ? [hub.accountManagerId, hub.trainingLeadId] : []} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ci-template" style={label}>Report template <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span></label>
          <select id="ci-template" value={form.templateId} onChange={(e) => set("templateId")(e.target.value)} style={input}>
            <option value="">No template — highs, lows and resolutions only</option>
            {templateOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <p style={hint}>
            With a template, each report answers its items (yes / no, rubric, comments) and gets a score, then the highs, lows and resolutions.
            {templates.length === 0 ? " Make one in the Templates tab." : ""}
            {schedule ? " A new template applies to every check-in not reported yet." : ""}
          </p>
        </div>
      </div>
      {schedule && <p style={{ ...hint, marginTop: 12 }}>Changes apply to the upcoming check-ins. A new frequency or first date replaces them with a new set; reports already written stay.</p>}
      {errors.length > 1 && <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#B91C1C", fontSize: 12.5 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </Modal>
  );
}
