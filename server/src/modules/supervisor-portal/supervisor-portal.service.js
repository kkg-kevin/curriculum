const db = require("../../config/db");
const AuditService = require("../audit/audit.service");
const NotificationService = require("../notifications/notification.service");
const { supervisedEducatorIds, supervisedHubIds, supervisorWorkspace } = require("./supervisor.scope");
const { rolesOf } = require("../auth/account-roles");

// The supervisor portal's own reads and one action (17 Nov 2026), always limited to the
// supervisor's educators (teachers.supervisorId):
//   educator(id)   who the educator is — contact, schools, availability, qualifications and the
//                  classes they teach. Read only; never pay or rates (that's the admin's).
//   activity()     what their educators did in the system (the activity log), newest first.
//   message()      a note to some or all of their educators: a notification and an email
//                  (supervisor_message), to each educator's own login.
//   me()           their own account for My Profile: details, who manages them, and their work in
//                  figures (educators, schools, claims, QA reports).

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const lower = (s) => String(s || "").trim().toLowerCase();
const json = (v) => {
  if (v == null || typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
};
const classLabel = (c) => [c?.gradeName, c?.streamName].filter(Boolean).join(" · ") || "Class";
const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

async function assertMine(req, teacherId) {
  const t = await db("teachers").where({ id: teacherId, supervisorId: req.user.id }).whereNot({ status: "removed" }).first();
  if (!t) fail("This educator isn't assigned to you", 404);
  return t;
}

// Each educator's own login (an educator signs in with their email).
async function loginsOf(teachers) {
  const emails = [...new Set(teachers.map((t) => lower(t.email)).filter(Boolean))];
  if (!emails.length) return new Map();
  const users = await db("users").whereRaw(`LOWER(email) IN (${emails.map(() => "?").join(",")})`, emails)
    .whereNull("deactivatedAt").select("id", "email", "role", "extraRoles");
  const isEducator = (u) => u.role === "teacher" || (json(u.extraRoles) || []).includes("teacher");
  const byEmail = new Map();
  for (const u of users) if (isEducator(u) && !byEmail.has(lower(u.email))) byEmail.set(lower(u.email), u.id);
  return new Map(teachers.map((t) => [t.id, byEmail.get(lower(t.email)) || null]));
}

const SupervisorPortalService = {
  async educator(req, teacherId) {
    const t = await assertMine(req, teacherId);
    const [hubLinks, availability, courseLinks, logins] = await Promise.all([
      db("teacher_hub_links as l").join("learning_hubs as h", "h.id", "l.hubId").where("l.teacherId", t.id).whereNot("h.status", "removed").select("h.id", "h.name"),
      db("teacher_availability_slots").where({ teacherId: t.id }).select("dayOfWeek", "startTime", "endTime"),
      db("class_course_teacher_links").where({ teacherId: t.id }).select("classId", "courseId", "isPrimary"),
      loginsOf([t]),
    ]);
    const classIds = [...new Set(courseLinks.map((l) => l.classId))];
    const qualified = json(t.qualifiedCourseIds) || [];
    const courseIds = [...new Set([...courseLinks.map((l) => l.courseId), ...qualified])];
    const [classes, courses, learnerCounts] = await Promise.all([
      classIds.length ? db("classes").whereIn("id", classIds).select("id", "gradeName", "streamName", "schoolId", "status") : [],
      courseIds.length ? db("courses").whereIn("id", courseIds).select("id", "name") : [],
      classIds.length ? db("learner_hub_links").whereIn("classId", classIds).where({ status: "active" }).groupBy("classId").select("classId").count({ n: "*" }) : [],
    ]);
    const hubIds = [...new Set(classes.map((c) => c.schoolId))];
    const hubs = hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).select("id", "name") : [];
    const hubName = new Map(hubs.map((h) => [h.id, h.name]));
    const courseName = new Map(courses.map((c) => [c.id, c.name]));
    const learners = new Map(learnerCounts.map((r) => [r.classId, Number(r.n) || 0]));
    const allHubs = new Map([...hubLinks.map((h) => [h.id, h.name]), ...hubs.map((h) => [h.id, h.name])]);
    return {
      id: t.id, name: fullName(t), email: t.email || null, phone: t.phone || null, photo: t.photo || null,
      status: t.status || "active", employmentType: t.employmentType || null, teacherLevel: t.teacherLevel ?? null,
      joinedAt: t.createdAt, hasLogin: Boolean(logins.get(t.id)),
      hubs: [...allHubs.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      availability: availability.sort((a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek) || String(a.startTime).localeCompare(String(b.startTime))),
      qualifiedCourses: qualified.map((id) => ({ id, name: courseName.get(id) || "A course" })),
      classes: classes.map((c) => ({
        id: c.id, label: classLabel(c), hubName: hubName.get(c.schoolId) || "", status: c.status, learners: learners.get(c.id) || 0,
        courses: courseLinks.filter((l) => l.classId === c.id).map((l) => ({ name: courseName.get(l.courseId) || "Course", primary: !!l.isPrimary })),
      })).sort((a, b) => a.label.localeCompare(b.label)),
    };
  },

  // The activity log, narrowed to what their educators did (one educator when `teacherId`).
  async activity(req, { teacherId, view, from, to, page }) {
    const ownerAdminId = await supervisorWorkspace(req);
    const ids = await supervisedEducatorIds(req.user.id);
    const chosen = teacherId ? ids.filter((id) => id === teacherId) : ids;
    if (teacherId && !chosen.length) fail("This educator isn't assigned to you", 404);
    const teachers = chosen.length ? await db("teachers").whereIn("id", chosen).select("id", "email") : [];
    const userIds = [...new Set([...(await loginsOf(teachers)).values()].filter(Boolean))];
    if (!ownerAdminId || !userIds.length) return { items: [], hasMore: false, page: 1 };
    return AuditService.list(ownerAdminId, { actorUserIds: userIds, view, from, to }, { page, pageSize: 40 });
  },

  // A note to some or all of their educators.
  async message(req, { teacherIds, title, message }) {
    const ids = await supervisedEducatorIds(req.user.id);
    const chosen = (teacherIds && teacherIds.length ? teacherIds : ids).filter((id) => ids.includes(id));
    if (!chosen.length) fail("Choose at least one of your educators");
    const teachers = await db("teachers").whereIn("id", chosen).select("id", "firstName", "lastName", "email");
    const logins = await loginsOf(teachers);
    const ownerAdminId = await supervisorWorkspace(req);
    const me = await db("users").where({ id: req.user.id }).first("name");
    const from = me?.name || "Your supervisor";
    const sent = [];
    const notReached = [];
    for (const t of teachers) {
      const userId = logins.get(t.id);
      if (!userId) { notReached.push(fullName(t)); continue; }
      await NotificationService.notifyPerson(userId, {
        type: "supervisor_message",
        title: title ? `${from}: ${title}` : `A message from ${from}`,
        message,
        payload: { route: "/teacher-portal", fromSupervisorId: req.user.id },
        ownerAdminId,
      });
      sent.push(fullName(t));
    }
    return { sent, notReached };
  },

  // My Profile: the supervisor's own account, who manages it, and their work in figures.
  async me(req) {
    const id = req.user.id;
    const user = await db("users").where({ id }).first("id", "name", "email", "phone", "jobTitle", "photo", "role", "extraRoles", "createdAt", "invitedByAdminId");
    if (!user) fail("Account not found", 404);
    const educatorIds = await supervisedEducatorIds(id);
    const [admin, hubIds, claims, qa, signIns] = await Promise.all([
      user.invitedByAdminId ? db("users").where({ id: user.invitedByAdminId }).first("name", "email") : null,
      supervisedHubIds(id, educatorIds),
      db("teacher_claims").where({ supervisorId: id }).groupBy("status").select("status").count({ n: "*" }),
      db("qa_visits").where({ reviewerId: id }).whereIn("status", ["open", "submitted"]).groupBy("status").select("status").count({ n: "*" }),
      db("audit_log").where({ actorUserId: id, action: "login" }).orderBy("createdAt", "desc").limit(2).pluck("createdAt"),
    ]);
    const count = (rows, test) => rows.filter((r) => test(r.status)).reduce((n, r) => n + Number(r.n || 0), 0);
    return {
      id: user.id, name: user.name, email: user.email, phone: user.phone || null, jobTitle: user.jobTitle || null, photo: user.photo || null,
      createdAt: user.createdAt,
      otherRoles: rolesOf(user).filter((r) => r !== "supervisor"),
      managedBy: admin ? { name: admin.name, email: admin.email } : null,
      // The sign-in before this one (the latest is usually the session they're in now).
      previousSignInAt: signIns[1] || null,
      figures: {
        educators: educatorIds.length,
        schools: hubIds.length,
        claimsWaiting: count(claims, (s) => s === "pending_supervisor"),
        claimsDecided: count(claims, (s) => s !== "pending_supervisor"),
        qaReports: count(qa, (s) => s === "submitted"),
        qaPlanned: count(qa, (s) => s === "open"),
      },
    };
  },

  // The hubs their educators work at (for the hub check-ins view and filters).
  hubIds: (req) => supervisedHubIds(req.user.id),
};

module.exports = SupervisorPortalService;
