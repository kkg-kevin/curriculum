import { useOutletContext } from "react-router-dom";
import AssessmentsOverview from "../components/AssessmentsOverview";
import SideRail from "../components/SideRail";

const T = {
  accent: "#25476a",
  accentDeep: "#1a3550",
  accentMid: "#2e7db5",
  accentLight: "#38aae1",
};

export default function LearnerAssessmentsPage() {
  const { hubs, hubsLoading, mentors, mentorsLoading, cls } = useOutletContext();

  return (
    <div style={{ fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: `linear-gradient(135deg, ${T.accentDeep} 0%, ${T.accent} 40%, ${T.accentMid} 75%, ${T.accentLight} 100%)`, borderRadius: 20, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.4px" }}>My Assessments</h1>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 620 }}>Assessments your teacher has issued to your class.</p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
        <div style={{ flex: 2, minWidth: 340 }}>
          <AssessmentsOverview classId={cls?.id} />
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <SideRail hubs={hubs} mentors={mentors} hubsLoading={hubsLoading} mentorsLoading={mentorsLoading} />
        </div>
      </div>
    </div>
  );
}
