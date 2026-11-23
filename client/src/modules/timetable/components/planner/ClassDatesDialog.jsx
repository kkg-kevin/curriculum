import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Modal, QaStyles, btn } from "../../../qa/shared";
import { askConfirm } from "../../../../components/ui/AskDialog";
import { BRAND, FONT } from "../../../../theme/brand";
import { useClassDateWindow, useClassPeriods } from "../../hooks/useTimetable";
import { errorText, plannerApi, usePlannerMutation } from "../../hooks/usePlanner";
import { fmtDate, fmtTime } from "./shared";

// One class's course start dates. A date anchors Session 1; the calendar does the rest, pausing
// through breaks. This class only: a bootcamp's cohort classes can each run on their own dates.

const inSession = (d, periods) => !periods.length || periods.some((p) => p.startDate && p.endDate && d >= p.startDate && d <= p.endDate && !(p.breakStartDate && p.breakEndDate && d >= p.breakStartDate && d <= p.breakEndDate));
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function firstSessionFrom(startDate, lessons, periods) {
  if (!startDate || !lessons.length) return null;
  const byDay = new Map();
  [...lessons].sort((a, b) => a.startTime.localeCompare(b.startTime)).forEach((l) => { if (!byDay.has(l.dayOfWeek)) byDay.set(l.dayOfWeek, l); });
  const d = new Date(`${startDate}T12:00:00Z`);
  for (let i = 0; i < 370; i += 1, d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const lesson = byDay.get(WEEKDAYS[d.getUTCDay()]);
    if (lesson && inSession(iso, periods)) return { date: iso, lesson };
  }
  return null;
}

function problemWith(date, periods) {
  if (!date || !periods.length) return null;
  const inside = periods.find((p) => p.startDate && p.endDate && date >= p.startDate && date <= p.endDate);
  if (inside) return null;
  const dated = periods.filter((p) => p.startDate && p.endDate);
  return dated.length ? `Outside this class's run (${fmtDate(dated[0].startDate)} to ${fmtDate(dated[dated.length - 1].endDate)}).` : "Outside this class's run.";
}

