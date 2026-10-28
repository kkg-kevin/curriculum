const db = require("../../config/db");
const { assertOwn, isOwnedByAdmin } = require("../../shared/middleware/scope.middleware");

// "Is this still in use?" — asked before anything that other records depend on is deleted. There
// are no database foreign keys (see CLAUDE.md), so without this a delete leaves classes pointing at
// a curriculum that's gone, learners at a hub that's gone, and so on. A delete of something in use
// is refused (409, code IN_USE) with what uses it; nothing is unlinked behind anyone's back. Where
// the record can be switched off instead, `alternative` says how (the client offers it).
//
// Every delete route that needs this calls guardDelete() after its own permission and ownership
// checks. `?check=1` on that same DELETE only answers the question (the delete dialog asks first,
// so the warning shows before anyone confirms) — it deletes nothing and isn't written to the
// activity log.
//
// What counts as "in use" is what would be left broken or meaningless: live links, history people
// rely on (invoices, reports, submissions, certificates). Links a delete already cleans up as part
// of itself (an educator's hub links, a course's own sessions) don't count.

const EXAMPLES = 5;
const NAME = {
  classes: "CONCAT_WS(' ', gradeName, NULLIF(streamName, ''), CONCAT('(', academicYear, ')'))",
  learners: "CONCAT_WS(' ', firstName, lastName)",
  teachers: "CONCAT_WS(' ', firstName, lastName)",
};
const nameOf = (table) => db.raw(`${NAME[table] || "name"} as label`);
const jsonHas = (column, id) => [`CAST(?? AS CHAR) LIKE ?`, [column, `%${id}%`]];

// One kind of thing that uses the record: how many, and up to EXAMPLES of their names. `query` is a
// knex builder on `table` (already filtered); `distinctOn` counts distinct values of a column (e.g.
// learners across several hub links).
async function usage(key, [one, many], query, { table, labelFrom = table, distinctOn = null, idColumn = "id" } = {}) {
  const countRow = distinctOn
    ? await query.clone().countDistinct({ n: distinctOn }).first()
    : await query.clone().count({ n: "*" }).first();
  const count = Number(countRow?.n || 0);
  if (!count) return null;
  let examples = [];
  if (labelFrom) {
    const ids = distinctOn
      ? (await query.clone().distinct(distinctOn).limit(EXAMPLES)).map((r) => r[distinctOn.split(".").pop()])
      : (await query.clone().select(`${table}.${idColumn} as id`).limit(EXAMPLES)).map((r) => r.id);
    if (ids.length) examples = [...new Set((await db(labelFrom).whereIn("id", ids).select(nameOf(labelFrom))).map((r) => String(r.label || "").trim()).filter(Boolean))];
  }
  return { key, count, label: `${count} ${count === 1 ? one : many}`, examples };
}

// A listed id inside a JSON column (a version's courses, a pathway's courses, a bootcamp's games…).
const whereJsonHas = (q, column, id) => q.whereRaw(...jsonHas(column, id));

