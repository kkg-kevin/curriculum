import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FiCalendar, FiCopy } from "react-icons/fi";
import { useBootcampRunsQuery, useScheduleBootcampRun } from "../hooks/useBootcamps";
import { CheckinStyles, Modal, btn, hint, input, label } from "../../checkins/shared";

const RUN_STATUS = {
  upcoming:  { bg: "#fff8e6", color: "#b07800", label: "Upcoming" },
  active:    { bg: "#e8f5fb", color: "#25476a", label: "Running now" },
  completed: { bg: "#F9FAFB", color: "#6B7280", label: "Completed" },
};

const pad = (n) => String(n).padStart(2, "0");
const toStr = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const shift = (s, days) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + days); return toStr(d); };
const fmt = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

// "Schedule another run" — the same bootcamp again at other dates. Everything about it is copied
// (description, pricing, curriculum and pathways, games, images); only the dates, the name, the
// website listing and the hubs are chosen here. Picking a start date moves the end and the
// registration dates by the same amount (each can still be changed). Each hub ticked gets the new
// run's classes, as "Run at a Hub" does.
export function ScheduleRunDialog({ bootcamp, offerings, onClose }) {
  const navigate = useNavigate();
  const schedule = useScheduleBootcampRun(bootcamp.id);
  const liveHubs = offerings.filter((o) => o.hubName);
  const [form, setForm] = useState({
    name: bootcamp.name,
    startDate: "",
    endDate: "",
    registrationOpenDate: "",
    registrationCloseDate: "",
    listOnWebsite: bootcamp.saleStatus === "for_sale",
    hubIds: liveHubs.map((o) => o.hubId),
  });
  const [errors, setErrors] = useState([]);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  // A new start date carries the rest along, keeping the first run's shape (length, registration window).
  const setStart = (startDate) => setForm((f) => {
    if (!startDate || !bootcamp.startDate) return { ...f, startDate };
    const by = daysBetween(bootcamp.startDate, startDate);
    return {
      ...f,
      startDate,
      endDate: bootcamp.endDate ? shift(bootcamp.endDate, by) : f.endDate,
      registrationOpenDate: bootcamp.registrationOpenDate ? shift(bootcamp.registrationOpenDate, by) : f.registrationOpenDate,
      registrationCloseDate: bootcamp.registrationCloseDate ? shift(bootcamp.registrationCloseDate, by) : f.registrationCloseDate,
    };
  });
  const toggleHub = (hubId) => setForm((f) => ({ ...f, hubIds: f.hubIds.includes(hubId) ? f.hubIds.filter((h) => h !== hubId) : [...f.hubIds, hubId] }));
  const canRunAtHubs = !!bootcamp.curriculumId;

  const submit = () => {
    setErrors([]);
    schedule.mutate({ ...form, name: form.name.trim() || bootcamp.name, hubIds: canRunAtHubs ? form.hubIds : [] }, {
      onSuccess: ({ bootcamp: run, hubs }) => {
        const failed = hubs.filter((h) => !h.ok);
        toast.success(`Next run scheduled for ${fmt(run.startDate)}`);
        if (failed.length) toast.error(`Not set up at ${failed.length} hub${failed.length === 1 ? "" : "s"}: ${failed.map((h) => h.message).join("; ")}`, { duration: 8000 });
        onClose();
        navigate(`/events/bootcamps/${run.id}/view`);
      },
      onError: (err) => setErrors((err.response?.data?.errors || err.errors || []).map((e) => e.message)),
    });
  };

  return (
    <Modal
      title="Schedule another run"
      onClose={onClose}
      width={620}
      footer={<>
        <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" onClick={submit} disabled={schedule.isPending || !form.startDate || !form.endDate} style={btn("primary", { disabled: schedule.isPending || !form.startDate || !form.endDate })}>
          <FiCopy size={14} /> {schedule.isPending ? "Scheduling…" : "Schedule run"}
        </button>
      </>}
    >
      <CheckinStyles />
      <p style={{ ...hint, margin: "0 0 14px", fontSize: 13 }}>
        A copy of <strong>{bootcamp.name}</strong> — its description, pricing, curriculum, games and pictures — running at new dates. Change anything on the new run afterwards without touching this one.
      </p>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
        <div>
          <label htmlFor="run-start" style={label}>Starts</label>
          <input id="run-start" type="date" value={form.startDate} onChange={(e) => setStart(e.target.value)} style={input} />
        </div>
        <div>
          <label htmlFor="run-end" style={label}>Ends</label>
          <input id="run-end" type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set("endDate")(e.target.value)} style={input} />
        </div>
        <div>
          <label htmlFor="run-reg-open" style={label}>Registration opens <span style={{ fontWeight: 500, color: "#9CA3AF" }}>(optional)</span></label>
          <input id="run-reg-open" type="date" value={form.registrationOpenDate} onChange={(e) => set("registrationOpenDate")(e.target.value)} style={input} />
        </div>
        <div>
          <label htmlFor="run-reg-close" style={label}>Registration closes <span style={{ fontWeight: 500, color: "#9CA3AF" }}>(optional)</span></label>
          <input id="run-reg-close" type="date" value={form.registrationCloseDate} onChange={(e) => set("registrationCloseDate")(e.target.value)} style={input} />
        </div>
        {bootcamp.startDate && <p style={{ ...hint, gridColumn: "1 / -1", marginTop: -6 }}>Picking a start date moves the end and registration dates to match this run&apos;s ({fmt(bootcamp.startDate)} – {fmt(bootcamp.endDate)}).</p>}

        <div style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="run-name" style={label}>Name</label>
          <input id="run-name" value={form.name} onChange={(e) => set("name")(e.target.value)} maxLength={150} style={input} />
          <p style={hint}>Keep the same name and the website shows whichever run comes next. A different name lists it separately.</p>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <span style={label}>Run it at</span>
          {!canRunAtHubs ? (
            <p style={hint}>Link this bootcamp to a curriculum to run it at hubs — then add hubs on the new run.</p>
          ) : liveHubs.length === 0 ? (
            <p style={hint}>This run isn&apos;t at any hub. Add hubs on the new run with &ldquo;Run at a Hub&rdquo;.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {liveHubs.map((o) => (
                <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${form.hubIds.includes(o.hubId) ? "#a8d5ee" : "#E5E7EB"}`, background: form.hubIds.includes(o.hubId) ? "#F0F7FF" : "#fff", cursor: "pointer", fontSize: 13.5, color: "#111827" }}>
                  <input type="checkbox" checked={form.hubIds.includes(o.hubId)} onChange={() => toggleHub(o.hubId)} />
                  {o.hubName}
                </label>
              ))}
              <p style={hint}>Each hub gets the new run&apos;s own classes, one per cohort.</p>
            </div>
          )}
        </div>

        <label style={{ gridColumn: "1 / -1", display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={form.listOnWebsite} onChange={(e) => set("listOnWebsite")(e.target.checked)} style={{ marginTop: 3 }} />
          <span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#111827" }}>List on the website</span>
            <span style={{ display: "block", fontSize: 12, color: "#6B7280", marginTop: 2 }}>Families can see and sign up for it. You can publish it later instead.</span>
          </span>
        </label>
      </div>
      {errors.length > 0 && <ul style={{ margin: "12px 0 0", paddingLeft: 18, color: "#B91C1C", fontSize: 12.5 }}>{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </Modal>
  );
}

// Every run of this bootcamp — shown once it has been run more than once — with this one marked.
export function RunsSection({ bootcamp, onSchedule }) {
  const navigate = useNavigate();
  const { data: runs = [] } = useBootcampRunsQuery(bootcamp.id);
  if (runs.length < 2) return null;
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>All runs of this bootcamp</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>{runs.length} runs. Each has its own dates, hubs, classes and sign-ups.</p>
        </div>
        <button type="button" onClick={onSchedule} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1.5px solid #25476a", backgroundColor: "#fff", color: "#25476a", fontSize: 12.5, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>
          <FiCalendar size={13} /> Schedule another run
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {runs.map((r) => {
          const s = RUN_STATUS[r.status];
          const current = r.id === bootcamp.id;
          return (
            <button key={r.id} type="button" onClick={() => !current && navigate(`/events/bootcamps/${r.id}/view`)} disabled={current}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${current ? "#25476a" : "#E5E7EB"}`, background: current ? "#F0F7FF" : "#fff", cursor: current ? "default" : "pointer", fontFamily: "Inter, sans-serif", textAlign: "left", flexWrap: "wrap" }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "#111827" }}>
                  {r.startDate ? `${fmt(r.startDate)} – ${fmt(r.endDate)}` : "No dates yet"}{current ? " · this run" : ""}
                </span>
                <span style={{ display: "block", fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
                  {r.name !== bootcamp.name ? `${r.name} · ` : ""}{r.hubCount ? `${r.hubCount} hub${r.hubCount === 1 ? "" : "s"}` : "No hubs yet"}
                </span>
              </span>
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {r.saleStatus === "for_sale" && <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: "#ECFDF5", color: "#047857" }}>On website</span>}
                {s && <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 10.5, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
