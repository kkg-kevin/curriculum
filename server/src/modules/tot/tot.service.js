const db = require("../../config/db");
const LearnerService = require("../learners/learner.service");
const AssessmentSubmissionModel = require("../assessments/submissions/assessment-submission.model");
const AssessmentSubmissionService = require("../assessments/submissions/assessment-submission.service");

// Training of trainers (TOT) — educators learning on a curriculum made for them while they teach.
// See the 20261030090000 migration.
//
//   An educator in training has a learner record of their own (learners.teacherId) — the same
//   learning as any learner: a class of a TOT curriculum (curricula.audience "educators"), its
//   courses, assessments, reports and certificates. They are adults: no guardian (their own name
//   and phone fill the guardian columns) and no parent login. They sign in as the educator and do
//   their learning in the teacher portal's "My learning" (scope.middleware.js — a teacher request
//   marked X-Teacher-Learning runs as their own learner record).
//
//   Their work is marked by their supervisor (teachers.supervisorId) — or, with none, the
//   workspace's admins. A course certificate qualifies them to teach that course
//   (qualifiedCourseIds); a certificate for every course of the curriculum raises their educator
//   level to the curriculum's completionTeacherLevel.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const asArray = (v) => {
  if (Array.isArray(v)) return v;
  try { const parsed = JSON.parse(v || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

// An educator's own learner record, or null.
function traineeOf(teacherId) {
  if (!teacherId) return null;
  return db("learners").where({ teacherId }).first();
}

// Whether this supervisor (a users.id) supervises the educator this learner record belongs to.
async function supervisesLearner(supervisorId, learnerId) {
  const learner = await db("learners").where({ id: learnerId }).first("teacherId");
  if (!learner?.teacherId) return false;
  const teacher = await db("teachers").where({ id: learner.teacherId }).first("supervisorId");
  return teacher?.supervisorId === supervisorId;
}

// The learner ids of every educator-in-training this supervisor supervises.
async function supervisedTraineeIds(supervisorId) {
  return db("learners").whereIn("teacherId", db("teachers").where({ supervisorId }).select("id")).pluck("id");
}

// The TOT classes (classes of an "educators" curriculum) at this workspace's hubs.
async function totClasses(ownerAdminId) {
  return db("classes as c")
    .join("curricula as cu", "cu.id", "c.curriculumId")
    .join("learning_hubs as h", "h.id", "c.schoolId")
    .where("cu.audience", "educators").where("h.ownerAdminId", ownerAdminId)
    .select("c.id", "c.gradeName", "c.streamName", "c.academicYear", "c.status", "c.schoolId as hubId", "h.name as hubName", "cu.id as curriculumId", "cu.name as curriculumName")
    .orderBy([{ column: "h.name" }, { column: "c.gradeName" }]);
}

async function hydrateQueue(submissions) {
  const rows = await AssessmentSubmissionService._hydrateSubmissionRows(submissions);
  const learnerIds = [...new Set(submissions.map((s) => s.learnerId))];
  const learners = learnerIds.length ? await db("learners").whereIn("id", learnerIds).select("id", "teacherId") : [];
  const teacherOf = new Map(learners.map((l) => [l.id, l.teacherId]));
  const teacherIds = [...new Set(learners.map((l) => l.teacherId).filter(Boolean))];
  const teachers = teacherIds.length ? await db("teachers").whereIn("id", teacherIds).select("id", "firstName", "lastName", "photo") : [];
  const teacherById = new Map(teachers.map((t) => [t.id, t]));
  return rows.map((row) => {
    const teacher = teacherById.get(teacherOf.get(row.submission.learnerId));
    return { ...row, educator: teacher ? { id: teacher.id, name: fullName(teacher), photo: teacher.photo || null } : null };
  }).sort((a, b) => new Date(a.submission.submittedAt || 0) - new Date(b.submission.submittedAt || 0));
}

const TotService = {
  traineeOf,
  supervisesLearner,
  supervisedTraineeIds,

  // The TOT classes an admin can put an educator in.
  totClasses,

  // Puts an educator into a TOT class — making their learner record the first time. An educator
  // already in that class is left as they are.
  async enrol(teacher, { hubId, classId }, { ownerAdminId }) {
    const cls = (await totClasses(ownerAdminId)).find((c) => c.id === classId && c.hubId === hubId);
    if (!cls) fail("Choose a class of a TOT curriculum (one marked for educators) at one of your hubs");
    let learner = await traineeOf(teacher.id);
    if (!learner) {
      learner = await LearnerService.createLearner({
        firstName: teacher.firstName || "Educator",
        lastName: teacher.lastName || "",
        gender: null,
        // An adult learning for themself: the guardian columns (which can't be empty) hold their
        // own name and phone, and no email — so no parent login is ever made or matched.
        guardianName: fullName(teacher) || "Educator",
        guardianPhone: teacher.phone || "—",
        guardianEmail: "",
        accountStatus: "active",
        createdByAdminId: ownerAdminId,
        teacherId: teacher.id,
      });
    }
    const already = await db("learner_hub_links").where({ learnerId: learner.id, hubId }).first();
    if (already) {
      if (already.classId !== classId) await db("learner_hub_links").where({ id: already.id }).update({ classId, status: "active", updatedAt: new Date() });
    } else {
      await LearnerService.enrollInHub(learner.id, { hubId, classId, status: "active" });
    }
    return TotService.progressFor(teacher.id);
  },

  // An educator's training: their TOT classes, each course with how far they are, certificates,
  // and work waiting to be marked. null when they aren't in training.
  async progressFor(teacherId, { hubIds = null } = {}) {
    const learner = await traineeOf(teacherId);
    if (!learner) return null;
    let links = await db("learner_hub_links as l")
      .join("classes as c", "c.id", "l.classId")
      .join("curricula as cu", "cu.id", "c.curriculumId")
      .join("learning_hubs as h", "h.id", "l.hubId")
      .where("l.learnerId", learner.id).where("cu.audience", "educators")
      .select("l.hubId", "l.classId", "l.status", "h.name as hubName", "c.gradeName", "cu.id as curriculumId", "cu.name as curriculumName", "cu.completionTeacherLevel");
    if (hubIds) links = links.filter((l) => hubIds.includes(l.hubId));

    const CertificateService = require("../certificates/certificate.service");
    const progress = await CertificateService.progressForLearner(learner.id).catch(() => null);
    const certificates = (await db("certificates").where({ learnerId: learner.id, status: "issued" })
      .select("id", "kind", "courseId", "classId", "snapshot", "issuedAt").orderBy("issuedAt", "desc"))
      .filter((c) => !hubIds || links.some((l) => l.classId === c.classId) || c.kind === "pathway")
      .map((c) => ({ id: c.id, kind: c.kind, courseId: c.courseId, title: (typeof c.snapshot === "string" ? JSON.parse(c.snapshot) : c.snapshot)?.title || "Certificate", issuedAt: c.issuedAt }));
    const toMark = links.length
      ? Number((await db("assessment_submissions").where({ learnerId: learner.id, status: "submitted" }).count({ n: "*" }).first())?.n || 0)
      : 0;
    const totClassIds = new Set(links.map((l) => l.classId));
    // Courses still in progress (a course with a certificate is in `certificates` instead).
    const courses = (progress?.courses || []).filter((item) => totClassIds.has(item.classId));
    return {
      learnerId: learner.id,
      accountStatus: learner.accountStatus || "active",
      classes: links.map((l) => ({ hubId: l.hubId, hubName: l.hubName, classId: l.classId, className: l.gradeName, curriculumId: l.curriculumId, curriculumName: l.curriculumName, completionTeacherLevel: l.completionTeacherLevel, status: l.status })),
      courses,
      certificates,
      toMark,
    };
  },

  // Work waiting to be marked: a supervisor's — their own educators'; an admin's — the
  // workspace's educators with no supervisor (`all` adds every educator's).
  async markingQueue({ supervisorId = null, ownerAdminId = null, all = false }) {
    let learnerIds;
    if (supervisorId) {
      learnerIds = await supervisedTraineeIds(supervisorId);
    } else {
      const hubIds = await db("learning_hubs").where({ ownerAdminId }).pluck("id");
      const trainees = await db("learners as l")
        .join("teachers as t", "t.id", "l.teacherId")
        .whereIn("l.id", db("learner_hub_links").whereIn("hubId", hubIds.length ? hubIds : ["__none__"]).select("learnerId"))
        .modify((q) => { if (!all) q.whereNull("t.supervisorId"); })
        .select("l.id");
      learnerIds = trainees.map((t) => t.id);
    }
    if (!learnerIds.length) return [];
    const submissions = await AssessmentSubmissionModel.findAll({ status: "submitted" });
    return hydrateQueue(submissions.filter((s) => learnerIds.includes(s.learnerId)));
  },

  // A course certificate was issued to someone: if they're an educator in training, they're now
  // qualified to teach that course, and a certificate for every course of a TOT curriculum raises
  // their educator level. Never throws — a certificate must not fail because of this.
  async onCourseCertificate(certificate) {
    try {
      if (!certificate || certificate.kind !== "course" || !certificate.courseId) return;
      const learner = await db("learners").where({ id: certificate.learnerId }).first("id", "teacherId");
      if (!learner?.teacherId) return;
      const teacher = await db("teachers").where({ id: learner.teacherId }).first("id", "qualifiedCourseIds", "teacherLevel");
      if (!teacher) return;
      const qualified = asArray(teacher.qualifiedCourseIds);
      const patch = {};
      if (!qualified.includes(certificate.courseId)) patch.qualifiedCourseIds = JSON.stringify([...qualified, certificate.courseId]);

      const cls = certificate.classId ? await db("classes").where({ id: certificate.classId }).first("curriculumId") : null;
      const curriculum = cls?.curriculumId ? await db("curricula").where({ id: cls.curriculumId }).first("id", "audience", "completionTeacherLevel") : null;
      if (curriculum?.audience === "educators" && curriculum.completionTeacherLevel) {
        const courseIds = await db("course_curriculum_links").where({ curriculumId: curriculum.id }).pluck("courseId");
        const held = new Set(await db("certificates").where({ learnerId: learner.id, kind: "course", status: "issued" }).pluck("courseId"));
        if (courseIds.length && courseIds.every((id) => held.has(id)) && Number(teacher.teacherLevel || 0) < curriculum.completionTeacherLevel) {
          patch.teacherLevel = curriculum.completionTeacherLevel;
        }
      }
      if (Object.keys(patch).length) await db("teachers").where({ id: teacher.id }).update({ ...patch, updatedAt: new Date() });
    } catch (err) {
      console.error("[tot] could not update the educator after a certificate:", err.message);
    }
  },
};

module.exports = TotService;