const CHECKS = {
  curriculum: {
    name: "curricula",
    alternative: null,
    uses: (id) => [
      usage("hubs", ["learning hub", "learning hubs"], db("learning_hubs").where({ curriculumId: id }), { table: "learning_hubs" }),
      usage("hubCurricula", ["learning hub (second curriculum)", "learning hubs (second curriculum)"], db("learning_hub_curricula").where({ curriculumId: id }).whereNot({ slot: "core" }).whereNot({ status: "ended" }), { table: "learning_hub_curricula", labelFrom: "learning_hubs", distinctOn: "hubId" }),
      usage("classes", ["class", "classes"], db("classes").where({ curriculumId: id }), { table: "classes" }),
      usage("homeLearning", ["Home Learning child", "Home Learning children"], db("home_learning_enrollments").where({ curriculumId: id }).whereIn("status", ["active", "paused"]), { table: "home_learning_enrollments", labelFrom: "learners", distinctOn: "learnerId" }),
      usage("bootcamps", ["bootcamp", "bootcamps"], db("bootcamps").where({ curriculumId: id }), { table: "bootcamps" }),
      usage("competitions", ["competition", "competitions"], db("competitions").where({ curriculumId: id }), { table: "competitions" }),
    ],
  },

  learningHub: {
    name: "learning_hubs",
    alternative: { action: "deactivate", label: "Deactivate the hub instead" },
    uses: (id) => [
      usage("classes", ["class", "classes"], db("classes").where({ schoolId: id }), { table: "classes" }),
      usage("learners", ["learner enrolled", "learners enrolled"], db("learner_hub_links").where({ hubId: id }), { table: "learner_hub_links", labelFrom: "learners", distinctOn: "learnerId" }),
      usage("educators", ["educator", "educators"], db("teacher_hub_links").where({ hubId: id }), { table: "teacher_hub_links", labelFrom: "teachers", distinctOn: "teacherId" }),
      usage("branches", ["branch hub", "branch hubs"], db("learning_hubs").where({ parentHubId: id }), { table: "learning_hubs" }),
      usage("invoices", ["invoice", "invoices"], db("billing_invoices").where((w) => w.where({ hubId: id }).orWhere({ issuerHubId: id }).orWhere({ payerHubId: id })), { table: "billing_invoices", labelFrom: null }),
      usage("checkins", ["active check-in schedule", "active check-in schedules"], db("checkin_schedules").where({ hubId: id, status: "active" }), { table: "checkin_schedules", labelFrom: null }),
      usage("bootcamps", ["bootcamp offered here", "bootcamps offered here"], db("bootcamp_hubs").where({ hubId: id }), { table: "bootcamp_hubs", labelFrom: "bootcamps", distinctOn: "bootcampId" }),
      usage("competitions", ["competition held here", "competitions held here"], db("competition_hubs").where({ hubId: id }), { table: "competition_hubs", labelFrom: "competitions", distinctOn: "competitionId" }),
      usage("clubs", ["Tech Club membership", "Tech Club memberships"], db("club_memberships").where({ hubId: id }).whereNot({ status: "cancelled" }), { table: "club_memberships", labelFrom: null }),
      usage("orders", ["website order", "website orders"], db("orders").where((w) => w.where({ hubId: id }).orWhere({ pickupHubId: id })), { table: "orders", labelFrom: null }),
      usage("visits", ["logged visit", "logged visits"], db("hub_visits").where({ hubId: id }), { table: "hub_visits", labelFrom: null }),
    ],
  },

  course: {
    name: "courses",
    alternative: { action: "archive", label: "Archive the course instead" },
    uses: (id) => [
      usage("curricula", ["curriculum", "curricula"], db("curricula").whereIn("id", db("curriculum_versions").where({ isCurrent: true }).whereRaw(...jsonHas("content", id)).select("curriculumId")), { table: "curricula" }),
      usage("pathways", ["pathway", "pathways"], whereJsonHas(db("pathways"), "courses", id), { table: "pathways" }),
      usage("classes", ["class teaching it", "classes teaching it"], db("class_course_teacher_links").where({ courseId: id }), { table: "class_course_teacher_links", labelFrom: "classes", distinctOn: "classId" }),
      usage("timetable", ["class timetable", "class timetables"], db("timetable_course_schedules").where({ courseId: id }), { table: "timetable_course_schedules", labelFrom: "classes", distinctOn: "classId" }),
      usage("learners", ["learner on it in a pathway", "learners on it in a pathway"], db("learner_pathways").where({ currentCourseId: id }), { table: "learner_pathways", labelFrom: "learners", distinctOn: "learnerId" }),
      usage("reports", ["learner report", "learner reports"], db("reports").where({ courseId: id }), { table: "reports", labelFrom: null }),
      usage("certificates", ["certificate", "certificates"], db("certificates").where({ courseId: id }), { table: "certificates", labelFrom: null }),
    ],
  },

  courseModule: {
    name: "course_modules",
    alternative: null,
    uses: (id) => [
      usage("sessions", ["session in it", "sessions in it"], db("course_sessions").where({ moduleId: id }), { table: "course_sessions", labelFrom: null }),
    ],
  },

  courseSession: {
    name: "course_sessions",
    alternative: null,
    uses: (id) => [
      usage("issued", ["assessment issued from it", "assessments issued from it"], db("assessment_issues").where({ sessionId: id }), { table: "assessment_issues", labelFrom: null }),
      usage("taught", ["class that has taught it", "classes that have taught it"], db("session_occurrences").where({ sessionId: id }).whereNotNull("taughtAt"), { table: "session_occurrences", labelFrom: "classes", distinctOn: "classId" }),
      usage("reports", ["learner report", "learner reports"], db("reports").where({ sessionId: id }), { table: "reports", labelFrom: null }),
    ],
  },

  assessment: {
    name: "assessments",
    alternative: null,
    uses: (id) => [
      usage("sessions", ["course session", "course sessions"], db("course_sessions").where((w) => w.whereRaw(...jsonHas("assessmentIds", id)).orWhereRaw(...jsonHas("assessmentAttachments", id))), { table: "course_sessions", labelFrom: null }),
      usage("issued", ["time issued", "times issued"], db("assessment_issues").where({ assessmentId: id }), { table: "assessment_issues", labelFrom: null }),
      usage("submissions", ["learner submission", "learner submissions"], db("assessment_submissions").where({ assessmentId: id }), { table: "assessment_submissions", labelFrom: null }),
      usage("pathways", ["pathway diagnostic", "pathway diagnostics"], db("pathways").where((w) => w.where({ diagnosticAssessmentId: id }).orWhere({ publicDiagnosticAssessmentId: id })), { table: "pathways" }),
      usage("stages", ["developmental stage diagnostic", "developmental stage diagnostics"], db("age_categories").where({ diagnosticAssessmentId: id }), { table: "age_categories" }),
      usage("orders", ["website order", "website orders"], db("order_items").where({ refId: id }), { table: "order_items", labelFrom: null }),
    ],
  },

  class: {
    name: "classes",
    alternative: { action: "deactivate", label: "Mark the class inactive instead" },
    uses: (id) => [
      usage("learners", ["learner in it", "learners in it"], db("learner_hub_links").where({ classId: id }), { table: "learner_hub_links", labelFrom: "learners", distinctOn: "learnerId" }),
      usage("issued", ["assessment issued to it", "assessments issued to it"], db("assessment_issues").where({ classId: id }), { table: "assessment_issues", labelFrom: null }),
      usage("reports", ["learner report", "learner reports"], db("reports").where({ classId: id }), { table: "reports", labelFrom: null }),
      usage("certificates", ["certificate", "certificates"], db("certificates").where({ classId: id }), { table: "certificates", labelFrom: null }),
      usage("invoices", ["invoice", "invoices"], db("billing_invoices").where({ classId: id }), { table: "billing_invoices", labelFrom: null }),
      usage("claims", ["educator claim", "educator claims"], db("teacher_claims").where({ classId: id }), { table: "teacher_claims", labelFrom: null }),
      usage("homeLearning", ["Home Learning child", "Home Learning children"], db("home_learning_enrollments").where({ classId: id }).whereIn("status", ["active", "paused"]), { table: "home_learning_enrollments", labelFrom: "learners", distinctOn: "learnerId" }),
      usage("clubs", ["Tech Club child", "Tech Club children"], db("club_membership_children").where({ classId: id }).whereNot({ status: "cancelled" }), { table: "club_membership_children", labelFrom: "learners", distinctOn: "learnerId" }),
    ],
  },

  classGroup: {
    name: "class_groups",
    alternative: null,
    uses: (id) => [
      usage("submissions", ["group submission", "group submissions"], db("assessment_submissions").where({ groupId: id }), { table: "assessment_submissions", labelFrom: null }),
    ],
  },

  teacher: {
    name: "teachers",
    alternative: { action: "deactivate", label: "Mark the educator inactive instead" },
    uses: async (id) => {
      const teacher = await db("teachers").where({ id }).first("email");
      const login = teacher?.email ? await db("users").whereRaw("LOWER(email) = ?", [teacher.email.toLowerCase()]).first("id") : null;
      return [
        usage("classes", ["class they teach", "classes they teach"], db("class_course_teacher_links").where({ teacherId: id }), { table: "class_course_teacher_links", labelFrom: "classes", distinctOn: "classId" }),
        usage("classTeacher", ["class they're class teacher of", "classes they're class teacher of"], db("classes").where({ classTeacherId: id }), { table: "classes" }),
        usage("timetable", ["timetable slot", "timetable slots"], db("timetable_slots").where({ teacherId: id }), { table: "timetable_slots", labelFrom: null }),
        usage("claims", ["claim", "claims"], db("teacher_claims").where({ teacherId: id }), { table: "teacher_claims", labelFrom: null }),
        usage("homeLearning", ["Home Learning child", "Home Learning children"], db("home_learning_enrollments").where({ educatorId: id }).whereIn("status", ["active", "paused"]), { table: "home_learning_enrollments", labelFrom: "learners", distinctOn: "learnerId" }),
        login && usage("checkins", ["hub they run check-ins for", "hubs they run check-ins for"], db("learning_hubs").where((w) => w.where({ accountManagerId: login.id }).orWhere({ trainingLeadId: login.id })), { table: "learning_hubs" }),
      ];
    },
  },

  learner: {
    name: "learners",
    alternative: { action: "deactivate", label: "Deactivate the learner's account instead" },
    uses: (id) => [
      usage("invoices", ["invoice", "invoices"], db("billing_invoices").where({ learnerId: id }).orWhereIn("id", db("billing_invoice_items").where({ learnerId: id }).select("invoiceId")), { table: "billing_invoices", labelFrom: null }),
      usage("submissions", ["assessment submission", "assessment submissions"], db("assessment_submissions").where({ learnerId: id }).whereNot({ status: "not_started" }), { table: "assessment_submissions", labelFrom: null }),
      usage("reports", ["report", "reports"], db("reports").where({ learnerId: id }), { table: "reports", labelFrom: null }),
      usage("certificates", ["certificate", "certificates"], db("certificates").where({ learnerId: id }), { table: "certificates", labelFrom: null }),
      usage("attendance", ["attendance record", "attendance records"], db("attendance").where({ learnerId: id }), { table: "attendance", labelFrom: null }),
      usage("homeLearning", ["Home Learning enrolment", "Home Learning enrolments"], db("home_learning_enrollments").where({ learnerId: id }).whereIn("status", ["active", "paused"]), { table: "home_learning_enrollments", labelFrom: null }),
      usage("clubs", ["Tech Club place", "Tech Club places"], db("club_membership_children").where({ learnerId: id }).whereNot({ status: "cancelled" }), { table: "club_membership_children", labelFrom: null }),
    ],
  },

  competency: {
    name: "competencies",
    alternative: null,
    uses: (id) => [
      usage("curricula", ["curriculum that adopted it", "curricula that adopted it"], db("curriculum_competency_links").where({ competencyId: id }), { table: "curriculum_competency_links", labelFrom: "curricula", distinctOn: "curriculumId" }),
      usage("assessments", ["assessment", "assessments"], db("assessment_competency_links").where({ competencyId: id }), { table: "assessment_competency_links", labelFrom: "assessments", distinctOn: "assessmentId" }),
      usage("courses", ["course", "courses"], db("course_competency_links").where({ competencyId: id }), { table: "course_competency_links", labelFrom: "courses", distinctOn: "courseId" }),
    ],
  },

  // A curriculum's adopted competency (`id` = curriculumId:competencyId): its curriculum's assessments
  // and band set-ups that use it, and the marks learners have earned on it.
  curriculumCompetency: {
    name: null,
    alternative: null,
    uses: async (key) => {
      const [curriculumId, competencyId] = key.split(":");
      const indicatorIds = (await db("competency_indicators").where({ competencyId }).pluck("id"));
      const marks = (q) => {
        q.whereRaw(...jsonHas("items", competencyId));
        for (const ind of indicatorIds) q.orWhereRaw(...jsonHas("items", ind)).orWhereRaw(...jsonHas("rubric", ind)).orWhereRaw(...jsonHas("indicators", ind));
      };
      return [
        usage("assessments", ["assessment marking it", "assessments marking it"], db("assessments").where((w) => w.whereIn("id", db("assessment_competency_links").where({ competencyId }).select("assessmentId")).orWhere(marks)).where((w) => w.where({ curriculumId }).orWhereNull("curriculumId")), { table: "assessments" }),
        usage("bands", ["performance band", "performance bands"], whereJsonHas(db("performance_bands").where({ curriculumId }), "competencyIds", competencyId), { table: "performance_bands" }),
        usage("achievements", ["learner mark recorded", "learner marks recorded"], db("indicator_achievements").where({ curriculumId, competencyId }), { table: "indicator_achievements", labelFrom: null }),
      ];
    },
  },

  // An indicator of a curriculum's competency: assessments marking it, band set-ups weighting it.
  curriculumIndicator: {
    name: "curriculum_competency_indicators",
    alternative: null,
    uses: async (id) => {
      const indicator = await db("curriculum_competency_indicators").where({ id }).first("curriculumId");
      return [
        usage("assessments", ["assessment marking it", "assessments marking it"], db("assessments").where((w) => w.whereRaw(...jsonHas("items", id)).orWhereRaw(...jsonHas("rubric", id)).orWhereRaw(...jsonHas("indicators", id))), { table: "assessments" }),
        indicator && usage("bands", ["performance band", "performance bands"], whereJsonHas(db("performance_bands").where({ curriculumId: indicator.curriculumId }), "indicatorContributions", id), { table: "performance_bands" }),
        usage("achievements", ["learner mark recorded", "learner marks recorded"], db("indicator_achievements").where({ indicatorId: id }), { table: "indicator_achievements", labelFrom: null }),
      ];
    },
  },

  pathway: {
    name: "pathways",
    alternative: null,
    uses: (id) => [
      usage("learners", ["learner on it", "learners on it"], db("learner_pathways").where({ pathwayId: id }), { table: "learner_pathways", labelFrom: "learners", distinctOn: "learnerId" }),
      usage("assessments", ["assessment", "assessments"], db("assessment_pathway_links").where({ pathwayId: id }), { table: "assessment_pathway_links", labelFrom: "assessments", distinctOn: "assessmentId" }),
      usage("courses", ["course linked to it", "courses linked to it"], db("course_pathway_links").where({ pathwayId: id }), { table: "course_pathway_links", labelFrom: "courses", distinctOn: "courseId" }),
      usage("bootcamps", ["bootcamp", "bootcamps"], whereJsonHas(db("bootcamps"), "pathwayIds", id), { table: "bootcamps" }),
      usage("issued", ["diagnostic issued for it", "diagnostics issued for it"], db("assessment_issues").where({ pathwayId: id }), { table: "assessment_issues", labelFrom: null }),
    ],
  },

  ageCategory: {
    name: "age_categories",
    alternative: null,
    uses: (id) => [
      usage("pathways", ["pathway", "pathways"], db("pathways").where({ ageCategoryId: id }), { table: "pathways" }),
      usage("bands", ["performance band", "performance bands"], db("performance_bands").where({ ageCategoryId: id }), { table: "performance_bands" }),
      usage("learners", ["learner placed at it", "learners placed at it"], db("learner_hub_links").where({ currentStageId: id }), { table: "learner_hub_links", labelFrom: "learners", distinctOn: "learnerId" }),
      usage("issued", ["diagnostic issued for it", "diagnostics issued for it"], db("assessment_issues").where({ ageCategoryId: id }), { table: "assessment_issues", labelFrom: null }),
    ],
  },

  performanceBand: {
    name: "performance_bands",
    alternative: null,
    uses: (id) => [
      usage("learners", ["learner placed in it", "learners placed in it"], db("learner_hub_links").where({ currentBandId: id }), { table: "learner_hub_links", labelFrom: "learners", distinctOn: "learnerId" }),
    ],
  },

  systemLevel: {
    name: "system_levels",
    alternative: null,
    uses: (id) => [
      usage("curricula", ["curriculum using it for a grade", "curricula using it for a grade"], whereJsonHas(db("curricula"), "classes", id), { table: "curricula" }),
    ],
  },

  item: {
    name: "items",
    alternative: null,
    uses: (id) => [
      usage("courses", ["course that needs it", "courses that need it"], db("course_inventory_links").where({ inventoryItemId: id }), { table: "course_inventory_links", labelFrom: "courses", distinctOn: "courseId" }),
      usage("assessments", ["project that needs it", "projects that need it"], db("assessment_inventory_links").where({ inventoryItemId: id }), { table: "assessment_inventory_links", labelFrom: "assessments", distinctOn: "assessmentId" }),
      usage("orders", ["website order", "website orders"], db("order_items").where({ refId: id }), { table: "order_items", labelFrom: null }),
    ],
  },

  homeLearningPackage: {
    name: "home_learning_packages",
    alternative: { action: "archive", label: "Archive the package instead" },
    uses: (id) => [
      usage("households", ["household on it", "households on it"], db("home_learning_households").where({ packageId: id }).whereNot({ status: "cancelled" }), { table: "home_learning_households", labelFrom: null }),
    ],
  },

  clubPackage: {
    name: "club_packages",
    alternative: { action: "archive", label: "Archive the package instead" },
    uses: (id) => [
      usage("memberships", ["membership on it", "memberships on it"], db("club_memberships").where({ packageId: id }).whereNot({ status: "cancelled" }), { table: "club_memberships", labelFrom: null }),
    ],
  },

  room: {
    name: "rooms",
    alternative: { action: "deactivate", label: "Mark the room inactive instead" },
    uses: (id) => [
      usage("slots", ["timetable slot", "timetable slots"], db("timetable_slots").where({ roomId: id }), { table: "timetable_slots", labelFrom: null }),
      usage("moves", ["moved session", "moved sessions"], db("timetable_session_skips").where({ roomId: id }), { table: "timetable_session_skips", labelFrom: null }),
    ],
  },

  accessRole: {
    name: "access_roles",
    alternative: null,
    uses: (id) => [
      usage("staff", ["staff member with it", "staff members with it"], db("users").where({ roleId: id }), { table: "users" }),
    ],
  },

  bootcamp: {
    name: "bootcamps",
    alternative: null,
    uses: (id) => [
      usage("enrolments", ["enrolment", "enrolments"], db("leads").where({ bootcampId: id }), { table: "leads" }),
    ],
  },

  game: {
    name: "event_games",
    alternative: null,
    uses: (id) => [
      usage("bootcamps", ["bootcamp", "bootcamps"], whereJsonHas(db("bootcamps"), "gameIds", id), { table: "bootcamps" }),
    ],
  },

  supervisor: {
    name: "users",
    alternative: null,
    uses: (id) => [
      usage("educators", ["educator they supervise", "educators they supervise"], db("teachers").where({ supervisorId: id }), { table: "teachers" }),
      usage("claims", ["claim waiting for them", "claims waiting for them"], db("teacher_claims").where({ supervisorId: id, status: "pending_supervisor" }), { table: "teacher_claims", labelFrom: null }),
    ],
  },
};

