const db = require("../../config/db");

// What a supervisor looks after (17 Nov 2026): their educators (teachers.supervisorId, set by the
// admin on the educator form), the classes those educators teach, and the hubs they work at.
// Shared by the supervisor portal's read-only views (supervisor-portal/*, hub check-ins).

async function supervisedEducatorIds(supervisorUserId) {
  return db("teachers").where({ supervisorId: supervisorUserId }).whereNot({ status: "removed" }).pluck("id");
}

// The hubs their educators work at: linked to the hub, or teaching one of its classes.
async function supervisedHubIds(supervisorUserId, educatorIds = null) {
  const ids = educatorIds || (await supervisedEducatorIds(supervisorUserId));
  if (!ids.length) return [];
  const [linked, teaching] = await Promise.all([
    db("teacher_hub_links").whereIn("teacherId", ids).distinct("hubId").pluck("hubId"),
    db("class_course_teacher_links as l").join("classes as c", "c.id", "l.classId").whereIn("l.teacherId", ids).distinct("c.schoolId").pluck("c.schoolId"),
  ]);
  return [...new Set([...linked, ...teaching].filter(Boolean))];
}

// The supervisor's workspace: the organisation of the admin who created the account.
async function supervisorWorkspace(req) {
  if (!req.user.invitedByAdminId) return null;
  const admin = await db("users").where({ id: req.user.invitedByAdminId }).first("id", "organisationId");
  return admin ? admin.organisationId || admin.id : null;
}

module.exports = { supervisedEducatorIds, supervisedHubIds, supervisorWorkspace };
