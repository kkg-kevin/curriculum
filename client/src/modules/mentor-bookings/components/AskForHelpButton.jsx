import { useState } from "react";
import toast from "react-hot-toast";
import { FiHelpCircle } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { Modal, QaStyles as CheckinStyles, btn, input, label } from "../../qa/shared";
import { useAskForHelp } from "../hooks/useMentorBookings";

// "Stuck? Ask for help" on a course session (the learner's own login — never a parent's or a TOT
// learner's). It tells their parent, who can book a mentor to take them through it
// (modules/mentor-bookings/). A child never sees prices or invoices.
export default function AskForHelpButton({ courseId, sessionId, sessionTitle }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const ask = useAskForHelp();
  if (user?.role !== "learner" || !user?.username || user?.totLearner || user?.learningAsEducator) return null;
  const send = () => ask.mutate({ courseId, sessionId, message }, {
    onSuccess: () => { toast.success("We've told your parent — they can book a mentor to help you."); setOpen(false); setMessage(""); },
  });
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", backgroundColor: "#FFF5E1", border: "1.5px solid #FDD89A", borderRadius: "20px", color: "#7A4F00", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
      >
        <FiHelpCircle size={14} /> Stuck? Ask for help
      </button>
      {open && (
        <Modal title="Ask for help" onClose={() => setOpen(false)} footer={(
          <>
            <button type="button" className="ci-btn" onClick={() => setOpen(false)} style={btn("secondary")}>Cancel</button>
            <button type="button" className="ci-btn" disabled={ask.isPending} onClick={send} style={btn("primary", { disabled: ask.isPending })}>{ask.isPending ? "Sending…" : "Ask"}</button>
          </>
        )}>
          <CheckinStyles />
          <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#374151", lineHeight: 1.6 }}>We&apos;ll tell your parent you&apos;re stuck on <strong>{sessionTitle || "this session"}</strong>. They can book a mentor to go through it with you.</p>
          <label htmlFor="help-msg" style={label}>What&apos;s hard? (optional)</label>
          <textarea id="help-msg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. I don't understand how loops work." style={{ ...input, resize: "vertical" }} />
        </Modal>
      )}
    </>
  );
}
