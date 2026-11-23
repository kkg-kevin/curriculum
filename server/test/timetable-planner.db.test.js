// The Timetable Planner end to end, on a throwaway database:
//
//   TEST_DB_NAME=digifunzi_nfr_test npm test
//
// Same set-up as removals.db.test.js: the name must end in "_test", the database is created if
// missing and migrated, the rows added are removed at the end, and email is off for the run.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const TEST_DB = process.env.TEST_DB_NAME;
const enabled = Boolean(TEST_DB);

if (enabled) {
  if (!/_test$/.test(TEST_DB)) throw new Error("TEST_DB_NAME must end in _test");
  process.env.BREVO_API_KEY = "";
  process.env.SMTP_HOST = "";
  process.env.MAIL_FROM = "";
  require("dotenv").config({ quiet: true });
  process.env.DB_NAME = TEST_DB;
}

test("timetable planner: dates stay safe, hubs copy, conflicts are named", { skip: !enabled && "set TEST_DB_NAME to run" }, async (t) => {
  const knex = require("knex");
  const knexConfig = require("../knexfile");
  const admin = knex({ ...knexConfig, connection: { ...knexConfig.connection, database: undefined } });
  await admin.raw("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4", [TEST_DB]);
  await admin.destroy();

  const env = require("../src/config/env");
  assert.ok(!env.BREVO_API_KEY && !env.SMTP_HOST, "email must be off for this run");
  const db = require("../src/config/db");
  await db.migrate.latest();

  const TimetableService = require("../src/modules/timetable/timetable.service");
  const Planner = require("../src/modules/timetable/timetable-planner.service");
  const Notifications = require("../src/modules/timetable/timetable.notifications");
  const A = require("../src/modules/mentor-bookings/availability.rules");
  const { todayInKenya, addDays } = require("../src/modules/checkins/checkin.dates");

  const id = () => crypto.randomUUID();
  const tag = crypto.randomBytes(3).toString("hex");
  const now = new Date();
  const made = {};
  const insert = async (table, row) => {
    const full = { id: id(), createdAt: now, ...row };
    await db(table).insert(full);
    (made[table] = made[table] || []).push(full.id);
    return full;
  };
  const emails = [];
  const login = async (role, name) => {
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${tag}@planner.test`;
    emails.push(email);
    return insert("users", { name, email, passwordHash: "x", role });
  };

  t.after(async () => {
    const classIds = made.classes || [];
    await db("timetable_slot_versions").whereIn("classId", classIds).del();
    await db("timetable_course_schedules").whereIn("classId", classIds).del();
    await db("timetable_slots").whereIn("classId", classIds).del();
    await db("class_course_teacher_links").whereIn("classId", classIds).del();
    for (const table of ["teacher_availability_slots", "attendance", "learner_hub_links", "learners", "course_sessions", "classes", "courses", "curriculum_versions", "curricula", "teacher_hub_links", "teachers", "rooms", "learning_hubs"]) {
      if (made[table]?.length) await db(table).whereIn("id", made[table]).del();
    }
    await db("notifications").whereIn("recipientId", made.users || []).del();
    await db("email_outbox").whereIn("toEmail", emails).del();
    await db("users").whereIn("id", made.users || []).del();
    await db.destroy();
  });

  const owner = await login("admin", "Planner Owner");
  const otherOwner = await login("admin", "Other Owner");
  const req = { user: { id: owner.id, role: "admin" }, ownerAdminId: owner.id };
  const hubA = await insert("learning_hubs", { name: `Alpha ${tag}`, ownerAdminId: owner.id, status: "active" });
  const hubB = await insert("learning_hubs", { name: `Beta ${tag}`, ownerAdminId: owner.id, status: "active" });
  const hubElse = await insert("learning_hubs", { name: `Else ${tag}`, ownerAdminId: otherOwner.id, status: "active" });
  const curriculum = await insert("curricula", { name: "Curr", code: `P${tag}`, ownerAdminId: owner.id });
  const course = await insert("courses", { name: "Python", ownerAdminId: owner.id });
  const other = await insert("courses", { name: "Robotics", ownerAdminId: owner.id });
  for (const c of [course, other]) for (let order = 1; order <= 12; order += 1) await insert("course_sessions", { courseId: c.id, order, title: `${c.name} ${order}` });
  await insert("curriculum_versions", {
    curriculumId: curriculum.id, versionNumber: 1, isCurrent: true, status: "published",
    content: JSON.stringify([{ periodName: "Term", classes: [{ classId: "g5", className: "Grade 5", courses: [{ id: course.id }, { id: other.id }] }] }]),
  });
  const newClass = (hub, stream, gradeId = "g5") => insert("classes", { schoolId: hub.id, curriculumId: curriculum.id, gradeId, gradeName: "Grade 5", streamName: `${stream}`, academicYear: "2026", status: "active" });
  const classA = await newClass(hubA, "East");
  const classB = await newClass(hubB, "West");
  const classC = await newClass(hubB, "North");
  const classOtherGrade = await newClass(hubB, "Other", "g9");
  const foreign = await newClass(hubElse, "Foreign");
  const educator = async (name) => {
    const l = await login("teacher", `${name} Educator`);
    const row = await insert("teachers", { firstName: name, lastName: "Educator", email: l.email, status: "active", createdByAdminId: owner.id });
    await insert("teacher_hub_links", { teacherId: row.id, hubId: hubA.id });
    await insert("teacher_hub_links", { teacherId: row.id, hubId: hubB.id });
    return { ...row, login: l };
  };
  const amina = await educator("Amina");
  const brian = await educator("Brian");
  const parent = await login("learner", "Planner Parent");
  const learner = await insert("learners", { firstName: "Zuri", lastName: "One", guardianName: "Planner Parent", guardianPhone: "0700000000", guardianEmail: parent.email, accountStatus: "active" });
  await insert("learner_hub_links", { learnerId: learner.id, hubId: hubA.id, classId: classA.id, status: "active" });
  const room = await insert("rooms", { hubId: hubA.id, name: `Lab ${tag}`, status: "active" });

  const today = todayInKenya();
  const lastMonday = addDays(A.mondayOf(today), -14);
  const nextMonday = addDays(A.mondayOf(today), 7);
  const lesson = (over = {}) => ({ classId: classA.id, courseId: course.id, teacherId: amina.id, roomId: null, days: ["monday"], startTime: "09:00", endTime: "10:00", ...over });

  let mondaySlot;
  await t.test("setting a class up in one step: educator, days and start date together", async () => {
    let view = await Planner.overview(req);
    assert.equal(view.classes.find((c) => c.id === classA.id).status, "not_set");
    assert.ok(!view.classes.some((c) => c.id === foreign.id), "another workspace's classes never appear");
    const check = await Planner.check(req, lesson({ days: ["monday", "saturday"], startDate: lastMonday }));
    assert.equal(check.canSave, true);
    assert.equal(check.placement.sessions, 12);
    assert.equal(check.placement.first, lastMonday);
    const saved = await Planner.saveLessons(req, lesson({ days: ["monday", "saturday"], startDate: lastMonday }));
    assert.equal(saved.created, 2);
    view = await Planner.overview(req);
    const row = view.classes.find((c) => c.id === classA.id);
    assert.equal(row.status, "ready");
    assert.deepEqual(row.lessons.map((l) => l.dayOfWeek), ["monday", "saturday"], "weekends are allowed");
    assert.equal(row.lessons[0].educatorName, "Amina Educator");
    assert.ok(await db("class_course_teacher_links").where({ classId: classA.id, courseId: course.id, teacherId: amina.id }).first());
    mondaySlot = row.lessons[0];
  });

  await t.test("a Saturday session is on the real calendar, with names on it", async () => {
    const { events } = await TimetableService.resolveCalendar({ classId: classA.id, from: lastMonday, to: addDays(lastMonday, 5) });
    const saturday = events.find((e) => e.dayOfWeek === "saturday");
    assert.ok(saturday);
    assert.equal(saturday.courseName, "Python");
    assert.equal(saturday.hubName, hubA.name);
    assert.equal(saturday.className, "Grade 5 — East");
  });

  await t.test("the same course twice on one day is refused, and an end before a start", async () => {
    await assert.rejects(TimetableService.createSlot({ classId: classA.id, courseId: course.id, dayOfWeek: "monday", startTime: "15:00", endTime: "16:00" }), /already has a time on Monday/);
    await assert.rejects(TimetableService.updateSlot(mondaySlot.id, { endTime: "08:00" }), /after start/);
  });

  await t.test("changing a lesson keeps past sessions where they happened", async () => {
    const before = await TimetableService.resolveCalendar({ classId: classA.id, from: lastMonday, to: addDays(lastMonday, 7) });
    const pastMonday = before.events.find((e) => e.date === lastMonday);
    assert.equal(pastMonday.startTime, "09:00");
    await TimetableService.updateSlot(mondaySlot.id, { dayOfWeek: "tuesday", startTime: "14:00", endTime: "15:00" }, { applyFrom: nextMonday, changedBy: owner.id });
    const after = await TimetableService.resolveCalendar({ classId: classA.id, from: lastMonday, to: addDays(nextMonday, 7) });
    const same = after.events.find((e) => e.date === lastMonday);
    assert.equal(same?.startTime, "09:00", "the past Monday session hasn't moved");
    assert.equal(same.sessionId, pastMonday.sessionId);
    assert.ok(!after.events.some((e) => e.dayOfWeek === "monday" && e.date >= nextMonday), "no Monday lesson from the change");
    assert.ok(after.events.some((e) => e.dayOfWeek === "tuesday" && e.date >= nextMonday && e.startTime === "14:00"));
    const version = await db("timetable_slot_versions").where({ slotId: mondaySlot.id }).first();
    assert.equal(String(version.validTo).slice(0, 10), addDays(nextMonday, -1));
    assert.equal((await db("timetable_slots").where({ id: mondaySlot.id }).first()).dayOfWeek, "tuesday");
  });

  await t.test("the old time stays taken until the change starts", async () => {
    const clash = await TimetableService.findClashes({ classId: classB.id, courseId: other.id, teacherId: amina.id, dayOfWeek: "monday", startTime: "09:00", endTime: "10:00" });
    assert.equal(clash.teacherClashes.length, 1, "Amina still teaches Monday 9 until the change");
    const later = await TimetableService.findClashes({ classId: classB.id, courseId: other.id, teacherId: amina.id, dayOfWeek: "monday", startTime: "09:00", endTime: "10:00", validFrom: nextMonday });
    assert.equal(later.teacherClashes.length, 0, "and is free from then");
  });

  await t.test("families and educators hear about a change of day or time, once", async () => {
    const change = { before: { ...mondaySlot, classId: classA.id, courseId: course.id, teacherId: null, id: mondaySlot.id }, after: { dayOfWeek: "tuesday", startTime: "14:00", endTime: "15:00" }, from: nextMonday };
    await Notifications.lessonChanged(change);
    await Notifications.lessonChanged(change);
    const parentNotes = await db("notifications").where({ recipientId: parent.id, type: "timetable_changed" });
    const educatorNotes = await db("notifications").where({ recipientId: amina.login.id, type: "timetable_changed" });
    assert.equal(parentNotes.length, 1);
    assert.equal(educatorNotes.length, 1);
    assert.match(parentNotes[0].message, /moves from Monday 9:00 AM to Tuesday 2:00 PM/);
  });

  await t.test("the check names what blocks a lesson and warns about travel", async () => {
    await db("class_course_teacher_links").insert({ id: id(), classId: classB.id, courseId: other.id, teacherId: amina.id, isPrimary: true, createdAt: now });
    await db("teacher_availability_slots").insert({ id: id(), teacherId: amina.id, dayOfWeek: "friday", startTime: "08:00", endTime: "09:00", createdAt: now, updatedAt: now });
    const busy = await Planner.check(req, { classId: classB.id, courseId: other.id, teacherId: amina.id, days: ["saturday"], startTime: "09:30", endTime: "10:30" });
    assert.equal(busy.canSave, false);
    assert.match(busy.blocks[0].message, /Amina Educator is teaching Grade 5 — East at Alpha/);
    const close = await Planner.check(req, { classId: classB.id, courseId: other.id, teacherId: amina.id, days: ["saturday"], startTime: "10:15", endTime: "11:00" });
    assert.equal(close.canSave, true);
    assert.ok(close.warnings.some((w) => w.type === "travel" && /15 minutes/.test(w.message)), "under 30 minutes between hubs");
    assert.ok(close.warnings.some((w) => w.type === "outside_hours"), "outside stated hours warns, never blocks");
    await db("teacher_availability_slots").where({ teacherId: amina.id }).del();
    await db("class_course_teacher_links").where({ classId: classB.id, courseId: other.id }).del();
  });

  await t.test("copying across hubs: only classes that are ready", async () => {
    await db("class_course_teacher_links").insert({ id: id(), classId: classB.id, courseId: course.id, teacherId: brian.id, isPrimary: true, createdAt: now });
    const preview = await Planner.copyPreview(req, { fromClassId: classA.id, toClassIds: [classB.id, classC.id, classOtherGrade.id, foreign.id] });
    const byClass = new Map(preview.rows.map((r) => [r.classId, r]));
    assert.equal(byClass.get(classB.id).status, "ready");
    assert.equal(byClass.get(classC.id).status, "missing_educator");
    assert.equal(byClass.get(classOtherGrade.id).status, "missing_course");
    assert.ok(!byClass.has(foreign.id), "another workspace's class is never a target");
    const out = await Planner.copyApply(req, { fromClassId: classA.id, toClassIds: [classB.id, classC.id, classOtherGrade.id], withDates: true });
    assert.equal(out.copied, 1);
    assert.equal(await db("timetable_slots").where({ classId: classC.id }).count({ n: "*" }).first().then((r) => Number(r.n)), 0, "a class that wasn't ready is left alone");
    const copied = await db("timetable_slots").where({ classId: classB.id });
    assert.equal(copied.length, 2);
    assert.ok(copied.every((s) => s.teacherId === null && s.roomId === null), "follows the class's own educator; rooms stay with their hub");
    assert.equal(await db("timetable_course_schedules").where({ classId: classB.id, courseId: course.id }).first(), undefined, "a start date already past isn't copied: those sessions never happened here");
    assert.equal(out.results.find((r) => r.classId === classB.id).datesLeft, 1);
    const again = await Planner.copyPreview(req, { fromClassId: classA.id, toClassIds: [classB.id] });
    assert.equal(again.rows[0].status, "already_set");
  });

  await t.test("removing a lesson from a date keeps what already ran", async () => {
    const saturday = (await db("timetable_slots").where({ classId: classA.id, dayOfWeek: "saturday" }).first());
    const firstSaturday = addDays(lastMonday, 5);
    await TimetableService.deleteSlot(saturday.id, { applyFrom: nextMonday, changedBy: owner.id });
    const { events } = await TimetableService.resolveCalendar({ classId: classA.id, from: firstSaturday, to: addDays(nextMonday, 14) });
    assert.ok(events.some((e) => e.date === firstSaturday), "the Saturday that already happened is still there");
    assert.ok(!events.some((e) => e.dayOfWeek === "saturday" && e.date >= nextMonday), "none from the change");
  });

  await t.test("adding a lesson to a running course leaves its past sessions alone", async () => {
    const yesterday = addDays(today, -1);
    const key = (e) => `${e.date}|${e.sessionId}|${e.startTime}`;
    const before = (await TimetableService.resolveCalendar({ classId: classA.id, from: lastMonday, to: yesterday })).events.filter((e) => e.courseId === course.id).map(key);
    assert.ok(before.length > 0);
    const check = await Planner.check(req, lesson({ days: ["wednesday"], startTime: "13:00", endTime: "14:00", teacherId: null }));
    assert.equal(check.placement.continuing, true);
    assert.ok(check.placement.first > today, "the preview starts from the change, not Session 1");
    assert.ok(check.placement.sessions < 12, "only the sessions left");
    await Planner.saveLessons(req, lesson({ days: ["wednesday"], startTime: "13:00", endTime: "14:00", teacherId: null }));
    const after = (await TimetableService.resolveCalendar({ classId: classA.id, from: lastMonday, to: yesterday })).events.filter((e) => e.courseId === course.id).map(key);
    assert.deepEqual(after, before);
    const slot = await db("timetable_slots").where({ classId: classA.id, courseId: course.id, dayOfWeek: "wednesday" }).first();
    assert.equal(String(slot.validFrom).slice(0, 10), addDays(today, 1));
  });

  await t.test("a room clash is named, and a hub login sees only its own hub", async () => {
    await TimetableService.createSlot({ classId: classC.id, courseId: other.id, roomId: room.id, teacherId: null, dayOfWeek: "friday", startTime: "11:00", endTime: "12:00" });
    const check = await Planner.check(req, { classId: classA.id, courseId: other.id, teacherId: null, roomId: room.id, days: ["friday"], startTime: "11:30", endTime: "12:30" });
    assert.ok(check.blocks.some((b) => b.type === "room" && /Grade 5 — North at Beta/.test(b.message)));
    const hubReq = { user: { id: owner.id, role: "school" }, ownSchool: hubB };
    const view = await Planner.overview(hubReq);
    assert.deepEqual([...new Set(view.classes.map((c) => c.hubId))], [hubB.id]);
    await assert.rejects(Planner.check(hubReq, lesson()), /Class not found/);
    await assert.rejects(Planner.overview(hubReq, { hubId: hubA.id }), /Hub not found/);
  });
});
