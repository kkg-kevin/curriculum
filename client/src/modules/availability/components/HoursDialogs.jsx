import { useState } from "react";
import { Modal, QaStyles, btn, input, label } from "../../qa/shared";
import { BRAND, FONT } from "../../../theme/brand";
import { DAYS, DAY_LONG, TIME_OPTIONS, fmtRange, fmtTime, toMin } from "../utils";

// Adding or changing one block of hours, and copying a day's hours to other days.

function TimeSelect({ id, value, onChange, labelText }) {
  const options = TIME_OPTIONS.includes(value) || !value ? TIME_OPTIONS : [...TIME_OPTIONS, value].sort();
  return (
    <div style={{ flex: "1 1 140px", minWidth: 0 }}>
      <label htmlFor={id} style={label}>{labelText}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={input}>
        {options.map((t) => <option key={t} value={t}>{fmtTime(t)}</option>)}
      </select>
    </div>
  );
}

export function HoursDialog({ initial, onSave, onRemove, onClose }) {
  const editing = !!initial.startTime;
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek || "monday");
  const [startTime, setStartTime] = useState(initial.startTime || "16:00");
  const [endTime, setEndTime] = useState(initial.endTime || "18:00");
  const problem = toMin(endTime) <= toMin(startTime) ? "The end time must be after the start time." : toMin(endTime) - toMin(startTime) < 30 ? "Make it at least 30 minutes." : "";
  return (
    <Modal
      title={editing ? "Change these hours" : "Add hours"}
      onClose={onClose}
      width={460}
      footer={(
        <>
          {editing && <button type="button" className="ci-btn" onClick={onRemove} style={{ ...btn("danger"), marginRight: "auto" }}>Remove</button>}
          <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
          <button type="button" className="ci-btn" disabled={!!problem} onClick={() => onSave({ dayOfWeek, startTime, endTime })} style={btn("primary", { disabled: !!problem })}>{editing ? "Save" : "Add hours"}</button>
        </>
      )}
    >
      <QaStyles />
      <label htmlFor="av-day" style={label}>Day</label>
      <select id="av-day" value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} style={{ ...input, marginBottom: 12 }}>
        {DAYS.map((d) => <option key={d} value={d}>{DAY_LONG[d]}</option>)}
      </select>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <TimeSelect id="av-start" labelText="From" value={startTime} onChange={setStartTime} />
        <TimeSelect id="av-end" labelText="To" value={endTime} onChange={setEndTime} />
      </div>
      {problem
        ? <p role="alert" style={{ margin: "10px 0 0", fontSize: 12.5, color: BRAND.danger }}>{problem}</p>
        : <p style={{ margin: "10px 0 0", fontSize: 12.5, color: BRAND.muted, lineHeight: 1.5 }}>Repeats every {DAY_LONG[dayOfWeek]}. If a class falls in this time, the class comes first and families can&apos;t book that part.</p>}
    </Modal>
  );
}

export function CopyDayDialog({ fromDay, windows, onCopy, onClose }) {
  const [chosen, setChosen] = useState([]);
  const hours = windows.filter((w) => w.dayOfWeek === fromDay);
  const others = DAYS.filter((d) => d !== fromDay);
  const toggle = (d) => setChosen((list) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]));
  return (
    <Modal
      title={`Copy ${DAY_LONG[fromDay]}'s hours`}
      onClose={onClose}
      width={460}
      footer={(
        <>
          <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
          <button type="button" className="ci-btn" disabled={!chosen.length} onClick={() => onCopy(chosen)} style={btn("primary", { disabled: !chosen.length })}>{chosen.length ? `Copy to ${chosen.length} day${chosen.length === 1 ? "" : "s"}` : "Copy"}</button>
        </>
      )}
    >
      <QaStyles />
      <p style={{ margin: "0 0 12px", fontSize: 13, color: BRAND.inkSoft }}>{hours.map(fmtRange).join(", ")}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {[["Weekdays", others.filter((d) => !["saturday", "sunday"].includes(d))], ["Every day", others]].map(([text, list]) => (
          <button key={text} type="button" onClick={() => setChosen(list)} style={{ padding: "5px 12px", borderRadius: 999, border: `1px solid ${BRAND.skyBorder}`, background: BRAND.skyTint, color: BRAND.navy, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>{text}</button>
        ))}
      </div>
      <div style={{ display: "grid", gap: 2, gridTemplateColumns: "100%" }}>
        {others.map((d) => (
          <label key={d} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", fontSize: 13.5, color: BRAND.ink, cursor: "pointer" }}>
            <input type="checkbox" checked={chosen.includes(d)} onChange={() => toggle(d)} style={{ width: 16, height: 16 }} /> {DAY_LONG[d]}
          </label>
        ))}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 12, color: BRAND.muted }}>Added to any hours those days already have.</p>
    </Modal>
  );
}
