import { useState } from "react";
import { FiAlertTriangle, FiLock } from "react-icons/fi";
import { Modal, QaStyles as CheckinStyles, btn, hint, input, label } from "../../qa/shared";
import { useSaveReview } from "../hooks/useMentorReviews";
import { StarInput } from "./Stars";

// An aspect worded for a parent ("Engages my child", "My child is progressing"), reworded for a TOT
// learner reviewing their own trainer ("Engages me", "I am progressing").
const selfWorded = (text) => text.replace(/\bmy child is\b/gi, "I am").replace(/\bmy child\b/gi, "me").replace(/^me\b/, "I");

// Reviewing one mentor (for one child and course): overall stars, each aspect the workspace asks
// about, a comment, consent to quote it on the website, and — apart from the rest — a concern about
// conduct, which goes to the team at once. The educator never sees who wrote it.
export default function ReviewDialog({ learner, mentor, forSelf = false, onClose }) {
  const existing = mentor.review;
  const [overall, setOverall] = useState(existing?.overall || 0);
  const [ratings, setRatings] = useState(existing?.ratings || {});
  const [comment, setComment] = useState(existing?.comment || "");
  const [websiteConsent, setWebsiteConsent] = useState(!!existing?.websiteConsent);
  const [concern, setConcern] = useState(!!existing?.concern);
  const [concernText, setConcernText] = useState(existing?.concernText || "");
  const save = useSaveReview();
  const who = forSelf ? "you" : learner.firstName;
  const ended = mentor.stage === "end";

  const submit = () => save.mutate(
    {
      learnerId: learner.id, teacherId: mentor.teacher.id, courseId: mentor.course.id,
      overall, ratings, comment, websiteConsent: websiteConsent && !!comment.trim(), concern, concernText,
    },
    { onSuccess: onClose },
  );

  return (
    <Modal
      title={`${existing ? "Edit your review of" : "Review"} ${mentor.teacher.name}`}
      onClose={onClose}
      width={600}
      footer={(
        <>
          <button type="button" className="ci-btn" onClick={onClose} style={btn("secondary")}>Cancel</button>
          <button type="button" className="ci-btn" disabled={!overall || save.isPending || (concern && !concernText.trim())} onClick={submit} style={btn("primary", { disabled: !overall || save.isPending || (concern && !concernText.trim()) })}>
            {save.isPending ? "Saving…" : existing ? "Save changes" : "Send review"}
          </button>
        </>
      )}
    >
      <CheckinStyles />
      <div style={{ display: "grid", gap: 18, gridTemplateColumns: "100%" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#4B5563", lineHeight: 1.6 }}>
          {mentor.course.name} · {mentor.hub.name} — {ended ? "the course is complete." : "a check-in while the course runs."}{" "}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#1F6F9E", fontWeight: 600 }}><FiLock size={12} /> {mentor.teacher.name} never sees your name — only a summary of what families say.</span>
        </p>

        <div>
          <span style={label}>Overall, how is {mentor.teacher.name} doing{forSelf ? "" : ` with ${who}`}?</span>
          <StarInput value={overall} onChange={setOverall} label="Overall rating" name="overall" size={34} />
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "100%" }}>
          <span style={{ ...label, marginBottom: 0 }}>A little more detail <span style={{ fontWeight: 500, color: "#6B7280" }}>(optional)</span></span>
          {mentor.aspects.map((a) => (
            <div key={a.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #EEF1F5" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: "#1F2937" }}>{forSelf ? selfWorded(a.label) : a.label}</span>
              <StarInput value={ratings[a.key] || 0} onChange={(n) => setRatings((r) => ({ ...r, [a.key]: n }))} label={a.label} name={`aspect-${a.key}`} size={22} />
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="mr-comment" style={label}>Anything you&apos;d like to say? <span style={{ fontWeight: 500, color: "#6B7280" }}>(optional)</span></label>
          <textarea id="mr-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={2000}
            placeholder={`What's going well, and what could be better${forSelf ? "" : ` for ${who}`}…`} style={{ ...input, resize: "vertical", lineHeight: 1.5 }} />
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 8, fontSize: 12.5, color: comment.trim() ? "#374151" : "#9CA3AF", cursor: comment.trim() ? "pointer" : "not-allowed" }}>
            <input type="checkbox" checked={websiteConsent && !!comment.trim()} disabled={!comment.trim()} onChange={(e) => setWebsiteConsent(e.target.checked)} style={{ marginTop: 2 }} />
            <span>You may share my comment on the website — without my name{forSelf ? "" : ", my child's name"} or the educator&apos;s.</span>
          </label>
        </div>

        <div style={{ padding: "12px 14px", borderRadius: 12, border: `1.5px solid ${concern ? "#FCA5A5" : "#F3D7D7"}`, background: concern ? "#FEF2F2" : "#FFFBFB" }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, fontWeight: 700, color: "#991B1B", cursor: "pointer" }}>
            <input type="checkbox" checked={concern} onChange={(e) => setConcern(e.target.checked)} style={{ marginTop: 2 }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><FiAlertTriangle size={14} /> I have a concern about this educator&apos;s conduct</span>
          </label>
          <p style={{ ...hint, color: "#7F1D1D", margin: "6px 0 0 24px" }}>Safety, behaviour or anything that worries you. It goes straight to the team (never to the educator), who will follow up.</p>
          {concern && (
            <textarea aria-label="Your concern" value={concernText} onChange={(e) => setConcernText(e.target.value)} rows={3} maxLength={2000} placeholder="What happened?" style={{ ...input, marginTop: 10, resize: "vertical" }} />
          )}
        </div>
      </div>
    </Modal>
  );
}
