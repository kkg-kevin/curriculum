import { useState } from "react";
import { FiHome } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEnrollLearnerHub, useUpdateLearnerHubLink, useUnenrollLearnerHub, useTransferLearnerHub } from "../../hooks/useLearners";
import { useAllLearningHubsQuery } from "../../../learning-hubs/hooks/useLearningHub";
import { classApi } from "../../../classes/services/classApi";
import ConfirmDialog from "../../../curriculum/components/ConfirmDialog";
import { schoolViewPath } from "../../../../routes/portalPaths";
import { formatClassName } from "../../../classes/utils/classDisplay";

const ACCENT = "#25476a";

// The body of the Unlink / Transfer warnings: a lead line, then what will happen.
function WarningBody({ lead, points }) {
  return (
    <>
      <p style={{ margin: "0 0 10px", color: "#374151" }}>{lead}</p>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
        {points.filter(Boolean).map((point, i) => <li key={i}>{point}</li>)}
      </ul>
    </>
  );
}

const classLabel = (cls) => (cls ? `${formatClassName(cls)} — ${cls.academicYear}` : null);

const STATUS_LABELS = { active: "Active", inactive: "Inactive", transferred: "Transferred", graduated: "Graduated" };
const STATUS_STYLES = {
  active:      { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive:    { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  transferred: { bg: "#e8f5fb", color: "#38aae1", border: "#a8d5ee" },
  graduated:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
};

// One enrollment row — hub name, plus that hub's class/admission-number/status, editable
// in place (mirrors TeacherViewPage's Learning Hubs row, richer because a learner's
// placement within a hub is meaningful in a way a teacher's isn't).
function EnrollmentRow({ learnerId, learnerName, enrollment, isAdmin, onRequestUnlink }) {
  const navigate = useNavigate();
  const { mutate: updateLink } = useUpdateLearnerHubLink();
  const { mutate: transferHub, isPending: isTransferring } = useTransferLearnerHub();
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetHubId, setTargetHubId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  // The transfer waits for the warning to be confirmed.
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", enrollment.id],
    queryFn:  () => classApi.getAll({ schoolId: enrollment.id }),
    enabled:  isAdmin,
  });
  const classes = classesData?.data || [];
  const statusStyle = STATUS_STYLES[enrollment.status] || STATUS_STYLES.inactive;

  // Every other active hub — a learner can transfer to any hub, not just ones the caller
  // administers (same posture as "Add Existing Learner", which already lets a school enroll a
  // learner from any other hub into theirs without that hub's permission).
  const { data: allHubsData } = useAllLearningHubsQuery({ status: "active" });
  const targetHubOptions = (allHubsData?.data || []).filter((h) => h.id !== enrollment.id);
  const { data: targetClassesData } = useQuery({
    queryKey: ["classes", "bySchool", targetHubId],
    queryFn:  () => classApi.getAll({ schoolId: targetHubId }),
    enabled:  !!targetHubId,
  });
  const targetClasses = targetClassesData?.data || [];
  const targetHub = targetHubOptions.find((h) => h.id === targetHubId);
  const targetClass = targetClasses.find((c) => c.id === targetClassId);
  const currentClass = classLabel(enrollment.class);

  return (
    <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div onClick={() => navigate(schoolViewPath(isAdmin ? "admin" : "school", enrollment.id))} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minWidth: 0 }}>
          <span style={{ display: "flex", color: ACCENT, flexShrink: 0 }}><FiHome size={18} /></span>
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
            {classes.map((c) => <option key={c.id} value={c.id}>{formatClassName(c)} — {c.academicYear}</option>)}
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
          <button type="button" onClick={() => setTransferOpen((v) => !v)} style={{ background: "none", border: "none", color: ACCENT, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Transfer
          </button>
          <button type="button" onClick={() => onRequestUnlink(enrollment)} style={{ background: "none", border: "none", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
            Unlink
          </button>
        </div>
      )}
      {isAdmin && transferOpen && (
        <div style={{ marginTop: 4, paddingTop: 10, borderTop: "1px dashed #E5E7EB", display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 11.5, color: "#9CA3AF" }}>
            Enrolls the learner at the new hub, then removes this enrollment — their history at {enrollment.name} is kept as a transfer record.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={targetHubId}
              onChange={(e) => { setTargetHubId(e.target.value); setTargetClassId(""); }}
              style={{ flex: 1, minWidth: 140, padding: "6px 8px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, fontFamily: "Inter, sans-serif", color: "#374151" }}
            >
              <option value="">Transfer to hub…</option>
              {targetHubOptions.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              disabled={!targetHubId}
              style={{ flex: 1, minWidth: 140, padding: "6px 8px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 12, fontFamily: "Inter, sans-serif", color: "#374151", opacity: targetHubId ? 1 : 0.5 }}
            >
              <option value="">— Auto-assign class —</option>
              {targetClasses.map((c) => <option key={c.id} value={c.id}>{formatClassName(c)} — {c.academicYear}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={!targetHubId || isTransferring}
              onClick={() => setConfirmTransfer(true)}
              style={{ padding: "6px 14px", backgroundColor: !targetHubId || isTransferring ? "#b8d9ee" : ACCENT, color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: !targetHubId || isTransferring ? "not-allowed" : "pointer" }}
            >
              {isTransferring ? "Transferring…" : "Transfer…"}
            </button>
            <button type="button" onClick={() => setTransferOpen(false)} style={{ padding: "6px 14px", backgroundColor: "transparent", color: "#6B7280", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmTransfer}
        title="Transfer this learner?"
        variant="default"
        confirmLabel={`Transfer to ${targetHub?.name || "the new hub"}`}
        message={(
          <WarningBody
            lead={<>{learnerName} will move from <strong>{enrollment.name}</strong> to <strong>{targetHub?.name}</strong>.</>}
            points={[
              <>At {targetHub?.name}: {targetClass ? <>the class <strong>{classLabel(targetClass)}</strong></> : "the hub's first active class (you didn't pick one)"}, a new admission number, and a developmental stage set from their age.</>,
              <>They leave {enrollment.name}{currentClass ? <> and the class <strong>{currentClass}</strong></> : ""} — that class's courses, assessments and timetable stop showing for them, and admission number {enrollment.admissionNumber || "—"} and their stage there are removed.</>,
              "A transfer record is kept, and their marked work, reports and certificates stay on their record.",
            ]}
          />
        )}
        onConfirm={() => {
          setConfirmTransfer(false);
          transferHub(
            { learnerId, hubId: enrollment.id, data: { toHubId: targetHubId, toClassId: targetClassId } },
            { onSuccess: () => { setTransferOpen(false); setTargetHubId(""); setTargetClassId(""); } }
          );
        }}
        onCancel={() => setConfirmTransfer(false)}
      />

      {!isAdmin && (
        <p style={{ margin: 0, fontSize: 12, color: "#6B7280" }}>
          {enrollment.class ? `${formatClassName(enrollment.class)} — ${enrollment.class.academicYear}` : "No class assigned yet"}
        </p>
      )}
    </div>
  );
}

function EnrollLearnerControl({ learnerId, enrolledHubIds }) {
  const { data: allHubsData } = useAllLearningHubsQuery({ status: "active" });
  const availableHubs = (allHubsData?.data || []).filter((h) => !enrolledHubIds.includes(h.id));
  const [selectedHubId, setSelectedHubId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const { mutate: enroll, isPending } = useEnrollLearnerHub();

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", selectedHubId],
    queryFn:  () => classApi.getAll({ schoolId: selectedHubId }),
    enabled:  !!selectedHubId,
  });
  const classes = classesData?.data || [];

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
        {classes.map((c) => <option key={c.id} value={c.id}>{formatClassName(c)} — {c.academicYear}</option>)}
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

// The learner page's Learning Hubs panel for staff — each enrollment with its class, status,
// transfer and unlink, plus "Enroll at hub" (an admin's only; a hub sees its own row read-only).
export default function LearnerHubsManager({ learnerId, learnerName, enrollments, isAdmin }) {
  const { mutate: unenroll } = useUnenrollLearnerHub();
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  return (
    <>
      {enrollments.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "#9CA3AF", textAlign: "center", padding: "6px 0" }}>Not enrolled at any learning hub yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {enrollments.map((e) => (
            <EnrollmentRow key={e.linkId} learnerId={learnerId} learnerName={learnerName} enrollment={e} isAdmin={isAdmin} onRequestUnlink={setUnlinkTarget} />
          ))}
        </div>
      )}
      {isAdmin && <EnrollLearnerControl learnerId={learnerId} enrolledHubIds={enrollments.map((e) => e.id)} />}

      <ConfirmDialog
        isOpen={!!unlinkTarget}
        title="Unlink from this hub?"
        message={unlinkTarget && (
          <WarningBody
            lead={<>{learnerName} will no longer be enrolled at <strong>{unlinkTarget.name}</strong>.</>}
            points={[
              <>They leave {classLabel(unlinkTarget.class) ? <>the class <strong>{classLabel(unlinkTarget.class)}</strong></> : "the hub"} — its courses, assessments and timetable stop showing for them.</>,
              <>Admission number {unlinkTarget.admissionNumber || "—"} and their developmental stage at this hub are removed; enrolling them again gives a new admission number.</>,
              enrollments.length === 1
                ? <strong style={{ color: "#B91C1C" }}>This is their only hub — they'll be in no class at all until you enrol them again.</strong>
                : "Their other hub enrolments aren't affected.",
              "Their marked work, reports and certificates stay on their record. To move them to another hub instead, use Transfer.",
            ]}
          />
        )}
        confirmLabel="Unlink"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          unenroll({ learnerId, hubId: unlinkTarget.id });
          setUnlinkTarget(null);
        }}
        onCancel={() => setUnlinkTarget(null)}
      />
    </>
  );
}
