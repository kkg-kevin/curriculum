import { Fragment, useMemo, useState } from "react";
import { FiAlertTriangle, FiCalendar, FiChevronDown, FiChevronRight, FiCopy, FiPlus, FiUsers } from "react-icons/fi";
import { BRAND, FONT, card, pill } from "../../../../theme/brand";
import { DAY_LONG, DAY_SHORT, STATUS, fmtRange, hubLook, toMin, travelFlags } from "./shared";
import ClassRunBadge from "../../../classes/components/ClassRun";

// The week as a grid: one row per class, educator or room, one column per day. On a phone each row
// becomes a card. Dragging a lesson to another day of its class opens it, ready to confirm.

const CSS = `
  .tp-cell:hover .tp-add, .tp-add:focus-visible { opacity: 1; }
  .tp-add { opacity: 0; transition: opacity 120ms ease; }
  .tp-cell[data-drop="true"] { background: ${BRAND.skyTint} !important; box-shadow: inset 0 0 0 2px ${BRAND.sky}; }
  .tp-chip:focus-visible { outline: 2px solid ${BRAND.mid}; outline-offset: 1px; }
  @media (hover: none) { .tp-add { opacity: 1; } }
`;

function LessonChip({ lesson, look, line, flagged, canEdit, draggable, onOpen, onDragState }) {
  const problem = lesson.educatorIds.length === 0;
  return (
    <button
      type="button"
      className="tp-chip"
      draggable={draggable}
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", lesson.id); e.dataTransfer.effectAllowed = "move"; onDragState?.(lesson); }}
      onDragEnd={() => onDragState?.(null)}
      onClick={() => onOpen(lesson)}
      title={[lesson.courseName, fmtRange(lesson.startTime, lesson.endTime), lesson.educatorName || "No educator", lesson.roomName].filter(Boolean).join(" · ")}
      aria-label={`${lesson.courseName}, ${DAY_LONG[lesson.dayOfWeek]} ${fmtRange(lesson.startTime, lesson.endTime)}${canEdit ? ". Open to change" : ""}`}
      style={{ display: "block", width: "100%", boxSizing: "border-box", textAlign: "left", padding: "5px 7px", borderRadius: 7, background: look.bg, border: `1px solid ${flagged || problem ? BRAND.gold : look.border}`, borderLeft: `3px solid ${flagged || problem ? BRAND.gold : look.text}`, color: look.text, cursor: draggable ? "grab" : "pointer", fontFamily: FONT, minWidth: 0 }}
    >
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>{fmtRange(lesson.startTime, lesson.endTime)}</span>
      <span style={{ display: "block", fontSize: 12, fontWeight: 800, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lesson.courseName}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, opacity: 0.9, overflow: "hidden", whiteSpace: "nowrap" }}>
        {(flagged || problem) && <FiAlertTriangle size={10} style={{ flexShrink: 0 }} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{flagged ? "Tight travel" : problem ? "No educator" : line}</span>
      </span>
    </button>
  );
}

function ClassHead({ cls, perms, onCopy, onDates }) {
  const status = STATUS[cls.status];
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: BRAND.ink, overflowWrap: "anywhere" }}>{cls.label}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 3 }}>
        {cls.run?.state !== "ended" && <span style={pill(status.tone, { fontSize: 10.5, padding: "2px 7px" })}>{status.label}</span>}
        {cls.run && <ClassRunBadge cls={{ bootcampRun: cls.run }} style={{ fontSize: 10.5, padding: "2px 7px" }} />}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: BRAND.muted }}><FiUsers size={10} /> {cls.learners}</span>
      </div>
      {(perms.change || perms.add) && cls.lessons.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {perms.change && <button type="button" onClick={() => onDates(cls)} aria-label={`Start dates for ${cls.label}`} style={linkBtn}><FiCalendar size={11} /> Dates</button>}
          {perms.add && <button type="button" onClick={() => onCopy(cls)} aria-label={`Copy ${cls.label}'s timetable`} style={linkBtn}><FiCopy size={11} /> Copy</button>}
        </div>
      )}
    </div>
  );
}
const linkBtn = { display: "inline-flex", alignItems: "center", gap: 3, padding: 0, border: "none", background: "none", color: BRAND.mid, fontSize: 11, fontWeight: 700, fontFamily: FONT, cursor: "pointer" };

