const db = require("../../config/db");
const R = require("./educator-profile.rules");
const { summarise } = require("../mentor-reviews/mentor-review.rules");
const { getSettings } = require("../mentor-reviews/mentor-review.service");

// An educator's figures, worked out from the system's own records (never typed in), kept in
// educator_stats and refreshed nightly (npm run educators:stats) and whenever a profile is opened with
// figures older than STALE_MINUTES. Definitions (the rules live in educator-profile.rules.js):
//   hours / sessions   each day a class's attendance was taken, on the weekday of this educator's
//                      timetable slot for a course of it (a shifted session on its new day) — that
//                      slot's length. A class with no timetable, taught by this educator alone, counts
//                      its sessions with no hours ("untimed").
//   learners taught    learners marked present or late in those sessions.
//   reliability        of the sessions their timetable planned in the last 90 days, how many were held.
//   parent rating      mentor_reviews of the last 12 months: average, smoothed, per aspect.
//   quality reviews    every submitted QA visit, compounded: all-time average and band, running average
//                      after each visit, sections averaged across visits, change since the first.
//   feedback speed     typical hours from hand-in to marked, for hand-marked work in their classes.
//   outcomes           learners who finished their courses (final report published), certificates, score.
//   leadership         hub check-ins led (Account Manager / Training Lead) and their tasks.
// Pay is never part of it.

