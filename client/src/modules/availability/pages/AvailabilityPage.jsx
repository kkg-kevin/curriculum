import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { FiAlertCircle, FiCalendar, FiCheck, FiCheckCircle, FiChevronLeft, FiChevronRight, FiClock, FiCopy, FiEye, FiPlus, FiRotateCcw, FiTrash2, FiX, FiZap } from "react-icons/fi";
import { askConfirm } from "../../../components/ui/AskDialog";
import { readLocal, writeLocal } from "../../../utils/safeStorage";
import { BRAND, FONT, HERO_GRADIENT, card, cardHeading, pill } from "../../../theme/brand";
import WeekPlanner, { PlannerLegend } from "../components/WeekPlanner";
import { CopyDayDialog, HoursDialog } from "../components/HoursDialogs";
import { useAvailabilityWeek, useHoursEditor } from "../hooks/useAvailability";
import { DAYS, DAY_LONG, DAY_SHORT, PRESETS, addDaysTo, dateLabel, fmtRange, fmtTime, hoursLabel, planLocally, toMin } from "../utils";

// My Availability (/teacher-portal/availability, 23 Nov 2026): the hours a mentor offers families
// for Book a mentor. Their classes are drawn on the same week and always win: hours under a class
// simply aren't bookable, and come back by themselves when the class ends.

const box = { ...card, padding: "16px 18px", fontFamily: FONT };
const ghost = (disabled = false) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, background: "#fff", color: disabled ? BRAND.faint : BRAND.inkSoft, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap" });
const primary = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "none", background: BRAND.navy, color: "#fff", fontSize: 13, fontWeight: 800, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" };

function useNarrow(width = 820) {
  const query = `(max-width: ${width}px)`;
  const [narrow, setNarrow] = useState(() => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const list = window.matchMedia(query);
    const on = (e) => setNarrow(e.matches);
    setNarrow(list.matches);
    list.addEventListener("change", on);
    return () => list.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

function Stat({ icon, label, value, note, compact }) {
  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0" }}>
        <span aria-hidden style={{ color: BRAND.mid, display: "flex", flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>{label}</span>
        <span style={{ fontSize: 13.5, fontWeight: 900, color: BRAND.ink, textAlign: "right" }}>{value}</span>
      </div>
    );
  }
  return (
    <div style={{ ...card, flex: "1 1 190px", padding: "13px 16px", display: "flex", gap: 12, alignItems: "center" }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: BRAND.skyTint, color: BRAND.navy, display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: BRAND.muted }}>{label}</p>
        <p style={{ margin: "1px 0 0", fontSize: 17, fontWeight: 900, color: BRAND.ink, lineHeight: 1.25 }}>{value}</p>
        {note && <p style={{ margin: "1px 0 0", fontSize: 11.5, color: BRAND.faint }}>{note}</p>}
      </div>
    </div>
  );
}

const CHECKS = [
  { key: "hours", done: "Weekly hours added", todo: "Add your weekly hours below" },
  { key: "published", done: "Profile published", todo: "Publish your profile so families can find you", to: "/teacher-portal/profile?tab=public", cta: "Open profile" },
  { key: "active", done: "Account active", todo: "Your account isn't active for teaching yet. Ask your admin" },
  { key: "open", done: "Mentor booking is on", todo: "Mentor booking isn't switched on yet. Your admin controls this" },
];

function ReadinessCard({ status }) {
  if (status.bookable) return null;
  return (
    <section style={{ ...box, border: `1px solid ${BRAND.goldBorder}`, background: BRAND.goldTint }}>
      <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.goldText }}>Families can&apos;t book you yet</h2>
      <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%", marginTop: 9 }}>
        {CHECKS.map((c) => {
          const ok = status.checks[c.key];
          return (
            <div key={c.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ok ? BRAND.muted : BRAND.ink, flexWrap: "wrap" }}>
              {ok ? <FiCheckCircle color={BRAND.mid} style={{ flexShrink: 0 }} /> : <FiAlertCircle color={BRAND.goldText} style={{ flexShrink: 0 }} />}
              <span>{ok ? c.done : c.todo}</span>
              {!ok && c.to && <Link to={c.to} style={{ fontWeight: 800, color: BRAND.navy }}>{c.cta}</Link>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FirstRun({ onPreset, onAdd }) {
  return (
    <section style={{ ...box, border: `1.5px solid ${BRAND.skyBorder}`, background: BRAND.skyTint }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: BRAND.navy }}>When can families book you?</h2>
      <p style={{ margin: "4px 0 12px", fontSize: 13, color: BRAND.inkSoft, lineHeight: 1.55 }}>Pick a starting point. You can adjust it afterwards, and your classes will always come first.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => onPreset(p)} style={{ flex: "1 1 170px", textAlign: "left", padding: "11px 14px", borderRadius: 11, border: `1.5px solid ${BRAND.skyBorder}`, background: "#fff", cursor: "pointer", fontFamily: FONT }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: BRAND.navy }}>{p.label}</span>
            <span style={{ display: "block", fontSize: 12, color: BRAND.muted, marginTop: 1 }}>{p.note}</span>
          </button>
        ))}
        <button type="button" onClick={onAdd} style={{ flex: "1 1 170px", textAlign: "left", padding: "11px 14px", borderRadius: 11, border: `1.5px dashed ${BRAND.skyBorder}`, background: "transparent", cursor: "pointer", fontFamily: FONT }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 800, color: BRAND.navy }}>My own hours</span>
          <span style={{ display: "block", fontSize: 12, color: BRAND.muted, marginTop: 1 }}>Choose a day and time</span>
        </button>
      </div>
    </section>
  );
}

