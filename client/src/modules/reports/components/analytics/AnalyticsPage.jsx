import { useEffect, useMemo } from "react";
import { FiActivity, FiAlertTriangle, FiArrowUpRight, FiAward, FiCalendar, FiClipboard, FiClock, FiDollarSign, FiGrid, FiHeart, FiHome, FiLogIn, FiStar, FiTarget, FiTrendingUp, FiUsers } from "react-icons/fi";
import { readLocal, writeLocal } from "../../../../utils/safeStorage";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAnalytics, useAnalyticsFilters } from "../../hooks/useAnalytics";
import { learnerPath } from "../../../../routes/portalPaths";
import FilterBar, { presetRange } from "./FilterBar";
import LoginsTab from "./LoginsTab";
import TimeToTaskTab from "./TimeToTaskTab";
import AssessmentsTab from "./AssessmentsTab";
import CompetenciesTab from "./CompetenciesTab";
import AtRiskTab from "./AtRiskTab";
import ParentFeedbackTab from "./ParentFeedbackTab";
import EducatorsTab from "./EducatorsTab";
import TrendsTab from "./TrendsTab";
import HubsTab from "./HubsTab";
import GrowthTab from "./GrowthTab";
import AttendanceTab from "./AttendanceTab";
import EnrolmentTab from "./EnrolmentTab";
import ParentsTab from "./ParentsTab";
import AttentionPanel from "./AttentionPanel";
import { Card, Empty, STYLES, T } from "./ui";

/*
 * Reports & Analytics — the admin Reports page (every hub of the workspace) and the hub portal's
 * (its own hub). The Overview tab is the existing dashboard; the other tabs read
 * /api/analytics/<tab> with the period and filters from the filter bar. Tab and filters live in
 * the address, so a view can be bookmarked or shared.
 */

// Grouped (10 Nov 2026): a summary, how learning is going, the people, and the business side.
const TABS = [
  { key: "overview", label: "Overview", icon: FiGrid, group: "Summary" },
  { key: "trends", label: "Trends", icon: FiTrendingUp, group: "Summary", Component: TrendsTab },
  { key: "hubs", label: "Hubs", icon: FiHome, group: "Summary", Component: HubsTab, adminOnly: true },
  { key: "growth", label: "Growth", icon: FiArrowUpRight, group: "Learning", Component: GrowthTab },
  { key: "assessments", label: "Assessments", icon: FiClipboard, group: "Learning", Component: AssessmentsTab },
  { key: "time-to-task", label: "Time to task", icon: FiClock, group: "Learning", Component: TimeToTaskTab },
  { key: "competencies", label: "Competencies", icon: FiTarget, group: "Learning", Component: CompetenciesTab },
  { key: "attendance", label: "Attendance", icon: FiCalendar, group: "Learning", Component: AttendanceTab },
  { key: "at-risk", label: "Learners at risk", icon: FiAlertTriangle, group: "Learning", Component: AtRiskTab },
  { key: "logins", label: "Logins", icon: FiLogIn, group: "People", Component: LoginsTab },
  { key: "parents", label: "Parent engagement", icon: FiHeart, group: "People", Component: ParentsTab },
  { key: "parent-feedback", label: "Parent feedback", icon: FiStar, group: "People", Component: ParentFeedbackTab },
  // Per-educator performance — admins only (hubs never see per-educator tables).
  { key: "educators", label: "Educators", icon: FiUsers, group: "People", Component: EducatorsTab, adminOnly: true },
  { key: "enrolment", label: "Enrolment & income", icon: FiDollarSign, group: "Business", Component: EnrolmentTab, adminOnly: true },
];
const GROUP_ICON = { Summary: FiActivity, Learning: FiAward, People: FiUsers, Business: FiDollarSign };
const FILTER_KEYS = ["hubId", "curriculumId", "classId", "courseId", "stageId", "pathway", "gender"];

