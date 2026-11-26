import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiAlertCircle, FiAlertTriangle, FiCalendar, FiCheckCircle, FiTrash2, FiUsers, FiX } from "react-icons/fi";
import { askConfirm } from "../../../../components/ui/AskDialog";
import { BRAND, FONT } from "../../../../theme/brand";
import { errorText, plannerApi, usePlannerCheck, usePlannerMutation } from "../../hooks/usePlanner";
import { DAY_LONG, DAY_SHORT, WEEK, fmtDate } from "./shared";

// Adding or changing a lesson in one place: course, educator, days, time, room and start date, with
// a live answer to "can this be saved, where does it land, and who does it affect?".

const label = { display: "block", fontSize: 12.5, fontWeight: 700, color: BRAND.inkSoft, marginBottom: 5 };
const control = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, fontSize: 13.5, fontFamily: FONT, color: BRAND.ink, background: "#fff" };

function useDebounced(value, ms = 250) {
  const [settled, setSettled] = useState(value);
  const key = JSON.stringify(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);
  return settled;
}

const Note = ({ tone, children }) => {
  const look = tone === "block"
    ? { bg: BRAND.dangerTint, border: BRAND.dangerBorder, color: BRAND.danger, Icon: FiAlertCircle }
    : { bg: BRAND.goldTint, border: BRAND.goldBorder, color: BRAND.goldText, Icon: FiAlertTriangle };
  return <p role={tone === "block" ? "alert" : undefined} style={{ display: "flex", gap: 7, margin: 0, padding: "7px 10px", borderRadius: 8, background: look.bg, border: `1px solid ${look.border}`, color: look.color, fontSize: 12.5, lineHeight: 1.45 }}><look.Icon size={14} style={{ flexShrink: 0, marginTop: 2 }} /><span>{children}</span></p>;
};

