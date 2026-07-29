import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiBookOpen, FiLayers, FiUsers } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";
import { gradeStreamsPath } from "../../../routes/portalPaths";

const ACCENT    = "#25476a";
const GRAD_FROM = "#feb139";
const GRAD_TO   = "#f59e0b";

// One grade at one hub can be split into several streams (same gradeId+academicYear, different
// streamName) — this is the grouped card shown on the Classes grid for a grade with 2+ streams,
// standing in for all of them at once. Clicking it drills into GradeStreamsPage, where each
// stream gets its own regular ClassCard (roster/attendance/educators are all per-stream, not
// managed from here). A grade with just one class never reaches this component — SchoolClassesPage
// renders a plain ClassCard directly for those, unchanged from before streams existed.
export function GradeGroupCard({ group, schoolId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);

  const first = group[0];
  const totalLearners = group.reduce((sum, c) => sum + (c.learnerCount || 0), 0);
  const totalCapacity = group.every((c) => c.capacity != null) ? group.reduce((sum, c) => sum + c.capacity, 0) : null;
  const activeCount = group.filter((c) => c.status === "active").length;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(gradeStreamsPath(user?.role, schoolId, first.gradeId, first.academicYear))}
      style={{ backgroundColor: "#ffffff", borderRadius: 16, boxShadow: hovered ? "0 8px 24px rgba(234,88,12,0.10), 0 2px 6px rgba(0,0,0,0.05)" : "0 1px 4px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", overflow: "hidden", transition: "box-shadow 0.2s, transform 0.2s", transform: hovered ? "translateY(-2px)" : "translateY(0)", cursor: "pointer" }}
    >
      <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${GRAD_FROM}, ${GRAD_TO})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#fff" }}>
              <FiBookOpen size={20} strokeWidth={1.8} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: hovered ? ACCENT : "#111827", transition: "color 0.15s" }}>
                {first.gradeName}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#9CA3AF" }}>{first.academicYear}</p>
            </div>
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "#e8f5fb", color: ACCENT, border: "1px solid #a8d5ee", flexShrink: 0 }}>
            <FiLayers size={11} strokeWidth={2} /> {group.length} streams
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid #F3F4F6", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7280" }}>
            <FiUsers size={14} strokeWidth={2} color="#6B7280" />
            <span>
              {totalLearners} learner{totalLearners !== 1 ? "s" : ""}
              {totalCapacity != null ? <span style={{ color: "#9CA3AF" }}> · {totalCapacity} capacity</span> : null}
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {group.map((c) => (
              <span key={c.id} style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, backgroundColor: "#F9FAFB", color: "#6B7280", border: "1px solid #E5E7EB" }}>
                {c.streamName || "Unnamed"}
              </span>
            ))}
          </div>
        </div>

        <div style={{ marginTop: "auto" }}>
          <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: "#e8f5fb", color: "#25476a", border: "1px solid #a8d5ee" }}>
            {activeCount} of {group.length} active
          </span>
        </div>
      </div>
    </div>
  );
}
