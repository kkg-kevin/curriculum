import { useState } from "react";
import { AttachMoney as AttachMoneyIcon } from "@mui/icons-material";
import { useHubRevenueQuery, useDeleteMentorSession } from "../hooks/useMentorSessions";
import LogSessionModal from "./LogSessionModal";

const STATUS_STYLE = {
  paid:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  unpaid: { bg: "#FFF5F5", color: "#DC2626", border: "#FECACA" },
  waived: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
};

function fmt(amount, currency) {
  if (amount == null) return "—";
  return `${currency || "KES"} ${amount.toLocaleString()}`;
}

// Non-school hubs (co_working_space / innovation_lab / makerspace / tech_club) only — see
// mentor-session.service.js's header comment for why this is a separate, log-only feature
// distinct from Billing. Rendered on LearningHubViewPage.jsx gated by `!isSchool`.
export default function HubRevenueSection({ hubId, teachers, learners }) {
  const { data: summary, isLoading } = useHubRevenueQuery(hubId);
  const { mutate: deleteSession } = useDeleteMentorSession();
  const [logOpen, setLogOpen] = useState(false);

  const sessions = summary?.sessions || [];

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>Mentor Session Revenue</h2>
        <button
          type="button"
          onClick={() => setLogOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "7px 14px", backgroundColor: "#e8f5fb", color: "#25476a", border: "1.5px solid #a8d5ee", borderRadius: "9px", fontSize: "12.5px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
        >
          + Log Session
        </button>
      </div>

      <div style={{ padding: "20px" }}>
        {isLoading ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Loading…</p>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "18px" }}>
              <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee" }}>
                <p style={{ margin: "0 0 2px", fontSize: "10.5px", fontWeight: "700", color: "#25476a", textTransform: "uppercase" }}>Paid</p>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#25476a" }}>{fmt(summary?.paid, "KES")}</p>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA" }}>
                <p style={{ margin: "0 0 2px", fontSize: "10.5px", fontWeight: "700", color: "#DC2626", textTransform: "uppercase" }}>Unpaid</p>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#DC2626" }}>{fmt(summary?.unpaid, "KES")}</p>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <p style={{ margin: "0 0 2px", fontSize: "10.5px", fontWeight: "700", color: "#6B7280", textTransform: "uppercase" }}>Waived</p>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#6B7280" }}>{fmt(summary?.waived, "KES")}</p>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: "10px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB" }}>
                <p style={{ margin: "0 0 2px", fontSize: "10.5px", fontWeight: "700", color: "#6B7280", textTransform: "uppercase" }}>Sessions</p>
                <p style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#111827" }}>{summary?.sessionCount ?? 0}</p>
              </div>
            </div>

            {sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#9CA3AF" }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}><AttachMoneyIcon fontSize="medium" /></div>
                <p style={{ margin: 0, fontSize: "13px" }}>No sessions logged yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {sessions.map((s) => {
                  const teacher = teachers.find((t) => t.id === s.teacherId);
                  const learner = learners.find((l) => l.id === s.learnerId);
                  const style = STATUS_STYLE[s.paymentStatus] || STATUS_STYLE.unpaid;
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 12px", borderRadius: "9px", border: "1px solid #E5E7EB" }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {teacher ? `${teacher.firstName} ${teacher.lastName}` : "Unknown mentor"} → {learner ? `${learner.firstName} ${learner.lastName}` : "Unknown learner"}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "#9CA3AF" }}>
                          {s.sessionDate}{s.durationMinutes ? ` · ${s.durationMinutes} min` : ""} · {fmt(s.feeAmount, s.feeCurrency)}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <span style={{ padding: "3px 9px", borderRadius: "20px", fontSize: "10.5px", fontWeight: "700", backgroundColor: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                          {s.paymentStatus}
                        </span>
                        <button
                          type="button"
                          title="Delete session"
                          onClick={() => { if (window.confirm("Delete this logged session?")) deleteSession({ id: s.id, hubId }); }}
                          style={{ width: "26px", height: "26px", borderRadius: "7px", border: "none", background: "transparent", color: "#9CA3AF", cursor: "pointer", fontSize: "14px" }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {logOpen && (
        <LogSessionModal hubId={hubId} teachers={teachers} learners={learners} onClose={() => setLogOpen(false)} />
      )}
    </div>
  );
}
