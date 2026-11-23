import { useMemo, useRef, useState } from "react";
import { BRAND, FONT } from "../../../theme/brand";
import { DAY_SHORT, dateLabel, fmtRange, fmtTime, toMin, toTime } from "../utils";

// The week at a glance: the hours a mentor offers families, with what's really on each date laid
// over them. Classes always sit on top, because the timetable wins. With `onAdd` / `onResize` it can
// be edited by dragging (desktop); `onOpen` opens one block of hours by click, tap or keyboard.

const HOUR = 46;
const LAST_MINUTE = 23 * 60 + 30;
const SNAP = 30;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

const LOOK = {
  class: { background: BRAND.navy, color: "#fff", border: BRAND.navyDeep },
  booking: { background: BRAND.gold, color: BRAND.navyDeep, border: "#E79A1F" },
  checkin: { background: BRAND.navyTint, color: BRAND.navy, border: BRAND.navyBorder },
  clash: { background: BRAND.goldTint, color: BRAND.goldText, border: BRAND.danger },
  busy: { background: "#D9DEE6", color: BRAND.greyText, border: "#C5CCD6" },
};

// Things at the same time sit side by side, so a session a class landed on never hides the class.
function withLanes(items) {
  const sorted = [...items].sort((a, b) => toMin(a.startTime) - toMin(b.startTime) || (a.kind === "class" ? -1 : 1));
  const out = [];
  let group = [];
  let groupEnd = -1;
  const close = () => {
    const laneEnds = [];
    const placed = group.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= toMin(item.startTime));
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = toMin(item.endTime);
      return { item, lane };
    });
    placed.forEach((p) => out.push({ ...p, lanes: laneEnds.length }));
    group = [];
  };
  for (const item of sorted) {
    if (group.length && toMin(item.startTime) >= groupEnd) close();
    group.push(item);
    groupEnd = group.length === 1 ? toMin(item.endTime) : Math.max(groupEnd, toMin(item.endTime));
  }
  if (group.length) close();
  return out;
}

