import { Link } from "react-router-dom";
import { FiChevronRight, FiStar } from "react-icons/fi";
import { useMyMentors } from "../hooks/useMentorReviews";

// On the parent's home: the mentors waiting for their feedback (a check-in due, or a course just
// finished) — one line, to the Mentor feedback page. Nothing when none is due.
export default function MentorFeedbackPrompt({ to = "/parent/feedback" }) {
  const { data } = useMyMentors();
  const due = (data?.children || []).flatMap((c) => c.mentors.filter((m) => m.due).map((m) => ({ child: c.learner, m })));
  if (!due.length) return null;
  const first = due[0];
  const text = due.length === 1
    ? `How is ${first.m.teacher.name} doing with ${first.child.firstName}? Tell us in a minute.`
    : `${due.length} of your children's mentors are waiting for your feedback.`;
  return (
    <Link to={to} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 16, background: "#FFF8EC", border: "1.5px solid #FDD89A", color: "#7A4F00", textDecoration: "none", fontFamily: "Inter, sans-serif" }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: "#feb139", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><FiStar size={18} /></span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{text}</span>
      <FiChevronRight style={{ flexShrink: 0 }} />
    </Link>
  );
}
