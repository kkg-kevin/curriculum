import { useState } from "react";
import { useCheckinHubs, useCheckinMutation, useCheckinPeople } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import { FREQUENCY_LABEL, Modal, PersonSelect, ghostBtn, hint, input, label, primaryBtn } from "../shared";

const today = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const EMPTY = { hubId: "", accountManagerId: "", trainingLeadId: "", frequency: "monthly", startDate: today(), endDate: "", startTime: "10:00", durationMinutes: 60, format: "in_person", meetingLink: "", venue: "", agenda: "" };

// Set up or change a check-in schedule (managers). A one-off is a schedule of one. Editing changes
// the upcoming check-ins nobody has started; anything already written up keeps its own record.
export default function ScheduleDialog({ schedule, onClose }) {
  const { data: hubs = [] } = useCheckinHubs();
  const { data: people = [] } = useCheckinPeople();
  const [form, setForm] = useState(() => (schedule ? {
    ...EMPTY, ...schedule, endDate: schedule.endDate || "", meetingLink: schedule.meetingLink || "", venue: schedule.venue || "", agenda: schedule.agenda || "", durationMinutes: schedule.durationMinutes ?? "",
  } : EMPTY));
  const [errors, setErrors] = useState([]);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const save = useCheckinMutation(
    (body) => (schedule ? checkinsApi.updateSchedule(schedule.id, body) : checkinsApi.createSchedule(body)),
    (result) => (schedule ? `Schedule saved${result?.updatedSessions || result?.replacedSessions ? " — upcoming check-ins updated" : ""}` : "Check-ins scheduled"),
  );

  const submit = () => {
    setErrors([]);
    const body = {
      hubId: form.hubId, accountManagerId: form.accountManagerId, trainingLeadId: form.trainingLeadId, frequency: form.frequency,
      startDate: form.startDate, endDate: form.frequency === "once" ? null : form.endDate || null, startTime: form.startTime,
      durationMinutes: form.durationMinutes === "" ? null : Number(form.durationMinutes), format: form.format,
      meetingLink: form.format === "online" ? form.meetingLink.trim() : "", venue: form.format === "in_person" ? form.venue.trim() : "", agenda: form.agenda.trim(),
    };
    save.mutate(body, { onSuccess: onClose, onError: (err) => setErrors((err.errors || []).map((e) => e.message)) });
  };
  const notInModule = people.filter((p) => !p.canUseCheckins);

  return (
    <Modal
      title={schedule ? "Edit check-in schedule" : "Schedule check-ins"}
      onClose={onClose}
      width={640}
      footer={<>
        <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
        <button type="button" onClick={submit} disabled={save.isPending} style={primaryBtn(save.isPending)}>{save.isPending ? "Saving…" : schedule ? "Save" : "Schedule"}</button>
      </>}
    >
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ci-hub" style={label}>Hub</label>
          <select id="ci-hub" value={form.hubId} onChange={(e) => set("hubId")(e.target.value)} disabled={!!schedule} style={input}>
            <option value="">Choose the hub…</option>
            {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {schedule && <p style={hint}>A schedule stays with its hub. To move to another hub, end this one and set up a new one.</p>}
        </div>
        <div>
          <label htmlFor="ci-am" style={label}>Account Manager</label>
          <PersonSelect id="ci-am" value={form.accountManagerId} onChange={set("accountManagerId")} people={people} onlyCheckins placeholder="Choose…" />
        </div>
        <div>
          <label htmlFor="ci-tl" style={label}>Training Lead</label>
          <PersonSelect id="ci-tl" value={form.trainingLeadId} onChange={set("trainingLeadId")} people={people} onlyCheckins placeholder="Choose…" />
        </div>
        {notInModule.length > 0 && (
          <p style={{ ...hint, gridColumn: "1 / -1", marginTop: -6 }}>
            Only people whose role includes Hub check-ins are listed. {notInModule.length} other staff member{notInModule.length === 1 ? "" : "s"} can be added by giving their role that permission (Settings → People & sharing → Roles).
          </p>
        )}
        <div>
          <label htmlFor="ci-freq" style={label}>How often</label>
          <select id="ci-freq" value={form.frequency} onChange={(e) => set("frequency")(e.target.value)} style={input}>
            {Object.entries(FREQUENCY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ci-start" style={label}>{form.frequency === "once" ? "Date" : "First check-in"}</label>
          <input id="ci-start" type="date" value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} style={input} />
        </div>
        <div>
          <label htmlFor="ci-time" style={label}>Time</label>
          <input id="ci-time" type="time" value={form.startTime} onChange={(e) => set("startTime")(e.target.value)} style={input} />
        </div>
        <div>
          <label htmlFor="ci-dur" style={label}>Duration (minutes)</label>
          <input id="ci-dur" type="number" min="5" max="600" value={form.durationMinutes} onChange={(e) => set("durationMinutes")(e.target.value)} style={input} />
        </div>
        {form.frequency !== "once" && (
          <div>
            <label htmlFor="ci-end" style={label}>Until <span style={{ fontWeight: 400, color: "#9CA3AF" }}>(optional)</span></label>
            <input id="ci-end" type="date" value={form.endDate} onChange={(e) => set("endDate")(e.target.value)} style={input} />
          </div>
        )}
        <div>
          <label htmlFor="ci-format" style={label}>Format</label>
          <select id="ci-format" value={form.format} onChange={(e) => set("format")(e.target.value)} style={input}>
            <option value="in_person">In person</option>
            <option value="online">Online</option>
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          {form.format === "online" ? (
            <>
              <label htmlFor="ci-link" style={label}>Meeting link</label>
              <input id="ci-link" value={form.meetingLink} onChange={(e) => set("meetingLink")(e.target.value)} placeholder="https://meet.google.com/…" style={input} />
            </>
          ) : (
            <>
              <label htmlFor="ci-venue" style={label}>Venue</label>
              <input id="ci-venue" value={form.venue} onChange={(e) => set("venue")(e.target.value)} maxLength={255} placeholder="e.g. the hub's office" style={input} />
            </>
          )}
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ci-agenda" style={label}>Agenda / purpose</label>
          <textarea id="ci-agenda" value={form.agenda} onChange={(e) => set("agenda")(e.target.value)} rows={3} maxLength={5000} style={{ ...input, resize: "vertical" }} />
        </div>
      </div>
      {schedule && <p style={{ ...hint, marginTop: 12 }}>Changes apply to the upcoming check-ins nobody has started. Check-ins already written up, moved or past keep their own details. A new frequency or date replaces those upcoming check-ins with a new set.</p>}
      {errors.length > 1 && <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#B91C1C", fontSize: 12.5 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </Modal>
  );
}