function ItemBlock({ item, top, height, familyView, lane = 0, lanes = 1 }) {
  const look = familyView ? LOOK.busy : item.needsNewTime ? LOOK.clash : LOOK[item.kind] || LOOK.busy;
  const title = familyView ? "Busy" : item.needsNewTime ? "Needs a new time" : item.title;
  const when = fmtRange(item);
  return (
    <div
      title={familyView ? `Busy · ${when}` : [item.title, item.subtitle, when].filter(Boolean).join(" · ")}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ position: "absolute", top: top + 1, height: Math.max(height - 2, 16), left: `calc(${(lane / lanes) * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)`, zIndex: 3, background: look.background, color: look.color, borderLeft: `3px solid ${look.border}`, borderRadius: 6, padding: "2px 5px", overflow: "hidden", boxSizing: "border-box", cursor: "default" }}
    >
      <div style={{ fontSize: 10.5, fontWeight: 800, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
      {height >= 34 && <div style={{ fontSize: 9.5, lineHeight: 1.25, opacity: 0.9, whiteSpace: "nowrap" }}>{fmtTime(item.startTime)}</div>}
      {height >= 52 && item.subtitle && !familyView && <div style={{ fontSize: 9.5, lineHeight: 1.25, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.subtitle}</div>}
    </div>
  );
}

export default function WeekPlanner({ days, familyView = false, onAdd, onResize, onOpen, compact = false }) {
  const canDrag = !!onAdd && !familyView;
  const [drag, setDrag] = useState(null);
  const dragRef = useRef(null);

  const { axisStart, axisEnd } = useMemo(() => {
    let low = 7 * 60;
    let high = 20 * 60;
    for (const d of days) {
      for (const r of [...d.offered, ...d.items]) {
        low = Math.min(low, toMin(r.startTime));
        high = Math.max(high, toMin(r.endTime));
      }
    }
    return { axisStart: Math.floor(low / 60) * 60, axisEnd: Math.min(24 * 60, Math.ceil(high / 60) * 60) };
  }, [days]);

  const y = (minutes) => ((minutes - axisStart) / 60) * HOUR;
  const gridHeight = y(axisEnd);
  const hours = [];
  for (let m = axisStart; m <= axisEnd; m += 60) hours.push(m);

  const minuteAt = (e, el) => {
    const raw = axisStart + ((e.clientY - el.getBoundingClientRect().top) / HOUR) * 60;
    return clamp(Math.round(raw / SNAP) * SNAP, axisStart, Math.min(axisEnd, LAST_MINUTE));
  };

  const begin = (e, dayOfWeek, mode, range) => {
    if (!canDrag || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const column = e.currentTarget.closest("[data-planner-column]");
    column.setPointerCapture?.(e.pointerId);
    const at = minuteAt(e, column);
    const next = mode === "create"
      ? { dayOfWeek, mode, anchor: at, start: at, end: Math.min(at + SNAP, LAST_MINUTE), moved: false }
      : { dayOfWeek, mode, original: range, start: toMin(range.startTime), end: toMin(range.endTime), moved: false };
    dragRef.current = next;
    setDrag(next);
  };

  const move = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const at = minuteAt(e, e.currentTarget);
    let next = d;
    if (d.mode === "create") {
      next = at >= d.anchor
        ? { ...d, start: d.anchor, end: Math.max(at, d.anchor + SNAP), moved: d.moved || at !== d.anchor }
        : { ...d, start: at, end: d.anchor, moved: true };
    } else if (d.mode === "top") next = { ...d, start: Math.min(at, d.end - SNAP), moved: true };
    else if (d.mode === "bottom") next = { ...d, end: Math.max(at, d.start + SNAP), moved: true };
    dragRef.current = next;
    setDrag(next);
  };

  const finish = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!d) return;
    if (d.mode === "create") {
      const end = d.moved ? d.end : Math.min(d.start + 60, LAST_MINUTE);
      if (end > d.start) onAdd(d.dayOfWeek, toTime(d.start), toTime(end));
    } else if (d.moved) {
      onResize?.(d.dayOfWeek, d.original, { startTime: toTime(d.start), endTime: toTime(d.end) });
    }
  };
  const cancel = () => { dragRef.current = null; setDrag(null); };

  return (
    <div style={{ display: "flex", border: `1px solid ${BRAND.border}`, borderRadius: 12, overflow: "hidden", fontFamily: FONT, background: "#fff", userSelect: drag ? "none" : undefined }}>
      <div style={{ width: 50, flexShrink: 0, borderRight: `1px solid ${BRAND.border}`, background: "#FAFBFC" }}>
        <div style={{ height: 42, borderBottom: `1px solid ${BRAND.border}` }} />
        <div style={{ position: "relative", height: gridHeight }}>
          {hours.map((m) => <div key={m} style={{ position: "absolute", top: y(m) - 6, right: 5, fontSize: 9.5, fontWeight: 700, color: BRAND.faint, whiteSpace: "nowrap" }}>{m < 24 * 60 ? fmtTime(m).replace(":00", "") : ""}</div>)}
        </div>
      </div>

      {days.map((day, i) => {
        const dragging = drag?.dayOfWeek === day.dayOfWeek ? drag : null;
        return (
          <div key={day.date} style={{ flex: 1, minWidth: 0, borderRight: i < days.length - 1 ? `1px solid ${BRAND.border}` : "none", opacity: day.isPast && !compact ? 0.62 : 1 }}>
            <div style={{ height: 42, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderBottom: `1px solid ${BRAND.border}`, background: day.isToday ? BRAND.skyTint : "#FAFBFC" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: day.isToday ? BRAND.navy : BRAND.inkSoft, textTransform: "uppercase", letterSpacing: ".03em" }}>{DAY_SHORT[day.dayOfWeek]}</span>
              <span style={{ fontSize: 10, color: BRAND.muted }}>{dateLabel(day.date)}</span>
            </div>

            <div
              data-planner-column
              onPointerDown={canDrag ? (e) => begin(e, day.dayOfWeek, "create") : undefined}
              onPointerMove={canDrag ? move : undefined}
              onPointerUp={canDrag ? finish : undefined}
              onPointerCancel={canDrag ? cancel : undefined}
              style={{ position: "relative", height: gridHeight, cursor: canDrag ? "crosshair" : "default", touchAction: canDrag ? "none" : "auto" }}
            >
              {hours.map((m) => <div key={m} style={{ position: "absolute", top: y(m), left: 0, right: 0, borderTop: `1px solid ${BRAND.line}`, pointerEvents: "none" }} />)}

              {!familyView && day.offered.map((r) => {
                const editingThis = dragging && dragging.mode !== "create" && dragging.original.startTime === r.startTime;
                const start = editingThis ? dragging.start : toMin(r.startTime);
                const end = editingThis ? dragging.end : toMin(r.endTime);
                return (
                  <div key={r.startTime} style={{ position: "absolute", top: y(start), height: y(end) - y(start), left: 2, right: 2, zIndex: 1 }}>
                    <button
                      type="button"
                      aria-label={`Your hours on ${day.dayOfWeek}, ${fmtRange(r)}${onOpen ? ". Open to change" : ""}`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={onOpen ? () => onOpen(day.dayOfWeek, r) : undefined}
                      style={{ position: "absolute", inset: 0, width: "100%", background: "#F2F9FE", border: `1.5px dashed ${BRAND.skyBorder}`, borderRadius: 7, cursor: onOpen ? "pointer" : "default", padding: 0 }}
                    />
                    {canDrag && (
                      <>
                        <div aria-hidden onPointerDown={(e) => begin(e, day.dayOfWeek, "top", r)} style={{ position: "absolute", top: -3, left: 0, right: 0, height: 8, cursor: "ns-resize", zIndex: 5 }} />
                        <div aria-hidden onPointerDown={(e) => begin(e, day.dayOfWeek, "bottom", r)} style={{ position: "absolute", bottom: -3, left: 0, right: 0, height: 8, cursor: "ns-resize", zIndex: 5 }} />
                      </>
                    )}
                  </div>
                );
              })}

              {!dragging && day.open.map((r) => (
                <div key={`open-${r.startTime}`} style={{ position: "absolute", top: y(toMin(r.startTime)) + 1, height: y(toMin(r.endTime)) - y(toMin(r.startTime)) - 2, left: 3, right: 3, zIndex: 2, background: BRAND.skyTint, borderLeft: `3px solid ${BRAND.sky}`, borderRadius: 6, padding: "2px 5px", overflow: "hidden", boxSizing: "border-box", pointerEvents: "none" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: BRAND.skyText, whiteSpace: "nowrap" }}>{familyView ? "Bookable" : "Open"}</div>
                  {y(toMin(r.endTime)) - y(toMin(r.startTime)) >= 34 && <div style={{ fontSize: 9.5, color: BRAND.skyText, whiteSpace: "nowrap" }}>{fmtTime(r.startTime)}</div>}
                </div>
              ))}

              {!familyView && day.byClass.map((r) => (
                <div key={`class-${r.startTime}`} style={{ position: "absolute", top: y(toMin(r.startTime)), height: y(toMin(r.endTime)) - y(toMin(r.startTime)), left: 2, right: 2, zIndex: 2, borderRadius: 7, pointerEvents: "none", background: `repeating-linear-gradient(135deg, ${BRAND.navyTint}, ${BRAND.navyTint} 4px, #fff 4px, #fff 8px)` }} />
              ))}

              {withLanes(day.items).map(({ item, lane, lanes }, n) => (
                <ItemBlock key={`${item.kind}-${item.startTime}-${n}`} item={item} lane={lane} lanes={lanes} familyView={familyView} top={y(toMin(item.startTime))} height={y(toMin(item.endTime)) - y(toMin(item.startTime))} />
              ))}

              {dragging && (
                <div style={{ position: "absolute", top: y(dragging.start), height: y(dragging.end) - y(dragging.start), left: 3, right: 3, zIndex: 6, background: "rgba(56,170,225,0.28)", border: `2px solid ${BRAND.sky}`, borderRadius: 7, pointerEvents: "none", padding: "2px 5px", boxSizing: "border-box" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: BRAND.navy, whiteSpace: "nowrap" }}>{fmtTime(dragging.start)} – {fmtTime(dragging.end)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PlannerLegend({ familyView = false }) {
  const swatch = (background, extra = {}) => <span aria-hidden style={{ width: 13, height: 13, borderRadius: 4, background, flexShrink: 0, ...extra }} />;
  const rows = familyView
    ? [[swatch(BRAND.skyTint, { borderLeft: `3px solid ${BRAND.sky}` }), "Families can book"], [swatch("#D9DEE6"), "Busy"]]
    : [
      [swatch(BRAND.skyTint, { borderLeft: `3px solid ${BRAND.sky}` }), "Open to families"],
      [swatch(BRAND.navy), "Class (always comes first)"],
      [swatch(`repeating-linear-gradient(135deg, ${BRAND.navyTint}, ${BRAND.navyTint} 3px, #fff 3px, #fff 6px)`, { border: `1px solid ${BRAND.navyBorder}` }), "Your hours a class has taken"],
      [swatch(BRAND.gold), "Mentor session"],
      [swatch(BRAND.navyTint, { border: `1px solid ${BRAND.navyBorder}` }), "Parent check-in"],
    ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", fontFamily: FONT }}>
      {rows.map(([icon, text]) => <span key={text} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: BRAND.muted }}>{icon}{text}</span>)}
    </div>
  );
}
