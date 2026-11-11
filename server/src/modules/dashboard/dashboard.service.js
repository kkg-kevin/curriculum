const db = require("../../config/db");
const { can } = require("../access/access.service");
const { workspaceTeacherIds } = require("../qa/qa.access");

// The admin dashboard (12 Nov 2026) — what the workspace looks like today, worked out on the
// server in one request (the old page downloaded every learner and educator just to count them).
// The figures that Reports already works out (needs your attention, trends, hubs side by side,
// enrolment and money) come from /api/analytics, so the dashboard and Reports always agree; this
// adds what Reports doesn't have:
//   people      who is asking (name, photo, job title) for the greeting
//   counts      active learners / educators / hubs / classes, curricula, courses, new learners
//               this month against last
//   todo        admin to-dos that aren't learning: payments to confirm, unmatched M-Pesa money,
//               claims to approve, mentor booking refunds, partner hubs owed desk fees, educator
//               profiles waiting to be published, educators still In training, hub check-in
//               reports overdue
//   today       the day: classes on the timetable, mentor sessions, hub and parent–mentor
//               check-ins, QA visits, bootcamps running
//   programmes  Home Learning, Tech Clubs, pathway subscriptions, bootcamps coming up, mentor
//               bookings this week
//   setup       the getting-started checklist (only shown while something is missing)
// Staff get only the sections their role can view (access.registry.js module keys).

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const kenyaNow = () => new Date(Date.now() + 3 * 3600 * 1000);
const dayKey = (d) => d.toISOString().slice(0, 10);
const num = async (q) => Number((await q.count({ n: "*" }).first())?.n || 0);
const monthStart = (d, back = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));

