import { useLocation, useSearchParams } from "react-router-dom";
import { usePermissions } from "../../../hooks/usePermissions";
import MyCheckins from "../components/MyCheckins";
import ActionsTab from "../components/ActionsTab";
import OverviewTab from "../components/OverviewTab";
import SchedulesTab from "../components/SchedulesTab";
import ActionDialog from "../components/ActionDialog";
import { chip, font } from "../shared";

// Hub check-ins. Everyone in the module has My Check-ins and Issues & Actions; check-in managers
// (the workspace owner, or staff whose role includes "Hub check-ins: schedules & oversight") also
// get the Overview across every hub and the Schedules. ?tab= picks the tab and ?action= opens an
// action — that's where notifications link.
export default function CheckinsPage() {
  const { can } = usePermissions();
  const isManager = can("checkins-manage", "view");
  const canManage = can("checkins-manage", "create") || can("checkins-manage", "edit");
  const [params, setParams] = useSearchParams();
  const tabs = [
    { key: "mine", label: "My check-ins" },
    { key: "actions", label: "Issues & actions" },
    ...(isManager ? [{ key: "overview", label: "Overview" }, { key: "schedules", label: "Schedules" }] : []),
  ];
  // /checkins/actions (where action notifications link) opens on Issues & actions.
  const { pathname } = useLocation();
  const requested = params.get("tab") || (pathname.endsWith("/actions") ? "actions" : null);
  const tab = tabs.some((t) => t.key === requested) ? requested : "mine";
  const actionId = params.get("action");
  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: key === "action" });
  };

  return (
    <div style={{ fontFamily: font }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "26px 30px", marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Hub Check-ins</h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, maxWidth: 620 }}>
          Regular check-ins with each hub: what&apos;s working, what&apos;s not, and the follow-ups agreed — tracked until they&apos;re done.
        </p>
      </div>

      <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setParam("tab", t.key === "mine" ? null : t.key)} style={chip(tab === t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "mine" && <MyCheckins isManager={isManager} />}
      {tab === "actions" && <ActionsTab isManager={isManager} onOpen={(id) => setParam("action", id)} />}
      {tab === "overview" && isManager && <OverviewTab onOpenAction={(id) => setParam("action", id)} />}
      {tab === "schedules" && isManager && <SchedulesTab canManage={canManage} />}

      {actionId && <ActionDialog actionId={actionId} onClose={() => setParam("action", null)} />}
    </div>
  );
}
