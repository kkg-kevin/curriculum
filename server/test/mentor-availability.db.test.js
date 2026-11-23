// A mentor's availability against the real timetable, end to end, on a throwaway database:
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

test("availability: the class timetable always wins", { skip: !enabled && "set TEST_DB_NAME to run" }, async (t) => {
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
  const Bookings = require("../src/modules/mentor-bookings/mentor-booking.service");
  const Clashes = require("../src/modules/mentor-bookings/mentor-booking.clashes");
  const EducatorBusy = require("../src/modules/mentor-bookings/educator-busy");
  const Availability = require("../src/modules/teachers/teacher-availability.service");
  const CheckinService = require("../src/modules/mentor-checkins/mentor-checkin.service");
  const BillingService = require("../src/modules/billing/billing.service");
  const A = require("../src/modules/mentor-bookings/availability.rules");
  const R = require("../src/modules/mentor-bookings/mentor-booking.rules");
  const { addDays } = require("../src/modules/checkins/checkin.dates");

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
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${tag}@availability.test`;
    emails.push(email);
    return insert("users", { name, email, passwordHash: "x", role });
  };

  t.after(async () => {
    const learnerIds = made.learners || [];
    const invoiceIds = learnerIds.length ? await db("billing_invoices").whereIn("learnerId", learnerIds).pluck("id") : [];
    if (invoiceIds.length) {
      for (const table of ["billing_payments", "billing_invoice_items", "billing_audit_events", "billing_receipts"]) {
        if (await db.schema.hasTable(table)) await db(table).whereIn("invoiceId", invoiceIds).del();
      }
      await db("billing_invoices").whereIn("id", invoiceIds).del();
    }
    await db("mentor_bookings").whereIn("learnerId", learnerIds).del();
    await db("teacher_availability_slots").whereIn("teacherId", made.teachers || []).del();
    await db("timetable_course_schedules").whereIn("classId", made.classes || []).del();
    await db("timetable_slots").whereIn("classId", made.classes || []).del();
    for (const table of ["session_covers", "class_course_teacher_links", "course_sessions", "learner_hub_links", "learners", "classes", "courses", "curricula", "teacher_hub_links", "teachers", "claim_settings", "learning_hubs"]) {
      if (made[table]?.length) await db(table).whereIn("id", made[table]).del();
    }
    await db("notifications").whereIn("recipientId", made.users || []).del();
    await db("email_outbox").whereIn("toEmail", emails).del();
    await db("users").whereIn("id", made.users || []).del();
    await db.destroy();
  });

  // ---- A workspace, a mentor who offers Monday 15:00–19:00, a family ----
  const owner = await login("admin", "Owner");
  const hub = await insert("learning_hubs", { name: `Hub ${tag}`, ownerAdminId: owner.id, status: "active" });
  const curriculum = await insert("curricula", { name: "Curr", code: `A${tag}`, ownerAdminId: owner.id });
  await insert("claim_settings", {
    ownerAdminId: owner.id,
    mentorBookings: JSON.stringify({ enabled: true, lengths: [{ minutes: 60, price: 1000, educatorPay: 600 }], noticeHours: 1, holdMinutes: 120, cancelHours: 24, horizonDays: 60 }),
  });
  const mentorLogin = await login("teacher", "Mentor One");
  const mentor = await insert("teachers", { firstName: "Mentor", lastName: "One", email: mentorLogin.email, status: "active", createdByAdminId: owner.id, profilePublic: true });
  await insert("teacher_hub_links", { teacherId: mentor.id, hubId: hub.id });
  const otherLogin = await login("teacher", "Cover Two");
  const other = await insert("teachers", { firstName: "Cover", lastName: "Two", email: otherLogin.email, status: "active", createdByAdminId: owner.id });
  await insert("teacher_hub_links", { teacherId: other.id, hubId: hub.id });
  const parent = await login("learner", "Parent One");
  const learner = await insert("learners", { firstName: "Amani", lastName: "One", guardianName: "Parent One", guardianPhone: "0700000000", guardianEmail: parent.email, accountStatus: "active" });
  await insert("learner_hub_links", { learnerId: learner.id, hubId: hub.id, status: "active" });
  const parentReq = { user: { id: parent.id, role: "learner", email: parent.email }, ownLearners: [learner] };
  const adminReq = { user: { id: owner.id, role: "admin" }, ownerAdminId: owner.id };

  const today = R.kenyaNow().date;
  const D = addDays(A.mondayOf(today), 14); // a Monday at least a week away
  await Availability.replace(mentor.id, [{ dayOfWeek: "monday", startTime: "15:00", endTime: "19:00" }]);

  const classWith = async (name, sessions) => {
    const course = await insert("courses", { name, ownerAdminId: owner.id });
    const sessionRows = [];
    for (let order = 1; order <= sessions; order += 1) sessionRows.push(await insert("course_sessions", { courseId: course.id, order, title: `${name} ${order}` }));
    const cls = await insert("classes", { schoolId: hub.id, curriculumId: curriculum.id, gradeId: `g-${name}`, gradeName: name, streamName: tag, academicYear: "2026" });
    await insert("class_course_teacher_links", { classId: cls.id, courseId: course.id, teacherId: mentor.id, isPrimary: true });
    return { course, cls, sessions: sessionRows };
  };
  const freeOn = async (date) => (await Bookings.freeTimes(parentReq, { learnerId: learner.id, teacherId: mentor.id, minutes: 60, from: date, to: date })).slots.map((s) => s.startTime);
  const bookAndPay = async (date, startTime) => {
    const { booking, invoiceId } = await Bookings.book(parentReq, { learnerId: learner.id, teacherId: mentor.id, minutes: 60, date, startTime, mode: "online", topic: "Loops" });
    await BillingService.applyPayment(invoiceId, { amount: 1000, provider: "manual", paymentMethod: "cash", recordedBy: owner.id, idempotencyKey: `test:${booking.id}` });
    return db("mentor_bookings").where({ id: booking.id }).first();
  };
  const stateOf = async (bookingId) => (await Bookings.get(parentReq, bookingId)).state;

  let first; // Class One: Monday 15:00, naming nobody, two sessions from D.
  await t.test("a class outside the mentor's hours can still be saved, with only a warning", async () => {
    const { cls, course } = await classWith("Tuesday", 2);
    const slot = await TimetableService.createSlot({ classId: cls.id, courseId: course.id, teacherId: mentor.id, dayOfWeek: "tuesday", startTime: "09:00", endTime: "10:00" });
    assert.ok(slot.id);
    assert.deepEqual(await TimetableService.getOutsideHoursTeacherIds([mentor.id], { dayOfWeek: "tuesday", startTime: "09:00", endTime: "10:00" }), [mentor.id]);
    assert.deepEqual(await TimetableService.getOutsideHoursTeacherIds([mentor.id], { dayOfWeek: "monday", startTime: "16:00", endTime: "17:00" }), []);
    // No start date yet: it still counts every week.
    const busy = await EducatorBusy.classTimes(mentor.id, addDays(D, 1), addDays(D, 1));
    assert.equal(busy.length, 1);
    assert.equal(busy[0].undated, true);
  });

  await t.test("a slot naming nobody on a course they teach blocks families, until the course ends", async () => {
    first = await classWith("Monday", 2);
    assert.ok((await freeOn(D)).includes("15:00"));
    await TimetableService.createSlot({ classId: first.cls.id, courseId: first.course.id, teacherId: null, dayOfWeek: "monday", startTime: "15:00", endTime: "16:00" });
    await TimetableService.setCourseSchedule(first.cls.id, first.course.id, D);
    assert.ok(!(await freeOn(D)).includes("15:00"), "a class that week");
    assert.ok((await freeOn(D)).includes("16:00"), "the rest of the hours stay open");
    assert.ok(!(await freeOn(addDays(D, 7))).includes("15:00"), "its second session");
    assert.ok((await freeOn(addDays(D, 14))).includes("15:00"), "the course has finished: the hours are back");
    const { dated } = await CheckinService._internal.busyFor([mentor.id], D, D);
    assert.ok(dated.some((b) => b.startTime === "15:00"), "parent check-ins see it too");
  });

  await t.test("the planner shows the class over the hours, without changing them", async () => {
    const week = await Availability.week(mentor.id, { from: D });
    const monday = week.days[0];
    assert.deepEqual(monday.offered, [{ startTime: "15:00", endTime: "19:00" }]);
    assert.deepEqual(monday.byClass, [{ startTime: "15:00", endTime: "16:00" }]);
    assert.deepEqual(monday.open, [{ startTime: "16:00", endTime: "19:00" }]);
    assert.equal(week.summary.openMinutes, 180);
    assert.equal(week.status.bookable, true);
    assert.ok(week.suggestions.length > 0);
    assert.equal(monday.items.find((i) => i.kind === "class").title, "Monday");
    const forHub = await Availability.week(mentor.id, { from: D, detail: false });
    assert.equal(forHub.days[0].items.find((i) => i.kind === "class").title, "Class", "a hub doesn't see what it is");
  });

  await t.test("a session someone else covers frees the time, and shows on the cover educator's", async () => {
    const cover = await insert("session_covers", {
      ownerAdminId: owner.id, hubId: hub.id, classId: first.cls.id, courseId: first.course.id, sessionId: first.sessions[0].id,
      date: D, startTime: "15:00", endTime: "16:00", originalTeacherId: mentor.id, coverTeacherId: other.id, status: "accepted",
    });
    assert.ok((await freeOn(D)).includes("15:00"));
    assert.ok((await EducatorBusy.classTimes(other.id, D, D)).some((c) => c.covering));
    await db("session_covers").where({ id: cover.id }).update({ status: "cancelled" });
    assert.ok(!(await freeOn(D)).includes("15:00"));
  });

  let flagged;
  let later;
  let classThree;
  let classThreeSlot;
  await t.test("a new class on a paid session: warned first, then the family is asked for a new time", async () => {
    flagged = await bookAndPay(D, "17:00");
    later = await bookAndPay(addDays(D, 7), "17:00");
    assert.equal(flagged.status, "confirmed");

    classThree = await classWith("Evening", 2);
    const preview = await Clashes.previewForSlot({ classId: classThree.cls.id, courseId: classThree.course.id, teacherIds: [mentor.id], dayOfWeek: "monday", startTime: "17:00", endTime: "18:00" });
    assert.equal(preview[0].count, 2);

    classThreeSlot = await TimetableService.createSlot({ classId: classThree.cls.id, courseId: classThree.course.id, teacherId: null, dayOfWeek: "monday", startTime: "17:00", endTime: "18:00" });
    await TimetableService.setCourseSchedule(classThree.cls.id, classThree.course.id, D);
    await Clashes.afterClassChange(classThree.cls.id);

    assert.equal(await stateOf(flagged.id), "needs_new_time");
    assert.equal(await stateOf(later.id), "needs_new_time");
    const view = await Bookings.get(parentReq, flagged.id);
    assert.equal(view.can.reschedule, true);
    assert.equal(view.can.mark, false);
    const notes = await db("notifications").where({ recipientId: parent.id, type: "mentor_booking_needs_new_time" });
    assert.equal(notes.length, 2);
    await Clashes.sweep({ teacherIds: [mentor.id] });
    assert.equal((await db("notifications").where({ recipientId: parent.id, type: "mentor_booking_needs_new_time" })).length, 2, "running it again tells nobody twice");
    assert.ok((await db("notifications").where({ recipientId: mentorLogin.id, type: "mentor_booking_hours_taken" })).length >= 1);
  });

  await t.test("the family moves it to a free time, with nothing more to pay", async () => {
    const { slots } = await Bookings.newTimes(parentReq, flagged.id);
    assert.ok(slots.some((s) => s.date === D && s.startTime === "18:00"));
    assert.ok(!slots.some((s) => s.date === D && s.startTime === "17:00"), "never onto the class");
    await assert.rejects(Bookings.reschedule(parentReq, flagged.id, { date: D, startTime: "17:00" }), /isn't free/);
    const invoicesBefore = (await db("billing_invoices").where({ learnerId: learner.id })).length;
    const moved = await Bookings.reschedule(parentReq, flagged.id, { date: D, startTime: "18:00" });
    assert.equal(moved.state, "confirmed");
    assert.equal(moved.startTime, "18:00");
    assert.equal((await db("billing_invoices").where({ learnerId: learner.id })).length, invoicesBefore);
    await assert.rejects(Bookings.reschedule(parentReq, flagged.id, { date: D, startTime: "16:00" }), /doesn't need a new time/);
  });

  await t.test("when the class moves away, the session stands again", async () => {
    await TimetableService.updateSlot(classThreeSlot.id, { startTime: "11:00", endTime: "12:00" });
    await Clashes.afterClassChange(classThree.cls.id);
    assert.equal(await stateOf(later.id), "confirmed");
  });

  await t.test("still flagged when its time comes: cancelled, with everything due back", async () => {
    await db("mentor_bookings").where({ id: later.id }).update({ clashAt: new Date(), clashReason: Clashes.CLASH_REASON });
    await Clashes.sweep({ teacherIds: [mentor.id], now: new Date(`${addDays(D, 7)}T17:30:00+03:00`) });
    const row = await db("mentor_bookings").where({ id: later.id }).first();
    assert.equal(row.status, "cancelled");
    assert.equal(row.cancelledBy, "clash");
    assert.equal(row.refundStatus, "due");
    assert.equal(Number(row.refundAmount), 1000);
    assert.equal(row.slotKey, null);
  });

  await t.test("an unpaid hold on a new class's time is released", async () => {
    const date = addDays(D, 21);
    const { booking, invoiceId } = await Bookings.book(parentReq, { learnerId: learner.id, teacherId: mentor.id, minutes: 60, date, startTime: "18:00", mode: "online", topic: "Loops" });
    assert.equal(booking.status, "held");
    const held = await classWith("Late", 1);
    await TimetableService.createSlot({ classId: held.cls.id, courseId: held.course.id, teacherId: null, dayOfWeek: "monday", startTime: "18:00", endTime: "19:00" });
    await TimetableService.setCourseSchedule(held.cls.id, held.course.id, date);
    await Clashes.afterClassChange(held.cls.id);
    assert.equal((await db("mentor_bookings").where({ id: booking.id }).first()).status, "cancelled");
    assert.equal((await db("billing_invoices").where({ id: invoiceId }).first()).status, "cancelled");
  });

  await t.test("saving hours replaces the pattern, joined; a removed educator's can't change", async () => {
    const saved = await Availability.replace(mentor.id, [
      { dayOfWeek: "saturday", startTime: "09:00", endTime: "11:00" },
      { dayOfWeek: "saturday", startTime: "11:00", endTime: "13:00" },
    ]);
    assert.deepEqual(saved.map((w) => [w.dayOfWeek, w.startTime, w.endTime]), [["saturday", "09:00", "13:00"]]);
    await assert.rejects(Availability.replace(mentor.id, [{ dayOfWeek: "monday", startTime: "12:00", endTime: "11:00" }]), /after start/);
    await db("teachers").where({ id: other.id }).update({ status: "removed" });
    await assert.rejects(Availability.replace(other.id, []), /removed/);
    assert.ok(adminReq.user.id);
  });
});
