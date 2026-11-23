import { useState } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { BRAND, FONT } from "../../../theme/brand";
import WeekPlanner, { PlannerLegend } from "./WeekPlanner";
import { useAvailabilityWeek } from "../hooks/useAvailability";
import { addDaysTo, dateLabel, hoursLabel } from "../utils";

// The educator page (admin / hub): their week, read only. The educator sets the hours themselves.
export default function EducatorAvailabilitySection({ teacherId }) {
  const [from, setFrom] = useState("");
  const { data, isLoading, isError } = useAvailabilityWeek(teacherId, from);
  if (isLoading && !data) return <p style={{ margin: 0, fontSize: 13, color: BRAND.faint, fontFamily: FONT }}>Loading…</p>;
  if (isError || !data) return <p style={{ margin: 0, fontSize: 13, color: BRAND.muted, fontFamily: FONT }}>Couldn&apos;t load their week.</p>;
  const nav = { padding: 7, display: "flex", borderRadius: 8, border: `1.5px solid ${BRAND.border}`, background: "#fff", color: BRAND.inkSoft, cursor: "pointer" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontFamily: FONT, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <button type="button" aria-label="Previous week" onClick={() => setFrom(addDaysTo(data.week.from, -7))} style={nav}><FiChevronLeft size={14} /></button>
        <button type="button" aria-label="Next week" onClick={() => setFrom(addDaysTo(data.week.from, 7))} style={nav}><FiChevronRight size={14} /></button>
        <strong style={{ fontSize: 13, color: BRAND.ink, marginLeft: 4 }}>{dateLabel(data.week.from)} – {dateLabel(data.week.to)}</strong>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: BRAND.muted }}>{hoursLabel(data.summary.openMinutes)} open to families</span>
      </div>
      <div style={{ overflowX: "auto" }}><div style={{ minWidth: 640 }}><WeekPlanner days={data.days} /></div></div>
      <PlannerLegend />
    </div>
  );
}
