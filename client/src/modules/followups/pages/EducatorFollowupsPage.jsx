import { FiFlag } from "react-icons/fi";
import { BRAND, FONT, HERO_GRADIENT } from "../../../theme/brand";
import FollowupsPanel from "../components/FollowupsPanel";

// The educator's learner follow-ups (/teacher-portal/follow-ups, 26 Nov 2026): the cases they look
// after, and those for learners of the classes they teach. Opened by themselves from the figures;
// each has what's wrong, a message ready for the parent, and Close / Escalate.
export default function EducatorFollowupsPage() {
  return (
    <div style={{ display: "grid", gap: 14, fontFamily: FONT, width: "100%" }}>
      <header style={{ background: HERO_GRADIENT, color: "#fff", borderRadius: 20, padding: "20px 24px", display: "flex", gap: 14, alignItems: "center" }}>
        <span aria-hidden style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,255,255,0.16)", display: "grid", placeItems: "center", flexShrink: 0 }}><FiFlag size={22} /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: BRAND.gold }}>Your learners</div>
          <h1 style={{ margin: "2px 0", fontSize: 24, fontWeight: 900 }}>Follow-ups</h1>
          <div style={{ fontSize: 13.5, opacity: 0.92 }}>Learners who need a little extra from you, and why. Reach the family, agree a plan, then close it, or escalate it to the admins.</div>
        </div>
      </header>
      <FollowupsPanel level="educator" />
    </div>
  );
}
