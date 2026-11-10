import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiArrowLeft, FiCheck, FiRefreshCw, FiSend, FiShuffle, FiUser } from "react-icons/fi";
import { useClassPeople, useHubClasses, useMentorHubs, useMentorMutation } from "../hooks/useMentorCheckins";
import { mentorCheckinsApi } from "../services/mentorCheckinsApi";
import { templateSource, useSourceTemplates } from "../../qa/templateSources";
import { CheckinStyles, FORMAT_LABEL, T, WEEKDAYS, btn, card, chip, font, hint, input, label, shortDay } from "../shared";

// Every problem the server names (else its one message).
const errorFrom = (err) => (err?.errors?.length ? err.errors.map((e) => e.message) : [err?.message || "Something went wrong"]);

const addDays = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const EMPTY = {
  hubId: "", classId: "", parentUserIds: [],
  format: "in_person", meetingLink: "", location: "", templateId: "",
  windowStart: "", windowEnd: "", days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  dayStart: "15:00", dayEnd: "17:00", minutes: 20, gapMinutes: 5, spread: "spread",
};
const key = (m) => `${m.date} ${m.startTime}`;

function Section({ step, title, children, aside }) {
  return (
    <section style={{ ...card, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: T.tint, color: T.accent, fontWeight: 900, fontSize: 13, display: "grid", placeItems: "center" }}>{step}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

// Setting up a class's parent check-ins (managers): the hub and class (its educators all attend;
// its families listed — siblings share one meeting; learners whose parent has no login can't be
// included), how they're held and the template, then when. "Draw the times" puts each family on a
// free time at random (never when the educators teach or have another check-in; at least 3 days
// away); draw again, or swap any family onto another time, then publish — which tells every family
// and the educators.
export default function NewRoundPage() {
  const navigate = useNavigate();
  const base = "/mentor-checkins";
  const [form, setForm] = useState(EMPTY);
  const [draw, setDraw] = useState(null); // { meetings, unplaced, freeTimes, short }
  const [problems, setProblems] = useState([]);
  const { data: hubs = [] } = useMentorHubs();
  const { data: classes = [], isLoading: classesLoading } = useHubClasses(form.hubId);
  const { data: people, isLoading: peopleLoading } = useClassPeople(form.classId);
  const { data: templates = [] } = useSourceTemplates(templateSource("mentor"), { status: "active" });

  // A new class: every family ticked, and the window from the first allowed day for two weeks.
  useEffect(() => {
    if (!people) return;
    setForm((f) => ({
      ...f,
      parentUserIds: people.families.map((x) => x.parentUserId),
      windowStart: f.windowStart && f.windowStart >= people.earliestDate ? f.windowStart : people.earliestDate,
      windowEnd: f.windowEnd && f.windowEnd >= people.earliestDate ? f.windowEnd : addDays(people.earliestDate, 13),
    }));
  }, [people]);

  // Any change to who or when throws away a draw already made.
  const set = (k, { keepDraw = false } = {}) => (value) => {
    setForm((f) => ({ ...f, [k]: value, ...(k === "hubId" ? { classId: "", parentUserIds: [] } : {}) }));
    if (!keepDraw) setDraw(null);
  };
  const toggle = (k, value) => set(k)(form[k].includes(value) ? form[k].filter((v) => v !== value) : [...form[k], value]);

  const settings = () => ({
    classId: form.classId, parentUserIds: form.parentUserIds, windowStart: form.windowStart, windowEnd: form.windowEnd,
    days: form.days, dayStart: form.dayStart, dayEnd: form.dayEnd, minutes: Number(form.minutes), gapMinutes: Number(form.gapMinutes), spread: form.spread,
  });
  const preview = useMentorMutation((body) => mentorCheckinsApi.preview(body), null, { toastErrors: false });
  const publish = useMentorMutation((body) => mentorCheckinsApi.createRound(body), "Check-ins set up — the families and educators have been told", { toastErrors: false });

  const runDraw = () => {
    setProblems([]);
    preview.mutate(settings(), { onSuccess: setDraw, onError: (err) => setProblems(errorFrom(err)) });
  };

  // Swapping: picking a time another family holds swaps the two.
  const moveFamily = (parentUserId, slotKey) => {
    setDraw((d) => {
      const mine = d.meetings.find((m) => m.parentUserId === parentUserId);
      const target = d.freeTimes.find((t) => key(t) === slotKey);
      if (!mine || !target) return d;
      const other = d.meetings.find((m) => m.parentUserId !== parentUserId && key(m) === slotKey);
      const meetings = d.meetings.map((m) => {
        if (m.parentUserId === parentUserId) return { ...m, date: target.date, startTime: target.startTime, endTime: target.endTime };
        if (other && m.parentUserId === other.parentUserId) return { ...m, date: mine.date, startTime: mine.startTime, endTime: mine.endTime };
        return m;
      });
      meetings.sort((a, b) => key(a).localeCompare(key(b)));
      return { ...d, meetings };
    });
  };

  const submit = () => {
    setProblems([]);
    publish.mutate({
      ...settings(),
      format: form.format,
      meetingLink: form.format === "online" ? form.meetingLink.trim() || null : null,
      location: form.format === "in_person" ? form.location.trim() || null : null,
      templateId: form.templateId || null,
      meetings: draw.meetings.map((m) => ({ parentUserId: m.parentUserId, date: m.date, startTime: m.startTime })),
    }, { onSuccess: (round) => navigate(`${base}/rounds/${round.id}`, { replace: true }), onError: (err) => setProblems(errorFrom(err)) });
  };

  const taken = useMemo(() => new Map((draw?.meetings || []).map((m) => [key(m), m])), [draw]);
  const chosenFamilies = people?.families.filter((f) => form.parentUserIds.includes(f.parentUserId)) || [];
  const canDraw = form.classId && chosenFamilies.length > 0 && people?.educators.length > 0 && form.days.length > 0 && form.windowStart && form.windowEnd;

  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 16, width: "100%", minWidth: 0 }}>
      <CheckinStyles />
      <Link to={base} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.accentMid, textDecoration: "none", alignSelf: "flex-start" }}><FiArrowLeft size={14} /> Parent–Mentor Check-ins</Link>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.ink }}>Set up parent check-ins</h1>
        <p style={{ ...hint, fontSize: 13 }}>For one class: its educators meet each family in turn. You don&apos;t need to be there.</p>
      </div>

      <Section step={1} title="The class">
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
          <div>
            <label htmlFor="mc-hub" style={label}>Hub</label>
            <select id="mc-hub" value={form.hubId} onChange={(e) => set("hubId")(e.target.value)} style={input}>
              <option value="">Choose the hub…</option>
              {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="mc-class" style={label}>Class</label>
            <select id="mc-class" value={form.classId} onChange={(e) => set("classId")(e.target.value)} disabled={!form.hubId} style={input}>
              <option value="">{!form.hubId ? "Choose the hub first" : classesLoading ? "Loading…" : classes.length ? "Choose the class…" : "This hub has no active classes"}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.learnerCount} learner{c.learnerCount === 1 ? "" : "s"}</option>)}
            </select>
          </div>
        </div>

        {form.classId && peopleLoading && <p style={hint}>Loading the class…</p>}
        {people && (
          <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
            <div style={{ padding: "10px 12px", borderRadius: 10, background: people.educators.length ? T.tint : "#FFFBEB", border: `1px solid ${people.educators.length ? "#CFE6F5" : "#FDE68A"}` }}>
              {people.educators.length ? (
                <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                  <strong>Educators (all attend):</strong> {people.educators.map((e) => e.name).join(", ")}
                  {people.educators.some((e) => !e.hasLogin) && <span style={{ color: "#92400E" }}> — {people.educators.filter((e) => !e.hasLogin).map((e) => e.name).join(", ")} {people.educators.filter((e) => !e.hasLogin).length === 1 ? "has" : "have"} no login, so won&apos;t be notified.</span>}
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "#92400E" }}>{people.className} has no educators yet — give its courses an educator first.</p>
              )}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={label}>Families ({chosenFamilies.length} of {people.families.length})</span>
                {people.families.length > 0 && (
                  <button type="button" onClick={() => set("parentUserIds")(form.parentUserIds.length === people.families.length ? [] : people.families.map((f) => f.parentUserId))} style={{ border: 0, background: "none", color: T.accentMid, fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: font }}>
                    {form.parentUserIds.length === people.families.length ? "Untick all" : "Tick all"}
                  </button>
                )}
              </div>
              {people.families.length === 0 && <p style={hint}>No learner in this class has a parent with a login.</p>}
              <div style={{ display: "grid", gap: 6, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}>
                {people.families.map((f) => {
                  const on = form.parentUserIds.includes(f.parentUserId);
                  return (
                    <label key={f.parentUserId} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 11px", borderRadius: 10, border: `1.5px solid ${on ? "#A8D5EE" : T.border}`, background: on ? "#F7FBFE" : "#fff", cursor: "pointer" }}>
                      <input type="checkbox" checked={on} onChange={() => toggle("parentUserIds", f.parentUserId)} style={{ marginTop: 3 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: T.ink }}>{f.learners.map((l) => l.name).join(" & ")}</span>
                        <span style={{ display: "block", fontSize: 12, color: T.inkMuted }}>{f.parentName}{f.learners.length > 1 ? " · one meeting for both" : ""}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {people.withoutLogin.length > 0 && (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "#F9FAFB", border: `1px solid ${T.border}` }}>
                  <p style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 700, color: "#374151" }}>Left out — no parent login ({people.withoutLogin.length})</p>
                  <p style={{ margin: 0, fontSize: 12.5, color: T.inkMuted, lineHeight: 1.6 }}>{people.withoutLogin.map((l) => `${l.name} (${l.reason.toLowerCase()})`).join(" · ")}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section step={2} title="How it's held">
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Held</span>
            <div role="radiogroup" aria-label="Held" style={{ display: "flex", gap: 8 }}>
              {Object.entries(FORMAT_LABEL).map(([k, text]) => (
                <button key={k} type="button" role="radio" aria-checked={form.format === k} onClick={() => set("format", { keepDraw: true })(k)} style={chip(form.format === k)}>{text}</button>
              ))}
            </div>
          </div>
          {form.format === "online" ? (
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="mc-link" style={label}>Link to join</label>
              <input id="mc-link" type="url" value={form.meetingLink} onChange={(e) => set("meetingLink", { keepDraw: true })(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij — or a Zoom or Teams link" style={input} maxLength={500} />
              <p style={hint}>One link for every check-in of the class — they&apos;re one at a time, so families never overlap. It comes with each reminder, and as a Join button on the day.</p>
            </div>
          ) : (
            <div style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="mc-place" style={label}>Where <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span></label>
              <input id="mc-place" value={form.location} onChange={(e) => set("location", { keepDraw: true })(e.target.value)} placeholder="e.g. The hub's front office" style={input} maxLength={255} />
            </div>
          )}
          <div style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="mc-template" style={label}>Report template <span style={{ fontWeight: 500, color: T.inkFaint }}>(optional)</span></label>
            <select id="mc-template" value={form.templateId} onChange={(e) => set("templateId", { keepDraw: true })(e.target.value)} style={input}>
              <option value="">No template — the two written parts only</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p style={hint}>With a template, the educators answer its items (yes / no, rubric, comments) and the report gets a score; then &quot;How the child is doing&quot; and &quot;What was agreed&quot;.{templates.length === 0 ? " Make one in the Templates tab." : ""}</p>
          </div>
        </div>
      </Section>

      <Section step={3} title="When">
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}>
          <div>
            <label htmlFor="mc-from" style={label}>First day</label>
            <input id="mc-from" type="date" value={form.windowStart} min={people?.earliestDate} onChange={(e) => set("windowStart")(e.target.value)} style={input} />
          </div>
          <div>
            <label htmlFor="mc-to" style={label}>Last day</label>
            <input id="mc-to" type="date" value={form.windowEnd} min={form.windowStart || people?.earliestDate} onChange={(e) => set("windowEnd")(e.target.value)} style={input} />
          </div>
          <div>
            <label htmlFor="mc-start" style={label}>From</label>
            <input id="mc-start" type="time" value={form.dayStart} onChange={(e) => set("dayStart")(e.target.value)} style={input} />
          </div>
          <div>
            <label htmlFor="mc-end" style={label}>Until</label>
            <input id="mc-end" type="time" value={form.dayEnd} onChange={(e) => set("dayEnd")(e.target.value)} style={input} />
          </div>
          <div>
            <label htmlFor="mc-len" style={label}>Each check-in</label>
            <select id="mc-len" value={form.minutes} onChange={(e) => set("minutes")(Number(e.target.value))} style={input}>
              {[10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} minutes</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="mc-gap" style={label}>Gap between</label>
            <select id="mc-gap" value={form.gapMinutes} onChange={(e) => set("gapMinutes")(Number(e.target.value))} style={input}>
              {[0, 5, 10, 15].map((n) => <option key={n} value={n}>{n ? `${n} minutes` : "None"}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>Days of the week</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {WEEKDAYS.map((d) => <button key={d.key} type="button" aria-pressed={form.days.includes(d.key)} onClick={() => toggle("days", d.key)} style={chip(form.days.includes(d.key))}>{d.short}</button>)}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <span style={label}>How the times are spread</span>
            <div role="radiogroup" aria-label="How the times are spread" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" role="radio" aria-checked={form.spread === "spread"} onClick={() => set("spread")("spread")} style={chip(form.spread === "spread")}>Across the dates</button>
              <button type="button" role="radio" aria-checked={form.spread === "earliest"} onClick={() => set("spread")("earliest")} style={chip(form.spread === "earliest")}>Earliest times first</button>
            </div>
          </div>
        </div>
        <p style={{ ...hint, marginTop: 10 }}>
          Families get at least 3 days&apos; notice{people ? `, so the first day can be ${shortDay(people.earliestDate)} at the earliest` : ""}. Times when an educator has a class or another check-in are skipped.
        </p>
      </Section>

      <Section
        step={4}
        title="The times"
        aside={draw && <button type="button" className="ci-btn" onClick={runDraw} disabled={preview.isPending} style={btn("secondary", { size: "sm", disabled: preview.isPending })}><FiRefreshCw size={13} /> Draw again</button>}
      >
        {!draw ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button type="button" className="ci-btn" onClick={runDraw} disabled={!canDraw || preview.isPending} style={btn("primary", { disabled: !canDraw || preview.isPending })}>
              <FiShuffle size={14} /> {preview.isPending ? "Drawing…" : "Draw the times"}
            </button>
            <span style={hint}>Each family gets a free time at random. You can draw again, or swap anyone, before publishing.</span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {draw.short > 0 && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10, background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: 13, color: "#92400E" }}>
                <FiAlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>Not enough free times: {draw.short} famil{draw.short === 1 ? "y has" : "ies have"} no time ({draw.unplaced.map((f) => f.parentName).join(", ")}). Widen the dates, days or hours and draw again — or publish without them.</span>
              </div>
            )}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
              {draw.meetings.map((m) => (
                <div key={m.parentUserId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderTop: "1px solid #F3F4F6", flexWrap: "wrap" }}>
                  <FiUser size={15} color={T.inkMuted} style={{ flexShrink: 0 }} />
                  <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: T.ink }}>{m.learners.map((l) => l.name).join(" & ")}</p>
                    <p style={{ margin: 0, fontSize: 12, color: T.inkMuted }}>{m.parentName}</p>
                  </div>
                  <select aria-label={`Time for ${m.parentName}`} value={key(m)} onChange={(e) => moveFamily(m.parentUserId, e.target.value)} style={{ ...input, width: "auto", minWidth: 220, flex: "0 1 260px" }}>
                    {draw.freeTimes.map((t) => {
                      const holder = taken.get(key(t));
                      const other = holder && holder.parentUserId !== m.parentUserId;
                      return <option key={key(t)} value={key(t)}>{shortDay(t.date)}, {t.startTime}{other ? ` — swap with ${holder.parentName}` : ""}</option>;
                    })}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
        {problems.length > 0 && <div style={{ marginTop: 10, color: "#B91C1C", fontSize: 12.5 }}>{problems.map((p) => <p key={p} style={{ margin: 0 }}>{p}</p>)}</div>}
      </Section>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", position: "sticky", bottom: 0, padding: "12px 0", background: "linear-gradient(180deg, rgba(248,250,252,0) 0%, #F8FAFC 40%)" }}>
        <button type="button" className="ci-btn" onClick={() => navigate(base)} style={btn("secondary")}>Cancel</button>
        <button type="button" className="ci-btn" onClick={submit} disabled={!draw?.meetings?.length || publish.isPending} style={btn("primary", { disabled: !draw?.meetings?.length || publish.isPending })}>
          {publish.isPending ? <>Publishing…</> : <><FiSend size={14} /> Publish {draw?.meetings?.length ? `${draw.meetings.length} check-in${draw.meetings.length === 1 ? "" : "s"}` : ""}</>}
        </button>
      </div>
      {draw?.meetings?.length > 0 && (
        <p style={{ ...hint, textAlign: "right", marginTop: -8 }}><FiCheck size={12} style={{ verticalAlign: -1 }} /> Publishing tells each family their time (they can confirm or pick another) and gives the educators the schedule.</p>
      )}
    </div>
  );
}
