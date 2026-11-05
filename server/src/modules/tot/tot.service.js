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
//   their learning as a TOT learner — a sign-in of its own (auth/account-roles.js's TOT_LEARNER_ROLE),
//   the learner portal on their own learner record (scope.middleware.js), never inside the teacher
//   portal. Still "in training", it's their only sign-in; once Active they choose at sign-in.
//
//   Their work is marked by their supervisor (teachers.supervisorId) — or, with none, the
//   workspace's admins. A certificate for every course of the curriculum raises their educator
//   level to the curriculum's completionTeacherLevel. Finishing a course does NOT change what they
//   may teach (3 Nov 2026: no qualifications — courses are shared by learners and educators, and
//   writing qualifiedCourseIds locked an educator out of every other course).

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();

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

  // The workspace's TOT learners (Learners → TOT learners): every educator's own learner record at
  // one of its hubs, or made by it — with the educator, their supervisor, their training classes,
  // certificates and work waiting to be marked. Each opens on the learner page like any learner.
  async learnersFor(ownerAdminId) {
    const hubIds = await db("learning_hubs").where({ ownerAdminId }).pluck("id");
    const trainees = await db("learners")
      .whereNotNull("teacherId")
      .andWhere((q) => {
        q.where("createdByAdminId", ownerAdminId);
        if (hubIds.length) q.orWhereIn("id", db("learner_hub_links").whereIn("hubId", hubIds).select("learnerId"));
      })
      .select("id", "firstName", "lastName", "photo", "username", "accountStatus", "teacherId", "createdAt")
      .orderBy([{ column: "firstName" }, { column: "lastName" }]);
    if (!trainees.length) return [];
    const ids = trainees.map((t) => t.id);
    const teachers = await db("teachers").whereIn("id", trainees.map((t) => t.teacherId))
      .select("id", "firstName", "lastName", "email", "phone", "status", "supervisorId");
    const teacherById = new Map(teachers.map((t) => [t.id, t]));
    const supervisorIds = [...new Set(teachers.map((t) => t.supervisorId).filter(Boolean))];
    const supervisors = supervisorIds.length ? await db("users").whereIn("id", supervisorIds).select("id", "name") : [];
    const supervisorName = new Map(supervisors.map((u) => [u.id, u.name]));
    const links = await db("learner_hub_links as l")
      .join("classes as c", "c.id", "l.classId")
      .join("curricula as cu", "cu.id", "c.curriculumId")
      .join("learning_hubs as h", "h.id", "l.hubId")
      .whereIn("l.learnerId", ids).where("cu.audience", "educators")
      .select("l.learnerId", "l.status", "l.classId", "c.gradeName", "cu.name as curriculumName", "h.name as hubName");
    const certs = await db("certificates").whereIn("learnerId", ids).where({ status: "issued", kind: "course" })
      .groupBy("learnerId").select("learnerId").count({ n: "*" });
    const certCount = new Map(certs.map((c) => [c.learnerId, Number(c.n)]));
    const marking = await db("assessment_submissions").whereIn("learnerId", ids).where({ status: "submitted" })
      .groupBy("learnerId").select("learnerId").count({ n: "*" });
    const toMark = new Map(marking.map((m) => [m.learnerId, Number(m.n)]));
    // Who is a TOT learner (tot/tot.people.js — the same rule as their sign-in): still in training,
    // or an Active educator with an active place in a TOT class. An Active educator withdrawn from
    // every TOT class is an educator only — their training history stays on their educator page.
    const isTotLearner = (t) => teacherById.get(t.teacherId)?.status === "in_training"
      || links.some((l) => l.learnerId === t.id && l.status === "active");
    return trainees.filter(isTotLearner).map((t) => {
      const teacher = teacherById.get(t.teacherId) || null;
      return {
        id: t.id,
        firstName: t.firstName,
        lastName: t.lastName,
        photo: t.photo || null,
        username: t.username || null,
        accountStatus: t.accountStatus || "active",
        createdAt: t.createdAt,
        educator: teacher ? {
          id: teacher.id, name: fullName(teacher), email: teacher.email || null, phone: teacher.phone || null,
          status: teacher.status || "active", supervisorName: teacher.supervisorId ? supervisorName.get(teacher.supervisorId) || null : null,
        } : null,
        classes: links.filter((l) => l.learnerId === t.id).map((l) => ({ classId: l.classId, curriculumName: l.curriculumName, className: l.gradeName, hubName: l.hubName, status: l.status })),
        certificates: certCount.get(t.id) || 0,
        toMark: toMark.get(t.id) || 0,
      };
    });
  },

  // Puts an educator into a TOT class — making their learner record the first time. An educator
  // already in that class is left as they are.
  // `pendingPayment`: a new learner record waits on payment (the website TOT sign-up —
  // bootcamp-enrollment/educator-enrollment.service.js); paying switches it on.
  // `dateOfBirth`: theirs, when known (the website sign-up asks) — kept on the learner record, so
  // their stage, and with it the diagnostic, can follow their age like any learner's.
  async enrol(teacher, { hubId, classId }, { ownerAdminId, pendingPayment = false, dateOfBirth = null }) {
    const cls = (await totClasses(ownerAdminId)).find((c) => c.id === classId && c.hubId === hubId);
    if (!cls) fail("Choose a class of a TOT curriculum (one marked for educators) at one of your hubs");
    let learner = await traineeOf(teacher.id);
    if (learner && dateOfBirth && !learner.dateOfBirth) {
      await db("learners").where({ id: learner.id }).update({ dateOfBirth, updatedAt: new Date() });
    }
    if (!learner) {
      learner = await LearnerService.createLearner({
        firstName: teacher.firstName || "Educator",
        lastName: teacher.lastName || "",
        gender: null,
        dateOfBirth: dateOfBirth || "",
        // An adult learning for themself: the guardian columns (which can't be empty) hold their
        // own name and phone, and no email — so no parent login is ever made or matched.
        guardianName: fullName(teacher) || "Educator",
        guardianPhone: teacher.phone || "—",
        guardianEmail: "",
        accountStatus: pendingPayment ? "pending_payment" : "active",
        createdByAdminId: ownerAdminId,
        teacherId: teacher.id,
      });
    }
    const already = await db("learner_hub_links").where({ learnerId: learner.id, hubId }).first();
    if (already) {
      // Another class at the hub, or the same one after being withdrawn — active again.
      if (already.classId !== classId || already.status !== "active") {
        await db("learner_hub_links").where({ id: already.id }).update({ classId, status: "active", updatedAt: new Date() });
      }
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
    // Courses still in progress (a course with a certificate is in `certificates` instead), each
    // with where its final report stands: `ready` once every session's work is marked and
    // released (session reports publish themselves), `reportStatus` none | draft. Publishing it
    // (publishCourseReport) issues the certificate.
    const ReportService = require("../reports/report.service");
    const courses = await Promise.all((progress?.courses || []).filter((item) => totClassIds.has(item.classId)).map(async (item) => {
      await ReportService.refreshSessionReports(learner.id, item.classId, item.id).catch(() => {});
      const now = await ReportService.getCourseProgressForLearner(item.id, item.classId, learner.id);
      const report = await db("reports").where({ learnerId: learner.id, courseId: item.id, classId: item.classId }).whereNull("sessionId").first("id", "status");
      return { ...item, done: now.doneSessions, total: now.totalSessions, ready: now.totalSessions > 0 && now.doneSessions === now.totalSessions, reportStatus: report?.status || "none" };
    }));
    return {
      learnerId: learner.id,
      accountStatus: learner.accountStatus || "active",
      classes: links.map((l) => ({ hubId: l.hubId, hubName: l.hubName, classId: l.classId, className: l.gradeName, curriculumId: l.curriculumId, curriculumName: l.curriculumName, completionTeacherLevel: l.completionTeacherLevel, status: l.status })),
      courses,
      certificates,
      toMark,
    };
  },

  // The final report of one course of an educator's training, generated and published in one
  // step — by their supervisor or an admin (a supervisor marks the work, so the certificate
  // shouldn't wait on anyone else). Publishing issues the course certificate, and with it any
  // level the TOT curriculum gives (onCourseCertificate). Only a course of one of their TOT classes.
  async publishCourseReport(teacherId, { classId, courseId, remarks = "" }, publishedBy) {
    const learner = await traineeOf(teacherId);
    if (!learner) fail("Not in training", 404);
    const link = await db("learner_hub_links as l")
      .join("classes as c", "c.id", "l.classId")
      .join("curricula as cu", "cu.id", "c.curriculumId")
      .where({ "l.learnerId": learner.id, "l.classId": classId, "cu.audience": "educators" })
      .first("l.id");
    if (!link) fail("That isn't one of their training classes", 404);
    const ReportService = require("../reports/report.service");
    await ReportService.refreshSessionReports(learner.id, classId, courseId);
    let report;
    try {
      report = await ReportService.generateReport({ learnerId: learner.id, courseId, classId, generatedBy: publishedBy });
    } catch (err) {
      if (err.statusCode === 409) fail("Some of this course's work still needs marking and releasing before its report", 409);
      throw err;
    }
    if (report.status !== "published") {
      if (remarks) await ReportService.updateRemarks(report.id, { remarks });
      await ReportService.publishReport(report.id, publishedBy);
    }
    return TotService.progressFor(teacherId);
  },

  // Ends an educator's training in one TOT class (admin): their place there is set inactive —
  // nothing is deleted, so their certificates, reports and marked work stay, and enrolling them
  // again picks up where they left off.
  async withdraw(teacherId, { classId }) {
    const learner = await traineeOf(teacherId);
    if (!learner) fail("Not in training", 404);
    const updated = await db("learner_hub_links").where({ learnerId: learner.id, classId }).update({ status: "inactive", updatedAt: new Date() });
    if (!updated) fail("That isn't one of their training classes", 404);
    return TotService.progressFor(teacherId);
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

  // A course certificate was issued to someone: if they're an educator in training and now hold a
  // certificate for every course of a TOT curriculum, their educator level rises to that
  // curriculum's level. Never throws — a certificate must not fail because of this.
  async onCourseCertificate(certificate) {
    try {
      if (!certificate || certificate.kind !== "course" || !certificate.courseId) return;
      const learner = await db("learners").where({ id: certificate.learnerId }).first("id", "teacherId");
      if (!learner?.teacherId) return;
      const teacher = await db("teachers").where({ id: learner.teacherId }).first("id", "teacherLevel", "status", "firstName", "lastName");
      if (!teacher) return;
      const patch = {};

      const cls = certificate.classId ? await db("classes").where({ id: certificate.classId }).first("curriculumId", "schoolId") : null;
      const curriculum = cls?.curriculumId ? await db("curricula").where({ id: cls.curriculumId }).first("id", "name", "audience", "completionTeacherLevel", "ownerAdminId") : null;
      if (curriculum?.audience === "educators") {
        // The curriculum's courses are its published version's (what its classes run); a curriculum
        // without one falls back to its attached courses.
        const versionCourses = await require("../curriculum/versions/curriculum-versions.service").getCurrentCourses(curriculum.id).catch(() => []);
        const courseIds = versionCourses.length
          ? versionCourses.map((c) => c.id)
          : await db("course_curriculum_links").where({ curriculumId: curriculum.id }).pluck("courseId");
        const held = new Set(await db("certificates").where({ learnerId: learner.id, kind: "course", status: "issued" }).pluck("courseId"));
        const finished = courseIds.length > 0 && courseIds.every((id) => held.has(id));
        if (finished && curriculum.completionTeacherLevel && Number(teacher.teacherLevel || 0) < curriculum.completionTeacherLevel) {
          patch.teacherLevel = curriculum.completionTeacherLevel;
        }
        // Still "in training" (a website TOT sign-up): the admins decide when they start teaching.
        const hub = cls.schoolId ? await db("learning_hubs").where({ id: cls.schoolId }).first("ownerAdminId") : null;
        const ownerAdminId = hub?.ownerAdminId || curriculum.ownerAdminId;
        if (finished && teacher.status === "in_training" && ownerAdminId) {
          await require("../notifications/notification.service")._notify(ownerAdminId, {
            type: "tot_training_finished",
            title: "Training finished — ready to make active?",
            message: `${fullName(teacher)} has a certificate for every course of ${curriculum.name}. They're still In training: make them Active on their page when they're ready to teach.`,
            payload: { route: `/teachers/${teacher.id}/view` },
            dedupeKey: `tot_training_finished:${teacher.id}:${curriculum.id}`,
            ownerAdminId,
          }).catch(() => {});
        }
      }
      if (Object.keys(patch).length) await db("teachers").where({ id: teacher.id }).update({ ...patch, updatedAt: new Date() });
    } catch (err) {
      console.error("[tot] could not update the educator after a certificate:", err.message);
    }
  },
};

module.exports = TotService;
