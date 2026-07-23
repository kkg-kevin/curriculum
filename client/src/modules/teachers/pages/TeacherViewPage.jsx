import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTeacherQuery, useDeleteTeacher, useTeacherHubsQuery, useLinkTeacherHub, useUnlinkTeacherHub } from "../hooks/useTeacher";
import { useAllLearningHubsQuery } from "../../learning-hubs/hooks/useLearningHub";
import { learningHubApi } from "../../learning-hubs/services/learningHubApi";
import { LEARNING_HUB_TYPES } from "../../learning-hubs/schemas/learningHub.schema";
import { classApi } from "../../classes/services/classApi";
import { useUpdateClass } from "../../classes/hooks/useClasses";
import { useAuth } from "../../../context/AuthContext";
import { teachersListPath, teacherPath, classPath, classCreatePath, schoolViewPath } from "../../../routes/portalPaths";
import ConfirmDialog from "../../curriculum/components/ConfirmDialog";

const ACCENT = "#25476a";

// Assigns/unassigns this teacher as a class's class teacher — scoped to hubs this teacher is
// already linked to (you can't be a class's teacher at a hub you're not even part of). A class
// only ever has one class teacher (Class.classTeacherId), so "linking" here means picking a
// hub, then a class within it, same two-step shape as EnrollLearnerControl on LearnerViewPage.
function AssignClassControl({ teacherId, hubs }) {
  const [selectedHubId, setSelectedHubId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const { mutate: updateClass, isPending } = useUpdateClass();

  const { data: classesData } = useQuery({
    queryKey: ["classes", "bySchool", selectedHubId],
    queryFn:  () => classApi.getAll({ schoolId: selectedHubId, status: "active" }),
    enabled:  !!selectedHubId,
  });
  const classes = (classesData?.data || []).filter((c) => c.classTeacherId !== teacherId);

  const { data: hubTeachers } = useQuery({
    queryKey: ["learningHubs", "detail", selectedHubId, "teachers"],
    queryFn:  () => learningHubApi.getTeachers(selectedHubId),
    enabled:  !!selectedHubId,
  });
  const teacherNameById = Object.fromEntries((hubTeachers || []).map((t) => [t.id, `${t.firstName} ${t.lastName}`]));

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #F3F4F6", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={selectedHubId}
          onChange={(e) => { setSelectedHubId(e.target.value); setSelectedClassId(""); }}
          style={{ flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151" }}
        >
          <option value="">Pick a hub…</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          disabled={!selectedHubId}
          style={{ flex: 1, minWidth: 140, padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E5E7EB", fontSize: 13, fontFamily: "Inter, sans-serif", color: "#374151", opacity: selectedHubId ? 1 : 0.5 }}
        >
          <option value="">Pick a class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.gradeName} — {c.academicYear}{c.classTeacherId ? ` (replaces ${teacherNameById[c.classTeacherId] || "current tech educator"})` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedClassId || isPending}
          onClick={() => {
            updateClass({ id: selectedClassId, data: { classTeacherId: teacherId } });
            setSelectedClassId("");
          }}
          style={{ padding: "8px 16px", backgroundColor: !selectedClassId || isPending ? "#b8d9ee" : ACCENT, color: "#ffffff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: "Inter, sans-serif", cursor: !selectedClassId || isPending ? "not-allowed" : "pointer", flexShrink: 0 }}
        >
          Assign
        </button>
      </div>
      {selectedHubId && classes.length === 0 && (
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>No other active classes at this hub.</span>
      )}
    </div>
  );
}

const HUB_TYPE_LABELS = Object.fromEntries(LEARNING_HUB_TYPES.map((t) => [t.value, t.label]));

const STATUS_STYLES = {
  active:   { bg: "#e8f5fb", color: "#25476a", border: "#a8d5ee" },
  inactive: { bg: "#F9FAFB", color: "#6B7280", border: "#E5E7EB" },
  on_leave: { bg: "#FFFBEB", color: "#92400E", border: "#FDE68A" },
};
const STATUS_LABELS = { active: "Active", inactive: "Inactive", on_leave: "On Leave" };

function Avatar({ firstName, lastName, size = 64 }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: "linear-gradient(135deg, #25476a, #2e7db5)",
        border: "3px solid rgba(255,255,255,0.3)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.34, fontWeight: "700", color: "#ffffff",
        flexShrink: 0, letterSpacing: "0.02em",
      }}
    >
      {initials || "?"}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", border: "1.5px solid #E5E7EB", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6" }}>
        <h2 style={{ margin: 0, fontSize: "11px", fontWeight: "700", color: "#38aae1", textTransform: "uppercase", letterSpacing: "0.07em" }}>{title}</h2>
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  );
}

function DetailRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ color: "#9CA3AF", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
      <div>
        <p style={{ margin: "0 0 1px", fontSize: "11px", fontWeight: "600", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
        <p style={{ margin: 0, fontSize: "14px", color: "#111827" }}>{value}</p>
      </div>
    </div>
  );
}

export default function TeacherViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isSchool = user?.role === "school";

  const { data: teacher, isLoading, isError } = useTeacherQuery(id);
  const { data: hubs = [] } = useTeacherHubsQuery(id);
  const { mutate: deleteTeacher } = useDeleteTeacher();
  const { mutate: linkHub, isPending: isLinking } = useLinkTeacherHub();
  const { mutate: unlinkHub } = useUnlinkTeacherHub();

  const { data: ownSchoolData } = useQuery({
    queryKey: ["learningHubs", "byEmail", user?.email],
    queryFn:  () => learningHubApi.getAll({ email: user.email }),
    enabled:  isSchool && !!user?.email,
  });
  const ownSchoolId = ownSchoolData?.data?.[0]?.id;

  const { data: allHubsData } = useAllLearningHubsQuery({ status: "active" });
  const availableHubs = (allHubsData?.data || []).filter((h) => !hubs.some((linked) => linked.id === h.id));
  const [selectedHubToAdd, setSelectedHubToAdd] = useState("");

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  const { data: classesData } = useQuery({
    queryKey: ["classes", "byClassTeacher", id],
    queryFn:  () => classApi.getAll({ classTeacherId: id }),
    enabled:  !!id,
  });
  const myClasses = classesData?.data || [];
  const { mutate: updateClass } = useUpdateClass();

  if (isLoading) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px", color: "#9CA3AF", fontSize: "14px" }}>
        Loading teacher…
      </div>
    );
  }

  if (isError || !teacher) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px" }}>
        ⚠ Teacher not found.
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[teacher.status] || STATUS_STYLES.inactive;

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>

      {/* Hero header */}
      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: "20px", padding: "28px 32px", marginBottom: "20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "-40px", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
            <button type="button" onClick={() => navigate(teachersListPath(isSchool ? "school" : "admin", ownSchoolId))} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.65)", fontSize: "13px", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: 0 }}>
              Tech Educators
            </button>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px" }}>/</span>
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: "500" }}>
              {teacher.firstName} {teacher.lastName}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Avatar firstName={teacher.firstName} lastName={teacher.lastName} size={64} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.3px" }}>
                    {teacher.firstName} {teacher.lastName}
                  </h1>
                  <span style={{ padding: "2px 9px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }}>
                    {STATUS_LABELS[teacher.status] ?? teacher.status}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => navigate(teacherPath(user?.role, id, "edit"))}
                style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", backgroundColor: "#feb139", color: "#25476a", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer", boxShadow: "0 2px 8px rgba(254,177,57,0.35)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Edit Tech Educator
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                style={{ padding: "10px 20px", backgroundColor: "rgba(239,68,68,0.2)", color: "#FCA5A5", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: "10px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
              >
                {isSchool ? "Remove from Hub" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "start" }}>

        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Section title="Classes">
            {myClasses.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#9CA3AF" }}>Not assigned as class tech educator to any class yet.</p>
                {hubs.length === 1 && (
                  <button type="button" onClick={() => navigate(classCreatePath(user?.role, hubs[0].id))} style={{ background: "none", border: "none", color: "#25476a", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "13px", padding: 0 }}>Create a class →</button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myClasses.map((c) => (
                  <div key={c.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", borderRadius: "10px", border: "1px solid #E5E7EB" }}
                  >
                    <div onClick={() => navigate(classPath(user?.role, c.id, "view"))} style={{ cursor: "pointer", minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>{c.gradeName}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#9CA3AF" }}>Academic Year {c.academicYear}</p>
                    </div>
                    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", backgroundColor: c.status === "active" ? "#e8f5fb" : "#F9FAFB", color: c.status === "active" ? "#25476a" : "#6B7280", border: `1px solid ${c.status === "active" ? "#a8d5ee" : "#E5E7EB"}`, flexShrink: 0 }}>
                      {c.status === "active" ? "Active" : "Inactive"}
                    </span>
                    {(isAdmin || isSchool) && (
                      <button
                        type="button"
                        onClick={() => updateClass({ id: c.id, data: { classTeacherId: null } })}
                        style={{ background: "none", border: "none", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {(isAdmin || isSchool) && hubs.length > 0 && <AssignClassControl teacherId={id} hubs={hubs} />}
          </Section>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Learning Hubs */}
          <Section title="Learning Hubs">
            {hubs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF" }}>Not assigned to any learning hub yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {hubs.map((hub) => (
                  <div key={hub.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", borderRadius: "10px", backgroundColor: "#e8f5fb", border: "1px solid #a8d5ee" }}>
                    <span onClick={() => navigate(schoolViewPath(user?.role, hub.id))} style={{ fontSize: "24px", flexShrink: 0, cursor: "pointer" }}>🏫</span>
                    <div onClick={() => navigate(schoolViewPath(user?.role, hub.id))} style={{ minWidth: 0, flex: 1, cursor: "pointer" }}>
                      <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "#25476a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hub.name}</p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6B7280" }}>{HUB_TYPE_LABELS[hub.hubType] || hub.hubType}{hub.address?.county ? ` · ${hub.address.county}` : ""}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUnlinkTarget(hub)}
                      style={{ background: "none", border: "none", color: "#EF4444", fontSize: "12px", fontWeight: "700", cursor: "pointer", fontFamily: "Inter, sans-serif", flexShrink: 0 }}
                    >
                      Unlink
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isAdmin && (
              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #F3F4F6", display: "flex", gap: "8px" }}>
                <select
                  value={selectedHubToAdd}
                  onChange={(e) => setSelectedHubToAdd(e.target.value)}
                  style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #E5E7EB", fontSize: "13px", fontFamily: "Inter, sans-serif", color: "#374151" }}
                >
                  <option value="">Assign to hub…</option>
                  {availableHubs.map((h) => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedHubToAdd || isLinking}
                  onClick={() => { linkHub({ teacherId: id, hubId: selectedHubToAdd }); setSelectedHubToAdd(""); }}
                  style={{ padding: "8px 16px", backgroundColor: !selectedHubToAdd || isLinking ? "#b8d9ee" : "#25476a", color: "#ffffff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: "700", fontFamily: "Inter, sans-serif", cursor: !selectedHubToAdd || isLinking ? "not-allowed" : "pointer", flexShrink: 0 }}
                >
                  Assign
                </button>
              </div>
            )}
          </Section>

          {/* Contact */}
          <Section title="Contact Details">
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2"/><polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2"/></svg>}
                label="Email" value={teacher.email}
              />
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6 6l.86-.86a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.03z" stroke="currentColor" strokeWidth="2"/></svg>}
                label="Phone" value={teacher.phone}
              />
              {!teacher.email && !teacher.phone && (
                <p style={{ margin: 0, fontSize: "13px", color: "#9CA3AF", textAlign: "center" }}>
                  No contact details.{" "}
                  <button type="button" onClick={() => navigate(teacherPath(user?.role, id, "edit"))} style={{ background: "none", border: "none", color: "#25476a", fontWeight: "600", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: "13px", padding: 0 }}>
                    Add →
                  </button>
                </p>
              )}
            </div>
          </Section>

          {/* Record info */}
          <Section title="Record Info">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/></svg>}
                label="Added"
                value={new Date(teacher.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
              />
              <DetailRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>}
                label="Last Updated"
                value={new Date(teacher.updatedAt).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}
              />
            </div>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title={isSchool ? "Remove from Hub" : "Remove Tech Educator"}
        message={
          isSchool
            ? `"${teacher.firstName} ${teacher.lastName}" will be removed from this hub. Their account and any other hub assignments are unaffected.`
            : `"${teacher.firstName} ${teacher.lastName}" will be permanently removed. This cannot be undone.`
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          setConfirmDelete(false);
          if (isSchool) {
            unlinkHub({ teacherId: id, hubId: ownSchoolId }, { onSuccess: () => navigate(teachersListPath("school", ownSchoolId)) });
          } else {
            deleteTeacher(id, { onSuccess: () => navigate(teachersListPath("admin")) });
          }
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        isOpen={!!unlinkTarget}
        title="Unlink Learning Hub"
        message={`"${teacher.firstName} ${teacher.lastName}" will no longer be assigned to "${unlinkTarget?.name}". Their account and any other hub assignments are unaffected.`}
        confirmLabel="Unlink"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => {
          unlinkHub({ teacherId: id, hubId: unlinkTarget.id });
          setUnlinkTarget(null);
        }}
        onCancel={() => setUnlinkTarget(null)}
      />
    </div>
  );
}
