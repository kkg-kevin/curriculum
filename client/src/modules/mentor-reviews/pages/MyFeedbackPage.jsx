import { FiHeart, FiLock } from "react-icons/fi";
import { QaStyles as CheckinStyles, card, font } from "../../qa/shared";
import { useMyFeedback } from "../hooks/useMentorReviews";
import FeedbackSummary from "../components/FeedbackSummary";
import { StarsShown } from "../components/Stars";

// The teacher portal's Parent feedback (/teacher-portal/feedback): what families say about the
// educator — averages and comments only, never who wrote them, and only from 3 reviews so no one
// family can be picked out. Concerns go to the team, not here.

const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString("en-KE", { month: "long", year: "numeric" });

export default function MyFeedbackPage() {
  const { data, isLoading } = useMyFeedback();
  return (
    <div style={{ fontFamily: font, display: "flex", flexDirection: "column", gap: 18 }}>
      <CheckinStyles />
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 45%, #2e7db5 100%)", borderRadius: 20, padding: "24px 28px", color: "#fff" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 23, fontWeight: 900, display: "flex", alignItems: "center", gap: 10 }}><FiHeart /> Parent feedback</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.8)", maxWidth: 640, lineHeight: 1.6 }}>
          What families say about your teaching. <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#BFE3F7", fontWeight: 600 }}><FiLock size={12} /> Always anonymous — no names, and only once at least 3 families have reviewed you.</span>
        </p>
      </div>

      {isLoading ? (
        <div style={{ padding: "50px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : !data?.enough ? (
        <div style={{ ...card, padding: "40px 24px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#374151" }}>Not enough reviews yet</p>
          <p style={{ margin: "6px auto 0", fontSize: 13, color: "#6B7280", maxWidth: 460, lineHeight: 1.6 }}>
            Your feedback shows once {data?.needed || 3} families have reviewed you ({data?.count || 0} so far), so no one family can be picked out. Families are asked after a few sessions, and when a course ends.
          </p>
        </div>
      ) : (
        <>
          <div style={{ ...card, padding: "18px 20px" }}><FeedbackSummary summary={data} /></div>
          {data.trend?.length > 1 && (
            <div style={{ ...card, padding: "16px 20px" }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800, color: "#111827" }}>Month by month</h2>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {data.trend.map((t) => (
                  <div key={t.month} style={{ padding: "8px 12px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #EEF1F5", minWidth: 120 }}>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#6B7280" }}>{monthLabel(t.month)}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 800, color: "#25476a" }}>{t.average?.toFixed(1)} <span style={{ fontSize: 11.5, fontWeight: 500, color: "#9CA3AF" }}>({t.count})</span></p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ ...card, padding: "16px 20px" }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 800, color: "#111827" }}>What families say</h2>
            {data.comments.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>No written comments yet.</p>
            ) : data.comments.map((c, i) => (
              <div key={i} style={{ padding: "12px 0", borderTop: i ? "1px solid #F3F4F6" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <StarsShown value={c.overall} showNumber={false} size={13} />
                  <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>{monthLabel(c.month)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13.5, color: "#1F2937", lineHeight: 1.6 }}>&ldquo;{c.comment}&rdquo;</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