export default function PlannerGrid({ view, groups, days, perms, narrow, onlineHubIds, onAdd, onOpen, onMove, onCopy, onDates }) {
  const [closed, setClosed] = useState(() => new Set());
  const [dragging, setDragging] = useState(null);
  const [dropKey, setDropKey] = useState(null);
  const toggle = (key) => setClosed((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const flaggedByRow = useMemo(() => {
    const map = new Map();
    if (view === "educators") for (const g of groups) for (const r of g.rows) map.set(r.key, travelFlags(r.lessons, onlineHubIds));
    return map;
  }, [groups, view, onlineHubIds]);

  const lineFor = (l) => (view === "classes" ? [l.educatorName, l.roomName].filter(Boolean).join(" · ") : view === "educators" ? `${l.classLabel} · ${l.hubName}` : `${l.classLabel} · ${l.educatorName || "No educator"}`);
  const lookFor = (l) => hubLook(view === "educators" ? l.hubId : l.courseId);
  const chips = (row, day) => row.lessons.filter((l) => l.dayOfWeek === day).sort((a, b) => toMin(a.startTime) - toMin(b.startTime)).map((l) => (
    <LessonChip
      key={l.id}
      lesson={l}
      look={lookFor(l)}
      line={lineFor(l)}
      flagged={flaggedByRow.get(row.key)?.has(l.id)}
      canEdit={perms.change}
      draggable={perms.change && view === "classes" && !narrow}
      onOpen={onOpen}
      onDragState={setDragging}
    />
  ));

  if (narrow) {
    return (
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "100%" }}>
        {groups.map((g) => (
          <section key={g.key} style={{ display: "grid", gap: 8, gridTemplateColumns: "100%" }}>
            <h3 style={{ margin: "2px 2px 0", fontSize: 12, fontWeight: 800, color: BRAND.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{g.label}</h3>
            {g.rows.map((row) => (
              <article key={row.key} style={{ ...card, padding: "12px 13px" }}>
                {view === "classes" ? <ClassHead cls={row.cls} perms={perms} onCopy={onCopy} onDates={onDates} /> : <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{row.label}</p>}
                <div style={{ display: "grid", gap: 6, gridTemplateColumns: "100%", marginTop: 9 }}>
                  {days.filter((d) => row.lessons.some((l) => l.dayOfWeek === d)).map((d) => (
                    <div key={d} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ width: 34, flexShrink: 0, paddingTop: 6, fontSize: 11.5, fontWeight: 800, color: BRAND.muted }}>{DAY_SHORT[d]}</span>
                      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 5, gridTemplateColumns: "100%" }}>{chips(row, d)}</div>
                    </div>
                  ))}
                  {!row.lessons.length && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.faint }}>No lessons yet</p>}
                </div>
                {perms.add && view === "classes" && <button type="button" onClick={() => onAdd(row.cls.id, null)} style={{ ...linkBtn, marginTop: 9, fontSize: 12.5 }}><FiPlus size={13} /> Add lesson</button>}
              </article>
            ))}
          </section>
        ))}
      </div>
    );
  }

  const first = view === "classes" ? "Class" : view === "educators" ? "Educator" : "Room";
  return (
    <div style={{ ...card, overflowX: "auto" }}>
      <style>{CSS}</style>
      <table style={{ width: "100%", minWidth: 190 + days.length * 122, borderCollapse: "separate", borderSpacing: 0, tableLayout: "fixed", fontFamily: FONT }}>
        <colgroup><col style={{ width: 190 }} />{days.map((d) => <col key={d} />)}</colgroup>
        <thead>
          <tr>
            <th scope="col" style={{ ...thBase, position: "sticky", left: 0, zIndex: 3, textAlign: "left" }}>{first}</th>
            {days.map((d) => <th key={d} scope="col" style={thBase}>{DAY_SHORT[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const shut = closed.has(g.key);
            return (
              <Fragment key={g.key}>
                {groups.length > 1 && (
                  <tr>
                    <th colSpan={days.length + 1} scope="colgroup" style={{ padding: 0, background: BRAND.canvas, borderBottom: `1px solid ${BRAND.line}`, textAlign: "left" }}>
                      <button type="button" aria-expanded={!shut} onClick={() => toggle(g.key)} style={{ position: "sticky", left: 0, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "none", background: "none", color: BRAND.navy, fontSize: 12.5, fontWeight: 800, fontFamily: FONT, cursor: "pointer" }}>
                        {shut ? <FiChevronRight size={14} /> : <FiChevronDown size={14} />} {g.label} <span style={{ fontWeight: 600, color: BRAND.muted }}>· {g.rows.length}</span>
                      </button>
                    </th>
                  </tr>
                )}
                {!shut && g.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row" style={{ position: "sticky", left: 0, zIndex: 2, background: "#fff", padding: "8px 10px 8px 12px", borderBottom: `1px solid ${BRAND.line}`, borderRight: `1px solid ${BRAND.line}`, textAlign: "left", verticalAlign: "top", fontWeight: 400 }}>
                      {view === "classes" ? <ClassHead cls={row.cls} perms={perms} onCopy={onCopy} onDates={onDates} /> : <span style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink, overflowWrap: "anywhere" }}>{row.label}</span>}
                    </th>
                    {days.map((d) => {
                      const key = `${row.key}|${d}`;
                      const canDrop = view === "classes" && dragging?.classId === row.cls?.id && dragging?.dayOfWeek !== d;
                      return (
                        <td
                          key={d}
                          className="tp-cell"
                          data-drop={dropKey === key ? "true" : undefined}
                          onDragOver={canDrop ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropKey(key); } : undefined}
                          onDragLeave={canDrop ? () => setDropKey(null) : undefined}
                          onDrop={canDrop ? (e) => { e.preventDefault(); setDropKey(null); const l = dragging; setDragging(null); onMove(l, d); } : undefined}
                          style={{ padding: 4, borderBottom: `1px solid ${BRAND.line}`, borderRight: `1px solid ${BRAND.line}`, verticalAlign: "top", minHeight: 58 }}
                        >
                          <div style={{ display: "grid", gap: 4, gridTemplateColumns: "100%" }}>
                            {chips(row, d)}
                            {perms.add && view === "classes" && (
                              <button type="button" className="tp-add" onClick={() => onAdd(row.cls.id, d)} aria-label={`Add a lesson for ${row.cls.label} on ${DAY_LONG[d]}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 24, border: `1px dashed ${BRAND.skyBorder}`, borderRadius: 6, background: "transparent", color: BRAND.mid, cursor: "pointer" }}><FiPlus size={13} /></button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thBase = { padding: "9px 8px", background: "#FAFBFC", borderBottom: `1px solid ${BRAND.border}`, fontSize: 11.5, fontWeight: 800, color: BRAND.inkSoft, textTransform: "uppercase", letterSpacing: "0.03em", textAlign: "center" };
