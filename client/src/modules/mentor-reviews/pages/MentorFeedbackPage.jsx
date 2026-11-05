import { useState } from "react";
import { FiCheckCircle, FiClock, FiLock, FiStar } from "react-icons/fi";
import Avatar from "../../../components/ui/Avatar";
import { useAuth } from "../../../context/AuthContext";
import { QaStyles as CheckinStyles, btn } from "../../qa/shared";
import { useMyMentors } from "../hooks/useMentorReviews";
import ReviewDialog from "../components/ReviewDialog";
import { StarsShown } from "../components/Stars";

// Mentor feedback — a parent's (/parent/feedback) or a TOT learner's (/learner-portal/feedback):
// every educator teaching each of their children (or them), with a Review / Edit review button.
// A mentor can be reviewed once the child has attended a few sessions; asked for twice — a check-in
// while the course runs and when it ends. Educators only ever see a summary, never who wrote what.

const STAGE = { mid: "While the course runs", end: "Course complete" };

function MentorCard({ child, mentor, forSelf, onReview }) {
  const r = mentor.review;
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: `1.5px solid ${mentor.due ? "#FDD89A" : "#E5E7EB"}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar firstName={mentor.teacher.name.split(" ")[0]} lastName={mentor.teacher.name.split(" ").slice(1).join(" ")} photo={mentor.teacher.photo} size={46} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#111827", overflowWrap: "anywhere" }}>{mentor.teacher.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#6B7280", overflowWrap: "anywhere" }}>{mentor.course.name} · {mentor.hub.name}</p>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11.5, fontWeight: 700 }}>
        <span style={{ padding: "2px 9px", borderRadius: 999, background: "#EAF6FD", color: "#1F6F9E", border: "1px solid #BFE3F7" }}>{STAGE[mentor.stage]}</span>
        <span style={{ padding: "2px 9px", borderRadius: 999, background: "#F3F4F6", color: "#4B5563", border: "1px solid #E5E7EB" }}>{mentor.attended} session{mentor.attended === 1 ? "" : "s"} attended</span>
        {mentor.due && <span style={{ padding: "2px 9px", borderRadius: 999, background: "#FFF5E1", color: "#7A4F00", border: "1px solid #FDD89A" }}>We&apos;d love your feedback</span>}
      </div>
      {r ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><FiCheckCircle color="#059669" /><StarsShown value={r.overall} showNumber={false} /> <span style={{ fontSize: 12.5, color: "#4B5563" }}>Reviewed</span></span>
          {mentor.editable && <button type="button" className="ci-btn" onClick={onReview} style={btn("secondary", { size: "sm" })}>Edit review</button>}
        </div>
      ) : mentor.eligible ? (
        <button type="button" className="ci-btn" onClick={onReview} style={{ ...btn("primary"), alignSelf: "flex-start" }}><FiStar size={14} style={{ marginRight: 6 }} /> Review {mentor.teacher.name.split(" ")[0]}</button>
      ) : (
        <p style={{ margin: 0, fontSize: 12.5, color: "#6B7280", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <FiClock size={13} /> You can review after {forSelf ? "you've" : `${child.firstName} has`} attended {mentor.minSessions} session{mentor.minSessions === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}

export default function MentorFeedbackPage() {
  const { user } = useAuth();
  const forSelf = !!user?.totLearner;
  const { data, isLoading, isError } = useMyMentors();
  const [open, setOpen] = useState(null); // { child, mentor }
  const children = data?.children || [];
  // Two children with the same first name (siblings recorded twice, or twins' nicknames) — full names.
  const firstNames = children.map((c) => c.learner.firstName);
  const nameOf = (l) => (firstNames.filter((n) => n === l.firstName).length > 1 ? [l.firstName, l.lastName].filter(Boolean).join(" ") : l.firstName);

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 18 }}>
      <CheckinStyles />
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 45%, #2e7db5 100%)", borderRadius: 20, padding: "24px 28px", color: "#fff" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 23, fontWeight: 900 }}>{forSelf ? "Rate your trainers" : "Mentor feedback"}</h1>
        <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.8)", maxWidth: 640, lineHeight: 1.6 }}>
          {forSelf ? "Tell us how the educators training you are doing." : "Tell us how the educators teaching your children are doing."} It takes a minute.
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginLeft: 6, color: "#BFE3F7", fontWeight: 600 }}><FiLock size={12} /> Educators only see a summary — never your name.</span>
        </p>
      </div>

      {isLoading ? (
        <div style={{ padding: "50px 20px", textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>Loading…</div>
      ) : isError ? (
        <div style={{ padding: "40px 20px", textAlign: "center", color: "#B91C1C", background: "#fff", borderRadius: 16 }}>Couldn&apos;t load your mentors. Please try again.</div>
      ) : children.every((c) => c.mentors.length === 0) ? (
        <div style={{ padding: "50px 20px", textAlign: "center", background: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#374151" }}>No mentors to review yet</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#9CA3AF" }}>{forSelf ? "Your trainers" : "Your children's educators"} show here once {forSelf ? "you're" : "they're"} in a class.</p>
        </div>
      ) : children.filter((c) => c.mentors.length).map((c) => (
        <section key={c.learner.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!forSelf && <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#111827" }}>{nameOf(c.learner)}&apos;s mentors</h2>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 14 }}>
            {c.mentors.map((m) => (
              <MentorCard key={`${m.teacher.id}:${m.course.id}`} child={c.learner} mentor={m} forSelf={forSelf} onReview={() => setOpen({ child: c.learner, mentor: m })} />
            ))}
          </div>
        </section>
      ))}

      {open && <ReviewDialog learner={open.child} mentor={open.mentor} forSelf={forSelf} onClose={() => setOpen(null)} />}
    </div>
  );
}
