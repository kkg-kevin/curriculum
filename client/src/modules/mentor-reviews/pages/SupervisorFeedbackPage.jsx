import { useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle, FiArrowRight, FiCheckCircle, FiChevronDown, FiChevronUp, FiHeart } from "react-icons/fi";
import { useModerateReview, useSupervisorFeedback } from "../hooks/useMentorReviews";
import ParentFeedbackSection from "../components/ParentFeedbackSection";
import { StarsShown } from "../components/Stars";
import { T, cardStyle, formatDate } from "../../claims/shared";
import { Avatar } from "../../claims/components/supervisorParts";

/*
 * The supervisor portal's Parent feedback (/supervisor-portal/feedback, 17 Nov 2026): what
 * parents said about the supervisor's educators, in one place instead of one educator page at a
 * time. Open conduct concerns first (oldest first), resolvable here; then each educator's rating,
 * reviews and open concerns — opening into the full feedback section (hide / show a comment,
 * resolve a concern). Server: MentorReviewService.forSupervisor.
 */
export default function SupervisorFeedbackPage() {
  const { data, isLoading, isError, error } = useSupervisorFeedback();
  const moderate = useModerateReview();
  const [openId, setOpenId] = useState(null);
  const educators = data?.educators || [];
  const concerns = data?.concerns || [];

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <section style={{ borderRadius: 20, padding: "24px 28px", background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 45%, ${T.accentMid} 80%, ${T.accentLight} 100%)` }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", gap: 10 }}><FiHeart size={22} /> Parent feedback</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "rgba(255,255,255,0.82)", lineHeight: 1.5, maxWidth: 680 }}>
          What parents say about your educators — their ratings and comments, and any concern raised about an educator&apos;s conduct.
        </p>
      </section>

      {isLoading && <p style={{ fontSize: 13, color: T.inkMuted }}>Loading…</p>}
      {isError && <p style={{ fontSize: 13, color: "#B91C1C" }}>{error?.response?.data?.message || error?.message || "The feedback couldn't be loaded."}</p>}

      {!isLoading && !isError && (
        <>
          <section style={{ ...cardStyle, padding: 18 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
              <FiAlertTriangle size={16} color={concerns.length ? "#B91C1C" : T.inkMuted} /> Open concerns {concerns.length > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: "#B91C1C" }}>({concerns.length})</span>}
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: T.inkMuted }}>A parent flagged something about an educator&apos;s conduct. Follow it up, then mark it resolved.</p>
            {concerns.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: "#047857", display: "flex", alignItems: "center", gap: 6 }}><FiCheckCircle size={14} /> No open concerns.</p>
            ) : concerns.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start", padding: "12px 14px", marginTop: 8, borderRadius: 12, background: "#FEF2F2", border: "1px solid #FECACA" }}>
                <div style={{ flex: "1 1 320px", minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: T.ink }}>{c.teacherName}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted }}>
                    From {c.reviewer} about {c.learner} · {c.course}{c.hub ? ` · ${c.hub}` : ""} · {formatDate(c.createdAt)}
                  </p>
                  {c.concernText && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#7F1D1D", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{c.concernText}</p>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link to={`/supervisor-portal/educators/${c.teacherId}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: `1px solid ${T.border}`, background: "#fff", color: T.accent, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                    Educator <FiArrowRight size={13} />
                  </Link>
                  <button type="button" disabled={moderate.isPending} onClick={() => moderate.mutate({ id: c.id, action: "resolve" })}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, border: "none", background: "#047857", color: "#fff", fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
                    <FiCheckCircle size={13} /> Mark resolved
                  </button>
                </div>
              </div>
            ))}
          </section>

          <section style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.border}` }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.ink }}>Your educators</h2>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: T.inkMuted }}>Open one to read every review and hide a comment if it shouldn&apos;t show.</p>
            </div>
            {educators.length === 0 && <p style={{ margin: 0, padding: 18, fontSize: 13, color: T.inkMuted }}>No educators are assigned to you yet.</p>}
            {educators.map((e) => {
              const open = openId === e.teacherId;
              return (
                <div key={e.teacherId} style={{ borderTop: `1px solid ${T.border}` }}>
                  <button type="button" onClick={() => setOpenId(open ? null : e.teacherId)} aria-expanded={open}
                    style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", width: "100%", padding: "12px 18px", border: "none", background: open ? "#F8FBFE" : "#fff", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                    <Avatar name={e.name} photo={e.photo} size={36} />
                    <span style={{ flex: "1 1 180px", minWidth: 0, fontSize: 14, fontWeight: 800, color: T.ink }}>{e.name}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.inkMuted }}>
                      {e.count > 0 && e.average != null ? <StarsShown value={e.average} size={13} count={e.count} /> : "No reviews yet"}
                    </span>
                    {e.openConcerns > 0 && <span style={{ padding: "2px 9px", borderRadius: 999, background: "#FEF2F2", color: "#B91C1C", fontSize: 11.5, fontWeight: 800 }}>{e.openConcerns} open concern{e.openConcerns === 1 ? "" : "s"}</span>}
                    {e.lastReviewAt && <span style={{ fontSize: 12, color: T.inkFaint }}>Last {formatDate(e.lastReviewAt)}</span>}
                    {open ? <FiChevronUp size={16} color={T.inkMuted} /> : <FiChevronDown size={16} color={T.inkMuted} />}
                  </button>
                  {open && (
                    <div style={{ padding: "4px 18px 18px", background: "#F8FBFE" }}>
                      <ParentFeedbackSection teacherId={e.teacherId} />
                      <Link to={`/supervisor-portal/educators/${e.teacherId}`} style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 13, fontWeight: 700, color: T.accentMid, textDecoration: "none" }}>
                        Their profile, QA and training <FiArrowRight size={13} />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
