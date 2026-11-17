// Who and what one analytics request may look at.
//
// An admin (or staff with Reports access) sees every hub of their workspace; a hub login sees only
// the hub it is acting as (req.ownSchool — its branch or, for a hub lead, the hub chosen in the
// header). The filters (hub, curriculum, class, stage, pathway, gender) only ever narrow that;
// an id outside it is refused, never trusted.

const db = require("../../config/db");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { periodFrom, inChunks } = require("./analytics.utils");

const forbidden = (message = "You can't see analytics for that") => Object.assign(new Error(message), { statusCode: 403 });

// A supervisor (17 Nov 2026, the supervisor portal's Team insights): the classes their educators
// teach (teachers.supervisorId → class_course_teacher_links), and those classes' hubs.
async function supervisorClasses(req) {
  const educatorIds = await db("teachers").where({ supervisorId: req.user.id }).whereNot({ status: "removed" }).pluck("id");
  const classIds = educatorIds.length ? await db("class_course_teacher_links").whereIn("teacherId", educatorIds).distinct("classId").pluck("classId") : [];
  // Their workspace (the inviting admin's organisation) — for workspace settings such as mentor standards.
  const admin = req.user.invitedByAdminId ? await db("users").where({ id: req.user.invitedByAdminId }).first("id", "organisationId") : null;
  return { educatorIds, classIds: new Set(classIds), ownerAdminId: admin ? admin.organisationId || admin.id : null };
}

async function workspaceHubs(req, supervised = null) {
  if (supervised) {
    const ids = classIdsList(supervised);
    const hubIds = ids.length ? await db("classes").whereIn("id", ids).distinct("schoolId").pluck("schoolId") : [];
    return hubIds.length ? (await db("learning_hubs").whereIn("id", hubIds)).filter((h) => h.status !== "removed") : [];
  }
  if (req.user.role === "school") {
    if (!req.ownSchool) throw forbidden("No learning hub is linked to this login");
    return [req.ownSchool];
  }
  if (!req.ownerAdminId) throw forbidden();
  // A removed hub (modules/removals/) has nothing left to report on — not offered.
  return (await LearningHubModel.findAll({ ownerAdminId: req.ownerAdminId, includeDrafts: true })).filter((h) => h.status !== "removed");
}

const classIdsList = (supervised) => [...supervised.classIds];

async function resolveScope(req) {
  const q = req.query || {};
  const isHubView = req.user.role === "school";
  const isSupervisorView = req.user.role === "supervisor";
  const supervised = isSupervisorView ? await supervisorClasses(req) : null;
  const allHubs = await workspaceHubs(req, supervised);
  let hubs = allHubs;
  if (q.hubId && !isHubView) {
    hubs = allHubs.filter((h) => h.id === q.hubId);
    if (!hubs.length) throw forbidden();
  }
  const hubIds = hubs.map((h) => h.id);

  let classes = hubIds.length ? await db("classes").whereIn("schoolId", hubIds) : [];
  if (supervised) classes = classes.filter((c) => supervised.classIds.has(c.id));
  if (q.curriculumId) classes = classes.filter((c) => c.curriculumId === q.curriculumId);
  if (q.classId) {
    classes = classes.filter((c) => c.id === q.classId);
    if (!classes.length) throw forbidden();
  }
  const classIds = classes.map((c) => c.id);
  const narrowedByClass = Boolean(q.curriculumId || q.classId);

  // Learners: their (active) places at these hubs — in the chosen classes when narrowed.
  let links = hubIds.length ? await db("learner_hub_links").whereIn("hubId", hubIds).where({ status: "active" }) : [];
  // A supervisor only ever sees the learners of their educators' classes, never the rest of a hub.
  if (narrowedByClass || supervised) {
    const set = new Set(classIds);
    links = links.filter((l) => set.has(l.classId));
  }
  if (q.stageId) links = links.filter((l) => l.currentStageId === q.stageId);

  let learners = await inChunks(links.map((l) => l.learnerId), (ids) => db("learners").whereIn("id", ids)
    .select("id", "firstName", "lastName", "gender", "dateOfBirth", "statedAge", "username", "guardianEmail", "guardianName", "guardianPhone", "accountStatus", "teacherId"));
  // Educators' own learner records (training of trainers) stay out unless a class is chosen —
  // the same rule as the learner lists.
  if (!q.classId) learners = learners.filter((l) => !l.teacherId);
  if (q.gender) learners = learners.filter((l) => l.gender === q.gender);
  if (q.pathway) {
    const curriculumIds = [...new Set(classes.map((c) => c.curriculumId).filter(Boolean))];
    const rows = curriculumIds.length ? await db("pathways").whereIn("curriculumId", curriculumIds).where({ name: q.pathway }).select("id") : [];
    const onPathway = new Set(await inChunks(learners.map((l) => l.id), async (ids) => (rows.length
      ? (await db("learner_pathways").whereIn("learnerId", ids).whereIn("pathwayId", rows.map((r) => r.id)).select("learnerId")).map((r) => r.learnerId)
      : [])));
    learners = learners.filter((l) => onPathway.has(l.id));
  }
  const learnerIds = new Set(learners.map((l) => l.id));
  links = links.filter((l) => learnerIds.has(l.learnerId));

  return {
    req,
    isHubView,
    isSupervisorView,
    supervisedEducatorIds: supervised ? supervised.educatorIds : null,
    ownerAdminId: supervised ? supervised.ownerAdminId : req.ownerAdminId || null,
    period: periodFrom(q),
    filters: { hubId: q.hubId || null, curriculumId: q.curriculumId || null, classId: q.classId || null, courseId: q.courseId || null, stageId: q.stageId || null, pathway: q.pathway || null, gender: q.gender || null },
    // Filters that pick learners (not hubs or classes) — educators and hub logins can't follow them.
    learnerFiltersOnly: Boolean(q.stageId || q.pathway || q.gender),
    narrowedByClass,
    hubs,
    hubIds,
    hubById: new Map(allHubs.map((h) => [h.id, h])),
    classes,
    classIds,
    classById: new Map(classes.map((c) => [c.id, c])),
    links,
    learners,
    learnerIds,
    learnerById: new Map(learners.map((l) => [l.id, l])),
  };
}

const className = (c) => (c ? [c.gradeName || c.name, c.streamName].filter(Boolean).join(" ") || "Class" : "—");

module.exports = { resolveScope, className, forbidden };
