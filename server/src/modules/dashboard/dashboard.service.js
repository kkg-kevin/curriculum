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
  // Every class meeting today, by the calendar engine itself (term breaks, a course's start date,
  // sessions shifted, merged or moved — TimetableService.resolveCalendar), with who teaches it,
  // which session it is, the room, how many learners and whether attendance is in. Feeds the
  // "Today across your hubs" widget (out.day) — the Today card keeps everything else.
  out.day = null;
  if (sees("timetable", "classes")) {
    const TimetableService = require("../timetable/timetable.service");
    const classes = await db("classes").whereIn("schoolId", ids).where({ status: "active" }).select("id", "gradeName", "streamName", "schoolId", "meetingLink");
    const classById = new Map(classes.map((c) => [c.id, c]));
    const classIds = classes.map((c) => c.id);
    // Only classes that could meet today: a slot on this weekday, or a session moved onto today.
    const candidates = classIds.length ? [...new Set([
      ...(await db("timetable_slots").whereIn("classId", classIds).where({ dayOfWeek: weekday }).pluck("classId")),
      ...(await db("timetable_session_skips").whereIn("classId", classIds).where({ mode: "move", newDate: today }).pluck("classId")),
    ])] : [];
    const rawEvents = (await Promise.all(candidates.map((classId) => TimetableService.resolveCalendar({ classId, from: today, to: today })
      .then((r) => r.events.filter((e) => e.date === today))
      .catch(() => [])))).flat();
    // Two sessions taught in one slot (a "merge") come as two events — one class, two sessions.
    const grouped = new Map();
    for (const e of rawEvents) {
      const key = `${e.classId}|${e.courseId}|${e.startTime}`;
      const g = grouped.get(key) || { ...e, sessions: [] };
      if (e.sessionTitle || e.sessionOrder != null) g.sessions.push({ order: e.sessionOrder, title: e.sessionTitle || null });
      grouped.set(key, g);
    }
    const events = [...grouped.values()];
    const hubRows = new Map((await db("learning_hubs").whereIn("id", ids).select("id", "name", "deliveryMode", "meetingLink", "isHomeLearning")).map((h) => [h.id, h]));
    const courseIds = [...new Set(events.map((e) => e.courseId).filter(Boolean))];
    const courseName = new Map((courseIds.length ? await db("courses").whereIn("id", courseIds).select("id", "name") : []).map((c) => [c.id, c.name]));
    const eventClassIds = [...new Set(events.map((e) => e.classId))];
    const links = eventClassIds.length ? await db("class_course_teacher_links").whereIn("classId", eventClassIds).select("classId", "courseId", "teacherId", "isPrimary") : [];
    const teacherIdsToday = [...new Set([...events.map((e) => e.teacherId), ...links.map((l) => l.teacherId)].filter(Boolean))];
    const teacherRow = new Map((teacherIdsToday.length ? await db("teachers").whereIn("id", teacherIdsToday).select("id", "firstName", "lastName", "photo") : []).map((t) => [t.id, t]));
    const person = (id) => { const t = teacherRow.get(id); return t ? { id, name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || "Educator", photo: t.photo || null } : null; };
    const learnersIn = new Map((eventClassIds.length ? await db("learner_hub_links").whereIn("classId", eventClassIds).where({ status: "active" }).select("classId").count({ n: "*" }).groupBy("classId") : []).map((r) => [r.classId, Number(r.n)]));
    const marks = eventClassIds.length ? await db("attendance").whereIn("classId", eventClassIds).where({ date: today }).select("classId", "status") : [];
    const marked = new Map();
    for (const m of marks) {
      const x = marked.get(m.classId) || { marked: 0, present: 0 };
      x.marked += 1;
      if (m.status === "present" || m.status === "late") x.present += 1;
      marked.set(m.classId, x);
    }
    const dayClasses = events.map((e) => {
      const cls = classById.get(e.classId);
      const hub = hubRows.get(cls?.schoolId);
      // Who teaches it: the slot's educator, else the course's educators on that class (main first).
      const ids2 = e.teacherId ? [e.teacherId] : links.filter((l) => l.classId === e.classId && l.courseId === e.courseId).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((l) => l.teacherId);
      return {
        key: `${e.classId}|${e.courseId}|${e.startTime}`,
        classId: e.classId, courseId: e.courseId,
        className: [cls?.gradeName, cls?.streamName].filter(Boolean).join(" ") || "Class",
        courseName: courseName.get(e.courseId) || "Course",
        sessions: e.sessions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        startTime: String(e.startTime || "").slice(0, 5) || null, endTime: String(e.endTime || "").slice(0, 5) || null,
        room: e.room || null, moved: !!e.moved, merged: !!e.merged,
        hubId: cls?.schoolId || null, hubName: hub ? (hub.isHomeLearning ? "Home Learning" : hub.name) : null,
        // virtual hub: online only; hybrid: in person, and online too.
        online: hub?.deliveryMode === "virtual" ? "only" : hub?.deliveryMode === "hybrid" || e.meetingLink ? "also" : null,
        educators: [...new Set(ids2)].map(person).filter(Boolean),
        learners: learnersIn.get(e.classId) || 0,
        attendance: marked.get(e.classId) || null,
      };
    }).sort((a, b) => String(a.startTime || "99").localeCompare(String(b.startTime || "99")) || String(a.hubName).localeCompare(String(b.hubName)));
    // Who's where: each educator's stops today — their classes, mentor sessions and QA visits.
    const people = new Map();
    const stop = (p, s) => {
      if (!p) return;
      const row = people.get(p.id) || { ...p, stops: [] };
      row.stops.push(s);
      people.set(p.id, row);
    };
    for (const c of dayClasses) for (const p of c.educators) stop(p, { kind: "class", time: c.startTime, end: c.endTime, title: `${c.courseName} · ${c.className}`, hubName: c.online === "only" ? `${c.hubName || ""}${c.hubName ? " · " : ""}online` : c.hubName, room: c.room, path: `/classes/${c.classId}/view` });
    if (sees("mentor-bookings")) {
      const bookings = await db("mentor_bookings").where({ ownerAdminId: owner, date: today }).whereIn("status", ["confirmed", "completed", "no_show"]).select("id", "teacherId", "startTime", "endTime", "courseName", "sessionTitle", "mode", "hubName");
      const extra = bookings.map((b) => b.teacherId).filter((id) => id && !teacherRow.has(id));
      if (extra.length) (await db("teachers").whereIn("id", [...new Set(extra)]).select("id", "firstName", "lastName", "photo")).forEach((t) => teacherRow.set(t.id, t));
      for (const b of bookings) stop(person(b.teacherId), { kind: "booking", time: String(b.startTime).slice(0, 5), end: String(b.endTime).slice(0, 5), title: `Mentor session · ${b.sessionTitle || b.courseName || "help"}`, hubName: b.mode === "online" ? "Online" : b.hubName, path: `/mentor-bookings/${b.id}` });
    }
    if (sees("qa")) {
      const visits = await db("qa_visits").where({ ownerAdminId: owner, scheduledDate: today }).whereNot({ status: "cancelled" }).select("id", "teacherId", "hubId", "visitType");
      const extra = visits.map((v) => v.teacherId).filter((id) => id && !teacherRow.has(id));
      if (extra.length) (await db("teachers").whereIn("id", [...new Set(extra)]).select("id", "firstName", "lastName", "photo")).forEach((t) => teacherRow.set(t.id, t));
      for (const v of visits) stop(person(v.teacherId), { kind: "qa", time: null, end: null, title: `QA visit${v.visitType === "surprise" ? " (surprise)" : ""}`, hubName: hubName.get(v.hubId) || null, path: `/qa/visits/${v.id}` });
    }
    const peopleList = [...people.values()].map((p) => ({ ...p, stops: p.stops.sort((a, b) => String(a.time || "99").localeCompare(String(b.time || "99"))) }))
      .sort((a, b) => String(a.stops[0]?.time || "99").localeCompare(String(b.stops[0]?.time || "99")) || a.name.localeCompare(b.name));
    out.day = { date: today, classes: dayClasses, people: peopleList };
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
  if (sees("general-events")) {
    const events = await db("general_events").where({ ownerAdminId: owner, status: "published" }).where("startDate", "<=", today)
      .where((w) => w.where("endDate", ">=", today).orWhere((x) => x.whereNull("endDate").where("startDate", today))).select("id", "title", "startTime", "endTime", "capacity");
    for (const e of events) {
      const coming = Number((await db("general_event_registrations").where({ eventId: e.id, status: "registered" }).sum({ n: "partySize" }).first())?.n || 0);
      items.push({ kind: "event", time: e.startTime, end: e.endTime, title: e.title, sub: `${coming} ${coming === 1 ? "person" : "people"} coming${e.capacity ? ` of ${e.capacity}` : ""}`, path: `/events/general/${e.id}?tab=checkin` });
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
