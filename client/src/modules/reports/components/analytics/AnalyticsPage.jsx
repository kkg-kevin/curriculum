import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAnalytics, useAnalyticsFilters } from "../../hooks/useAnalytics";
import { learnerPath } from "../../../../routes/portalPaths";
import FilterBar, { presetRange } from "./FilterBar";
import LoginsTab from "./LoginsTab";
import TimeToTaskTab from "./TimeToTaskTab";
import AssessmentsTab from "./AssessmentsTab";
import CompetenciesTab from "./CompetenciesTab";
import AtRiskTab from "./AtRiskTab";
import { Card, Empty, STYLES, T } from "./ui";

/*
 * Reports & Analytics — the admin Reports page (every hub of the workspace) and the hub portal's
 * (its own hub). The Overview tab is the existing dashboard; the other tabs read
 * /api/analytics/<tab> with the period and filters from the filter bar. Tab and filters live in
 * the address, so a view can be bookmarked or shared.
 */

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "logins", label: "Logins & engagement", Component: LoginsTab },
  { key: "time-to-task", label: "Time to task", Component: TimeToTaskTab },
  { key: "assessments", label: "Assessments", Component: AssessmentsTab },
  { key: "competencies", label: "Competencies", Component: CompetenciesTab },
  { key: "at-risk", label: "Learners at risk", Component: AtRiskTab },
];
const FILTER_KEYS = ["hubId", "curriculumId", "classId", "courseId", "stageId", "pathway", "gender"];

export default function AnalyticsPage({ level = "admin", overview, description, onCertificates }) {
  const navigate = useNavigate();
  const isHub = level === "hub";
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";
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

  const current = TABS.find((t) => t.key === tab);
  const filtersQuery = useAnalyticsFilters(isHub ? "" : value.hubId);
  const viewQuery = useAnalytics(tab, query, { enabled: tab !== "overview" });
  const links = {
    learner: (id) => navigate(learnerPath(isHub ? "school" : "admin", id, "view")),
    educator: (id) => navigate(isHub ? `/school-portal/teachers/${id}/view` : `/teachers/${id}/view`),
  };
  const Component = current.Component;

  return (
    <div className="an">
      <style>{STYLES}</style>
      <div style={{ background: `linear-gradient(135deg, ${T.navyDeep} 0%, ${T.navy} 40%, ${T.mid} 75%, ${T.sky} 100%)`, borderRadius: 20, padding: "24px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Reports & Analytics</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)", maxWidth: 680 }}>{description}</p>
          {onCertificates && (
            <button type="button" onClick={onCertificates}
              style={{ marginTop: 14, padding: "8px 16px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Certificates issued
            </button>
          )}
        </div>
      </div>

      <div className="ui-tab-scroll" role="tablist" aria-label="Analytics" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            style={{ padding: "9px 16px", borderRadius: 12, border: `1.5px solid ${tab === t.key ? T.navy : T.border}`, background: tab === t.key ? T.navy : "#fff", color: tab === t.key ? "#fff" : T.ink, fontSize: 13.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? overview : (
        <>
          <FilterBar filters={filtersQuery.data} value={value} onChange={update} isHub={isHub} />
          {viewQuery.isError ? (
            <Card><Empty>{viewQuery.error?.response?.data?.message || "Couldn't load these figures — try again."}</Empty></Card>
          ) : !viewQuery.data ? (
            <Card><Empty>Loading…</Empty></Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, opacity: viewQuery.isFetching ? 0.6 : 1, transition: "opacity .15s" }}>
              <Component data={viewQuery.data} links={links} isHub={isHub} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
