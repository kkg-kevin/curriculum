import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLearnerQuery, useDeleteLearner, useUpdateLearner } from "../hooks/useLearners";
import { useAllLocationsQuery } from "../../locations/hooks/useLocation";
import { useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/services/classApi";
import { useLadder, useLearningJourney, usePlaceLearner, useLearningAreas, useAgeCategories } from "../../curriculum/hooks/useCompetencies";
import { useCoursesQuery } from "../../courses/hooks/useCourse";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { useAuth } from "../../../context/AuthContext";
import { learnersListPath, learnerPath } from "../../../routes/portalPaths";

const GRAD_FROM = "#1a3550";
const GRAD_TO   = "#38aae1";

const STATUS_LABELS = { active: "Active", inactive: "Inactive", transferred: "Transferred", graduated: "Graduated" };

function Avatar({ firstName, lastName, size = 64 }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: `linear-gradient(135deg, ${GRAD_FROM}, ${GRAD_TO})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.35, fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>
      {initials || "?"}
    </div>
  );
}

// Where this learner currently sits on their curriculum's Learning Journey (Progression
// Ladder) — set manually here, e.g. by age at enrollment or after a diagnostic assessment.
// Only renders once the learner's class resolves to a curriculum with stages defined.
function JourneyPlacementCard({ learnerId, currentRungId, curriculumId }) {
  const { data: rungs = [], isLoading } = useLadder(curriculumId);
  const { mutate: updateLearner, isPending: saving } = useUpdateLearner();

  if (!curriculumId || isLoading) return null;
  if (rungs.length === 0) return null;

  const sorted = [...rungs].sort((a, b) => a.order - b.order);
  const current = sorted.find((r) => r.id === currentRungId) || null;

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Learning Journey Placement</h3>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9CA3AF" }}>
        Which stage of this curriculum's Learning Journey this learner is starting from.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <select
          value={currentRungId || ""}
          disabled={saving}
          onChange={(e) => updateLearner({ id: learnerId, data: { currentRungId: e.target.value || null } })}
          style={{ padding: "9px 12px", borderRadius: 10, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: "Inter, sans-serif", color: "#111827", minWidth: 220 }}
        >
          <option value="">Not yet placed</option>
          {sorted.map((r) => (
            <option key={r.id} value={r.id}>{r.label}{r.ageRange ? ` (${r.ageRange} yrs)` : ""}</option>
          ))}
        </select>
        {current
          ? <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>Placed at "{current.label}"</span>
          : <span style={{ fontSize: 12, color: "#9CA3AF" }}>No starting stage set yet</span>}
      </div>
    </div>
  );
}

// Per-Learning-Area course placement — where the learner currently sits in each
// area's course sequence (Robotics 1 → 2 → 3 → 4, etc.), and which developmental
// stage they're in (used to resolve a default placement when nothing else has
// placed them yet — diagnostic assessment or manual override, set below).
function LearningJourneyCard({ learnerId, currentStageId, curriculumId }) {
  const { data: journey = [], isLoading: journeyLoading } = useLearningJourney(curriculumId, learnerId);
  const { data: areas = [] } = useLearningAreas(curriculumId);
  const { data: stages = [] } = useAgeCategories(curriculumId);
  const { data: coursesResponse } = useCoursesQuery();
  const { mutate: place, isPending: placing } = usePlaceLearner(curriculumId, learnerId);
  const { mutate: updateLearner, isPending: savingStage } = useUpdateLearner();

  if (!curriculumId || journeyLoading) return null;
  if (journey.length === 0) return null;

  const allCourses = coursesResponse?.data || [];
  const courseNameById = new Map(allCourses.map((c) => [c.id, c.name]));
  const areaById = new Map(areas.map((a) => [a.id, a]));

  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", gridColumn: "1 / -1" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Learning Journey — Course Placement</h3>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9CA3AF" }}>
        Where this learner currently sits in each learning area's course sequence.
      </p>

      {stages.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Developmental Stage:</span>
          <select
            value={currentStageId || ""}
            disabled={savingStage}
            onChange={(e) => updateLearner({ id: learnerId, data: { currentStageId: e.target.value || null } })}
            style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#111827" }}
          >
            <option value="">Not set</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {journey.map((j) => {
          const area = areaById.get(j.learningAreaId);
          const areaColor = area?.color || "#25476a";
          const seq = [...(area?.courseSequence || [])].sort((a, b) => a.order - b.order).map((s) => s.courseId)
            .filter((cid) => (area?.courses || []).includes(cid));
          const options = [...seq, ...((area?.courses || []).filter((id) => !seq.includes(id)))];
          return (
            <div key={j.learningAreaId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "#FAFCFF", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: areaColor, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#1F2937" }}>{j.learningAreaName}</span>
              </div>
              <select
                value={j.currentCourseId || ""}
                disabled={placing}
                onChange={(e) => {
                  if (!e.target.value) return;
                  place({ areaId: j.learningAreaId, data: { courseId: e.target.value, reason: "manual" } });
                }}
                style={{ padding: "7px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#111827", minWidth: 200 }}
              >
                <option value="">Not placed</option>
                {options.map((cid) => (
                  <option key={cid} value={cid}>{courseNameById.get(cid) || "Unknown course"}</option>
                ))}
              </select>
              {j.currentCourseId ? (
                <span style={{ fontSize: 11, color: j.isDefault ? "#9CA3AF" : "#059669", fontWeight: 600 }}>
                  {j.isDefault ? "Default placement" : `Placed${j.history.length > 1 ? ` · ${j.history.length} changes` : ""}`}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>No course sequenced yet</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailRow({ label, value, empty = "—" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#111827", fontWeight: 500 }}>{value || empty}</span>
    </div>
  );
}

export default function LearnerViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: learner, isLoading } = useLearnerQuery(id);
  const { mutate: deleteLearner } = useDeleteLearner();
  const { data: schoolsData } = useAllLocationsQuery({ locationType: "school" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", learner?.schoolId],
    queryFn: () => classApi.getAll({ schoolId: learner.schoolId }),
    enabled: !!learner?.schoolId,
  });

  if (isLoading) return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  if (!learner)  return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Learner not found.</div>;

  const schoolsMap = (schoolsData?.data || []).reduce((m, s) => { m[s.id] = s; return m; }, {});
  const classesMap = (classesData?.data || []).reduce((m, c) => { m[c.id] = c; return m; }, {});

  const school = schoolsMap[learner.schoolId];
  const cls    = learner.classId ? classesMap[learner.classId] : null;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate(learnersListPath(user?.role, learner.schoolId))} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
          ← Learners
        </button>
        <span style={{ color: "#D1D5DB", fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{learner.firstName} {learner.lastName}</span>
      </div>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${GRAD_FROM} 0%, #25476a 40%, #2e7db5 75%, ${GRAD_TO} 100%)`, borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Avatar firstName={learner.firstName} lastName={learner.lastName} />
            <div>
              <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, color: "#ffffff" }}>{learner.firstName} {learner.lastName}</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>{learner.admissionNumber}</span>
                <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: "rgba(255,255,255,0.18)", color: "#ffffff" }}>
                  {STATUS_LABELS[learner.status]}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => navigate(learnerPath(user?.role, id, "edit"))} style={{ padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ padding: "10px 20px", backgroundColor: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Remove
            </button>
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Enrollment */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Enrollment</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="Admission Number" value={learner.admissionNumber} />
            <DetailRow label="School"           value={school?.name} />
            <DetailRow label="Class"            value={cls?.gradeName} />
            <DetailRow label="Academic Year"    value={cls?.academicYear} />
            <DetailRow label="Gender"           value={learner.gender ? learner.gender.charAt(0).toUpperCase() + learner.gender.slice(1) : null} />
            <DetailRow label="Status"           value={STATUS_LABELS[learner.status]} />
          </div>
        </div>

        {/* Guardian */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Guardian</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="Name"  value={learner.guardianName} />
            <DetailRow label="Phone" value={learner.guardianPhone} />
            <DetailRow label="Email" value={learner.guardianEmail} />
            <DetailRow label="Enrolled"     value={new Date(learner.createdAt).toLocaleDateString()} />
            <DetailRow label="Last Updated" value={new Date(learner.updatedAt).toLocaleDateString()} />
          </div>
        </div>

        <LearningJourneyCard learnerId={id} currentStageId={learner.currentStageId} curriculumId={cls?.curriculumId} />
        <JourneyPlacementCard learnerId={id} currentRungId={learner.currentRungId} curriculumId={cls?.curriculumId} />
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Remove Learner"
        message={`"${learner.firstName} ${learner.lastName}" (${learner.admissionNumber}) will be permanently removed. This cannot be undone.`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          deleteLearner(id, { onSuccess: () => navigate(learnersListPath(user?.role, learner.schoolId)) });
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