async function summary(req) {
  const owner = req.ownerAdminId;
  const isStaff = req.user.actualRole === "collaborator";
  const perms = req.user.permissions || null;
  const sees = (...modules) => !isStaff || modules.some((m) => can(perms, m, "view"));
  const k = kenyaNow();
  const today = dayKey(k);
  const weekday = WEEKDAYS[k.getUTCDay()];

  const hubs = await db("learning_hubs").where({ ownerAdminId: owner }).select("id", "name", "status", "isHomeLearning");
  const hubIds = hubs.map((h) => h.id);
  const hubName = new Map(hubs.map((h) => [h.id, h.isHomeLearning ? "Home Learning" : h.name]));
  const ids = hubIds.length ? hubIds : ["__none__"];
  const user = await db("users").where({ id: req.user.id }).first("name", "photo", "jobTitle", "email");
  const out = { person: { name: user?.name || null, photo: user?.photo || null, jobTitle: user?.jobTitle || null }, today, isStaff };

  // ── Counts ──────────────────────────────────────────────────────────────────────────────
  const activeLearnerIds = await db("learner_hub_links").whereIn("hubId", ids).where({ status: "active" }).distinct("learnerId").pluck("learnerId");
  const teacherIds = await workspaceTeacherIds(owner);
  const thisMonth = monthStart(k);
  const lastMonth = monthStart(k, 1);
  const newLearners = async (from, to) => num(db("learners").whereIn("id", db("learner_hub_links").whereIn("hubId", ids).select("learnerId")).where("createdAt", ">=", from).where("createdAt", "<", to));
  out.counts = {
    learners: sees("learners") ? activeLearnerIds.length : null,
    newLearners: sees("learners") ? { thisMonth: await newLearners(thisMonth, new Date(Date.now() + 86400000)), lastMonth: await newLearners(lastMonth, thisMonth) } : null,
    educators: sees("teachers") ? (teacherIds.length ? await num(db("teachers").whereIn("id", teacherIds).where({ status: "active" })) : 0) : null,
    hubs: sees("learning-hubs") ? hubs.filter((h) => h.status === "active" && !h.isHomeLearning).length : null,
    classes: sees("classes") ? await num(db("classes").whereIn("schoolId", ids).where({ status: "active" })) : null,
    curricula: sees("curriculum") ? await num(db("curricula").where({ ownerAdminId: owner })) : null,
    courses: sees("courses") ? await num(db("courses").where({ ownerAdminId: owner })) : null,
  };

  // ── To-dos outside learning (Reports' "needs attention" covers marking, risk, enquiries…) ──
  const todo = [];
  const add = (item) => { if (item.count > 0) todo.push(item); };
  if (sees("billing")) {
    add({ key: "notices", tone: "waiting", count: await num(db("payment_notices").where({ ownerAdminId: owner, status: "pending" })), label: "payments families say they've made, to confirm", path: "/billing?tab=confirm" });
    add({ key: "mpesa", tone: "waiting", count: await num(db("mpesa_transactions").where({ ownerAdminId: owner, status: "unallocated" })), label: "M-Pesa payments that match no invoice", path: "/billing?tab=mpesa" });
  }
  if (sees("claims", "claims-approval")) {
    add({ key: "claims", tone: "waiting", count: await num(db("teacher_claims").where({ ownerAdminId: owner, status: "pending_admin" })), label: "educator claims waiting for your approval", path: "/billing?tab=claims" });
    add({ key: "claimsToPay", tone: "info", count: await num(db("teacher_claims").where({ ownerAdminId: owner, status: "approved" })), label: "approved claims still to pay", path: "/billing?tab=claims" });
  }
  if (sees("mentor-bookings")) {
    add({ key: "refunds", tone: "danger", count: await num(db("mentor_bookings").where({ ownerAdminId: owner, refundStatus: "due" })), label: "mentor booking refunds to give back", path: "/mentor-bookings?tab=refunds" });
    const owed = await db("mentor_bookings").where({ ownerAdminId: owner, mode: "hub", deskFeeOwner: "hub" }).whereIn("status", ["completed", "no_show"]).whereNull("settlementId").where("hubShare", ">", 0).countDistinct({ n: "hubId" }).first();
    add({ key: "hubsOwed", tone: "info", count: Number(owed?.n || 0), label: "partner hubs owed desk fees", path: "/mentor-bookings?tab=hubs" });
  }
  if (sees("teachers") && teacherIds.length) {
    const waiting = await db("teachers").whereIn("id", teacherIds).where({ profileOptIn: true }).select("profilePublic", "profileAbout", "profileAboutDraft");
    add({ key: "profiles", tone: "info", count: waiting.filter((t) => !t.profilePublic || (t.profileAboutDraft && JSON.stringify(t.profileAboutDraft) !== JSON.stringify(t.profileAbout))).length, label: "educator profiles waiting for you to publish", path: "/teachers" });
    add({ key: "inTraining", tone: "info", count: await num(db("teachers").whereIn("id", teacherIds).where({ status: "in_training" })), label: "educators still In training", path: "/learners?tab=tot" });
  }
  if (sees("checkins-manage")) {
    add({ key: "checkins", tone: "waiting", count: await num(db("checkin_sessions").where({ ownerAdminId: owner, status: "open" }).where("scheduledDate", "<", today)), label: "hub check-in reports overdue", path: "/checkins" });
  }
  out.todo = todo;

  // ── Today ───────────────────────────────────────────────────────────────────────────────
  const items = [];
  if (sees("timetable", "classes")) {
    const classes = await db("classes").whereIn("schoolId", ids).where({ status: "active" }).select("id", "gradeName", "streamName", "schoolId");
    const classById = new Map(classes.map((c) => [c.id, c]));
    const slots = classes.length ? await db("timetable_slots").whereIn("classId", classes.map((c) => c.id)).where({ dayOfWeek: weekday }).select("classId", "courseId", "teacherId", "startTime", "endTime") : [];
    // A session cancelled or moved off today is left out; one moved onto today is added.
    const classIds = classes.map((c) => c.id);
    const skips = classIds.length ? await db("timetable_session_skips").whereIn("classId", classIds).where((w) => w.where({ date: today }).orWhere({ newDate: today })).select("classId", "courseId", "date", "newDate", "mode", "startTime", "endTime") : [];
    const off = new Set(skips.filter((x) => String(x.date).slice(0, 10) === today).map((x) => `${x.classId}|${x.courseId || ""}`));
    const live = slots.filter((s) => !off.has(`${s.classId}|${s.courseId || ""}`) && !off.has(`${s.classId}|`));
    for (const x of skips.filter((y) => y.mode === "shift" && String(y.newDate || "").slice(0, 10) === today)) live.push({ classId: x.classId, courseId: x.courseId, startTime: x.startTime || null, endTime: x.endTime || null });
    const courses = new Map((live.length ? await db("courses").whereIn("id", [...new Set(live.map((s) => s.courseId).filter(Boolean))]).select("id", "name") : []).map((c) => [c.id, c.name]));
    for (const s of live) {
      const cls = classById.get(s.classId);
      items.push({ kind: "class", time: s.startTime, end: s.endTime, title: courses.get(s.courseId) || "Class", sub: [[cls?.gradeName, cls?.streamName].filter(Boolean).join(" "), hubName.get(cls?.schoolId)].filter(Boolean).join(" · "), path: `/classes/${s.classId}/view` });
    }
  }
  if (sees("mentor-bookings")) {
    for (const b of await db("mentor_bookings").where({ ownerAdminId: owner, date: today }).whereIn("status", ["confirmed", "completed", "no_show"]).select("id", "startTime", "endTime", "sessionTitle", "courseName", "mode", "hubName")) {
      items.push({ kind: "booking", time: b.startTime, end: b.endTime, title: `Mentor session · ${b.sessionTitle || b.courseName || "help"}`, sub: b.mode === "online" ? "Online" : b.hubName, path: `/mentor-bookings/${b.id}` });
    }
  }
  if (sees("checkins-manage")) {
    for (const c of await db("checkin_sessions").where({ ownerAdminId: owner, scheduledDate: today }).select("id", "hubId", "status")) {
      items.push({ kind: "checkin", time: null, title: `Hub check-in · ${hubName.get(c.hubId) || "hub"}`, sub: c.status === "reported" ? "Report in" : "Report to write", path: `/checkins/sessions/${c.id}` });
    }
  }
  if (sees("mentor-checkins")) {
    for (const m of await db("mentor_checkin_meetings").where({ ownerAdminId: owner, date: today }).whereIn("status", ["scheduled", "held"]).select("id", "startTime", "endTime")) {
      items.push({ kind: "meeting", time: m.startTime, end: m.endTime, title: "Parent–mentor check-in", sub: null, path: `/mentor-checkins/meetings/${m.id}` });
    }
  }
  if (sees("qa")) {
    const visits = await db("qa_visits").where({ ownerAdminId: owner, scheduledDate: today }).whereNot({ status: "cancelled" }).select("id", "teacherId", "hubId");
    const names = new Map((visits.length ? await db("teachers").whereIn("id", visits.map((v) => v.teacherId)).select("id", "firstName", "lastName") : []).map((t) => [t.id, [t.firstName, t.lastName].filter(Boolean).join(" ")]));
    for (const v of visits) items.push({ kind: "qa", time: null, title: `QA visit · ${names.get(v.teacherId) || "educator"}`, sub: hubName.get(v.hubId) || null, path: `/qa/visits/${v.id}` });
  }
  if (sees("bootcamps")) {
    for (const b of await db("bootcamps").where({ ownerAdminId: owner }).where("startDate", "<=", today).where("endDate", ">=", today).select("id", "name")) {
      items.push({ kind: "bootcamp", time: null, title: `Bootcamp running · ${b.name}`, sub: null, path: `/bootcamps/${b.id}/view` });
    }
  }
  out.today = items.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));

  // ── Programmes ──────────────────────────────────────────────────────────────────────────
  const programmes = [];
  if (sees("home-learning")) programmes.push({ key: "home-learning", label: "Home Learning", value: await num(db("home_learning_households").where({ ownerAdminId: owner, status: "active" })), unit: "families", sub: `${await num(db("home_learning_households").where({ ownerAdminId: owner, status: "pending" }))} waiting to start`, path: "/home-learning" });
  if (sees("tech-clubs")) programmes.push({ key: "tech-clubs", label: "Tech Clubs", value: await num(db("club_memberships").where({ ownerAdminId: owner, status: "active" })), unit: "memberships", sub: `${await num(db("club_memberships").where({ ownerAdminId: owner, status: "pending" }))} waiting to start`, path: "/tech-clubs" });
  if (sees("pathway-subscriptions")) programmes.push({ key: "pathways", label: "Pathway subscriptions", value: await num(db("pathway_subscriptions").where({ ownerAdminId: owner, status: "active" })), unit: "active", sub: `${await num(db("pathway_subscriptions").where({ ownerAdminId: owner, status: "paused" }))} paused`, path: "/pathway-subscriptions" });
  if (sees("bootcamps")) {
    const upcoming = await db("bootcamps").where({ ownerAdminId: owner }).where("startDate", ">", today).orderBy("startDate", "asc").select("id", "name", "startDate");
    const next = upcoming[0];
    const signedUp = next ? await num(db("leads").where({ bootcampId: next.id })) : 0;
    programmes.push({ key: "bootcamps", label: "Bootcamps coming up", value: upcoming.length, unit: upcoming.length === 1 ? "bootcamp" : "bootcamps", sub: next ? `Next: ${next.name} · ${String(next.startDate).slice(0, 10)} · ${signedUp} signed up` : "None scheduled", path: next ? `/bootcamps/${next.id}/view` : "/events" });
  }
  if (sees("mentor-bookings")) {
    const weekEnd = dayKey(new Date(k.getTime() + 7 * 86400000));
    programmes.push({ key: "bookings", label: "Mentor sessions", value: await num(db("mentor_bookings").where({ ownerAdminId: owner, status: "confirmed" }).whereBetween("date", [today, weekEnd])), unit: "this week", sub: `${await num(db("mentor_bookings").where({ ownerAdminId: owner, status: "held" }))} waiting for payment`, path: "/mentor-bookings" });
  }
  out.programmes = programmes;

  // ── Getting started (only while something is missing) ───────────────────────────────────
  if (!isStaff) {
    const steps = [
      { key: "curriculum", label: "Create a curriculum", done: (out.counts.curricula || 0) > 0, path: "/curriculum/create" },
      { key: "course", label: "Add a course", done: (out.counts.courses || 0) > 0, path: "/courses" },
      { key: "hub", label: "Add a learning hub", done: hubs.some((h) => !h.isHomeLearning), path: "/settings/learning-hubs/create" },
      { key: "educator", label: "Add an educator", done: teacherIds.length > 0, path: "/teachers" },
      { key: "class", label: "Create a class", done: (out.counts.classes || 0) > 0, path: "/classes" },
      { key: "learner", label: "Enrol a learner", done: activeLearnerIds.length > 0, path: "/learners" },
    ];
    out.setup = steps.every((s) => s.done) ? null : steps;
  }

  out.sees = {
    reports: sees("reports"), activity: sees("activity"), billing: sees("billing"),
  };
  return out;
}

module.exports = { summary };
