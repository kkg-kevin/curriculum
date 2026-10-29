import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiCalendar, FiClipboard, FiFileText, FiPlus, FiUsers } from "react-icons/fi";
import VisitList from "../components/VisitList";
import EducatorsTab from "../components/EducatorsTab";
import SchedulesTab from "../components/SchedulesTab";
import TemplatesTab from "../components/TemplatesTab";
import VisitDialog from "../components/VisitDialog";
import { QaStyles, Tabs, btn, font } from "../shared";

const TABS = [
  { key: "visits", label: "Visits", icon: FiClipboard },
  { key: "educators", label: "Educators", icon: FiUsers },
  { key: "schedules", label: "Schedules", icon: FiCalendar },
  { key: "templates", label: "Templates", icon: FiFileText },
];

// Quality assurance, for whoever reviews: the admin app (/qa — admins, and staff with "Quality
// assurance") and the supervisor portal (/supervisor-portal/qa — a supervisor's own educators).
// Visits to review and their reports; the educators; regular visits; the templates. ?tab= picks the tab.
export default function QaPage() {
  const [params, setParams] = useSearchParams();
  const [planning, setPlanning] = useState(false);
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "visits";
  const setTab = (key) => {
    const next = new URLSearchParams(params);
    if (key === "visits") next.delete("tab"); else next.set("tab", key);
    setParams(next);
  };

  return (
    <div style={{ fontFamily: font }}>
      <QaStyles />
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "26px 30px", marginBottom: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>Quality Assurance</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, maxWidth: 640 }}>
            Visit educators — announced or by surprise — and review how they teach against a template. The educator reads the report and can reply; their hub sees a summary.
          </p>
        </div>
        <button type="button" className="ci-btn" onClick={() => setPlanning(true)} style={{ ...btn("primary"), background: "#feb139", borderColor: "#feb139", color: "#25476a" }}><FiPlus size={15} /> Plan a visit</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Quality assurance" />
      </div>

      {tab === "visits" && <VisitList />}
      {tab === "educators" && <EducatorsTab />}
      {tab === "schedules" && <SchedulesTab />}
      {tab === "templates" && <TemplatesTab />}
      {planning && <VisitDialog onClose={() => setPlanning(false)} />}
    </div>
  );
}
