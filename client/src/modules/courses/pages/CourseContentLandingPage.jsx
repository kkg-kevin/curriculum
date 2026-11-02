import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import { FiAlertTriangle, FiCheck, FiLock } from "react-icons/fi";
import { useCourseQuery, useSessions, useModules, useCoursePathways } from "../hooks/useCourse";
import { sessionLabel, buildModuleLocalSessionIndex, groupSessionsByModule } from "../sectionConfig";
import { useAuth } from "../../../context/AuthContext";
import { courseCatalogPath, sectionPath } from "../../../routes/portalPaths";
import { OnlineClassStrip } from "../../timetable/components/OnlineClass";
import { isModuleSessionsComplete, moduleLocks } from "../../learner-portal/utils/progressStorage";
import { isParentUser } from "../../parent/parentPaths";

const ACCENT = "#25476a";

function Pill({ color, bg, border, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, color, backgroundColor: bg, border: `1px solid ${border}` }}>
      {children}
    </span>
  );
}

// Read-only landing page for a single course, reached from a School's/Teacher's/Learner's
// course catalog. Deliberately not CourseViewPage (that page is a session editor with
// create/update/delete — appropriate for Admin authoring, not for browsing content) — but the
// Pathway tags CourseViewPage shows are still pulled in here read-only (no "Add some →"
// edit prompt, since this page has no admin controls), so a course tagged e.g. "Robotics" reads
// the same regardless of who's looking at it, not just to Admin.
export default function CourseContentLandingPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;
  // The educator / learner (or parent's child) portal's current hub — its online class, if it
  // teaches online, sits under the course header. Other portals render this page without one.
  const portal = useOutletContext() || {};
  const onlineWho = role === "teacher" ? "teacher" : role === "learner" ? "learner" : null;

  const { data: course, isLoading: courseLoading } = useCourseQuery(courseId);
  const { data: sessions = [], isLoading: sessionsLoading } = useSessions(courseId);
  const { data: modules = [] } = useModules(courseId);
  const { data: pathways = [] } = useCoursePathways(courseId);
  // Numbers each session relative to its own module (Module 2 restarts at "Session 1") instead
  // of counting continuously across the whole course — matches the sidebar/admin authoring view.
  const sessionPosition = buildModuleLocalSessionIndex(sessions, modules);
  // Listed module by module, like the admin authoring view — a flat list repeats "Session 1" once
  // per module, and a learner picking a later module's would land on its lock.
  const groups = groupSessionsByModule(sessions, modules);

  // The learner's own way through (not a parent watching — their browser holds no progress):
  // later modules locked until the earlier ones are done (moduleLocks, the same rule the session
  // pages enforce), finished sessions ticked, and the first open unfinished one marked.
  const showProgress = role === "learner" && !isParentUser(user);
  const progressKey = user?.email || user?.username;
  const { lockedSessionIds, lockedByModuleName } = showProgress
    ? moduleLocks(progressKey, courseId, sessions, modules)
    : { lockedSessionIds: new Set(), lockedByModuleName: new Map() };
  const isDone = (sessionId) => isModuleSessionsComplete(progressKey, courseId, [sessionId]);
  const anyDone = showProgress && sessions.some((s) => isDone(s.id));
  const nextSessionId = showProgress
    ? groups.flatMap((g) => g.sessions).find((s) => !lockedSessionIds.has(s.id) && !isDone(s.id))?.id
    : null;

  if (courseLoading || sessionsLoading) {
    return <div style={{ padding: 40, fontFamily: "Inter, sans-serif", color: "#6B7280" }}>Loading…</div>;
  }
  if (!course) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif", padding: "20px 24px", backgroundColor: "#FFF5F5", border: "1px solid #FECACA", borderRadius: "12px", color: "#EF4444", fontSize: "14px", display: "flex", alignItems: "center", gap: 8 }}>
        <FiAlertTriangle size={15} /> Course not found.
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <button
        type="button"
        onClick={() => navigate(courseCatalogPath(role))}
        style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", marginBottom: "16px", backgroundColor: "#fff", border: "1.5px solid #E5E7EB", borderRadius: "20px", color: "#374151", fontSize: "13px", fontWeight: "600", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
      >
        ← My Courses
      </button>

      <div style={{ background: "linear-gradient(135deg, #1a3550 0%, #25476a 40%, #2e7db5 75%, #38aae1 100%)", borderRadius: 20, padding: "28px 32px", marginBottom: 20, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 900, color: "#ffffff" }}>{course.name}</h1>
          <p style={{ margin: pathways.length > 0 ? "0 0 12px" : 0, fontSize: 13, color: "rgba(255,255,255,0.72)", maxWidth: 640 }}>
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </p>
          {pathways.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {pathways.map((area) => (
                <span
                  key={area.id}
                  style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11.5, fontWeight: 700,
                    backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#ffffff",
                  }}
                >
                  {area.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {onlineWho && (
        <OnlineClassStrip
          who={onlineWho} hub={portal.selectedHub} courseId={courseId}
          cls={onlineWho === "learner" ? portal.cls : undefined}
          classId={onlineWho === "learner" ? portal.cls?.id : undefined} style={{ marginBottom: 16 }}
        />
      )}

      {sessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", backgroundColor: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB" }}>
          <p style={{ margin: 0, fontSize: 14, color: "#9CA3AF" }}>No sessions have been added to this course yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {groups.map((group, groupIndex) => {
            const groupLocked = group.sessions.length > 0 && group.sessions.every((s) => lockedSessionIds.has(s.id));
            const groupDone = showProgress && group.sessions.length > 0 && group.sessions.every((s) => isDone(s.id));
            return (
              <section key={group.id || "ungrouped"}>
                {(group.name || groups.length > 1) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "0 0 10px" }}>
                    <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: groupLocked ? "#9CA3AF" : "#111827" }}>
                      {group.name ? `Module ${groupIndex + 1}: ${group.name}` : "Other sessions"}
                    </h2>
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>{group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}</span>
                    {groupDone && <Pill color="#047857" bg="#D1FAE5" border="#6EE7B7"><FiCheck size={11} /> Done</Pill>}
                    {groupLocked && (
                      <Pill color="#B45309" bg="#FFFBEB" border="#FDE68A">
                        <FiLock size={11} /> Unlocks after "{lockedByModuleName.get(group.sessions[0].id)}"
                      </Pill>
                    )}
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {group.sessions.map((session) => {
                    const locked = lockedSessionIds.has(session.id);
                    const done = showProgress && isDone(session.id);
                    const isNext = session.id === nextSessionId;
                    return (
                      <div
                        key={session.id}
                        role={locked ? undefined : "button"}
                        onClick={locked ? undefined : () => navigate(sectionPath(role, courseId, session.id, "outcomes"))}
                        title={locked ? `Finish "${lockedByModuleName.get(session.id)}" first` : undefined}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderRadius: 14, transition: "border-color 0.15s",
                          backgroundColor: locked ? "#F9FAFB" : "#fff",
                          border: `1.5px solid ${isNext ? "#38aae1" : "#E5E7EB"}`,
                          cursor: locked ? "not-allowed" : "pointer",
                        }}
                        onMouseEnter={locked || isNext ? undefined : (e) => (e.currentTarget.style.borderColor = "#a8d5ee")}
                        onMouseLeave={locked || isNext ? undefined : (e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
                      >
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: locked ? "#9CA3AF" : "#111827" }}>{sessionLabel(session, sessionPosition.get(session.id)?.index ?? 0)}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA3AF" }}>
                            {(session.outcomes?.length ?? 0)} learning outcome{(session.outcomes?.length ?? 0) !== 1 ? "s" : ""}
                          </p>
                        </div>
                        {locked ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "#9CA3AF", flexShrink: 0 }}><FiLock size={13} /> Locked</span>
                        ) : isNext ? (
                          <span style={{ padding: "6px 14px", borderRadius: 20, backgroundColor: ACCENT, color: "#fff", fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
                            {anyDone ? "Up next →" : "Start here →"}
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, color: done ? "#047857" : ACCENT, flexShrink: 0 }}>
                            {done ? <><FiCheck size={14} /> Review</> : "Open →"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
