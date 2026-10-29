import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight, FiCalendar, FiMapPin, FiPlus, FiSearch } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { useQaEducators } from "../hooks/useQa";
import VisitDialog from "./VisitDialog";
import { Empty, ScoreBadge, T, VisitTypePill, btn, card, formatDate, hint, input } from "../shared";

// Where an educator's own page is: the admin app's educator page (with its Quality reviews), or the
// supervisor portal's.
export const educatorPagePath = (role, id) => (role === "supervisor" ? `/supervisor-portal/educators/${id}` : `/teachers/${id}/view`);

function Figure({ label, children }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 11, background: "#F5F8FB" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: T.inkMuted }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

// The educators this person reviews — a supervisor's own, every educator for an admin — each with
// how their reports have gone and what's next.
export default function EducatorsTab() {
  const { user } = useAuth();
  const { data = [], isLoading, isError, error } = useQaEducators();
  const [search, setSearch] = useState("");
  const [planFor, setPlanFor] = useState(null);
  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((e) => !term || [e.name, e.email, ...e.hubs.map((h) => h.name)].some((x) => x?.toLowerCase().includes(term)));
  }, [data, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {data.length > 6 && (
        <div style={{ position: "relative", maxWidth: 360 }}>
          <FiSearch size={15} color={T.inkFaint} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email or hub" aria-label="Search educators" style={{ ...input, paddingLeft: 34 }} />
        </div>
      )}
      {isLoading && <p style={hint}>Loading…</p>}
      {isError && <p style={{ ...hint, color: "#B91C1C" }}>{error?.message || "Educators couldn't be loaded."}</p>}
      {!isLoading && data.length === 0 && (
        <section style={card}>
          <Empty title={user?.role === "supervisor" ? "No educators are assigned to you yet" : "No educators yet"}>
            {user?.role === "supervisor" ? "The admin assigns educators to a supervisor on the educator form." : "Add educators first (Educators)."}
          </Empty>
        </section>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 14 }}>
        {list.map((e) => (
          <div key={e.id} style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {e.photo
                ? <img src={e.photo} alt="" style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover" }} />
                : <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #25476a, #2e7db5)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15 }}>{e.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: T.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
                  {e.hubs.length ? <><FiMapPin size={11} />{e.hubs.map((h) => h.name).join(", ")}</> : "No hub yet"}
                </p>
              </div>
              {e.due > 0 && <span style={{ padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: "#FFFBEB", color: "#B45309", whiteSpace: "nowrap" }}>{e.due} due</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Figure label="Average">{e.reports ? <ScoreBadge score={e.averageScore} /> : <span style={{ color: T.inkFaint, fontWeight: 600 }}>No reports</span>}</Figure>
              <Figure label="Last report">{e.lastReport ? <>{formatDate(e.lastReport.date, { day: "numeric", month: "short", year: "2-digit" })}</> : <span style={{ color: T.inkFaint, fontWeight: 600 }}>—</span>}</Figure>
            </div>
            <div style={{ fontSize: 12.5, color: T.inkMuted, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", minHeight: 22 }}>
              <FiCalendar size={13} />
              {e.nextVisit ? <>Next visit {formatDate(e.nextVisit.date)} <VisitTypePill type={e.nextVisit.visitType} /></> : "No visit planned"}
            </div>
            {user?.role !== "supervisor" && e.supervisorName && <p style={{ margin: "-6px 0 0", fontSize: 12, color: T.inkMuted }}>Supervisor: {e.supervisorName}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap", marginTop: "auto" }}>
              <button type="button" className="ci-btn" onClick={() => setPlanFor(e.id)} style={btn("secondary", { size: "sm" })}><FiPlus size={13} /> Plan a visit</button>
              <Link to={educatorPagePath(user?.role, e.id)} className="ci-btn" style={{ ...btn("primary", { size: "sm" }), textDecoration: "none" }}>Reviews <FiArrowRight size={13} /></Link>
            </div>
          </div>
        ))}
      </div>
      {!isLoading && data.length > 0 && list.length === 0 && <p style={hint}>No educator matches “{search}”.</p>}
      {planFor && <VisitDialog teacherId={planFor} onClose={() => setPlanFor(null)} />}
    </div>
  );
}
