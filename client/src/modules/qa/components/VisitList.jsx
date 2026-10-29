import { useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowUpRight, FiMapPin, FiMessageSquare } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { useQaEducators, useQaVisits } from "../hooks/useQa";
import {
  Empty, Pager, Pill, ScoreBadge, stateLook, Segmented, T, VisitTypePill, card, formatDate, hint, toolbar, toolbarSelect, useQaBase, visitPath,
} from "../shared";

const VIEWS = [
  { key: "due", label: "Review due" },
  { key: "upcoming", label: "Upcoming" },
  { key: "submitted", label: "Reports" },
  { key: "all", label: "All" },
];
const EMPTY_TEXT = { due: "No reviews due.", upcoming: "No visits coming up.", submitted: "No reports yet.", all: "No visits yet.", cancelled: "Nothing cancelled." };

// One visit in a list — opens its page. `showTeacher` off on an educator's own page.
export function VisitRow({ visit, showTeacher = true }) {
  const base = useQaBase();
  const { user } = useAuth();
  return (
    <Link to={visitPath(base, visit.id)} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "13px 18px", borderTop: "1px solid #F3F4F6", textDecoration: "none", color: "inherit", background: visit.state === "due" ? "#FFFDF7" : "transparent" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {showTeacher && <strong style={{ fontSize: 14, color: T.ink }}>{visit.teacherName}</strong>}
          {!showTeacher && <strong style={{ fontSize: 14, color: T.ink }}>{formatDate(visit.scheduledDate)}</strong>}
          <Pill look={stateLook(visit.state, user?.role)} />
          <VisitTypePill type={visit.visitType} />
          {visit.started && visit.state !== "submitted" && <Pill look={{ bg: "#F3F4F6", color: "#374151" }}>Review started</Pill>}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4, fontSize: 12.5, color: T.inkMuted }}>
          {showTeacher && <span>{formatDate(visit.scheduledDate)}</span>}
          {visit.hubName && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><FiMapPin size={12} />{visit.hubName}</span>}
          {visit.reviewerName && <span>By {visit.reviewerName}</span>}
          {visit.templateName && <span>{visit.templateName}</span>}
          {visit.hasReply && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.accentMid, fontWeight: 700 }}><FiMessageSquare size={12} />Replied</span>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {visit.state === "submitted" && <ScoreBadge score={visit.score} />}
        <FiArrowUpRight size={15} color={T.accentMid} />
      </div>
    </Link>
  );
}

// The visits a reviewer can see: the ones due, coming up, sent, or all — by educator and hub.
// `teacherId` fixes it to one educator (their profile page), without the filters.
export default function VisitList({ teacherId = "", initialView = "due" }) {
  const [view, setView] = useState(initialView);
  const [filters, setFilters] = useState({ teacherId: "", hubId: "" });
  const [page, setPage] = useState(1);
  const { data: educators = [] } = useQaEducators({ enabled: !teacherId });
  const hubs = [...new Map(educators.flatMap((e) => e.hubs).map((h) => [h.id, h])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const params = { view, page, limit: 30, ...Object.fromEntries(Object.entries(teacherId ? { teacherId } : filters).filter(([, v]) => v)) };
  const { data, isLoading, isError, error } = useQaVisits(params);
  const counts = data?.counts || {};
  const setFilter = (key) => (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={toolbar}>
        <Segmented label="Show" options={VIEWS.map((v) => ({ ...v, count: counts[v.key] }))} value={view} onChange={(key) => { setView(key); setPage(1); }} />
        {!teacherId && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={filters.teacherId} onChange={setFilter("teacherId")} aria-label="Educator" style={toolbarSelect}>
              <option value="">All educators</option>
              {educators.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            {hubs.length > 1 && (
              <select value={filters.hubId} onChange={setFilter("hubId")} aria-label="Hub" style={toolbarSelect}>
                <option value="">All hubs</option>
                {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      <section style={{ ...card, overflow: "hidden" }}>
        {isLoading && <p style={{ ...hint, padding: 18 }}>Loading…</p>}
        {isError && <p style={{ ...hint, padding: 18, color: "#B91C1C" }}>{error?.message || "Visits couldn't be loaded."}</p>}
        {data && data.visits.length === 0 && <Empty title={EMPTY_TEXT[view]}>{view === "due" ? "Visits whose day has come and whose report isn't sent show here." : null}</Empty>}
        {data?.visits.map((v) => <VisitRow key={v.id} visit={v} showTeacher={!teacherId} />)}
        {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
      </section>
    </div>
  );
}
