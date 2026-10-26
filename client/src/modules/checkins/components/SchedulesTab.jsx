import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useCheckinMutation, useCheckinSchedules } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import ScheduleDialog from "./ScheduleDialog";
import { Empty, FORMAT_LABEL, FREQUENCY_LABEL, Pill, T, card, chip, formatDate, ghostBtn, hint, primaryBtn } from "../shared";

// Every check-in schedule in the workspace (managers): set one up, change it, or end it. Ending
// stops new check-ins and removes the upcoming ones; every report already written stays.
export default function SchedulesTab({ canManage }) {
  const [status, setStatus] = useState("active");
  const [dialog, setDialog] = useState(null); // { schedule? }
  const { data = [], isLoading, isError, error } = useCheckinSchedules({ status });
  const end = useCheckinMutation((id) => checkinsApi.endSchedule(id), "Schedule ended");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={() => setStatus("active")} style={chip(status === "active")}>Active</button>
        <button type="button" onClick={() => setStatus("ended")} style={chip(status === "ended")}>Ended</button>
        {canManage && <button type="button" onClick={() => setDialog({})} style={{ ...primaryBtn(), marginLeft: "auto" }}><FiPlus size={14} /> Set up check-ins</button>}
      </div>
      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Schedules couldn't be loaded."}</p>}
        {!isLoading && data.length === 0 && <Empty title={status === "active" ? "No check-ins set up" : "No ended schedules"}>{status === "active" && canManage ? "Set up check-ins for a hub to get started." : null}</Empty>}
        {data.map((s) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: "1px solid #F3F4F6" }}>
            <div style={{ minWidth: 0 }}>
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
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => setDialog({ schedule: s })} style={ghostBtn}>Edit</button>
                <button
                  type="button"
                  disabled={end.isPending}
                  onClick={() => {
                    if (window.confirm(`End the check-ins with ${s.hubName}? No more will come round, and the upcoming ones are removed. Reports already written stay.`)) end.mutate(s.id);
                  }}
                  style={{ ...ghostBtn, color: "#B91C1C", borderColor: "#FECACA" }}
                >
                  End
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
