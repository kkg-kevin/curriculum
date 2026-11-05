const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");
const { PUBLIC_CONTENT_ADMIN_ID } = require("../../config/env");
const NotificationService = require("../notifications/notification.service");
const { workspaceTeacherIds } = require("../qa/qa.access");
const { isParent } = require("../parent/parent.access");
const { ANONYMOUS_MIN_REVIEWS, isEditable, normaliseSettings, cleanSubmission, summarise } = require("./mentor-review.rules");

// Parents review the mentors teaching their children; a TOT learner their trainers (5 Nov 2026).
// Rules in mentor-review.rules.js; the table in the 20261105120000 migration.
//
//   Who reviews whom  a parent login (parent.access.js's isParent) — each educator teaching a child
//                     of theirs, in an active class place (the class's course educators: hub classes,
//                     Home Learning, bootcamp cohorts); a TOT learner session — their own trainers.
//                     A child's own username login never reviews.
//   When              once the child has attended `minSessions` of the class (or the course's final
//                     report is out). Stage "mid" while the course runs, "end" once its final report
//                     is published — one review per learner, educator, course and stage, changeable
//                     for 14 days. Prompted twice: a mid-course check-in after `midCourseAfterSessions`
//                     attended (attendance.service.js) and with the final report (report.service.js).
//   Who sees what     admins (and staff with Educators) and the educator's supervisor: every review,
//                     named, with moderation (hide a comment — its ratings still count — feature a
//                     consented one on the website, resolve a concern); the educator: a summary and
//                     the comments without names, from 3 reviews; the hub: its educators' averages,
//                     from 3 reviews, when the workspace allows. A concern goes to the admins (and
//                     the supervisor) at once and is never shown to the educator or the hub.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const parseJson = (v) => (typeof v === "string" ? JSON.parse(v || "null") : v);

// ── Settings ─────────────────────────────────────────────────────────────────
async function getSettings(ownerAdminId) {
  const row = ownerAdminId ? await db("mentor_review_settings").where({ ownerAdminId }).first() : null;
  return normaliseSettings(parseJson(row?.settings));
}

async function saveSettings(ownerAdminId, raw) {
  const settings = normaliseSettings(raw);
  if (!settings.aspects.length) fail("Keep at least one thing for parents to rate");
  const row = { settings: JSON.stringify(settings), updatedAt: new Date() };
  const exists = await db("mentor_review_settings").where({ ownerAdminId }).first("ownerAdminId");
  if (exists) await db("mentor_review_settings").where({ ownerAdminId }).update(row);
  else await db("mentor_review_settings").insert({ ownerAdminId, ...row });
  return settings;
}

// ── Mentors of a learner ─────────────────────────────────────────────────────
// Each educator teaching this learner, per course of each active class place — with how many of the
// class's sessions they attended, the stage, whether they can be reviewed yet, and the review so far.
async function mentorsForLearner(learner, settingsCache = new Map()) {
  const links = await db("learner_hub_links").where({ learnerId: learner.id, status: "active" }).whereNotNull("classId");
  const rows = [];
  for (const link of links) {
    const cls = await db("classes").where({ id: link.classId }).first("id", "gradeName", "streamName", "schoolId");
    const hub = cls ? await db("learning_hubs").where({ id: cls.schoolId }).first("id", "name", "ownerAdminId") : null;
    if (!cls || !hub) continue;
    if (!settingsCache.has(hub.ownerAdminId)) settingsCache.set(hub.ownerAdminId, await getSettings(hub.ownerAdminId));
    const settings = settingsCache.get(hub.ownerAdminId);
    if (!settings.enabled) continue;
    const teaching = await db("class_course_teacher_links").where({ classId: cls.id });
    if (!teaching.length) continue;
    const attended = Number((await db("attendance").where({ classId: cls.id, learnerId: learner.id }).whereIn("status", ["present", "late"]).count({ n: "*" }).first())?.n || 0);
    for (const t of teaching) {
      const teacher = await db("teachers").where({ id: t.teacherId }).first("id", "firstName", "lastName", "photo", "status");
      const course = await db("courses").where({ id: t.courseId }).first("id", "name");
      if (!teacher || !course || teacher.status === "inactive") continue;
      const finalReport = await db("reports").where({ learnerId: learner.id, classId: cls.id, courseId: course.id, status: "published" }).whereNull("sessionId").first("id");
      const stage = finalReport ? "end" : "mid";
      const eligible = stage === "end" || attended >= settings.minSessions;
      const review = await db("mentor_reviews").where({ learnerId: learner.id, teacherId: teacher.id, courseId: course.id, stage }).first();
      rows.push({
        teacher: { id: teacher.id, name: fullName(teacher), photo: teacher.photo || null },
        course: { id: course.id, name: course.name },
        classId: cls.id,
        className: [cls.gradeName, cls.streamName].filter(Boolean).join(" "),
        hub: { id: hub.id, name: hub.name },
        ownerAdminId: hub.ownerAdminId,
        attended,
        minSessions: settings.minSessions,
        stage,
        eligible,
        due: eligible && !review && (stage === "end" || (settings.midCourse && attended >= settings.midCourseAfterSessions)),
        review: review ? shapeOwnReview(review) : null,
        editable: review ? isEditable(review) : eligible,
        aspects: settings.aspects,
      });
    }
  }
  return rows;
}

