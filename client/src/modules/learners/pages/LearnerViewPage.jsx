import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  useLearnerQuery, useDeleteLearner, useUpdateLearner,
  useLearnerHubsQuery, useEnrollLearnerHub, useUpdateLearnerHubLink, useUnenrollLearnerHub,
} from "../hooks/useLearners";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import { learningHubApi } from "../../learning-hubs/services/learningHubApi";
import { classApi } from "../../classes/services/classApi";
import { useLadder, useLearningJourney, usePlaceLearner, useLearningAreas, useAgeCategories } from "../../curriculum/hooks/useCompetencies";
import { useCoursesQuery } from "../../courses/hooks/useCourse";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";
import { useAuth } from "../../../context/AuthContext";
import { learnersListPath, learnerPath, schoolViewPath } from "../../../routes/portalPaths";

const GRAD_FROM = "#1a3550";
const GRAD_TO   = "#38aae1";
const ACCENT    = "#25476a";

const STATUS_LABELS = { active: "Active", inactive: "Inactive", transferred: "Transferred", graduated: "Graduated" };
const STATUS_STYLES = {
  active:      { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  transferred: { bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee" },
  graduated:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
};

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

// One enrollment row — hub name, plus that hub's class/admission-number/status, editable
// in place (mirrors TeacherViewPage's Learning Hubs row, richer because a learner's
// placement within a hub is meaningful in a way a teacher's isn't).
function EnrollmentRow({ learnerId, enrollment, isAdmin, onRequestUnlink }) {
  const navigate = useNavigate();
  const { mutate: updateLink } = useUpdateLearnerHubLink();

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", enrollment.id],
    queryFn:  () => classApi.getAll({ schoolId: enrollment.id }),
    enabled:  isAdmin,
  });
  const classes = (classesData?.data || []).filter((c) => c.status === "active");
  const statusStyle = STATUS_STYLES[enrollment.status] || STATUS_STYLES.inactive;

  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div onClick={() => navigate(schoolViewPath(isAdmin ? "admin" : "school", enrollment.id))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minWidth: 0 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>🏫</span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: ACCENT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{enrollment.name}</p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "#9CA3AF" }}>{enrollment.admissionNumber || "No admission number"}</p>
          </div>
        </div>
        <span style={{ padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}`, flexShrink: 0 }}>
          {STATUS_LABELS[enrollment.status] ?? enrollment.status}
        </span>
      </div>

      {isAdmin && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select
            value={enrollment.classId || ""}
            onChange={(e) => updateLink({ learnerId, hubId: enrollment.id, data: { classId: e.target.value } })}
            style={{ padding: "6px 8px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, fontFamily: "Inter, sans-serif", color: "#374151", flex: 1, minWidth: 140 }}
          >
            <option value="">— No class —</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.gradeName} — {c.academicYear}</option>)}
          </select>
          <select
            value={enrollment.status}
            onChange={(e) => updateLink({ learnerId, hubId: enrollment.id, data: { status: e.target.value } })}
            style={{ padding: "6px 8px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, fontFamily: "Inter, sans-serif", color: "#374151" }}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="transferred">Transferred</option>
            <option value="graduated">Graduated</option>
          </select>
          <button type="button" onClick={() => onRequestUnlink(enrollment)} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Unlink
          </button>
        </div>
      )}
      {!isAdmin && (
        <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
          {enrollment.class ? `${enrollment.class.gradeName} — ${enrollment.class.academicYear}` : "No class assigned yet"}
        </p>
      )}
    </div>
  );
}

function EnrollLearnerControl({ learnerId, enrolledHubIds }) {
  const { data: allHubsData } = useAllLearningHubsQuery({ hubType: "school", status: "active" });
  const availableHubs = (allHubsData?.data || []).filter((h) => !enrolledHubIds.includes(h.id));
  const [selectedHubId, setSelectedHubId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const { mutate: enroll, isPending } = useEnrollLearnerHub();

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", selectedHubId],
    queryFn:  () => classApi.getAll({ schoolId: selectedHubId }),
    enabled:  !!selectedHubId,
  });
  const classes = (classesData?.data || []).filter((c) => c.status === "active");

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F3F4F6", display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select
        value={selectedHubId}
        onChange={(e) => { setSelectedHubId(e.target.value); setSelectedClassId(""); }}
        style={{ flex: 1, minWidth: 140, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151" }}
      >
        <option value="">Enroll at hub…</option>
        {availableHubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
      </select>
      <select
        value={selectedClassId}
        onChange={(e) => setSelectedClassId(e.target.value)}
        disabled={!selectedHubId}
        style={{ flex: 1, minWidth: 140, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151", opacity: selectedHubId ? 1 : 0.5 }}
      >
        <option value="">— No class yet —</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.gradeName} — {c.academicYear}</option>)}
      </select>
      <button
        type="button"
        disabled={!selectedHubId || isPending}
        onClick={() => {
          enroll({ learnerId, data: { hubId: selectedHubId, classId: selectedClassId, status: "active" } });
          setSelectedHubId(""); setSelectedClassId("");
        }}
        style={{ padding: "8px 16px", backgroundColor: !selectedHubId || isPending ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: !selectedHubId || isPending ? "not-allowed" : "pointer", flexShrink: 0 }}
      >
        Enroll
      </button>
    </div>
  );
}

export default function LearnerViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSchool = user?.role === "school";
  const { data: learner, isLoading } = useLearnerQuery(id);
  const { data: enrollments = [] } = useLearnerHubsQuery(id);
  const { mutate: deleteLearner } = useDeleteLearner();
  const { mutate: unenroll } = useUnenrollLearnerHub();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  const { data: ownSchoolData } = useQuery({
    queryKey: ["learningHubs", "byEmail", user?.email],
    queryFn:  () => learningHubApi.getAll({ email: user.email }),
    enabled:  isSchool && !!user?.email,
  });
  const ownSchoolId = ownSchoolData?.data?.[0]?.id;

  if (isLoading) return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  if (!learner)  return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#EF4444" }}>Learner not found.</div>;

  // Multiple enrollments are possible now — the first active one is used as the "current"
  // context for Learning Journey placement, same pragmatic default used elsewhere until a
  // dedicated hub-context switcher exists for learners.
  const primary = enrollments.find((e) => e.status === "active") || enrollments[0] || null;
  const curriculumId = primary?.class?.curriculumId;

  const backContext = isSchool ? ownSchoolId : undefined;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
        <button type="button" onClick={() => navigate(learnersListPath(user?.role, backContext))} style={{ padding: 0, background: "none", border: "none", color: "#6B7280", fontSize: 13, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
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
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
                  {enrollments.length === 0 ? "Not yet enrolled" : `${enrollments.length} hub enrollment${enrollments.length !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => navigate(learnerPath(user?.role, id, "edit"))} style={{ padding: "10px 20px", backgroundColor: "rgba(255,255,255,0.15)", color: "#ffffff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Edit
            </button>
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ padding: "10px 20px", backgroundColor: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              {isSchool ? "Remove from Hub" : "Remove"}
            </button>
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Learning Hubs */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Learning Hubs</h3>
          {enrollments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#9CA3AF" }}>Not enrolled at any learning hub yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {enrollments.map((e) => (
                <EnrollmentRow key={e.linkId} learnerId={id} enrollment={e} isAdmin={isAdmin} onRequestUnlink={setUnlinkTarget} />
              ))}
            </div>
          )}
          {isAdmin && <EnrollLearnerControl learnerId={id} enrolledHubIds={enrollments.map((e) => e.id)} />}
        </div>

        {/* Guardian */}
        <div style={{ backgroundColor: "#ffffff", borderRadius: 16, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 600, color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Guardian</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <DetailRow label="Gender" value={learner.gender ? learner.gender.charAt(0).toUpperCase() + learner.gender.slice(1) : null} />
            <DetailRow label="Name"  value={learner.guardianName} />
            <DetailRow label="Phone" value={learner.guardianPhone} />
            <DetailRow label="Email" value={learner.guardianEmail} />
            <DetailRow label="Enrolled"     value={new Date(learner.createdAt).toLocaleDateString()} />
            <DetailRow label="Last Updated" value={new Date(learner.updatedAt).toLocaleDateString()} />
          </div>
        </div>

        <LearningJourneyCard learnerId={id} currentStageId={learner.currentStageId} curriculumId={curriculumId} />
        <JourneyPlacementCard learnerId={id} currentRungId={learner.currentRungId} curriculumId={curriculumId} />
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title={isSchool ? "Remove from Hub" : "Remove Learner"}
        message={
          isSchool
            ? `"${learner.firstName} ${learner.lastName}" will be removed from this hub. Their record and any other hub enrollments are unaffected.`
            : `"${learner.firstName} ${learner.lastName}" will be permanently removed. This cannot be undone.`
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          if (isSchool) {
            unenroll({ learnerId: id, hubId: ownSchoolId }, { onSuccess: () => navigate(learnersListPath("school", ownSchoolId)) });
          } else {
            deleteLearner(id, { onSuccess: () => navigate(learnersListPath(user?.role)) });
          }
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        isOpen={!!unlinkTarget}
        title="Unlink Learning Hub"
        message={`"${learner.firstName} ${learner.lastName}" will no longer be enrolled at "${unlinkTarget?.name}". Their record and any other hub enrollments are unaffected.`}
        confirmLabel="Unlink"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          unenroll({ learnerId: id, hubId: unlinkTarget.id });
          setUnlinkTarget(null);
        }}
        onCancel={() => setUnlinkTarget(null)}
      />
    </div>
  );
}