export default function LessonPanel({ data, initial, perms, onClose, onOpenDates }) {
  const lesson = initial.lesson || null;
  const isEdit = !!lesson;
  const canEdit = isEdit ? perms.change : perms.add;
  const [classId, setClassId] = useState(lesson?.classId || initial.classId || "");
  const cls = data.classes.find((c) => c.id === classId) || null;
  const [courseId, setCourseId] = useState(lesson?.courseId || "");
  const course = cls?.courses.find((c) => c.id === courseId) || null;
  const [teacherId, setTeacherId] = useState(lesson?.teacherId || "");
  const [days, setDays] = useState(() => (initial.day ? [initial.day] : lesson ? [lesson.dayOfWeek] : []));
  const [startTime, setStartTime] = useState(lesson?.startTime || "09:00");
  const [endTime, setEndTime] = useState(lesson?.endTime || "10:00");
  const [roomId, setRoomId] = useState(lesson?.roomId || "");
  const [startDate, setStartDate] = useState("");
  const [applyFrom, setApplyFrom] = useState("");
  const [correctPast, setCorrectPast] = useState(false);

  useEffect(() => { const onKey = (e) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);
  useEffect(() => { if (!isEdit) setStartDate(course?.startDate || ""); }, [course?.id, course?.startDate, isEdit]);

  const rooms = data.rooms.filter((r) => r.hubId === cls?.hubId);
  const linked = course?.educators || [];
  const educatorOptions = useMemo(() => {
    if (!cls || !courseId) return [];
    if (isEdit) return linked.map((e) => ({ id: e.id, name: e.name }));
    const linkedIds = new Set(linked.map((e) => e.id));
    const others = data.educators.filter((e) => !linkedIds.has(e.id) && e.canTeach && e.hubIds.includes(cls.hubId) && (!e.qualifiedCourseIds.length || e.qualifiedCourseIds.includes(courseId)));
    return [...linked.map((e) => ({ id: e.id, name: e.name })), ...others.map((e) => ({ id: e.id, name: e.name }))];
  }, [cls, courseId, data.educators, isEdit, linked]);

  const body = useDebounced({
    classId, courseId, teacherId: teacherId || null, roomId: roomId || null, days, startTime, endTime,
    startDate: !isEdit ? startDate || null : null, slotId: lesson?.id || null, applyFrom: applyFrom || null, correctPast,
  });
  const ready = !!classId && !!courseId && days.length > 0 && !!startTime && !!endTime;
  const { data: check, isFetching, error: checkError } = usePlannerCheck(body, (perms.change || perms.add) && !!body.classId && !!body.courseId && body.days.length > 0);

  const add = usePlannerMutation(plannerApi.saveLessons, (r) => `${r.created} lesson${r.created === 1 ? "" : "s"} added`);
  const update = usePlannerMutation(({ id, ...b }) => plannerApi.updateLesson(id, b), "Lesson updated");
  const remove = usePlannerMutation(({ id, ...params }) => plannerApi.removeLesson(id, params), "Lesson removed");
  const saving = add.isPending || update.isPending || remove.isPending;
  const inSync = JSON.stringify(body.days) === JSON.stringify(days) && body.startTime === startTime && body.endTime === endTime;
  const canSave = canEdit && ready && inSync && !isFetching && !!check?.canSave && !saving;
  const affected = check?.affected;
  const from = applyFrom || check?.defaultApplyFrom || "";
  const showApply = !!affected?.started;

  const toggleDay = (d) => {
    if (isEdit) setDays([d]);
    else setDays((list) => (list.includes(d) ? list.filter((x) => x !== d) : WEEK.filter((x) => x === d || list.includes(x))));
  };

  const save = () => {
    if (!canSave) return;
    if (isEdit) {
      update.mutate({
        id: lesson.id, dayOfWeek: days[0], startTime, endTime, teacherId: teacherId || null, roomId: roomId || null,
        ...(correctPast ? { correctPast: true } : showApply ? { applyFrom: from } : {}),
      }, { onSuccess: onClose });
      return;
    }
    const payload = { classId, courseId, teacherId: teacherId || null, roomId: roomId || null, days, startTime, endTime, startDate: startDate || null, ...(showApply ? { applyFrom: from } : {}) };
    add.mutate(payload, {
      onSuccess: onClose,
      onError: async (err) => {
        if (err.response?.data?.code !== "HAS_HELD_SESSIONS") return;
        const ok = await askConfirm({ title: "Move this course's start date?", message: `${err.response.data.message} Only do this to correct a wrong start date.`, confirmLabel: "Move it anyway", tone: "danger" });
        if (ok) add.mutate({ ...payload, confirmMove: true }, { onSuccess: onClose });
      },
    });
  };

  const removeLesson = async () => {
    const who = affected?.families ? ` ${affected.families} famil${affected.families === 1 ? "y" : "ies"} and the educators will be told.` : "";
    const ok = await askConfirm({
      title: `Remove this ${DAY_LONG[lesson.dayOfWeek]} lesson?`,
      message: showApply && !correctPast ? `It stops from ${fmtDate(from)}. Sessions before then stay on the calendar.${who}` : `It comes off the timetable.${who}`,
      confirmLabel: "Remove lesson", cancelLabel: "Keep it", tone: "danger",
    });
    if (ok) remove.mutate({ id: lesson.id, ...(correctPast ? { correctPast: "1" } : showApply ? { applyFrom: from } : {}) }, { onSuccess: onClose });
  };

  const saveLabel = saving ? "Saving…" : isEdit
    ? affected?.willNotify && affected.families ? `Save and tell ${affected.families} famil${affected.families === 1 ? "y" : "ies"}` : "Save changes"
    : days.length > 1 ? `Add ${days.length} lessons` : "Add lesson";

  return createPortal(
    <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(15,23,42,0.38)", display: "flex", justifyContent: "flex-end" }}>
      <aside role="dialog" aria-modal="true" aria-label={isEdit ? "Change lesson" : "Add lesson"} style={{ width: "min(100%, 470px)", height: "100%", background: "#fff", display: "flex", flexDirection: "column", fontFamily: FONT, boxShadow: "-12px 0 40px rgba(15,23,42,0.2)" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 18px 12px", borderBottom: `1px solid ${BRAND.line}` }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: BRAND.ink }}>{isEdit ? "Change lesson" : "Add a lesson"}</h2>
            {cls && <p style={{ margin: "1px 0 0", fontSize: 12.5, color: BRAND.muted }}>{cls.label} · {cls.hubName}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ width: 34, height: 34, borderRadius: 9, border: "none", background: BRAND.greyTint, color: BRAND.muted, display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0 }}><FiX /></button>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: 13 }}>
          {!isEdit && !initial.classId && (
            <div>
              <label htmlFor="tp-class" style={label}>Class</label>
              <select id="tp-class" value={classId} onChange={(e) => { setClassId(e.target.value); setCourseId(""); setTeacherId(""); setRoomId(""); }} style={control}>
                <option value="">Choose a class…</option>
                {data.classes.filter((c) => c.run?.state !== "ended" || c.id === classId).map((c) => <option key={c.id} value={c.id}>{c.label}{data.hubs.length > 1 ? ` · ${c.hubName}` : ""}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="tp-course" style={label}>Course</label>
            <select id="tp-course" value={courseId} disabled={isEdit || !cls} onChange={(e) => { setCourseId(e.target.value); setTeacherId(""); }} style={{ ...control, opacity: isEdit || !cls ? 0.75 : 1 }}>
              <option value="">{cls?.courses.length === 0 ? "No courses on this class's curriculum" : "Choose a course…"}</option>
              {(cls?.courses || []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.sessions ? ` (${c.sessions} sessions)` : ""}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="tp-educator" style={label}>Educator</label>
            <select id="tp-educator" value={teacherId} disabled={!courseId} onChange={(e) => setTeacherId(e.target.value)} style={{ ...control, opacity: courseId ? 1 : 0.75 }}>
              <option value="">{linked.length ? `Course's educator (${linked.map((e) => e.name).join(", ")})` : "No educator yet"}</option>
              {educatorOptions.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            {!isEdit && teacherId && !linked.some((e) => e.id === teacherId) && <p style={{ margin: "4px 0 0", fontSize: 12, color: BRAND.muted }}>They'll be assigned to this course in this class.</p>}
          </div>
          <fieldset style={{ border: "none", margin: 0, padding: 0 }}>
            <legend style={{ ...label, padding: 0 }}>{isEdit ? "Day" : "Days"}</legend>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {WEEK.map((d) => {
                const on = days.includes(d);
                return <button key={d} type="button" aria-pressed={on} aria-label={DAY_LONG[d]} onClick={() => toggleDay(d)} style={{ padding: "8px 0", borderRadius: 8, border: `1.5px solid ${on ? BRAND.navy : BRAND.border}`, background: on ? BRAND.navy : "#fff", color: on ? "#fff" : BRAND.inkSoft, fontSize: 11.5, fontWeight: 800, fontFamily: FONT, cursor: "pointer" }}>{DAY_SHORT[d]}</button>;
              })}
            </div>
          </fieldset>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="tp-start" style={label}>From</label><input id="tp-start" type="time" step={300} value={startTime} onChange={(e) => setStartTime(e.target.value)} style={control} /></div>
            <div style={{ flex: 1, minWidth: 0 }}><label htmlFor="tp-end" style={label}>To</label><input id="tp-end" type="time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} style={control} /></div>
          </div>
          <div>
            <label htmlFor="tp-room" style={label}>Room <span style={{ fontWeight: 500, color: BRAND.faint }}>(optional)</span></label>
            <select id="tp-room" value={roomId} disabled={!cls} onChange={(e) => setRoomId(e.target.value)} style={control}>
              <option value="">No room</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{r.capacity ? ` (${r.capacity})` : ""}</option>)}
            </select>
          </div>

          {!isEdit && (
            <div>
              <label htmlFor="tp-date" style={label}>Start date {course?.startDate && <span style={{ fontWeight: 500, color: BRAND.faint }}>(already set for this course)</span>}</label>
              <input id="tp-date" type="date" value={startDate} disabled={!!course?.startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...control, opacity: course?.startDate ? 0.75 : 1 }} />
              {!startDate && courseId && <p style={{ margin: "4px 0 0", fontSize: 12, color: BRAND.goldText }}>Without a start date, this lesson won't be on anyone's calendar yet.</p>}
            </div>
          )}
          {isEdit && course && (
            <button type="button" onClick={() => onOpenDates(cls)} style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6, padding: 0, border: "none", background: "none", color: BRAND.mid, fontSize: 12.5, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>
              <FiCalendar size={13} /> {course.startDate ? `Starts ${fmtDate(course.startDate)}. Change` : "Set a start date"}
            </button>
          )}

          {showApply && (
            <section style={{ padding: "11px 12px", borderRadius: 10, background: BRAND.canvas, border: `1px solid ${BRAND.line}` }}>
              <label htmlFor="tp-apply" style={label}>{isEdit ? "Apply this change from" : "Start this lesson from"}</label>
              <input id="tp-apply" type="date" min={check?.today} value={from} disabled={correctPast} onChange={(e) => setApplyFrom(e.target.value)} style={{ ...control, opacity: correctPast ? 0.6 : 1 }} />
              <p style={{ margin: "5px 0 0", fontSize: 12, color: BRAND.muted }}>Sessions before this date stay exactly as they happened.</p>
              {isEdit && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 8, fontSize: 12.5, color: BRAND.inkSoft, cursor: "pointer" }}>
                  <input type="checkbox" checked={correctPast} onChange={(e) => setCorrectPast(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>The old time was a mistake: correct past sessions too</span>
                </label>
              )}
            </section>
          )}

          {checkError && <Note tone="block">{errorText(checkError)}</Note>}
          {ready && check && (
            <section aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 6, opacity: isFetching ? 0.65 : 1 }}>
              {check.blocks.map((b, i) => <Note key={`b${i}`} tone="block">{b.message}</Note>)}
              {check.warnings.map((w, i) => <Note key={`w${i}`} tone="warn">{w.message}</Note>)}
              {check.canSave && check.placement.first && (
                <p style={{ display: "flex", gap: 7, margin: 0, padding: "7px 10px", borderRadius: 8, background: BRAND.skyTint, border: `1px solid ${BRAND.skyBorder}`, color: BRAND.navy, fontSize: 12.5, lineHeight: 1.45 }}>
                  <FiCheckCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{check.placement.continuing ? "Next session on" : "Session 1 on"} <strong>{fmtDate(check.placement.first)}</strong>{check.placement.last && check.placement.last !== check.placement.first ? <>, last session on <strong>{fmtDate(check.placement.last)}</strong></> : ""}.</span>
                </p>
              )}
              {(isEdit || affected?.started) && affected && (affected.learners > 0 || affected.educators > 0) && (
                <p style={{ display: "flex", gap: 7, margin: 0, fontSize: 12.5, color: BRAND.muted }}>
                  <FiUsers size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>Affects {affected.learners} learner{affected.learners === 1 ? "" : "s"}, {affected.families} famil{affected.families === 1 ? "y" : "ies"} and {affected.educators} educator{affected.educators === 1 ? "" : "s"}{affected.willNotify ? ". They'll be told." : "."}</span>
                </p>
              )}
            </section>
          )}
        </div>

        {(canEdit || (isEdit && perms.remove)) && (
          <footer style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderTop: `1px solid ${BRAND.line}` }}>
            {isEdit && perms.remove && <button type="button" onClick={removeLesson} disabled={saving} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 11px", borderRadius: 9, border: `1.5px solid ${BRAND.dangerBorder}`, background: "#fff", color: BRAND.danger, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}><FiTrash2 size={13} /> Remove</button>}
            <button type="button" onClick={onClose} style={{ marginLeft: "auto", padding: "9px 13px", borderRadius: 9, border: `1.5px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, fontSize: 13, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>Cancel</button>
            <button type="button" onClick={save} disabled={!canSave} hidden={!canEdit} style={{ padding: "9px 15px", borderRadius: 9, border: "none", background: canSave ? BRAND.navy : BRAND.navyBorder, color: "#fff", fontSize: 13, fontWeight: 800, fontFamily: FONT, cursor: canSave ? "pointer" : "not-allowed" }}>{saveLabel}</button>
          </footer>
        )}
      </aside>
    </div>,
    document.body,
  );
}
