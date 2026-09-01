import { useOutletContext } from "react-router-dom";
import { ReceiptLong as ReceiptLongIcon, Schedule as ScheduleIcon } from "@mui/icons-material";

const ACCENT = "#25476a";
const T = {
  accent: ACCENT, accentDeep: "#1a3550", accentMid: "#2e7db5", accentLight: "#38aae1",
  tintBg: "#e8f5fb", tintBorder: "#a8d5ee", ink: "#111827", inkMuted: "#6B7280", inkFaint: "#9CA3AF", border: "#E5E7EB",
};
const cardStyle = { backgroundColor: "#fff", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" };

// Claims — teachers submit hourly / daily pay claims for teaching delivered, for hub approval
// and payment. Scaffold only: the hero + empty state land here so the sidebar link works while
// the submission form, claim list, and approval flow are built out.
export default function ClaimsPage() {
  const { selectedHub } = useOutletContext();

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6, color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <ReceiptLongIcon sx={{ fontSize: 16 }} /> Teacher payments
          </div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Claims</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            Submit hourly and daily claims for the teaching you deliver{selectedHub ? ` at ${selectedHub.name}` : ""}, and track their approval.
          </p>
        </div>
      </div>

      <div style={{ ...cardStyle, textAlign: "center", padding: "60px 24px" }}>
        <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg, #e8f5fb, #d6edf8)", border: "2px solid #a8d5ee", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: T.accent }}>
          <ScheduleIcon fontSize="large" />
        </div>
        <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: T.ink }}>Claims are coming soon</h3>
        <p style={{ margin: "0 auto", maxWidth: 420, fontSize: 13, color: T.inkMuted, lineHeight: 1.6 }}>
          You'll be able to log the hours or days you've taught, submit them as a claim, and see
          where each one is in the approval and payment process.
        </p>
      </div>
    </div>
  );
}