// The workspace a record belongs to — so a check (which stops before the route's own delete, where
// some ownership checks live) never answers about another workspace's record. Records below a
// curriculum are already confined by the curriculum routes' ownCurriculumOnly.
const OWNER = {
  curriculum: (id) => db("curricula").where({ id }).first("ownerAdminId"),
  learningHub: (id) => db("learning_hubs").where({ id }).first("ownerAdminId"),
  course: (id) => db("courses").where({ id }).first("ownerAdminId"),
  courseModule: (id) => db("courses").whereIn("id", db("course_modules").where({ id }).select("courseId")).first("ownerAdminId"),
  courseSession: (id) => db("courses").whereIn("id", db("course_sessions").where({ id }).select("courseId")).first("ownerAdminId"),
  assessment: (id) => db("assessments").where({ id }).first("ownerAdminId"),
  class: (id) => db("learning_hubs").whereIn("id", db("classes").where({ id }).select("schoolId")).first("ownerAdminId"),
  classGroup: (id) => db("learning_hubs").whereIn("id", db("classes").whereIn("id", db("class_groups").where({ id }).select("classId")).select("schoolId")).first("ownerAdminId"),
  competency: (id) => db("competencies").where({ id }).first("ownerAdminId"),
  systemLevel: (id) => db("system_levels").where({ id }).first("ownerAdminId"),
  item: (id) => db("items").where({ id }).first("ownerAdminId"),
  homeLearningPackage: (id) => db("home_learning_packages").where({ id }).first("ownerAdminId"),
  clubPackage: (id) => db("club_packages").where({ id }).first("ownerAdminId"),
  room: (id) => db("learning_hubs").whereIn("id", db("rooms").where({ id }).select("hubId")).first("ownerAdminId"),
  accessRole: (id) => db("access_roles").where({ id }).first("ownerAdminId"),
  bootcamp: (id) => db("bootcamps").where({ id }).first("ownerAdminId"),
  game: (id) => db("event_games").where({ id }).first("ownerAdminId"),
  supervisor: (id) => db("users").where({ id }).first("invitedByAdminId as ownerAdminId"),
};

