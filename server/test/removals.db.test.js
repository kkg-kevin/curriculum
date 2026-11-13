// Removing a person end to end — educator, supervisor, affiliate, learning hub — against a throwaway
// database, only when one is named:
//
//   TEST_DB_NAME=digifunzi_nfr_test npm test
//
// Same set-up as submissions.db.test.js: the name must end in "_test", the database is created if
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

test("removing a person: deactivate → transfer → delete", { skip: !enabled && "set TEST_DB_NAME to run" }, async (t) => {
  const knex = require("knex");
  const knexConfig = require("../knexfile");
  const admin = knex({ ...knexConfig, connection: { ...knexConfig.connection, database: undefined } });
  await admin.raw("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4", [TEST_DB]);
  await admin.destroy();

  const env = require("../src/config/env");
  assert.ok(!env.BREVO_API_KEY && !env.SMTP_HOST, "email must be off for this run");
  const db = require("../src/config/db");
  await db.migrate.latest();

  const RemovalService = require("../src/modules/removals/removal.service");
  const TeacherModel = require("../src/modules/teachers/teacher.model");
  const LearningHubModel = require("../src/modules/learning-hubs/learning-hub.model");
  const AuthService = require("../src/modules/auth/auth.service");

  const id = () => crypto.randomUUID();
  const tag = crypto.randomBytes(3).toString("hex");
  const now = new Date();
  const made = {}; // table → ids, removed at the end
  const insert = async (table, row) => {
    const full = { id: id(), createdAt: now, ...row };
    await db(table).insert(full);
    (made[table] = made[table] || []).push(full.id);
    return full;
  };
  const emails = [];
  const login = async (role, name, extra = {}) => {
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${tag}@removals.test`;
    emails.push(email);
    return insert("users", { name, email, passwordHash: "x", role, ...extra });
  };

  t.after(async () => {
    const order = ["affiliate_commissions", "affiliate_referrals", "affiliates", "billing_invoices", "rooms", "learner_hub_links", "learners",
      "qa_visits", "teacher_claims", "timetable_slots", "class_course_teacher_links", "classes", "courses", "curricula", "teacher_hub_links", "teachers", "learning_hubs", "users"];
    for (const table of order) if (made[table]?.length) await db(table).whereIn("id", made[table]).del();
    await db("learner_transfers").whereIn("learnerId", made.learners || []).del();
    await db("teacher_hub_links").whereIn("teacherId", made.teachers || []).del();
    await db("class_course_teacher_links").whereIn("teacherId", made.teachers || []).del();
    const userIds = [...(made.users || []), ...(await db("users").whereIn("email", emails).pluck("id"))];
    await db("notifications").whereIn("recipientId", userIds).del();
    await db("email_outbox").whereIn("toEmail", emails).del();
    await db("users").whereIn("email", emails).del();
    await db("users").whereIn("id", made.users || []).del();
    await db.destroy();
  });

  // ---- A workspace ----
  const owner = await login("admin", "Owner");
  const req = { user: { id: owner.id, name: owner.name, role: "admin" }, ownerAdminId: owner.id };
  const hub1 = await insert("learning_hubs", { name: `Hub One ${tag}`, ownerAdminId: owner.id, status: "active", email: `hub1.${tag}@removals.test` });
  const hub2 = await insert("learning_hubs", { name: `Hub Two ${tag}`, ownerAdminId: owner.id, status: "active" });
  emails.push(hub1.email);
  const curriculum = await insert("curricula", { name: "Curr", code: `R${tag}`, ownerAdminId: owner.id });
  const course = await insert("courses", { name: "Robotics", ownerAdminId: owner.id });
  const class1 = await insert("classes", { schoolId: hub1.id, curriculumId: curriculum.id, gradeId: "g4", gradeName: "Grade 4", streamName: "East", academicYear: "2026" });
  const class2 = await insert("classes", { schoolId: hub2.id, curriculumId: curriculum.id, gradeId: "g5", gradeName: "Grade 5", streamName: "West", academicYear: "2026" });

  const educator = async (first) => {
    const l = await login("teacher", `${first} Educator`);
    const teacher = await insert("teachers", { firstName: first, lastName: "Educator", email: l.email, status: "active", createdByAdminId: owner.id });
    await insert("teacher_hub_links", { teacherId: teacher.id, hubId: hub1.id });
    await insert("teacher_hub_links", { teacherId: teacher.id, hubId: hub2.id });
    return { teacher, login: l };
  };
  const leaving = await educator("Leaving");
  const busy = await educator("Busy");
  const free = await educator("Free");
  const supervisor = await login("supervisor", "Sam Supervisor", { invitedByAdminId: owner.id });
  const supervisor2 = await login("supervisor", "Sue Supervisor", { invitedByAdminId: owner.id });

  // ---- The educator's work and history ----
  await insert("class_course_teacher_links", { classId: class1.id, courseId: course.id, teacherId: leaving.teacher.id, isPrimary: true });
  const slot = await insert("timetable_slots", { classId: class1.id, courseId: course.id, teacherId: leaving.teacher.id, dayOfWeek: "Monday", startTime: "09:00", endTime: "10:00" });
  await insert("timetable_slots", { classId: class2.id, courseId: course.id, teacherId: busy.teacher.id, dayOfWeek: "Monday", startTime: "09:30", endTime: "10:30" });
  await db("learning_hubs").where({ id: hub1.id }).update({ accountManagerId: leaving.login.id });
  await insert("teacher_claims", { ownerAdminId: owner.id, teacherId: leaving.teacher.id, teacherName: "Leaving Educator", claimNumber: `CL-${tag}`, amount: 100, courseAmount: 100, sessionRate: 10, invoiceUrl: "x", type: "course", status: "paid" });
  await insert("qa_visits", { ownerAdminId: owner.id, teacherId: leaving.teacher.id, reviewerId: supervisor.id, templateId: id(), scheduledDate: "2026-10-01", visitType: "announced", status: "submitted" });

  await t.test("educator", async () => {
    let plan = await RemovalService.plan(req, "teacher", leaving.teacher.id);
    assert.equal(plan.step, "deactivate");
    assert.deepEqual(plan.items.map((i) => i.type).sort(), ["classCourse", "hubLead", "slot"]);
    assert.ok(plan.candidates.some((c) => c.id === busy.teacher.id));
    assert.ok(!plan.candidates.some((c) => c.id === leaving.teacher.id));
    await assert.rejects(RemovalService.transfer(req, "teacher", leaving.teacher.id, { to: busy.teacher.id }), /Deactivate them first/);
    await assert.rejects(RemovalService.remove(req, "teacher", leaving.teacher.id), /Deactivate them first/);

    plan = await RemovalService.deactivate(req, "teacher", leaving.teacher.id);
    assert.equal(plan.step, "transfer");

    // Everything to Busy: the slot clashes with Busy's own Monday class and stays.
    let out = await RemovalService.transfer(req, "teacher", leaving.teacher.id, { to: busy.teacher.id });
    const slotResult = out.results.find((r) => r.key === `slot:${slot.id}`);
    assert.equal(slotResult.ok, false);
    assert.match(slotResult.message, /teaching somewhere else/);
    assert.ok(out.results.filter((r) => r.key !== `slot:${slot.id}`).every((r) => r.ok));
    assert.deepEqual(out.items.map((i) => i.type), ["slot"]);
    await assert.rejects(RemovalService.remove(req, "teacher", leaving.teacher.id), /Hand over the last thing/);

    // The slot alone to Free.
    out = await RemovalService.transfer(req, "teacher", leaving.teacher.id, { overrides: { [`slot:${slot.id}`]: free.teacher.id } });
    assert.ok(out.results.every((r) => r.ok));
    assert.equal(out.step, "delete");
    assert.ok(out.history.some((h) => /claim/.test(h)) && out.history.some((h) => /QA report/.test(h)));

    const done = await RemovalService.remove(req, "teacher", leaving.teacher.id);
    assert.equal(done.kept, true);

    const link = await db("class_course_teacher_links").where({ classId: class1.id, courseId: course.id });
    assert.deepEqual(link.map((l) => [l.teacherId, Boolean(l.isPrimary)]), [[busy.teacher.id, true]]);
    assert.equal((await db("timetable_slots").where({ id: slot.id }).first()).teacherId, free.teacher.id);
    assert.equal((await db("learning_hubs").where({ id: hub1.id }).first()).accountManagerId, busy.login.id);
    assert.ok(JSON.stringify((await db("users").where({ id: busy.login.id }).first()).extraRoles || []).includes("hubLead"));

    const tomb = await TeacherModel.findById(leaving.teacher.id);
    assert.equal(tomb.status, "removed");
    assert.equal(tomb.email, null);
    assert.equal(tomb.removedEmail, leaving.login.email);
    assert.ok(!(await TeacherModel.findAll({ ids: made.teachers })).some((x) => x.id === leaving.teacher.id), "left out of lists");
    assert.equal((await db("teacher_claims").where({ teacherId: leaving.teacher.id }).first()).teacherName, "Leaving Educator", "history kept");
    const retired = await db("users").where({ id: leaving.login.id }).first();
    assert.ok(retired.removedAt && retired.email === null, "login retired, not deleted");

    // The email is free for someone new.
    const fresh = await AuthService.setOrCreatePassword({ name: "New Person", email: leaving.login.email, password: "Password123!", role: "teacher" });
    assert.notEqual(fresh.id, leaving.login.id);
    await assert.rejects(RemovalService.deactivate(req, "teacher", leaving.teacher.id), /Already removed/);
  });

  await t.test("supervisor", async () => {
    await db("teachers").where({ id: busy.teacher.id }).update({ supervisorId: supervisor.id });
    const claim = await insert("teacher_claims", { ownerAdminId: owner.id, teacherId: busy.teacher.id, teacherName: "Busy Educator", claimNumber: `CL2-${tag}`, amount: 50, courseAmount: 50, sessionRate: 5, invoiceUrl: "x", type: "course", status: "pending_supervisor", supervisorId: supervisor.id, supervisorName: supervisor.name });
    let plan = await RemovalService.deactivate(req, "supervisor", supervisor.id);
    assert.ok((await db("users").where({ id: supervisor.id }).first()).deactivatedAt);
    assert.deepEqual(plan.items.map((i) => i.type).sort(), ["claim", "educator"]);
    plan = await RemovalService.transfer(req, "supervisor", supervisor.id, { to: supervisor2.id, overrides: { [`claim:${claim.id}`]: "none" } });
    assert.ok(plan.results.every((r) => r.ok), JSON.stringify(plan.results));
    assert.equal((await db("teachers").where({ id: busy.teacher.id }).first()).supervisorId, supervisor2.id);
    const c = await db("teacher_claims").where({ id: claim.id }).first();
    assert.equal(c.status, "pending_admin");
    assert.equal(c.supervisorId, null);
    const done = await RemovalService.remove(req, "supervisor", supervisor.id);
    assert.equal(done.kept, true, "wrote a QA report, so the login is kept");
    const s = await db("users").where({ id: supervisor.id }).first();
    assert.ok(s.removedAt && !s.email && !s.invitedByAdminId);
    assert.equal(s.name, "Sam Supervisor", "the QA report still has its reviewer's name");
  });

  await t.test("affiliate", async () => {
    const leavingAff = await insert("affiliates", { name: "Ann Affiliate", code: `ANN${tag}`.toUpperCase(), ownerAdminId: owner.id, status: "active" });
    const otherAff = await insert("affiliates", { name: "Ben Affiliate", code: `BEN${tag}`.toUpperCase(), ownerAdminId: owner.id, status: "active" });
    const referral = await insert("affiliate_referrals", { affiliateId: leavingAff.id, ownerAdminId: owner.id, programme: "home_learning", recordId: id(), via: "link", status: "paid", customerName: "Wanjiru" });
    const commission = await insert("affiliate_commissions", { affiliateId: leavingAff.id, ownerAdminId: owner.id, referralId: referral.id, invoiceId: id(), amount: 100, baseAmount: 1000, ratePercent: 10, availableAt: now, status: "pending", kind: "own" });

    let plan = await RemovalService.deactivate(req, "affiliate", leavingAff.id);
    assert.equal(plan.person.status, "suspended");
    assert.equal(plan.toSettle.length, 1, "their unpaid commission must be sorted out first");
    plan = await RemovalService.transfer(req, "affiliate", leavingAff.id, { to: otherAff.id });
    assert.equal((await db("affiliate_referrals").where({ id: referral.id }).first()).affiliateId, otherAff.id);
    await assert.rejects(RemovalService.remove(req, "affiliate", leavingAff.id), /Sort out/);
    await db("affiliate_commissions").where({ id: commission.id }).update({ status: "cancelled" });
    const done = await RemovalService.remove(req, "affiliate", leavingAff.id);
    assert.equal(done.kept, true);
    assert.equal((await db("affiliates").where({ id: leavingAff.id }).first()).status, "removed");
  });

  await t.test("learning hub", async () => {
    const learner = await insert("learners", { firstName: "Kim", lastName: "Learner", guardianName: "P", guardianPhone: "0700", accountStatus: "active" });
    await insert("learner_hub_links", { learnerId: learner.id, hubId: hub1.id, classId: class1.id, status: "active" });
    await insert("rooms", { hubId: hub1.id, name: "Lab" });
    await insert("rooms", { hubId: hub2.id, name: "Lab" });
    await insert("billing_invoices", { hubId: hub1.id, invoiceNumber: `INV-${tag}`, invoiceType: "learner", issuerType: "platform", status: "paid" });

    let plan = await RemovalService.deactivate(req, "hub", hub1.id);
    assert.equal((await db("learners").where({ id: learner.id }).first()).accountStatus, "inactive", "the hub's switch-off reached its learner");
    assert.ok(plan.items.some((i) => i.type === "class" && i.id === class1.id));
    assert.ok(!plan.candidates.some((c) => c.id === hub1.id));

    plan = await RemovalService.transfer(req, "hub", hub1.id, { to: hub2.id });
    assert.ok(plan.results.every((r) => r.ok), JSON.stringify(plan.results));
    assert.equal((await db("classes").where({ id: class1.id }).first()).schoolId, hub2.id);
    const moved = await db("learner_hub_links").where({ learnerId: learner.id });
    assert.deepEqual(moved.map((l) => [l.hubId, l.classId, l.status]), [[hub2.id, class1.id, "active"]]);
    assert.equal((await db("learners").where({ id: learner.id }).first()).accountStatus, "active", "switched back on at the new hub");
    assert.deepEqual((await db("rooms").where({ hubId: hub2.id }).orderBy("name").pluck("name")), ["Lab", `Lab (from ${hub1.name})`]);

    const done = await RemovalService.remove(req, "hub", hub1.id);
    assert.equal(done.kept, true, "it has an invoice");
    const tomb = await LearningHubModel.findById(hub1.id);
    assert.equal(tomb.status, "removed");
    assert.equal(tomb.email, null);
    assert.ok(!(await LearningHubModel.findAll({ ownerAdminId: owner.id })).some((h) => h.id === hub1.id), "out of hub lists");
    assert.ok((await LearningHubModel.findAll({ ownerAdminId: owner.id, includeRemoved: true })).some((h) => h.id === hub1.id), "still there for billing");
  });
});
