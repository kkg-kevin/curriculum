import { useState } from "react";
import { FiEdit2, FiPlus, FiSlash } from "react-icons/fi";
import { useQaMutation, useQaSchedules } from "../hooks/useQa";
import { qaApi } from "../services/qaApi";
import VisitDialog from "./VisitDialog";
import { Empty, FREQUENCY_LABEL, Pill, Segmented, T, VisitTypePill, btn, card, formatDate, hint, toolbar } from "../shared";

// Regular visits — one schedule per educator: set one up, change it, or end it. Ending stops new
// visits and removes the upcoming ones not started; every report stays.
export default function SchedulesTab({ teacherId = "" }) {
  const [status, setStatus] = useState("active");
  const [dialog, setDialog] = useState(null); // { schedule? }
  const { data = [], isLoading, isError, error } = useQaSchedules({ status, ...(teacherId ? { teacherId } : {}) });
  const end = useQaMutation((id) => qaApi.endSchedule(id), "Schedule ended");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={toolbar}>
        <Segmented label="Show" options={[{ key: "active", label: "Active" }, { key: "ended", label: "Ended" }]} value={status} onChange={setStatus} />
        <button type="button" className="ci-btn" onClick={() => setDialog({})} style={btn("primary")}><FiPlus size={15} /> Schedule regular visits</button>
      </div>
      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Schedules couldn't be loaded."}</p>}
        {!isLoading && data.length === 0 && <Empty title={status === "active" ? "No regular visits set up" : "No ended schedules"}>{status === "active" ? "Schedule visits for an educator — every term, every month… announced or by surprise." : null}</Empty>}
        {data.map((s) => (
          <div key={s.id} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "14px 18px", borderTop: "1px solid #F3F4F6" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14, color: T.ink }}>{s.teacherName}</strong>
                <Pill look={{ bg: "#EFF6FF", color: "#1D4ED8" }}>{FREQUENCY_LABEL[s.frequency] || s.frequency}</Pill>
                <VisitTypePill type={s.visitType} />
                {s.status === "ended" && <Pill look={{ bg: "#F3F4F6", color: "#6B7280" }}>Ended</Pill>}
              </div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: T.inkMuted, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>From {formatDate(s.startDate)}{s.status === "ended" && s.endDate ? ` to ${formatDate(s.endDate)}` : ""}</span>
                {s.hubName && <span>{s.hubName}</span>}
                <span>{s.templateName || "Template"}</span>
                <span>By {s.reviewerName || "—"}</span>
              </div>
            </div>
            {s.status === "active" && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button type="button" className="ci-btn" onClick={() => setDialog({ schedule: s })} style={btn("secondary", { size: "sm" })}><FiEdit2 size={13} /> Edit</button>
                <button
                  type="button"
                  disabled={end.isPending}
                  onClick={() => {
                    if (window.confirm(`End the regular visits to ${s.teacherName}? No more will come round, and the upcoming ones not started are removed. Reports stay.`)) end.mutate(s.id);
                  }}
                  className="ci-btn"
                  style={btn("danger", { size: "sm", disabled: end.isPending })}
                >
                  <FiSlash size={13} /> End
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
      {dialog && <VisitDialog mode="schedule" schedule={dialog.schedule} teacherId={teacherId} onClose={() => setDialog(null)} />}
    </div>
  );
}
