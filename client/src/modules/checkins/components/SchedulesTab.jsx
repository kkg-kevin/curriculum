import { useState } from "react";
import { FiEdit2, FiPlus, FiSlash } from "react-icons/fi";
import { useCheckinMutation, useCheckinSchedules } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import ScheduleDialog from "./ScheduleDialog";
import { Empty, FORMAT_LABEL, FREQUENCY_LABEL, Pill, Segmented, T, btn, card, formatDate, hint, toolbar } from "../shared";

// Every check-in schedule in the workspace (managers): set one up, change it, or end it. Ending
// stops new check-ins and removes the upcoming ones; every report already written stays.
export default function SchedulesTab({ canManage }) {
  const [status, setStatus] = useState("active");
  const [dialog, setDialog] = useState(null); // { schedule? }
  const { data = [], isLoading, isError, error } = useCheckinSchedules({ status });
  const end = useCheckinMutation((id) => checkinsApi.endSchedule(id), "Schedule ended");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={toolbar}>
        <Segmented label="Show" options={[{ key: "active", label: "Active" }, { key: "ended", label: "Ended" }]} value={status} onChange={setStatus} />
        {canManage && <button type="button" className="ci-btn" onClick={() => setDialog({})} style={btn("primary")}><FiPlus size={15} /> Set up check-ins</button>}
      </div>
      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Schedules couldn't be loaded."}</p>}
        {!isLoading && data.length === 0 && <Empty title={status === "active" ? "No check-ins set up" : "No ended schedules"}>{status === "active" && canManage ? "Set up check-ins for a hub to get started." : null}</Empty>}
        {data.map((s) => (
          <div key={s.id} style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: "14px 18px", borderTop: "1px solid #F3F4F6" }}>
            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14, color: T.ink }}>{s.hubName}</strong>
                <Pill look={{ bg: "#EFF6FF", color: "#1D4ED8" }}>{FREQUENCY_LABEL[s.frequency]}</Pill>
                <Pill look={{ bg: "#F3F4F6", color: "#374151" }}>{FORMAT_LABEL[s.format]}</Pill>
                {s.status === "ended" && <Pill look={{ bg: "#F3F4F6", color: "#6B7280" }}>Ended</Pill>}
              </div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: T.inkMuted, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>From {formatDate(s.startDate)}{s.status === "ended" && s.endDate ? ` to ${formatDate(s.endDate)}` : ""}</span>
                <span>Account Manager: {s.accountManagerName || "—"} · Training Lead: {s.trainingLeadName || "—"}</span>
              </div>
            </div>
            {canManage && s.status === "active" && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button type="button" className="ci-btn" onClick={() => setDialog({ schedule: s })} style={btn("secondary", { size: "sm" })}><FiEdit2 size={13} /> Edit</button>
                <button
                  type="button"
                  disabled={end.isPending}
                  onClick={() => {
                    if (window.confirm(`End the check-ins with ${s.hubName}? No more will come round, and the upcoming ones are removed. Reports already written stay.`)) end.mutate(s.id);
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
      {dialog && <ScheduleDialog schedule={dialog.schedule} onClose={() => setDialog(null)} />}
    </div>
  );
}
