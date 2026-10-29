import { useState } from "react";
import { FiCalendar, FiPlus, FiStar } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { usePermissions } from "../../../hooks/usePermissions";
import { useQaVisits } from "../hooks/useQa";
import { VisitRow } from "./VisitList";
import VisitDialog from "./VisitDialog";
import { QaStyles, REVIEWER_ROLES, ScoreBadge, T, btn, card, font, hint } from "../shared";

// An educator's QA visits on their page — the admin app's and the hub portal's educator page, and
// the supervisor portal's. Reviewers see every visit (and can plan one); the hub sees its announced
// visits and its reports' summaries. Each row opens the visit. Shown only to those who may see QA.
export default function EducatorQaSection({ teacherId }) {
  const { user } = useAuth();
  const { can } = usePermissions();
  const reviewer = REVIEWER_ROLES.includes(user?.role);
  const allowed = user?.role === "supervisor" || user?.role === "school" || (reviewer && can("qa", "view"));
  const [dialog, setDialog] = useState(null); // "visit" | "schedule"
  const { data, isLoading } = useQaVisits({ view: "all", teacherId, page: 1, limit: 30 }, { enabled: allowed && !!teacherId });
  if (!allowed) return null;

  const visits = data?.visits || [];
  const scored = visits.filter((v) => v.state === "submitted" && v.score != null);
  const average = scored.length ? Math.round((scored.reduce((n, v) => n + Number(v.score), 0) / scored.length) * 10) / 10 : null;
  const reports = visits.filter((v) => v.state === "submitted").length;

  return (
    <section style={{ ...card, overflow: "hidden", fontFamily: font, border: "1.5px solid #E5E7EB", boxShadow: "none" }}>
      <QaStyles />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "14px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em", display: "inline-flex", alignItems: "center", gap: 6 }}><FiStar size={12} /> Quality reviews</h2>
          {reports > 0 && <><ScoreBadge score={average} /><span style={{ fontSize: 12, color: T.inkMuted }}>average of {reports} {reports === 1 ? "report" : "reports"}</span></>}
        </div>
        {reviewer && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="ci-btn" onClick={() => setDialog("visit")} style={btn("secondary", { size: "sm" })}><FiPlus size={13} /> Plan a visit</button>
            <button type="button" className="ci-btn" onClick={() => setDialog("schedule")} style={btn("secondary", { size: "sm" })}><FiCalendar size={13} /> Regular visits</button>
          </div>
        )}
      </div>
      {isLoading && <p style={{ ...hint, padding: "14px 20px", margin: 0 }}>Loading…</p>}
      {data && visits.length === 0 && (
        <p style={{ ...hint, padding: "16px 20px", margin: 0 }}>
          {reviewer ? "No QA visits yet. Plan one, or set up regular visits." : "No QA reports for this educator yet."}
        </p>
      )}
      {visits.map((v) => <VisitRow key={v.id} visit={v} showTeacher={false} />)}
      {dialog && <VisitDialog mode={dialog} teacherId={teacherId} onClose={() => setDialog(null)} />}
    </section>
  );
}