function CourseRow({ course, lessons, periods, runStart, saving, onSave }) {
  const [value, setValue] = useState(course.startDate || "");
  useEffect(() => setValue(course.startDate || ""), [course.startDate]);
  const dirty = value !== (course.startDate || "");
  const problem = problemWith(value, periods);
  const first = !problem ? firstSessionFrom(value, lessons, periods) : null;
  const blocked = !value || !dirty || !!problem || saving;
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: course.startDate ? BRAND.canvas : BRAND.goldTint, border: `1px solid ${course.startDate ? BRAND.line : BRAND.goldBorder}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 170px", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{course.name}</p>
          <p style={{ margin: "1px 0 0", fontSize: 12, color: course.startDate ? BRAND.muted : BRAND.goldText }}>{course.startDate ? `Starts ${fmtDate(course.startDate)}` : "Not set: its sessions aren't on the calendar yet"}</p>
        </div>
        <input type="date" aria-label={`${course.name} start date`} value={value} onChange={(e) => setValue(e.target.value)} style={{ padding: "7px 9px", borderRadius: 8, border: `1.5px solid ${problem ? BRAND.dangerBorder : BRAND.border}`, fontSize: 13, fontFamily: FONT }} />
        <button type="button" className="ci-btn" disabled={blocked} onClick={() => onSave(course, value)} style={btn("primary", { disabled: blocked })}>{course.startDate ? "Update" : "Set"}</button>
      </div>
      {runStart && value !== runStart && <button type="button" onClick={() => setValue(runStart)} style={{ marginTop: 5, padding: 0, border: "none", background: "none", color: BRAND.mid, fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>Use the programme's first day ({fmtDate(runStart)})</button>}
      {problem && <p role="alert" style={{ margin: "5px 0 0", fontSize: 12, color: BRAND.danger }}>{problem}</p>}
      {value && !problem && (first
        ? <p style={{ margin: "5px 0 0", fontSize: 12, color: BRAND.muted }}>Session 1 lands on <strong style={{ color: BRAND.ink }}>{fmtDate(first.date)}</strong> at {fmtTime(first.lesson.startTime)}.</p>
        : <p style={{ margin: "5px 0 0", fontSize: 12, color: BRAND.danger }}>None of this course's lessons fall inside the class's run after this date.</p>)}
    </div>
  );
}

export default function ClassDatesDialog({ cls, onClose }) {
  const { data: periodsData } = useClassPeriods(cls.id);
  const { data: window } = useClassDateWindow(cls.id);
  const periods = Array.isArray(periodsData) ? periodsData : [];
  const runStart = window?.startDate || "";
  const courses = cls.courses.filter((c) => cls.lessons.some((l) => l.courseId === c.id));
  const [allDate, setAllDate] = useState(runStart || "");
  useEffect(() => { if (runStart) setAllDate((d) => d || runStart); }, [runStart]);
  const save = usePlannerMutation(plannerApi.setStartDate, null);
  const allProblem = problemWith(allDate, periods);

  const saveOne = async (course, startDate, { quiet = false } = {}) => {
    const payload = { classId: cls.id, courseId: course.id, startDate };
    try {
      await save.mutateAsync(payload);
      if (!quiet) toast.success("Start date saved");
      return true;
    } catch (err) {
      const res = err.response?.data || {};
      if (res.code !== "HAS_HELD_SESSIONS" || quiet) return false;
      const ok = await askConfirm({ title: `Move ${course.name}'s start date?`, message: `${res.message} Only do this to correct a wrong start date.`, confirmLabel: "Move it anyway", tone: "danger" });
      if (!ok) return false;
      try { await save.mutateAsync({ ...payload, confirmMove: true }); toast.success("Start date moved"); return true; } catch (e) { toast.error(errorText(e)); return false; }
    }
  };
  const saveAll = async () => {
    let left = 0;
    for (const c of courses) {
      if (c.startDate === allDate) continue;
      if (!(await saveOne(c, allDate, { quiet: true }))) left += 1;
    }
    if (left) toast.error(`${left} course${left === 1 ? "" : "s"} kept ${left === 1 ? "its" : "their"} date. Change ${left === 1 ? "it" : "them"} on ${left === 1 ? "its" : "their"} own row.`);
    else toast.success("Start dates saved");
  };

  return (
    <Modal title={`Start dates · ${cls.label}`} onClose={onClose} width={620} footer={<button type="button" className="ci-btn" onClick={onClose} style={btn("primary")}>Done</button>}>
      <QaStyles />
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "100%", fontFamily: FONT }}>
        {courses.length > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "9px 12px", borderRadius: 10, border: `1px dashed ${BRAND.skyBorder}` }}>
            <span style={{ flex: "1 1 180px", fontSize: 13, fontWeight: 700, color: BRAND.navy }}>Same date for all {courses.length} courses</span>
            <input type="date" aria-label="Start date for every course" value={allDate} onChange={(e) => setAllDate(e.target.value)} style={{ padding: "7px 9px", borderRadius: 8, border: `1.5px solid ${allProblem ? BRAND.dangerBorder : BRAND.border}`, fontSize: 13, fontFamily: FONT }} />
            <button type="button" className="ci-btn" disabled={!allDate || !!allProblem || save.isPending} onClick={saveAll} style={btn("primary", { disabled: !allDate || !!allProblem || save.isPending })}>Set all</button>
            {allProblem && <p role="alert" style={{ flexBasis: "100%", margin: 0, fontSize: 12, color: BRAND.danger }}>{allProblem}</p>}
          </div>
        )}
        {courses.map((c) => <CourseRow key={c.id} course={c} lessons={cls.lessons.filter((l) => l.courseId === c.id)} periods={periods} runStart={runStart} saving={save.isPending} onSave={saveOne} />)}
        {!courses.length && <p style={{ margin: 0, fontSize: 13, color: BRAND.muted }}>Add a lesson first, then set its start date.</p>}
      </div>
    </Modal>
  );
}
