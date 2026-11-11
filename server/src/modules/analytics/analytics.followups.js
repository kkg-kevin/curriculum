// What staff did about a learner at risk (10 Nov 2026) — learner_followups. From the at-risk list:
//   parent_message   a message to the parent's login (bell + email: learner_followup)
//   educator_told    the class's educators are told, with the reasons (bell + email: learner_flagged)
//   checkin          a parent–mentor check-in was booked for them (admins; the page itself books it)
//   followed_up      marked as followed up, with a note (a call, a meeting…)
// The at-risk list shows each learner's latest one from the last FOLLOWED_UP_DAYS days, and can hide
// the learners already followed up. Only learners in the caller's scope (analytics.scope.js).

const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");
const NotificationService = require("../notifications/notification.service");
const { inChunks, fullName } = require("./analytics.utils");

const FOLLOWED_UP_DAYS = 30;
const ACTIONS = ["parent_message", "educator_told", "checkin", "followed_up"];
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409 });

// Each learner's latest follow-up within the last FOLLOWED_UP_DAYS days.
async function latestFor(learnerIds, { days = FOLLOWED_UP_DAYS } = {}) {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await inChunks(learnerIds, (ids) => db("learner_followups").whereIn("learnerId", ids).where("createdAt", ">=", since)
    .orderBy("createdAt", "desc").select("learnerId", "action", "note", "createdAt", "createdByName"));
  const latest = new Map();
  const count = new Map();
  for (const r of rows) {
    if (!latest.has(r.learnerId)) latest.set(r.learnerId, { action: r.action, note: r.note, at: r.createdAt, by: r.createdByName });
    count.set(r.learnerId, (count.get(r.learnerId) || 0) + 1);
  }
  for (const [id, x] of latest) x.count = count.get(id);
  return latest;
}

async function history(learnerId) {
  return db("learner_followups").where({ learnerId }).orderBy("createdAt", "desc").limit(20)
    .select("id", "action", "note", "reasons", "createdAt", "createdByName");
}

async function parentLoginOf(learner) {
  if (!learner?.guardianEmail) return null;
  return db("users").whereRaw("LOWER(email) = ?", [String(learner.guardianEmail).toLowerCase()]).whereNull("deactivatedAt").first("id", "name");
}

async function educatorLoginsOf(scope, learnerId) {
  const classIds = [...new Set(scope.links.filter((l) => l.learnerId === learnerId && l.classId).map((l) => l.classId))];
  if (!classIds.length) return { classId: null, users: [] };
  const teacherIds = [...new Set((await db("class_course_teacher_links").whereIn("classId", classIds).select("teacherId")).map((r) => r.teacherId))];
  const teachers = teacherIds.length ? await db("teachers").whereIn("id", teacherIds).whereNotNull("email").select("email") : [];
  const emails = [...new Set(teachers.map((t) => String(t.email).toLowerCase()))];
  const users = emails.length ? await db("users").whereIn(db.raw("LOWER(email)"), emails).whereNull("deactivatedAt").select("id") : [];
  return { classId: classIds[0], users };
}

// One follow-up. `scope` is the caller's (resolveScope) — the learner must be in it.
async function record(scope, user, { learnerId, action, note = "", message = "", reasons = [] }) {
  if (!ACTIONS.includes(action)) throw Object.assign(new Error("Unknown follow-up"), { statusCode: 400 });
  if (!scope.learnerIds.has(learnerId)) throw Object.assign(new Error("That learner isn't in your hubs"), { statusCode: 403 });
  if (action === "checkin" && scope.isHubView) throw Object.assign(new Error("Check-ins are booked by the admins"), { statusCode: 403 });
  const learner = scope.learnerById.get(learnerId);
  const first = learner?.firstName || "your child";
  const link = scope.links.find((l) => l.learnerId === learnerId);
  const ownerAdminId = scope.ownerAdminId || scope.hubById.get(link?.hubId)?.ownerAdminId || null;
  const reasonText = (reasons || []).filter(Boolean).slice(0, 6).join(", ");
  let sentTo = 0;

  if (action === "parent_message") {
    const text = String(message || "").trim();
    if (!text) throw Object.assign(new Error("Write the message to the parent"), { statusCode: 400 });
    const parent = await parentLoginOf(learner);
    if (!parent) throw conflict(`${first}'s parent has no login yet, so a message can't reach them here. Call them on ${learner?.guardianPhone || "their phone"} instead.`);
    await NotificationService.notifyPerson(parent.id, {
      type: "learner_followup",
      title: `A message about ${first}`,
      message: text,
      payload: { learnerId, route: `/parent/children/${learnerId}` },
      ownerAdminId,
    });
    sentTo = 1;
  }

  if (action === "educator_told") {
    const { classId, users } = await educatorLoginsOf(scope, learnerId);
    if (!users.length) throw conflict(`No educator with a login teaches ${first}'s class yet.`);
    const body = [`${fullName(learner)} needs support${reasonText ? `: ${reasonText.toLowerCase()}` : ""}.`, String(note || "").trim()].filter(Boolean).join(" ");
    await Promise.all(users.map((u) => NotificationService.notifyPerson(u.id, {
      type: "learner_flagged",
      title: `${fullName(learner)} needs support`,
      message: body,
      payload: { learnerId, classId, route: classId ? `/teacher-portal/classes/${classId}` : "/teacher-portal" },
      ownerAdminId,
    })));
    sentTo = users.length;
  }

  const row = {
    id: generateId(),
    ownerAdminId,
    hubId: link?.hubId || null,
    learnerId,
    action,
    note: String(action === "parent_message" ? message : note || "").trim().slice(0, 2000) || null,
    reasons: JSON.stringify((reasons || []).slice(0, 6)),
    createdBy: user?.id || null,
    createdByName: user?.name || user?.email || null,
    createdAt: new Date(),
  };
  await db("learner_followups").insert(row);
  return { ...row, reasons: reasons || [], sentTo };
}

module.exports = { latestFor, history, record, ACTIONS, FOLLOWED_UP_DAYS };
