import { useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle, FiEye, FiEyeOff, FiGlobe, FiHeart } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { QaStyles as CheckinStyles, btn, card, font } from "../../qa/shared";
import { useEducatorFeedback, useModerateReview } from "../hooks/useMentorReviews";
import FeedbackSummary from "./FeedbackSummary";
import { StarsShown } from "./Stars";

// "Parent feedback" on an educator's page — the admin app's and the hub portal's educator page, and
// the supervisor portal's. Admins, staff (with Educators) and the educator's supervisor see every
// review, named, with moderation: hide a comment (its rating still counts), put a consented comment
// on the website (admins), mark a conduct concern resolved. The hub sees the averages only, from 3
// reviews. (The educator's own view is the teacher portal's Parent feedback page.)

const fmt = (v) => (v ? new Date(v).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "");
const STAGE = { mid: "Mid-course", end: "End of course" };

function ReviewRow({ r, aspects, isAdmin, staff, onAction, busy }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <StarsShown value={r.overall} showNumber={false} size={14} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{r.reviewer}</span>
          <span style={{ fontSize: 12, color: "#6B7280" }}>{r.reviewerKind === "tot" ? "TOT learner" : <>parent of {staff ? <Link to={`/learners/${r.learner.id}`} style={{ color: "#2e7db5" }}>{r.learner.name}</Link> : r.learner.name}</>} · {r.course}{r.hub ? ` · ${r.hub}` : ""}</span>
        </div>
        <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>{STAGE[r.stage]} · {fmt(r.updatedAt || r.createdAt)}</span>
      </div>
      {r.concern && (
        <div style={{ padding: "8px 12px", borderRadius: 10, background: r.concernResolvedAt ? "#F3F4F6" : "#FEF2F2", border: `1px solid ${r.concernResolvedAt ? "#E5E7EB" : "#FECACA"}`, fontSize: 12.5, color: r.concernResolvedAt ? "#4B5563" : "#991B1B", display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
          <FiAlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ flex: 1, minWidth: 180 }}><strong>{r.concernResolvedAt ? `Concern (resolved ${fmt(r.concernResolvedAt)})` : "Concern"}:</strong> {r.concernText}</span>
          {!r.concernResolvedAt && <button type="button" className="ci-btn" disabled={busy} onClick={() => onAction(r.id, "resolve")} style={btn("secondary", { size: "sm" })}>Mark resolved</button>}
        </div>
      )}
      {r.comment && (
        <p style={{ margin: 0, fontSize: 13.5, color: r.hidden ? "#9CA3AF" : "#1F2937", lineHeight: 1.6, textDecoration: r.hidden ? "line-through" : "none" }}>&ldquo;{r.comment}&rdquo;</p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {Object.keys(r.ratings || {}).length > 0 && (
          <button type="button" onClick={() => setOpen((x) => !x)} style={{ padding: 0, border: "none", background: "none", color: "#2e7db5", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font }}>{open ? "Hide detail" : "Detail"}</button>
        )}
        {r.comment && (
          <button type="button" className="ci-btn" disabled={busy} onClick={() => onAction(r.id, r.hidden ? "show" : "hide")} style={btn("secondary", { size: "sm" })}>
            {r.hidden ? <><FiEye size={12} style={{ marginRight: 5 }} /> Show comment</> : <><FiEyeOff size={12} style={{ marginRight: 5 }} /> Hide comment</>}
          </button>
        )}
        {isAdmin && r.websiteConsent && r.comment && !r.hidden && (
          <button type="button" className="ci-btn" disabled={busy} onClick={() => onAction(r.id, r.featured ? "unfeature" : "feature")} style={btn(r.featured ? "primary" : "secondary", { size: "sm" })}>
            <FiGlobe size={12} style={{ marginRight: 5 }} /> {r.featured ? "On the website" : "Put on website"}
          </button>
        )}
        {r.websiteConsent && !r.featured && <span style={{ fontSize: 11.5, color: "#047857" }}>Parent agreed to share</span>}
      </div>
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
          {aspects.filter((a) => r.ratings?.[a.key]).map((a) => (
            <span key={a.key} style={{ fontSize: 12, color: "#4B5563" }}>{a.label}: <strong>{r.ratings[a.key]}</strong>/5</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentFeedbackSection({ teacherId }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const staff = user?.role === "admin" || user?.role === "collaborator";
  const allowed = user?.role === "supervisor" || user?.role === "school" || (staff && can("teachers", "view"));
  const { data, isLoading } = useEducatorFeedback(teacherId, { enabled: allowed });
  const moderate = useModerateReview();
  const [showAll, setShowAll] = useState(false);
  if (!allowed || isLoading || !data || data.mode === "none") return null;

  const header = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "14px 20px", borderBottom: "1px solid #F3F4F6" }}>
      <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em", display: "inline-flex", alignItems: "center", gap: 6 }}><FiHeart size={12} /> Parent feedback</h2>
      {data.mode === "named" && data.openConcerns > 0 && (
        <span style={{ padding: "3px 10px", borderRadius: 999, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA", fontSize: 11.5, fontWeight: 800 }}>{data.openConcerns} open concern{data.openConcerns === 1 ? "" : "s"}</span>
      )}
    </div>
  );

  let body;
  if (data.mode === "hub") {
    body = data.enough ? <FeedbackSummary summary={data} /> : <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>Averages show from {data.needed} reviews, so no one family can be picked out ({data.count} so far).</p>;
  } else if (!data.count) {
    body = <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>No reviews yet. Parents are asked once their child has attended a few sessions, and again when a course ends.</p>;
  } else {
    const reviews = showAll ? data.reviews : data.reviews.slice(0, 5);
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FeedbackSummary summary={data} />
        <div>
          {reviews.map((r) => (
            <ReviewRow key={r.id} r={r} aspects={data.aspectsList || data.aspects} isAdmin={user?.role === "admin" || (user?.role === "collaborator" && can("teachers", "edit"))} staff={staff} busy={moderate.isPending} onAction={(id, action) => moderate.mutate({ id, action })} />
          ))}
          {data.reviews.length > 5 && (
            <button type="button" onClick={() => setShowAll((x) => !x)} style={{ marginTop: 6, padding: 0, border: "none", background: "none", color: "#25476a", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
              {showAll ? "Show fewer" : `Show all ${data.reviews.length} reviews`}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <section style={{ ...card, overflow: "hidden", fontFamily: font, border: "1.5px solid #E5E7EB", boxShadow: "none" }}>
      <CheckinStyles />
      {header}
      <div style={{ padding: "16px 20px" }}>{body}</div>
    </section>
  );
}
