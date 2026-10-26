import { useSearchParams } from "react-router-dom";
import { usePermissions } from "../../../hooks/usePermissions";
import { useAuth } from "../../../context/AuthContext";
import CheckinList from "../components/CheckinList";
import SchedulesTab from "../components/SchedulesTab";
import { chip, font } from "../shared";

// Hub check-ins. Everyone has My check-ins; in the admin app, check-in managers (the workspace's
// admins, or staff whose role includes "Hub check-ins: schedules & every hub") also get every
// hub's check-ins and the Schedules. A hub's Account Manager / Training Lead opens this in the hub
// portal (/school-portal/checkins). ?tab= picks the tab.
export default function CheckinsPage() {
  const { can } = usePermissions();
  // A hub's Account Manager / Training Lead (the hub portal) has just their own check-ins.
  const { user } = useAuth();
  const isManager = !user?.hubLead && can("checkins-manage", "view");
  const canManage = isManager && (can("checkins-manage", "create") || can("checkins-manage", "edit"));
  const [params, setParams] = useSearchParams();
  const tabs = [
    { key: "mine", label: "My check-ins" },
    ...(isManager ? [{ key: "all", label: "All check-ins" }, { key: "schedules", label: "Schedules" }] : []),
  ];
  const tab = tabs.some((t) => t.key === params.get("tab")) ? params.get("tab") : "mine";
  const setTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === "mine") next.delete("tab"); else next.set("tab", key);
    setParams(next);
  };

  return (
    <div style={{ fontFamily: font }}>
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "26px 30px", marginBottom: 18 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Hub Check-ins</h1>
        <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, maxWidth: 620 }}>
          Regular check-ins on how each hub is running. When one is due, write its report: the highs, the lows and the resolutions.
        </p>
      </div>

      <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} style={chip(tab === t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === "mine" && <CheckinList key="mine" scope="mine" />}
      {tab === "all" && isManager && <CheckinList key="all" scope="all" />}
      {tab === "schedules" && isManager && <SchedulesTab canManage={canManage} />}
    </div>
  );
}