const STALE_MINUTES = 360;
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const todayKe = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (date, n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
const parseJson = (v) => (typeof v === "string" ? JSON.parse(v || "null") : v);

async function computeStats(teacherId) {
  const teacher = await db("teachers").where({ id: teacherId }).first("id", "firstName", "lastName", "email", "createdAt", "teacherLevel", "createdByAdminId");
  if (!teacher) return null;
  const today = todayKe();

  // Where they teach.
  const links = await db("class_course_teacher_links").where({ teacherId });
  const ownSlots = await db("timetable_slots").where({ teacherId });
  // A course they're the educator of whose timetable slot names nobody counts as theirs too.
  const linkKeys = new Set(links.map((l) => `${l.classId}|${l.courseId}`));
  const openSlots = links.length ? (await db("timetable_slots").whereIn("classId", uniq(links.map((l) => l.classId))).whereNull("teacherId")).filter((s) => linkKeys.has(`${s.classId}|${s.courseId}`)) : [];
  const slots = [...ownSlots, ...openSlots];
  const classIds = uniq([...links.map((l) => l.classId), ...slots.map((s) => s.classId)]);
  const classes = classIds.length ? await db("classes").whereIn("id", classIds).select("id", "gradeName", "streamName", "schoolId", "curriculumId", "status") : [];
  const classById = new Map(classes.map((c) => [c.id, c]));
  const hubs = classes.length ? await db("learning_hubs").whereIn("id", uniq(classes.map((c) => c.schoolId))).select("id", "name", "deliveryMode", "isHomeLearning", "ownerAdminId") : [];
  const hubById = new Map(hubs.map((h) => [h.id, h]));
  const courseIds = uniq([...links.map((l) => l.courseId), ...slots.map((s) => s.courseId)]);
  const courses = courseIds.length ? await db("courses").whereIn("id", courseIds).select("id", "name") : [];
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const curricula = classes.length ? await db("curricula").whereIn("id", uniq(classes.map((c) => c.curriculumId))).select("id", "name") : [];

  // Sessions held (attendance taken) and the timetable around them.
  const attendance = classIds.length ? await db("attendance").whereIn("classId", classIds).select("classId", "date", "learnerId", "status") : [];
  const held = new Map();
  for (const a of attendance) (held.get(a.classId) || held.set(a.classId, new Set()).get(a.classId)).add(R.dayKey(a.date));
  const skips = classIds.length ? await db("timetable_session_skips").whereIn("classId", classIds) : [];
  const shifts = skips.filter((s) => s.mode === "shift" && s.newDate);
  const credited = R.creditSessions({ slots, held, shifts });

  // Classes with no timetable at all, taught by this educator alone: their sessions, untimed.
  const timetabled = new Set(slots.map((s) => s.classId));
  const untimed = [];
  for (const classId of uniq(links.map((l) => l.classId)).filter((id) => !timetabled.has(id))) {
    const educators = uniq((await db("class_course_teacher_links").where({ classId })).map((l) => l.teacherId));
    if (educators.length === 1 && held.has(classId)) untimed.push({ classId, sessions: [...held.get(classId)].sort() });
  }

  // Hours: total, last 90 days, by month (last 12).
  const since90 = addDays(today, -90);
  const since12m = addDays(today, -365);
  let minutes = 0;
  let minutes90 = 0;
  const byMonth = new Map();
  for (const c of credited) {
    const per = c.sessions.length ? c.minutes / c.sessions.length : 0;
    for (const d of c.sessions) {
      minutes += per;
      if (d >= since90) minutes90 += per;
      if (d >= since12m) byMonth.set(d.slice(0, 7), (byMonth.get(d.slice(0, 7)) || 0) + per);
    }
  }
  const sessionKeys = new Set([...credited.flatMap((c) => c.sessions.map((d) => `${c.classId}|${d}`)), ...untimed.flatMap((u) => u.sessions.map((d) => `${u.classId}|${d}`))]);
  const learnersTaught = uniq(attendance.filter((a) => ["present", "late"].includes(a.status) && sessionKeys.has(`${a.classId}|${R.dayKey(a.date)}`)).map((a) => a.learnerId)).length;

  // Reliability (last 90 days, active classes).
  const schedules = classIds.length ? await db("timetable_course_schedules").whereIn("classId", classIds) : [];
  const startOf = (classId, courseId) => {
    const sch = schedules.find((x) => x.classId === classId && x.courseId === courseId);
    if (sch?.startDate) return R.dayKey(sch.startDate);
    const days = held.get(classId);
    return days?.size ? [...days].sort()[0] : null;
  };
  const activeSlots = slots.filter((s) => (classById.get(s.classId)?.status || "active") === "active");
  const reliability = R.reliability({ slots: activeSlots, held, shifts: skips.map((s) => ({ ...s, newDate: s.mode === "shift" ? s.newDate : null })), startOf, from: since90, to: addDays(today, -1) });

  // Courses taught.
  const pairs = uniq([...links.map((l) => `${l.classId}|${l.courseId}`), ...credited.map((c) => `${c.classId}|${c.courseId}`)]);
  const coursesTaught = [];
  for (const key of pairs) {
    const [classId, courseId] = key.split("|");
    const cls = classById.get(classId);
    const course = courseById.get(courseId);
    if (!cls || !course) continue;
    const c = credited.find((x) => x.classId === classId && x.courseId === courseId);
    const u = untimed.find((x) => x.classId === classId);
    const learners = Number((await db("learner_hub_links").where({ classId, status: "active" }).count({ n: "*" }).first())?.n || 0);
    const finished = (await db("reports").where({ classId, courseId, status: "published" }).whereNull("sessionId").distinct("learnerId")).length;
    const certificates = Number((await db("certificates").where({ classId, courseId, kind: "course", status: "issued" }).count({ n: "*" }).first())?.n || 0);
    const hub = hubById.get(cls.schoolId);
    coursesTaught.push({
      courseId, classId, course: course.name,
      className: [cls.gradeName, cls.streamName].filter(Boolean).join(" "),
      hub: hub?.isHomeLearning ? "Home Learning" : hub?.name || null,
      sessions: (c?.sessions.length || 0) + (u && !c ? u.sessions.length : 0),
      hours: R.round1((c?.minutes || 0) / 60),
      learners, finished, certificates,
      active: (cls.status || "active") === "active",
    });
  }
  coursesTaught.sort((a, b) => b.sessions - a.sessions || a.course.localeCompare(b.course));

  // Parent rating (12 months).
  const reviews = await db("mentor_reviews").where({ teacherId }).where("createdAt", ">=", new Date(`${since12m}T00:00:00Z`));
  const allReviews = Number((await db("mentor_reviews").where({ teacherId }).count({ n: "*" }).first())?.n || 0);
  const settings = await getSettings(reviews[0]?.ownerAdminId || hubs[0]?.ownerAdminId || teacher.createdByAdminId || null);
  const rsum = summarise(reviews, settings.aspects);
  const sharedComments = reviews.filter((r) => r.comment && r.websiteConsent && !r.hidden)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3)
    .map((r) => ({ comment: r.comment, overall: r.overall, month: new Date(r.createdAt).toISOString().slice(0, 7) }));

  // Quality reviews — every submitted visit, compounded (R.aggregateQa).
  const visits = await db("qa_visits").where({ teacherId, status: "submitted" }).select("score", "submittedAt", "scheduledDate", "visitType", "sectionScores", "summary");
  const qa = R.aggregateQa(visits.map((v) => ({
    date: v.submittedAt ? R.dayKey(v.submittedAt instanceof Date ? v.submittedAt.toISOString() : v.submittedAt) : R.dayKey(v.scheduledDate),
    score: v.score, visitType: v.visitType, sectionScores: parseJson(v.sectionScores) || [], summary: parseJson(v.summary) || {},
  })));

  // Feedback speed and learners' marked work (12 months, their classes).
  const subs = classIds.length ? await db("assessment_submissions").whereIn("classId", classIds).where({ status: "graded" })
    .where("gradedAt", ">=", new Date(`${since12m}T00:00:00Z`)).select("submittedAt", "gradedAt", "requiresManualGrading", "totalScore", "maxScore") : [];
  const markHours = subs.filter((s) => s.requiresManualGrading && s.submittedAt && s.gradedAt)
    .map((s) => (new Date(s.gradedAt) - new Date(s.submittedAt)) / 3600000).filter((h) => h >= 0);
  const percents = subs.filter((s) => Number(s.maxScore) > 0).map((s) => (Number(s.totalScore || 0) / Number(s.maxScore)) * 100);

  // Leadership: hub check-ins they lead, and their tasks.
  const user = teacher.email ? await db("users").whereRaw("LOWER(email) = ?", [teacher.email.toLowerCase()]).first("id") : null;
  let leadership = null;
  if (user) {
    const led = await db("checkin_sessions").where((q) => q.where({ accountManagerId: user.id }).orWhere({ trainingLeadId: user.id })).where("scheduledDate", "<=", today);
    const tasks = await db("checkin_tasks").where({ assigneeId: user.id });
    if (led.length || tasks.length) {
      const reported = led.filter((s) => s.status === "reported");
      leadership = {
        checkinsDue: led.length,
        checkinsReported: reported.length,
        reportedOnTime: reported.filter((s) => s.reportSubmittedAt && R.dayKey(new Date(s.reportSubmittedAt).toISOString()) <= addDays(R.dayKey(s.scheduledDate), 2)).length,
        tasks: tasks.length,
        tasksDone: tasks.filter((t) => t.status === "done").length,
      };
    }
  }

  // Training of trainers.
  const trainee = await db("learners").where({ teacherId }).first("id");
  const totCertificates = trainee ? Number((await db("certificates").where({ learnerId: trainee.id, status: "issued" }).count({ n: "*" }).first())?.n || 0) : 0;

  const availability = await db("teacher_availability_slots").where({ teacherId }).select("dayOfWeek", "startTime", "endTime");

  const stats = {
    hours: { total: R.round1(minutes / 60), last90Days: R.round1(minutes90 / 60), byMonth: [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, m]) => ({ month, hours: R.round1(m / 60) })) },
    sessions: { total: sessionKeys.size, untimed: untimed.reduce((n, u) => n + u.sessions.length, 0) },
    learnersTaught,
    reliability,
    courses: coursesTaught,
    coursesCount: uniq(coursesTaught.map((c) => c.courseId)).length,
    rating: {
      count: rsum.count, allTimeCount: allReviews, average: rsum.average, smoothed: R.smoothedRating(reviews.map((r) => r.overall)),
      aspects: rsum.aspects, distribution: rsum.distribution, trend: rsum.trend, sharedComments,
    },
    qa,
    feedback: { medianHours: markHours.length ? R.round1(R.median(markHours)) : null, count: markHours.length },
    outcomes: {
      learnersFinished: coursesTaught.reduce((n, c) => n + c.finished, 0),
      certificatesEarned: coursesTaught.reduce((n, c) => n + c.certificates, 0),
      averageScore: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null,
    },
    experience: {
      since: teacher.createdAt,
      months: Math.max(0, Math.floor((Date.now() - new Date(teacher.createdAt).getTime()) / (30.44 * 86400000))),
      curricula: curricula.map((c) => c.name),
      hubs: hubs.map((h) => ({ id: h.id, name: h.isHomeLearning ? "Home Learning" : h.name, deliveryMode: h.isHomeLearning ? "home" : h.deliveryMode || "in_person" })),
    },
    leadership,
    tot: { level: teacher.teacherLevel || null, certificates: totCertificates },
    availability,
  };
  stats.badges = R.badgesFor(stats);
  stats.tips = R.growthTips(stats, stats.badges);

  const row = { stats: JSON.stringify(stats), computedAt: new Date() };
  if (await db("educator_stats").where({ teacherId }).first("teacherId")) await db("educator_stats").where({ teacherId }).update(row);
  else await db("educator_stats").insert({ teacherId, ...row });
  return { ...stats, computedAt: row.computedAt };
}

// The figures, from the cache unless older than STALE_MINUTES (or `fresh`).
async function getStats(teacherId, { fresh = false } = {}) {
  if (!fresh) {
    const row = await db("educator_stats").where({ teacherId }).first();
    const cached = row ? parseJson(row.stats) : null;
    // Figures counted before QA compounded (no qa.history) are recounted once.
    if (cached && Array.isArray(cached.qa?.history) && Date.now() - new Date(row.computedAt).getTime() < STALE_MINUTES * 60000) return { ...cached, computedAt: row.computedAt };
  }
  return computeStats(teacherId);
}

async function refreshAll() {
  const ids = await db("teachers").whereNot("status", "inactive").pluck("id");
  let done = 0;
  for (const id of ids) {
    try { await computeStats(id); done += 1; } catch (err) { console.error(`[educator-stats] ${id}: ${err.message}`); }
  }
  return { educators: ids.length, refreshed: done };
}

module.exports = { computeStats, getStats, refreshAll, fullName, STALE_MINUTES };
