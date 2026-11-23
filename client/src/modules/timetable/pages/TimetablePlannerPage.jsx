import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiCalendar, FiClock, FiGrid, FiPlus, FiSearch } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { can } from "../../../hooks/usePermissions";
import { BRAND, FONT, HERO_GRADIENT, card } from "../../../theme/brand";
import { usePlanner, usePlannerCalendar } from "../hooks/usePlanner";
import CalendarView from "../components/CalendarView";
import PlannerGrid from "../components/planner/PlannerGrid";
import LessonPanel from "../components/planner/LessonPanel";
import CopyDialog from "../components/planner/CopyDialog";
import ClassDatesDialog from "../components/planner/ClassDatesDialog";
import TodayBoard from "../components/planner/TodayBoard";
import { STATUS, WEEK, hubLook, useNarrow } from "../components/planner/shared";

// The Timetable Planner (23 Nov 2026): one page to build and read timetables. Admins get every hub
// of the workspace (/timetable); a hub gets its own (/school-portal/timetable); Home Learning opens
// it on its hub and one child's class. `fixedHub` locks it to one hub.

const TABS = [["plan", "Weekly plan", FiGrid], ["today", "Today", FiClock], ["calendar", "Calendar", FiCalendar]];
const VIEWS = [["classes", "Classes"], ["educators", "Educators"], ["rooms", "Rooms"]];
const control = { padding: "8px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13, fontFamily: FONT, background: "#fff", color: BRAND.ink, minWidth: 0 };
const segment = (on) => ({ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 8, border: "none", background: on ? BRAND.navy : "transparent", color: on ? "#fff" : BRAND.inkSoft, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" });

function CalendarTab({ hubId, data }) {
  const [classId, setClassId] = useState("");
  const [range, setRange] = useState(null);
  const onRangeChange = useCallback((r) => setRange(r), []);
  const { data: calendar, isLoading } = usePlannerCalendar(hubId, range?.from, range?.to);
  const events = (calendar?.data || []).filter((e) => !classId || e.classId === classId);
  const breaks = (calendar?.breaks || []).filter((b) => !classId || (b.classIds || []).includes(classId));
  const skipped = (calendar?.skippedSessions || []).filter((s) => !classId || s.classId === classId);
  const labelOf = useMemo(() => new Map(data.classes.map((c) => [c.id, c.label])), [data.classes]);
  const educatorOf = useMemo(() => {
    const map = new Map();
    for (const c of data.classes) for (const course of c.courses) map.set(`${c.id}|${course.id}`, course.educators.map((e) => e.name).join(", "));
    return map;
  }, [data.classes]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...card, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <label htmlFor="tp-cal-class" style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>Showing</label>
        <select id="tp-cal-class" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ ...control, flex: "0 1 320px" }}>
          <option value="">All classes</option>
          {data.classes.filter((c) => c.lessons.length).map((c) => <option key={c.id} value={c.id}>{c.label}{data.hubs.length > 1 ? ` · ${c.hubName}` : ""}</option>)}
        </select>
      </div>
      <CalendarView
        events={events}
        breaks={breaks}
        skippedSessions={skipped}
        isLoading={isLoading}
        showHub={data.hubs.length > 1}
        colorBy={data.hubs.length > 1 ? "hub" : "course"}
        resolveTeacherLabel={(e) => (classId ? educatorOf.get(`${e.classId}|${e.courseId}`) || "No educator" : labelOf.get(e.classId) || e.className)}
        resolveClassLabel={(id) => labelOf.get(id)}
        onRangeChange={onRangeChange}
        emptyMessage="No sessions in this range. A lesson needs a start date to appear here."
        enableSessionDetail
        enableReschedule
      />
    </div>
  );
}

export default function TimetablePlannerPage({ fixedHub = null, initialClassId = "", heading = "Timetable", intro }) {
  const { user } = useAuth();
  // A hub's Account Manager / Training Lead reads only; staff follow their role's Timetable rights.
  const perms = useMemo(() => {
    const allowed = (action) => !user?.hubLead && can(user, "timetable", action);
    return { add: allowed("create"), change: allowed("edit"), remove: allowed("delete") };
  }, [user]);
  const [params, setParams] = useSearchParams();
  const hubParam = fixedHub?.id || params.get("planHub") || "";
  const tab = TABS.some(([k]) => k === params.get("view")) ? params.get("view") : "plan";
  const by = VIEWS.some(([k]) => k === params.get("by")) ? params.get("by") : "classes";
  const setParam = (key, value, fallback) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (!value || value === fallback) next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true });

  const { data, isLoading, isError, refetch } = usePlanner(hubParam);
  const narrow = useNarrow();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [weekendChoice, setWeekendChoice] = useState(null);
  const [panel, setPanel] = useState(null);
  const [copying, setCopying] = useState(null);
  const [datesClassId, setDatesClassId] = useState(null);

  // Home Learning opens straight on one child's class.
  useEffect(() => {
    if (!initialClassId || !data) return;
    const cls = data.classes.find((c) => c.id === initialClassId);
    if (cls) setSearch(cls.label);
  }, [initialClassId, data?.classes?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const allLessons = useMemo(() => (data?.classes || []).flatMap((c) => c.lessons.map((l) => ({ ...l, hubId: c.hubId, hubName: c.hubName, classLabel: c.label }))), [data]);
  const hasWeekend = allLessons.some((l) => ["saturday", "sunday"].includes(l.dayOfWeek));
  const showWeekend = weekendChoice ?? hasWeekend;
  const days = showWeekend ? WEEK : WEEK.slice(0, 5);
  const onlineHubIds = useMemo(() => new Set((data?.hubs || []).filter((h) => h.online).map((h) => h.id)), [data]);

  const term = search.trim().toLowerCase();
  const visibleClasses = useMemo(() => (data?.classes || []).filter((c) => (status === "all" || c.status === status) && (!term || `${c.label} ${c.hubName}`.toLowerCase().includes(term) || c.lessons.some((l) => `${l.courseName} ${l.educatorName}`.toLowerCase().includes(term)))), [data, status, term]);
  const counts = useMemo(() => {
    const out = { all: data?.classes.length || 0 };
    for (const c of data?.classes || []) out[c.status] = (out[c.status] || 0) + 1;
    return out;
  }, [data]);

  const groups = useMemo(() => {
    if (!data) return [];
    const visibleIds = new Set(visibleClasses.map((c) => c.id));
    const lessons = allLessons.filter((l) => visibleIds.has(l.classId));
    if (by === "classes") {
      const map = new Map();
      for (const c of visibleClasses) {
        const g = map.get(c.hubId) || map.set(c.hubId, { key: c.hubId, label: c.hubName, rows: [] }).get(c.hubId);
        g.rows.push({ key: c.id, cls: c, lessons: lessons.filter((l) => l.classId === c.id) });
      }
      return [...map.values()];
    }
    if (by === "educators") {
      const rows = data.educators
        .map((e) => ({ key: e.id, label: e.name, lessons: lessons.filter((l) => l.educatorIds.includes(e.id)) }))
        .filter((r) => r.lessons.length);
      const unassigned = lessons.filter((l) => !l.educatorIds.length);
      if (unassigned.length) rows.push({ key: "none", label: "No educator yet", lessons: unassigned });
      return rows.length ? [{ key: "educators", label: "Educators", rows }] : [];
    }
    return data.hubs.map((h) => {
      const hubLessons = lessons.filter((l) => l.hubId === h.id);
      const rows = data.rooms.filter((r) => r.hubId === h.id).map((r) => ({ key: r.id, label: r.name, lessons: hubLessons.filter((l) => l.roomId === r.id) }));
      const noRoom = hubLessons.filter((l) => !l.roomId);
      if (noRoom.length) rows.push({ key: `${h.id}-none`, label: "No room set", lessons: noRoom });
      return { key: h.id, label: h.name, rows };
    }).filter((g) => g.rows.length);
  }, [data, visibleClasses, allLessons, by]);

  const datesClass = data?.classes.find((c) => c.id === datesClassId) || null;
  const openLesson = (lesson, day = null) => setPanel({ lesson: data.classes.find((c) => c.id === lesson.classId)?.lessons.find((l) => l.id === lesson.id) || lesson, day });

  if (isLoading && !data) return <div style={{ padding: "60px 20px", textAlign: "center", color: BRAND.faint, fontSize: 14, fontFamily: FONT }}>Loading the timetable…</div>;
  if (isError || !data) {
    return (
      <div style={{ ...card, padding: "40px 20px", textAlign: "center", fontFamily: FONT }}>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: BRAND.inkSoft }}>We couldn't load the timetable.</p>
        <button type="button" onClick={() => refetch()} style={{ ...segment(true), padding: "9px 16px" }}>Try again</button>
      </div>
    );
  }

  const needsWork = (counts.not_set || 0) + (counts.needs_educator || 0) + (counts.needs_dates || 0);
  return (
    <div style={{ fontFamily: FONT, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div style={{ background: HERO_GRADIENT, borderRadius: 20, padding: "24px 28px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 340px", minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, letterSpacing: "-0.4px" }}>{heading}</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.55, maxWidth: 640 }}>{intro || "Plan each class's week, see who is where, and copy a timetable to other classes and hubs."}</p>
        </div>
        {perms.add && tab === "plan" && <button type="button" onClick={() => setPanel({ classId: "" })} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 11, border: "none", background: BRAND.gold, color: BRAND.navy, fontSize: 13.5, fontWeight: 800, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" }}><FiPlus /> Add lesson</button>}
      </div>

      <div style={{ ...card, padding: "8px 10px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div role="tablist" aria-label="Timetable" style={{ display: "flex", gap: 3, overflowX: "auto", maxWidth: "100%" }}>
          {TABS.map(([key, text, Icon]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setParam("view", key, "plan")} style={segment(tab === key)}><Icon size={14} /> {text}</button>)}
        </div>
        {!fixedHub && data.hubOptions.length > 1 && (
          <label style={{ marginLeft: narrow ? 0 : "auto", display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 700, color: BRAND.muted, flex: narrow ? "1 1 100%" : "0 1 auto", minWidth: 0 }}>
            Hub
            <select value={hubParam} onChange={(e) => setParam("planHub", e.target.value, "")} style={{ ...control, flex: 1 }}>
              <option value="">All hubs ({data.hubOptions.length})</option>
              {data.hubOptions.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {tab === "today" && <TodayBoard hubId={hubParam} data={data} />}
      {tab === "calendar" && <CalendarTab hubId={hubParam} data={data} />}
      {tab === "plan" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div role="group" aria-label="Show by" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 10, background: BRAND.track }}>
              {VIEWS.map(([key, text]) => <button key={key} type="button" aria-pressed={by === key} onClick={() => setParam("by", key, "classes")} style={segment(by === key)}>{text}</button>)}
            </div>
            <label style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 7, ...control }}>
              <FiSearch color={BRAND.faint} style={{ flexShrink: 0 }} />
              <input aria-label="Search classes, courses and educators" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search class, course or educator…" style={{ border: "none", outline: "none", width: "100%", minWidth: 0, fontSize: 13, fontFamily: FONT, background: "transparent" }} />
            </label>
            {!narrow && <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, cursor: "pointer" }}><input type="checkbox" checked={showWeekend} onChange={(e) => setWeekendChoice(e.target.checked)} /> Weekend</label>}
          </div>

          <div role="group" aria-label="Filter by status" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {[["all", "All"], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([key, text]) => {
              const on = status === key;
              return <button key={key} type="button" aria-pressed={on} onClick={() => setStatus(key)} style={{ padding: "5px 12px", borderRadius: 999, border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.inkSoft, fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: "pointer", whiteSpace: "nowrap" }}>{text} · {counts[key] || 0}</button>;
            })}
            {needsWork > 0 && status === "all" && <span style={{ alignSelf: "center", marginLeft: 4, fontSize: 12, color: BRAND.goldText, whiteSpace: "nowrap" }}>{needsWork} class{needsWork === 1 ? "" : "es"} need{needsWork === 1 ? "s" : ""} attention</span>}
          </div>

          {groups.length === 0 ? (
            <div style={{ ...card, padding: "40px 20px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.inkSoft }}>{data.classes.length ? "Nothing matches" : "No classes yet"}</p>
              <p style={{ margin: "5px 0 0", fontSize: 13, color: BRAND.muted }}>{data.classes.length ? (by === "classes" ? "Try another search or filter." : `No lessons to show by ${by === "rooms" ? "room" : "educator"} yet.`) : "Create a class first, then build its timetable here."}</p>
            </div>
          ) : (
            <PlannerGrid
              view={by}
              groups={groups}
              days={narrow ? WEEK : days}
              perms={perms}
              narrow={narrow}
              onlineHubIds={onlineHubIds}
              onAdd={(classId, day) => setPanel({ classId, day })}
              onOpen={(l) => openLesson(l)}
              onMove={(l, day) => openLesson(l, day)}
              onCopy={setCopying}
              onDates={(c) => setDatesClassId(c.id)}
            />
          )}
          {by === "classes" && perms.add && !narrow && groups.length > 0 && <p style={{ margin: 0, fontSize: 12, color: BRAND.faint }}>Point at any day to add a lesson. Drag a lesson to move it to another day.</p>}
          {by === "educators" && data.hubs.length > 1 && groups.length > 0 && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {data.hubs.map((h) => { const look = hubLook(h.id); return <span key={h.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: BRAND.muted }}><span aria-hidden style={{ width: 12, height: 12, borderRadius: 3, background: look.bg, border: `1px solid ${look.text}` }} />{h.name}</span>; })}
            </div>
          )}
        </>
      )}

      {panel && <LessonPanel key={`${panel.lesson?.id || "new"}-${panel.day || ""}-${panel.classId || ""}`} data={data} initial={panel} perms={perms} onClose={() => setPanel(null)} onOpenDates={(c) => { setPanel(null); setDatesClassId(c.id); }} />}
      {copying && <CopyDialog source={copying} classes={data.classes} onClose={() => setCopying(null)} />}
      {datesClass && <ClassDatesDialog cls={datesClass} onClose={() => setDatesClassId(null)} />}
    </div>
  );
}