function Suggestions({ items, onAccept, onDismiss }) {
  if (!items.length) return null;
  return (
    <section style={{ ...box, border: `1px solid ${BRAND.skyBorder}` }}>
      <h2 style={cardHeading}><FiZap size={12} /> Classes took some of your hours</h2>
      <p style={{ margin: "5px 0 10px", fontSize: 13, color: BRAND.inkSoft }}>Want to offer these free times instead?</p>
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
        {items.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 12px", borderRadius: 10, background: BRAND.canvas }}>
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{DAY_LONG[s.dayOfWeek]}, {fmtRange(s)}</p>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: BRAND.muted }}>Instead of {DAY_SHORT[s.replaces.dayOfWeek]} {fmtRange(s.replaces)}</p>
            </div>
            <button type="button" onClick={() => onAccept(s)} style={{ ...primary, padding: "7px 12px", fontSize: 12.5 }}><FiPlus size={13} /> Add</button>
            <button type="button" onClick={() => onDismiss(s)} aria-label={`Dismiss ${DAY_LONG[s.dayOfWeek]} ${fmtRange(s)}`} style={{ border: "none", background: "transparent", color: BRAND.muted, cursor: "pointer", padding: 6, display: "flex" }}><FiX /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function HoursList({ windows, days, onlyDay, onAdd, onOpen, onCopy }) {
  const shown = onlyDay ? [onlyDay] : DAYS;
  return (
    <section style={box}>
      <h2 style={{ margin: "0 0 8px", fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>Your weekly hours</h2>
      <div style={{ display: "grid", gridTemplateColumns: "100%" }}>
        {shown.map((d, i) => {
          const list = windows.filter((w) => w.dayOfWeek === d);
          const day = days.find((x) => x.dayOfWeek === d);
          const taken = day?.byClass?.length > 0;
          return (
            <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `1px solid ${BRAND.line}` : "none", flexWrap: "wrap" }}>
              <span style={{ width: 86, flexShrink: 0, fontSize: 13, fontWeight: 800, color: list.length ? BRAND.ink : BRAND.faint }}>{DAY_LONG[d]}</span>
              <div style={{ flex: "1 1 200px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
                {list.length ? list.map((w) => (
                  <button key={w.startTime} type="button" onClick={() => onOpen(d, w)} aria-label={`Change ${DAY_LONG[d]} ${fmtRange(w)}`} style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${BRAND.skyBorder}`, background: BRAND.skyTint, color: BRAND.navy, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>{fmtRange(w)}</button>
                )) : <span style={{ fontSize: 12.5, color: BRAND.faint }}>Not offered</span>}
                {taken && <span style={pill("strong", { fontSize: 11 })}>Part taken by a class this week</span>}
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                <button type="button" onClick={() => onAdd(d)} aria-label={`Add hours on ${DAY_LONG[d]}`} title="Add hours" style={{ border: "none", background: "transparent", color: BRAND.mid, cursor: "pointer", padding: 7, display: "flex" }}><FiPlus size={16} /></button>
                <button type="button" disabled={!list.length} onClick={() => onCopy(d)} aria-label={`Copy ${DAY_LONG[d]} to other days`} title="Copy to other days" style={{ border: "none", background: "transparent", color: list.length ? BRAND.mid : BRAND.border, cursor: list.length ? "pointer" : "default", padding: 7, display: "flex" }}><FiCopy size={15} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AvailabilityPage() {
  const { teacher, teacherLoading } = useOutletContext();
  const teacherId = teacher?.id;
  const [params, setParams] = useSearchParams();
  const weekParam = params.get("week") || "";
  const { data, isLoading, isError, refetch } = useAvailabilityWeek(teacherId, weekParam);
  const { windows, editing, saving, apply, undo, canUndo } = useHoursEditor(teacherId, data?.windows);
  const narrow = useNarrow();
  const [dialog, setDialog] = useState(null);
  const [familyView, setFamilyView] = useState(false);
  const [phoneDay, setPhoneDay] = useState(null);
  const dismissKey = `availability.dismissed.${teacherId}`;
  const [dismissed, setDismissed] = useState([]);
  useEffect(() => {
    if (!teacherId) return;
    try { setDismissed(JSON.parse(readLocal(dismissKey) || "[]")); } catch { setDismissed([]); }
  }, [dismissKey, teacherId]);

  const days = useMemo(() => (data?.days || []).map((d) => (editing ? planLocally(d, windows) : d)), [data, editing, windows]);
  const todayDay = days.find((d) => d.isToday)?.dayOfWeek || "monday";
  const selectedDay = phoneDay || todayDay;
  const suggestions = (data?.suggestions || []).filter((s) => !dismissed.includes(s.key));

  if (teacherLoading || (isLoading && !data)) return <div style={{ padding: "60px 20px", textAlign: "center", color: BRAND.faint, fontSize: 14, fontFamily: FONT }}>Loading your availability…</div>;
  if (!teacherId) return <div style={{ ...box, textAlign: "center", color: BRAND.muted }}>Your account isn&apos;t linked to an educator record yet.</div>;
  if (isError || !data) {
    return (
      <div style={{ ...box, textAlign: "center" }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: BRAND.inkSoft }}>We couldn&apos;t load your availability.</p>
        <button type="button" onClick={() => refetch()} style={primary}>Try again</button>
      </div>
    );
  }

  const { status, summary, nextOpen, week, today } = data;
  const goWeek = (from) => {
    const next = new URLSearchParams(params);
    if (from) next.set("week", from); else next.delete("week");
    setParams(next, { replace: true });
  };
  const isThisWeek = week.from <= today && today <= week.to;
  const rememberDismissed = (key) => {
    const next = [...new Set([...dismissed, key])];
    setDismissed(next);
    writeLocal(dismissKey, JSON.stringify(next));
  };
  const addWindow = (w) => apply([...windows, w]);
  const replaceWindow = (dayOfWeek, old, next) => apply([...windows.filter((w) => !(w.dayOfWeek === dayOfWeek && w.startTime === old.startTime)), next]);
  const removeWindow = (dayOfWeek, old) => apply(windows.filter((w) => !(w.dayOfWeek === dayOfWeek && w.startTime === old.startTime)));
  const copyDay = (from, targets) => {
    const hours = windows.filter((w) => w.dayOfWeek === from);
    apply([...windows, ...targets.flatMap((dayOfWeek) => hours.map(({ startTime, endTime }) => ({ dayOfWeek, startTime, endTime })))]);
    setDialog(null);
  };
  const clearAll = async () => {
    const ok = await askConfirm({ title: "Clear all your hours?", message: "Families won't be able to book you until you add hours again. Sessions already booked stay booked.", confirmLabel: "Clear hours", cancelLabel: "Keep them", tone: "danger" });
    if (ok) apply([]);
  };
  const shownDays = narrow ? days.filter((d) => d.dayOfWeek === selectedDay) : days;
  // On a phone these follow the calendar, which is what the page is for.
  const suggestionCard = <Suggestions items={suggestions} onAccept={(s) => { addWindow({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime }); rememberDismissed(s.key); }} onDismiss={(s) => rememberDismissed(s.key)} />;

  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 340px", minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "-0.4px" }}>My Availability</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, maxWidth: 620 }}>Choose the hours families can book you for a mentor session. Your classes always come first.</p>
        </div>
        <span style={{ ...pill(status.bookable ? "good" : "waiting"), fontSize: 12.5, padding: "6px 13px" }}>
          {status.bookable ? <FiCheck size={13} /> : <FiAlertCircle size={13} />} {status.bookable ? "Families can book you" : "Not bookable yet"}
        </span>
      </div>

      {status.needsNewTime > 0 && (
        <Link to="/teacher-portal/bookings" style={{ ...box, display: "flex", alignItems: "center", gap: 10, textDecoration: "none", border: `1px solid ${BRAND.goldBorder}`, background: BRAND.goldTint, color: BRAND.goldText, fontSize: 13.5, fontWeight: 700 }}>
          <FiAlertCircle style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{status.needsNewTime} mentor session{status.needsNewTime === 1 ? " falls" : "s fall"} on a class time. The famil{status.needsNewTime === 1 ? "y has" : "ies have"} been asked to pick a new time.</span>
          <FiChevronRight style={{ flexShrink: 0 }} />
        </Link>
      )}

      <ReadinessCard status={status} />
      {windows.length === 0 && <FirstRun onPreset={(p) => apply(p.windows)} onAdd={() => setDialog({ type: "hours", initial: { dayOfWeek: selectedDay } })} />}

      {windows.length > 0 && (
        <div style={narrow ? { ...card, padding: "4px 14px" } : { display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Stat compact={narrow} icon={<FiClock size={narrow ? 15 : 17} />} label={isThisWeek ? "Open this week" : "Open that week"} value={hoursLabel(summary.openMinutes)} note={`of ${hoursLabel(summary.offeredMinutes)} you offer`} />
          <Stat compact={narrow} icon={<FiCalendar size={narrow ? 15 : 17} />} label="Next bookable" value={nextOpen ? `${dateLabel(nextOpen.date, { weekday: "short", day: "numeric", month: "short" })}, ${fmtTime(nextOpen.startTime)}` : "None soon"} note={`Families book at least ${status.noticeHours} hours ahead`} />
          <Stat compact={narrow} icon={<FiZap size={narrow ? 15 : 17} />} label="Taken by classes" value={hoursLabel(summary.byClassMinutes)} note="Returns when the class ends" />
        </div>
      )}

      {!narrow && suggestionCard}

      <section style={{ ...box, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button type="button" aria-label="Previous week" onClick={() => goWeek(addDaysTo(week.from, -7))} style={{ ...ghost(), padding: 8 }}><FiChevronLeft size={15} /></button>
            <button type="button" aria-label="Next week" onClick={() => goWeek(addDaysTo(week.from, 7))} style={{ ...ghost(), padding: 8 }}><FiChevronRight size={15} /></button>
            {!isThisWeek && <button type="button" onClick={() => goWeek(null)} style={ghost()}>This week</button>}
          </div>
          <h2 style={{ margin: "0 6px", fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{dateLabel(week.from)} – {dateLabel(week.to, { day: "numeric", month: "short", year: "numeric" })}</h2>
          <span aria-live="polite" style={{ fontSize: 12, color: BRAND.faint }}>{saving ? "Saving…" : canUndo ? "Saved" : ""}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={undo} disabled={!canUndo} style={ghost(!canUndo)}><FiRotateCcw size={13} /> Undo</button>
            <button type="button" aria-pressed={familyView} onClick={() => setFamilyView((v) => !v)} style={{ ...ghost(), ...(familyView ? { background: BRAND.navy, color: "#fff", borderColor: BRAND.navy } : {}) }}><FiEye size={13} /> What families see</button>
            <button type="button" onClick={() => setDialog({ type: "hours", initial: { dayOfWeek: selectedDay } })} style={primary}><FiPlus size={14} /> Add hours</button>
          </div>
        </div>

        {windows.length > 0 && !familyView && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.muted }}>Quick add:</span>
            {PRESETS.map((p) => <button key={p.key} type="button" title={p.note} onClick={() => apply([...windows, ...p.windows])} style={{ padding: "4px 11px", borderRadius: 999, border: `1px solid ${BRAND.skyBorder}`, background: "#fff", color: BRAND.navy, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>{p.label}</button>)}
            <button type="button" onClick={clearAll} style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: BRAND.danger, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}><FiTrash2 size={12} /> Clear all</button>
          </div>
        )}

        {narrow && (
          <div role="tablist" aria-label="Day" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {days.map((d) => {
              const on = d.dayOfWeek === selectedDay;
              return (
                <button key={d.date} type="button" role="tab" aria-selected={on} onClick={() => setPhoneDay(d.dayOfWeek)} style={{ padding: "7px 0", borderRadius: 9, border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.inkSoft, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FONT, position: "relative" }}>
                  {DAY_SHORT[d.dayOfWeek].slice(0, 2)}
                  {d.open.length > 0 && <span aria-hidden style={{ position: "absolute", top: 3, right: 4, width: 5, height: 5, borderRadius: 99, background: on ? BRAND.gold : BRAND.sky }} />}
                </button>
              );
            })}
          </div>
        )}

        <WeekPlanner
          days={shownDays}
          familyView={familyView}
          compact={narrow}
          onAdd={narrow ? undefined : (dayOfWeek, startTime, endTime) => addWindow({ dayOfWeek, startTime, endTime })}
          onResize={narrow ? undefined : (dayOfWeek, old, next) => replaceWindow(dayOfWeek, old, { dayOfWeek, ...next })}
          onOpen={familyView ? undefined : (dayOfWeek, r) => setDialog({ type: "hours", initial: { dayOfWeek, ...r }, old: r })}
        />
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <PlannerLegend familyView={familyView} />
          {!narrow && !familyView && <span style={{ fontSize: 11.5, color: BRAND.faint }}>Drag on the calendar to add hours, or drag an edge to resize.</span>}
        </div>
        {familyView && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted }}>This is when families can book you. They never see your classes or who you&apos;re meeting.</p>}
      </section>

      {narrow && suggestionCard}

      <HoursList
        windows={windows}
        days={days}
        onlyDay={narrow ? selectedDay : null}
        onAdd={(d) => setDialog({ type: "hours", initial: { dayOfWeek: d } })}
        onOpen={(d, w) => setDialog({ type: "hours", initial: { dayOfWeek: d, startTime: w.startTime, endTime: w.endTime }, old: w })}
        onCopy={(d) => setDialog({ type: "copy", day: d })}
      />

      {dialog?.type === "hours" && (
        <HoursDialog
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onRemove={() => { removeWindow(dialog.initial.dayOfWeek, dialog.old); setDialog(null); }}
          onSave={(next) => {
            if (dialog.old) replaceWindow(dialog.initial.dayOfWeek, dialog.old, next);
            else addWindow(next);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "copy" && <CopyDayDialog fromDay={dialog.day} windows={windows} onClose={() => setDialog(null)} onCopy={(targets) => copyDay(dialog.day, targets)} />}
    </div>
  );
}
