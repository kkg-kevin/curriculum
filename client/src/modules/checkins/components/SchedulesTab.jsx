import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import { useCheckinMutation, useCheckinSchedules } from "../hooks/useCheckins";
import { checkinsApi } from "../services/checkinsApi";
import ScheduleDialog from "./ScheduleDialog";
import { Empty, FORMAT_LABEL, FREQUENCY_LABEL, Pill, T, card, chip, formatDate, ghostBtn, hint, primaryBtn } from "../shared";

// Every check-in schedule in the workspace (managers): set one up, change it, or end it. Ending
// stops new check-ins and cancels the upcoming ones nobody has started; everything written stays.
export default function SchedulesTab({ canManage }) {
  const [status, setStatus] = useState("active");
  const [dialog, setDialog] = useState(null); // { schedule? }
  const { data = [], isLoading, isError, error } = useCheckinSchedules({ status });
  const end = useCheckinMutation(({ id, reason }) => checkinsApi.endSchedule(id, reason), (r) => `Schedule ended${r?.cancelledSessions ? ` — ${r.cancelledSessions} upcoming check-in${r.cancelledSessions === 1 ? "" : "s"} cancelled` : ""}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" onClick={() => setStatus("active")} style={chip(status === "active")}>Active</button>
        <button type="button" onClick={() => setStatus("ended")} style={chip(status === "ended")}>Ended</button>
        {canManage && <button type="button" onClick={() => setDialog({})} style={{ ...primaryBtn(), marginLeft: "auto" }}><FiPlus size={14} /> Schedule check-ins</button>}
      </div>
      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Schedules couldn't be loaded."}</p>}
        {!isLoading && data.length === 0 && <Empty title={status === "active" ? "No check-ins scheduled" : "No ended schedules"}>{status === "active" && canManage ? "Schedule check-ins for a hub to get started." : null}</Empty>}
        {data.map((s) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: "1px solid #F3F4F6" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14, color: T.ink }}>{s.hubName}</strong>
                <Pill look={{ bg: "#EFF6FF", color: "#1D4ED8" }}>{FREQUENCY_LABEL[s.frequency]}</Pill>
                {s.status === "ended" && <Pill look={{ bg: "#F3F4F6", color: "#6B7280" }}>Ended</Pill>}
              </div>
              <div style={{ marginTop: 4, fontSize: 12.5, color: T.inkMuted, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>{s.frequency === "once" ? formatDate(s.startDate) : `From ${formatDate(s.startDate)}${s.endDate ? ` to ${formatDate(s.endDate)}` : ""}`} · {s.startTime}</span>
                <span>{FORMAT_LABEL[s.format]}</span>
                <span>AM: {s.accountManagerName || "—"} · TL: {s.trainingLeadName || "—"}</span>
              </div>
              {s.agenda && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#374151", whiteSpace: "pre-wrap" }}>{s.agenda}</p>}
            </div>
            {canManage && s.status === "active" && (
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => setDialog({ schedule: s })} style={ghostBtn}>Edit</button>
                <button
                  type="button"
                  disabled={end.isPending}
                  onClick={() => {
                    const reason = window.prompt(`End the check-ins with ${s.hubName}? Upcoming check-ins nobody has started will be cancelled; everything already written stays.\n\nReason (optional):`, "");
                    if (reason !== null) end.mutate({ id: s.id, reason });
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