export default function AnalyticsPage({ level = "admin", overview, onCertificates }) {
  const navigate = useNavigate();
  const isHub = level === "hub";
  const [params, setParams] = useSearchParams();
  const tabs = TABS.filter((t) => !(isHub && t.adminOnly));
  const tab = tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";
  const preset = params.get("period") || "30";
  const range = preset === "custom" ? { from: params.get("from") || presetRange("30").from, to: params.get("to") || presetRange("30").to } : presetRange(preset);
  const value = { preset, ...range, ...Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""])) };
  const query = useMemo(() => ({ from: value.from, to: value.to, ...Object.fromEntries(FILTER_KEYS.map((k) => [k, value[k]])) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.toString()]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      const key = k === "preset" ? "period" : k;
      if (v === "" || v == null) next.delete(key); else next.set(key, v);
    }
    if (patch.preset && patch.preset !== "custom") { next.delete("from"); next.delete("to"); }
    if (patch.preset === "custom") { next.set("from", value.from); next.set("to", value.to); }
    setParams(next, { replace: true });
  };
  const setTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === "overview") next.delete("tab"); else next.set("tab", key);
    setParams(next);
  };

  // The last period and filters are remembered in this browser (10 Nov 2026): opening the page
  // with none in the address brings them back; every change is kept.
  const memoryKey = `analytics.view.${level}`;
  useEffect(() => {
    if (params.get("period") || FILTER_KEYS.some((k) => params.get(k))) return;
    let saved = null;
    try { saved = JSON.parse(readLocal(memoryKey) || "null"); } catch { saved = null; }
    if (!saved) return;
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(saved)) if (v) next.set(k, v);
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const keep = Object.fromEntries(["period", "from", "to", ...FILTER_KEYS].map((k) => [k, params.get(k) || ""]).filter(([, v]) => v));
    writeLocal(memoryKey, JSON.stringify(keep));
  }, [params, memoryKey]);

  const current = tabs.find((t) => t.key === tab);
  const filtersQuery = useAnalyticsFilters(isHub ? "" : value.hubId);
  const viewQuery = useAnalytics(tab, query, { enabled: tab !== "overview" });
  // "Focus" on a hub (Hubs tab): every tab narrowed to it, starting with its trends.
  const focusHub = (hubId) => {
    const next = new URLSearchParams(params);
    next.set("hubId", hubId); next.delete("classId"); next.delete("courseId"); next.set("tab", "trends");
    setParams(next);
  };
  const links = {
    learner: (id) => navigate(learnerPath(isHub ? "school" : "admin", id, "view")),
    educator: (id) => navigate(isHub ? `/school-portal/teachers/${id}/view` : `/teachers/${id}/view`),
  };
  const Component = current.Component;

  return (
    <div className="an">
      <style>{STYLES}{`
.an-tabs { display: flex; gap: 10px 18px; flex-wrap: wrap; align-items: flex-start; background: #fff; border: 1px solid ${T.border}; border-radius: 16px; padding: 10px 12px; }
.an-tab-group { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.an-tab-group-label { display: inline-flex; align-items: center; gap: 5px; font-size: 10.5px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: ${T.faint}; padding-left: 2px; }
`}</style>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.ink, letterSpacing: "-0.3px", display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${T.navy}, ${T.sky})`, color: "#fff", display: "grid", placeItems: "center" }}><FiActivity size={18} /></span>
          Reports & Analytics
        </h1>
        {onCertificates && (
          <button type="button" onClick={onCertificates}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: `1px solid ${T.border}`, background: "#fff", color: T.navy, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <FiAward size={14} /> Certificates issued
          </button>
        )}
      </div>

      <nav aria-label="Analytics" className="an-tabs">
        {[...new Set(tabs.map((t) => t.group))].map((group) => {
          const GroupIcon = GROUP_ICON[group] || FiGrid;
          return (
            <div key={group} className="an-tab-group">
              <span className="an-tab-group-label"><GroupIcon size={12} aria-hidden /> {group}</span>
              <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {tabs.filter((t) => t.group === group).map((t) => {
                  const on = tab === t.key;
                  return (
                    <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 11, border: `1.5px solid ${on ? T.navy : T.border}`, background: on ? T.navy : "#fff", color: on ? "#fff" : T.ink, fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                      <t.icon size={14} aria-hidden /> {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {tab === "overview" ? (
        <>
          <AttentionPanel onTab={setTab} />
          {overview}
        </>
      ) : (
        <>
          <FilterBar filters={filtersQuery.data} value={value} onChange={update} isHub={isHub} />
          {viewQuery.isError ? (
            <Card><Empty>{viewQuery.error?.message || "These figures couldn't be loaded. Try again."}</Empty></Card>
          ) : !viewQuery.data ? (
            <Card><Empty>Loading…</Empty></Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: viewQuery.isFetching ? 0.6 : 1, transition: "opacity .15s" }}>
              <Component data={viewQuery.data} links={links} isHub={isHub} onTab={setTab} onFocusHub={focusHub} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