const shapeOwnReview = (r) => ({
  id: r.id, stage: r.stage, overall: r.overall, ratings: parseJson(r.ratings) || {}, comment: r.comment || "",
  concern: !!r.concern, concernText: r.concernText || "", websiteConsent: !!r.websiteConsent, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

// Who is reviewing: a parent (their children) or a TOT learner (themself). Anyone else — a child's
// own login — can't.
function reviewerOf(req) {
  if (req.user.role !== "learner") fail("Only parents can review mentors", 403);
  if (req.user.totLearner) return { kind: "tot", userId: req.user.id, learners: req.ownLearner ? [req.ownLearner] : [] };
  if (isParent(req.user)) return { kind: "parent", userId: req.user.id, learners: req.ownLearners || [] };
  fail("Only parents can review mentors", 403);
}

// The login that reviews for a learner (where the prompts go): a TOT learner's own educator login,
// else the parent's.
async function reviewerUserFor(learner) {
  if (learner.teacherId) {
    const teacher = await db("teachers").where({ id: learner.teacherId }).first("email");
    return teacher?.email ? db("users").whereRaw("LOWER(email) = ?", [teacher.email.toLowerCase()]).first("id") : null;
  }
  return learner.guardianEmail ? db("users").whereRaw("LOWER(email) = ?", [learner.guardianEmail.toLowerCase()]).first("id") : null;
}

const feedbackRoute = (learner) => (learner.teacherId ? "/learner-portal/feedback" : "/parent/feedback");

async function notifyRequest(learner, row) {
  const user = await reviewerUserFor(learner);
  if (!user) return;
  const ending = row.stage === "end";
  await NotificationService.notifyPerson(user.id, {
    type: "mentor_review_request",
    title: ending ? `${row.course.name} is complete — how did ${row.teacher.name} do?` : `How is ${row.teacher.name} doing?`,
    message: learner.teacherId
      ? `Tell us how ${row.teacher.name} is training you on ${row.course.name}. It takes a minute.`
      : `Tell us how ${row.teacher.name} is teaching ${learner.firstName} ${row.course.name}. It takes a minute, and the educator never sees your name.`,
    payload: { route: feedbackRoute(learner), learnerId: learner.id, teacherId: row.teacher.id, courseId: row.course.id },
    dedupeKey: `mentor_review_request:${row.stage}:${learner.id}:${row.teacher.id}:${row.course.id}`,
    ownerAdminId: row.ownerAdminId,
  }).catch(() => {});
}

// ── Staff access ─────────────────────────────────────────────────────────────
// Which reviews of this educator the viewer may see, and how: "named" (admins, staff, the educator's
// supervisor), "hub" (averages only), "own" (the educator — anonymous summary).
async function viewFor(req, teacherId) {
  const teacher = await db("teachers").where({ id: teacherId }).first("id", "firstName", "lastName", "supervisorId");
  if (!teacher) fail("Educator not found", 404);
  const role = req.user.role;
  if (role === "admin") {
    if (!(await workspaceTeacherIds(req.ownerAdminId)).includes(teacherId)) fail("Educator not found", 404);
    return { teacher, mode: "named", where: { ownerAdminId: req.ownerAdminId } };
  }
  if (role === "supervisor") {
    if (teacher.supervisorId !== req.user.id) fail("Educator not found", 404);
    return { teacher, mode: "named", where: { ownerAdminId: req.user.invitedByAdminId } };
  }
  if (role === "school") {
    const hubId = req.ownSchool?.id;
    const linked = hubId && (await db("teacher_hub_links").where({ teacherId, hubId }).first("id")
      || await db("class_course_teacher_links").where({ teacherId }).whereIn("classId", db("classes").where({ schoolId: hubId }).select("id")).first("id"));
    if (!linked) fail("Educator not found", 404);
    const settings = await getSettings(req.ownSchool.ownerAdminId);
    return { teacher, mode: settings.hubsSeeAverages ? "hub" : "none", where: { hubId } };
  }
  if (role === "teacher") {
    if (req.ownTeacher?.id !== teacherId) fail("Educator not found", 404);
    return { teacher, mode: "own", where: {} };
  }
  fail("Not allowed", 403);
}

async function aspectsFor(ownerAdminIds) {
  // One list of aspects to summarise against: the workspace's (the first, for an educator in more
  // than one), plus any keys only older reviews carry.
  const settings = await getSettings(ownerAdminIds[0] || null);
  return settings.aspects;
}

// The educator's feedback, as this viewer may see it.
async function feedbackForEducator(req, teacherId) {
  const { teacher, mode, where } = await viewFor(req, teacherId);
  if (mode === "none") return { mode, count: 0 };
  const reviews = await db("mentor_reviews").where({ teacherId, ...where }).orderBy("createdAt", "desc");
  const aspects = await aspectsFor([...new Set(reviews.map((r) => r.ownerAdminId))].filter(Boolean).concat(where.ownerAdminId ? [where.ownerAdminId] : []));
  const summary = summarise(reviews, aspects);

  if (mode === "own" || mode === "hub") {
    if (reviews.length < ANONYMOUS_MIN_REVIEWS) return { mode, count: reviews.length, enough: false, needed: ANONYMOUS_MIN_REVIEWS };
    const comments = mode === "own"
      ? reviews.filter((r) => r.comment && !r.hidden).map((r) => ({ comment: r.comment, month: new Date(r.createdAt).toISOString().slice(0, 7), overall: r.overall }))
      : [];
    return { mode, enough: true, ...summary, comments };
  }

  // Named: who, for which child and course, where — for admins, staff and the supervisor.
  const ids = (col) => [...new Set(reviews.map((r) => r[col]).filter(Boolean))];
  const [learners, users, courses, hubs] = await Promise.all([
    ids("learnerId").length ? db("learners").whereIn("id", ids("learnerId")).select("id", "firstName", "lastName") : [],
    ids("reviewerUserId").length ? db("users").whereIn("id", ids("reviewerUserId")).select("id", "name", "email") : [],
    ids("courseId").length ? db("courses").whereIn("id", ids("courseId")).select("id", "name") : [],
    ids("hubId").length ? db("learning_hubs").whereIn("id", ids("hubId")).select("id", "name") : [],
  ]);
  const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
  const [L, U, C, H] = [byId(learners), byId(users), byId(courses), byId(hubs)];
  return {
    mode,
    teacher: { id: teacher.id, name: fullName(teacher) },
    ...summary,
    openConcerns: reviews.filter((r) => r.concern && !r.concernResolvedAt).length,
    reviews: reviews.map((r) => ({
      id: r.id,
      stage: r.stage,
      overall: r.overall,
      ratings: parseJson(r.ratings) || {},
      comment: r.comment || "",
      hidden: !!r.hidden,
      concern: !!r.concern,
      concernText: r.concernText || "",
      concernResolvedAt: r.concernResolvedAt || null,
      websiteConsent: !!r.websiteConsent,
      featured: !!r.featured,
      reviewerKind: r.reviewerKind,
      reviewer: U.get(r.reviewerUserId)?.name || U.get(r.reviewerUserId)?.email || (r.reviewerKind === "tot" ? "TOT learner" : "Parent"),
      learner: { id: r.learnerId, name: fullName(L.get(r.learnerId)) || "Learner" },
      course: C.get(r.courseId)?.name || "Course",
      hub: H.get(r.hubId)?.name || null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    aspectsList: aspects,
  };
}

// A review the viewer may moderate (admins, staff with Educators, the educator's supervisor).
async function moderatable(req, reviewId) {
  const review = await db("mentor_reviews").where({ id: reviewId }).first();
  if (!review) fail("Review not found", 404);
  const { mode, where } = await viewFor(req, review.teacherId);
  if (mode !== "named" || (where.ownerAdminId && review.ownerAdminId !== where.ownerAdminId)) fail("Review not found", 404);
  return review;
}

const MentorReviewService = {
  getSettings,
  saveSettings,

  // The reviewer's children (or, for a TOT learner, themself), each with their mentors.
  async listMine(req) {
    const { kind, learners } = reviewerOf(req);
    const cache = new Map();
    const children = [];
    for (const learner of learners) {
      const mentors = await mentorsForLearner(learner, cache);
      children.push({ learner: { id: learner.id, firstName: learner.firstName, lastName: learner.lastName, photo: learner.photo || null }, mentors });
      // A check-in now due that never got its prompt (attendance marked before this existed): send it.
      for (const m of mentors.filter((x) => x.due)) await notifyRequest(learner, m);
    }
    return { kind, children, dueCount: children.reduce((n, c) => n + c.mentors.filter((m) => m.due).length, 0) };
  },

  // Saves the reviewer's review of one educator, for one learner and course, at its current stage.
  async submit(req, body) {
    const { kind, userId, learners } = reviewerOf(req);
    const learner = learners.find((l) => l.id === body.learnerId);
    if (!learner) fail("Choose one of your children", 404);
    const row = (await mentorsForLearner(learner)).find((m) => m.teacher.id === body.teacherId && m.course.id === body.courseId);
    if (!row) fail("This educator isn't teaching them at the moment", 404);
    if (!row.eligible) fail(`You can review once ${kind === "tot" ? "you've" : `${learner.firstName} has`} attended ${row.minSessions} sessions with them`, 409);
    const clean = cleanSubmission(body, { aspects: row.aspects });
    const existing = await db("mentor_reviews").where({ learnerId: learner.id, teacherId: row.teacher.id, courseId: row.course.id, stage: row.stage }).first();
    if (existing && !isEditable(existing)) fail("This review can no longer be changed", 409);
    const now = new Date();
    const values = {
      ...clean,
      ratings: JSON.stringify(clean.ratings),
      reviewerUserId: userId,
      reviewerKind: kind,
      classId: row.classId,
      hubId: row.hub.id,
      ownerAdminId: row.ownerAdminId,
      updatedAt: now,
    };
    let id = existing?.id;
    if (existing) {
      // A comment changed after it was featured goes back off the website until featured again.
      const changed = (existing.comment || null) !== values.comment;
      await db("mentor_reviews").where({ id }).update({ ...values, ...(changed || !values.websiteConsent ? { featured: false } : {}) });
    } else {
      id = generateId();
      await db("mentor_reviews").insert({ id, learnerId: learner.id, teacherId: row.teacher.id, courseId: row.course.id, stage: row.stage, createdAt: now, ...values });
    }
    // A concern about conduct goes to the workspace's admins, and the educator's supervisor, at once.
    if (clean.concern && !existing?.concern) await MentorReviewService.raiseConcern({ id, learner, row, concernText: clean.concernText });
    return shapeOwnReview(await db("mentor_reviews").where({ id }).first());
  },

  async raiseConcern({ id, learner, row, concernText }) {
    const event = {
      type: "mentor_review_concern",
      title: `Concern raised about ${row.teacher.name}`,
      message: `${learner.teacherId ? "A TOT learner" : `${learner.firstName}'s parent`} raised a concern about ${row.teacher.name} (${row.course.name}, ${row.hub.name}): "${concernText.slice(0, 200)}${concernText.length > 200 ? "…" : ""}"`,
      payload: { route: `/teachers/${row.teacher.id}/view`, teacherId: row.teacher.id, reviewId: id },
      dedupeKey: `mentor_review_concern:${id}`,
      ownerAdminId: row.ownerAdminId,
    };
    await NotificationService._notify(row.ownerAdminId, event).catch(() => {});
    const supervisorId = (await db("teachers").where({ id: row.teacher.id }).first("supervisorId"))?.supervisorId;
    if (supervisorId) await NotificationService.notifyPerson(supervisorId, { ...event, payload: { ...event.payload, route: `/supervisor-portal/educators/${row.teacher.id}` } }).catch(() => {});
  },

  feedbackForEducator,

  // The signed-in educator's own feedback — anonymous, from 3 reviews.
  async mine(req) {
    if (!req.ownTeacher) return { mode: "own", count: 0, enough: false, needed: ANONYMOUS_MIN_REVIEWS };
    return feedbackForEducator(req, req.ownTeacher.id);
  },

  async setHidden(req, reviewId, hidden) {
    await moderatable(req, reviewId);
    await db("mentor_reviews").where({ id: reviewId }).update({ hidden: !!hidden, hiddenBy: hidden ? req.user.id : null, ...(hidden ? { featured: false } : {}), updatedAt: new Date() });
  },

  async setFeatured(req, reviewId, featured) {
    const review = await moderatable(req, reviewId);
    if (req.user.role !== "admin") fail("Only admins choose what goes on the website", 403);
    if (featured && (!review.websiteConsent || !review.comment || review.hidden)) fail("Only a shown comment whose parent agreed can go on the website", 409);
    await db("mentor_reviews").where({ id: reviewId }).update({ featured: !!featured, updatedAt: new Date() });
  },

  async resolveConcern(req, reviewId) {
    const review = await moderatable(req, reviewId);
    if (!review.concern) fail("This review raised no concern", 409);
    await db("mentor_reviews").where({ id: reviewId }).update({ concernResolvedAt: new Date(), concernResolvedBy: req.user.id, updatedAt: new Date() });
  },

  // Attendance was just marked for a class: anyone who has now reached the mid-course check-in
  // gets its prompt (once — dedupe-keyed).
  async afterAttendance(classId) {
    const cls = await db("classes").where({ id: classId }).first("schoolId");
    const hub = cls ? await db("learning_hubs").where({ id: cls.schoolId }).first("ownerAdminId") : null;
    const settings = await getSettings(hub?.ownerAdminId);
    if (!settings.enabled || !settings.midCourse) return;
    const reached = await db("attendance").where({ classId }).whereIn("status", ["present", "late"])
      .groupBy("learnerId").havingRaw("COUNT(*) >= ?", [settings.midCourseAfterSessions]).select("learnerId");
    for (const { learnerId } of reached) {
      const learner = await db("learners").where({ id: learnerId }).first();
      if (!learner) continue;
      for (const row of (await mentorsForLearner(learner)).filter((m) => m.classId === classId && m.due && m.stage === "mid")) {
        await notifyRequest(learner, row);
      }
    }
  },

  // A course's final report was published: the end-of-course prompt for each of its educators.
  async afterCourseReport(report) {
    if (!report || report.sessionId || !report.learnerId) return;
    const learner = await db("learners").where({ id: report.learnerId }).first();
    if (!learner) return;
    for (const row of (await mentorsForLearner(learner)).filter((m) => m.classId === report.classId && m.course.id === report.courseId && m.due)) {
      await notifyRequest(learner, row);
    }
  },

  // The website's "What parents say": comments the parent agreed to share and an admin featured,
  // from the website's workspace — never a name, the child or the educator.
  async publicTestimonials() {
    if (!PUBLIC_CONTENT_ADMIN_ID) return [];
    // No SQL join to the older tables — their collation differs from this one's; hub names separately.
    const rows = await db("mentor_reviews")
      .where({ ownerAdminId: PUBLIC_CONTENT_ADMIN_ID, featured: true, websiteConsent: true, hidden: false })
      .whereNotNull("comment")
      .orderBy("updatedAt", "desc").limit(6)
      .select("comment", "overall", "reviewerKind", "hubId");
    const hubIds = [...new Set(rows.map((r) => r.hubId).filter(Boolean))];
    const hubName = new Map((hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).select("id", "name") : []).map((h) => [h.id, h.name]));
    return rows.map((r) => ({
      quote: r.comment,
      rating: r.overall,
      name: `${r.reviewerKind === "tot" ? "An educator in training" : "A parent"}${hubName.get(r.hubId) ? `, ${hubName.get(r.hubId)}` : ""}`,
    }));
  },
};

module.exports = MentorReviewService;