const UsageService = {
  TYPES: Object.keys(CHECKS),

  // What uses one record: { inUse, usages: [{ key, count, label, examples }], alternative }.
  async usageOf(type, id) {
    const check = CHECKS[type];
    if (!check) throw new Error(`No usage check for "${type}"`);
    const usages = (await Promise.all(await check.uses(id))).filter(Boolean);
    return { type, inUse: usages.length > 0, usages, alternative: check.alternative || null };
  },

  // Called by a delete route after its own permission/ownership checks. With ?check it answers
  // (and returns true — the route stops); otherwise it refuses an in-use delete, or lets it go on.
  // `what` names the record in the refusal ("This learning hub").
  async guardDelete(req, res, type, id, what = "This") {
    if (OWNER[type] && (req.user.role === "admin" || req.user.role === "collaborator")) {
      const record = await OWNER[type](id);
      if (!record) throw Object.assign(new Error("Not found"), { statusCode: 404 });
      assertOwn(isOwnedByAdmin(req, record));
    }
    const result = await this.usageOf(type, id);
    if (req.query.check !== undefined) {
      req.usageCheckOnly = true;
      res.json({ success: true, data: result });
      return true;
    }
    if (result.inUse) {
      const list = result.usages.map((u) => u.label).join(", ");
      throw Object.assign(new Error(`${what} is still in use (${list}) — remove or reassign those first.`), {
        statusCode: 409, code: "IN_USE", usage: result,
      });
    }
    return false;
  },
};

module.exports = UsageService;
