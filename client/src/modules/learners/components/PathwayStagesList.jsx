// A pathway's courses, stage by stage, in order — the dropdown under each pathway on the learner
// profile's Pathway tab (learner, parent) and on the staff learner page's Pathway card. `stages` is
// what the server sends with each pathway the learner is on (competency.service.js getPathway →
// `stages`: [{ stageName, isLearnerStage, courses: [{ id, name }] }]). The learner's own stage is
// marked, and in it their current course (and the next one). Stages with no courses are left out,
// except the learner's own, so it's clear when theirs has none yet.
//   audience "learner" → "Your stage" / "You're here"; "staff" → "Their stage" / "Current".
export default function PathwayStagesList({ stages = [], currentCourseId = null, color = "#25476a", awaitingDiagnostic = false, audience = "staff" }) {
  const learner = audience === "learner";
  const shown = stages.filter((s) => s.courses.length || s.isLearnerStage);
  if (!shown.some((s) => s.courses.length)) {
    return <p style={{ margin: "8px 0 0 20px", fontSize: 12, color: "#9CA3AF" }}>No courses in this pathway yet.</p>;
  }
  const many = shown.length > 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "10px 0 0", padding: "0 0 0 20px" }}>
      {shown.map((stage, si) => {
        const currentIndex = stage.isLearnerStage && currentCourseId ? stage.courses.findIndex((c) => c.id === currentCourseId) : -1;
        return (
          <div key={stage.pathwayId || si}>
            {many && (
              <p style={{ margin: "0 0 5px", display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 800, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {stage.stageName || "Any stage"}
                {stage.isLearnerStage && (
                  <span style={{ padding: "1px 8px", borderRadius: 20, fontSize: 10.5, fontWeight: 800, textTransform: "none", letterSpacing: 0, background: "#e8f5fb", color: "#25476a", border: "1px solid #a8d5ee" }}>
                    {learner ? "Your stage" : "Their stage"}
                  </span>
                )}
              </p>
            )}
            {!stage.courses.length ? (
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>No courses for this stage yet.</p>
            ) : (
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                {stage.courses.map((course, i) => {
                  const isCurrent = i === currentIndex;
                  const earlier = currentIndex !== -1 && i < currentIndex;
                  const tag = isCurrent
                    ? (awaitingDiagnostic ? "Starts here" : learner ? "You're here" : "Current")
                    : currentIndex !== -1 && i === currentIndex + 1 ? "Next" : null;
                  return (
                    <li
                      key={course.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8,
                        background: isCurrent ? "#ffffff" : "transparent",
                        border: `1px solid ${isCurrent ? color : "transparent"}`,
                        opacity: earlier ? 0.65 : 1,
                      }}
                    >
                      <span style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, backgroundColor: isCurrent ? color : "#F3F4F6", color: isCurrent ? "#ffffff" : "#6B7280" }}>
                        {i + 1}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: isCurrent ? 700 : 500, color: "#1F2937", overflowWrap: "anywhere" }}>{course.name}</span>
                      {tag && <span style={{ fontSize: 11, fontWeight: 700, color: isCurrent ? "#059669" : "#6B7280", whiteSpace: "nowrap" }}>{tag}</span>}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}
