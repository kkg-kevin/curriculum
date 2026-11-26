// Returning learners for another run of a bootcamp, end to end, against a throwaway database —
// only when one is named:
//
//   TEST_DB_NAME=digifunzi_nfr_test npm test
//
// Same set-up as submissions.db.test.js: the name must end in "_test", the database is created if
// missing and migrated, the rows added are removed at the end, and email is off for the run.
// Covers (26 Nov 2026): "Add missing classes" on a run's hub, enrolling someone already at a hub
// (a move into the class picked), and "Bring back learners" from an earlier run.
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

test("returning learners: missing classes, move at the same hub, bring back", { skip: !enabled && "set TEST_DB_NAME to run" }, async (t) => {
  const knex = require("knex");
  const knexConfig = require("../knexfile");
  const admin = knex({ ...knexConfig, connection: { ...knexConfig.connection, database: undefined } });
  await admin.raw("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4", [TEST_DB]);
  await admin.destroy();

  const env = require("../src/config/env");
  assert.ok(!env.BREVO_API_KEY && !env.SMTP_HOST, "email must be off for this run");
  const db = require("../src/config/db");
  await db.migrate.latest();

  const BootcampHubService = require("../src/modules/bootcamps/bootcamp-hub.service");
  const BootcampReturningService = require("../src/modules/bootcamps/bootcamp-returning.service");
  const BootcampModel = require("../src/modules/bootcamps/bootcamp.model");
  const LearnerMoveService = require("../src/modules/learner-moves/learner-move.service");

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

  t.after(async () => {
    const learnerIds = made.learners || [];
    const hubIds = made.learning_hubs || [];
    const bootcampIds = made.bootcamps || [];
    await db("learner_transfers").whereIn("learnerId", learnerIds).del();
    await db("learner_hub_links").whereIn("learnerId", learnerIds).del();
    await db("learner_pathways").whereIn("learnerId", learnerIds).del().catch(() => {});
    await db("bootcamp_hubs").whereIn("bootcampId", bootcampIds).del();
    await db("classes").whereIn("schoolId", hubIds).del();
    for (const table of ["learners", "bootcamps", "curricula", "learning_hubs", "users"]) {
      if (made[table]?.length) await db(table).whereIn("id", made[table]).del();
    }
    await db.destroy();
  });

  // ---- A workspace: two hubs, a bootcamp run in August and its next run in December ----
  const owner = await insert("users", { name: "Owner", email: `owner.${tag}@returning.test`, passwordHash: "x", role: "admin" });
  const req = { user: { id: owner.id, name: owner.name, role: "admin" }, ownerAdminId: owner.id };
  const hub = await insert("learning_hubs", { name: `Thika ${tag}`, code: `T${tag}`.slice(0, 10), ownerAdminId: owner.id, status: "active" });
  const hub2 = await insert("learning_hubs", { name: `Ruiru ${tag}`, code: `R${tag}`.slice(0, 10), ownerAdminId: owner.id, status: "active" });
  const curriculum = await insert("curricula", {
    name: "Holiday Robotics", code: `HR${tag}`, ownerAdminId: owner.id,
    classes: JSON.stringify([{ id: `starters-${tag}`, name: "Starters" }]),
  });
  const run1 = await insert("bootcamps", { name: "Robotics Bootcamp", ownerAdminId: owner.id, curriculumId: curriculum.id, startDate: "2026-08-03", endDate: "2026-08-14", saleStatus: "internal", audience: "learners" });
  const run2 = await insert("bootcamps", { name: "Robotics Bootcamp", ownerAdminId: owner.id, curriculumId: curriculum.id, seriesId: run1.id, startDate: "2026-12-07", endDate: "2026-12-18", saleStatus: "internal", audience: "learners" });

  const old = await BootcampHubService.createOffering({ bootcampId: run1.id, hubId: hub.id, ownerAdminId: owner.id });
  const oldAt2 = await BootcampHubService.createOffering({ bootcampId: run1.id, hubId: hub2.id, ownerAdminId: owner.id });
  // Run 1 was alone when its classes were made (bare bootcamp name); scheduling run 2 dates them.
  assert.equal((await db("classes").where({ id: old.classes[0].id }).first()).streamName, "Robotics Bootcamp");
  await BootcampModel.update(run1.id, { seriesId: run1.id });
  assert.equal(await BootcampHubService.dateRunClasses(run1.id), 2);
  assert.equal((await db("classes").where({ id: old.classes[0].id }).first()).streamName, "Robotics Bootcamp · 3 Aug 2026");
  assert.equal(await BootcampHubService.dateRunClasses(run1.id), 0, "safe to repeat");
  const next = await BootcampHubService.createOffering({ bootcampId: run2.id, hubId: hub.id, ownerAdminId: owner.id });
  const oldClass = old.classes[0].id;
  const oldClassAt2 = oldAt2.classes[0].id;
  const nextStarters = next.classes[0].id;

  const learner = async (first, hubId, classId, extra = {}) => {
    const l = await insert("learners", { firstName: first, lastName: tag, guardianName: "P", guardianPhone: "0700000000", accountStatus: "active", dateOfBirth: "2015-03-01" });
    await insert("learner_hub_links", { learnerId: l.id, hubId, classId, status: "active", admissionNumber: `ADM-${first}`, ...extra });
    return l;
  };
  const amani = await learner("Amani", hub.id, oldClass);
  const baraka = await learner("Baraka", hub.id, oldClass);
  const chebet = await learner("Chebet", hub2.id, oldClassAt2);
  const dalia = await learner("Dalia", hub.id, null, { status: "transferred" });
  const links = (learnerId) => db("learner_hub_links").where({ learnerId }).orderBy("hubId");

  let level2Class;
  await t.test("a cohort added later gets its class with Add missing classes", async () => {
    await db("curricula").where({ id: curriculum.id }).update({
      classes: JSON.stringify([{ id: `starters-${tag}`, name: "Starters" }, { id: `level2-${tag}`, name: "Level 2" }]),
    });
    const before = await BootcampHubService.enrich(await db("bootcamp_hubs").where({ id: next.id }).first());
    assert.deepEqual(before.missingCohorts.map((c) => c.name), ["Level 2"]);
    const { added, offering } = await BootcampHubService.addMissingClasses(next.id, run2.id);
    assert.deepEqual(added.map((c) => c.gradeName), ["Level 2"]);
    assert.equal(offering.missingCohorts.length, 0);
    assert.equal(offering.classes.length, 2);
    level2Class = added[0].id;
    const again = await BootcampHubService.addMissingClasses(next.id, run2.id);
    assert.equal(again.added.length, 0, "safe to repeat");
    await assert.rejects(BootcampHubService.addMissingClasses(next.id, run1.id), /doesn't run at that hub/);
  });

  await t.test("enrolling someone already at the hub moves them into the class picked", async () => {
    const moved = await LearnerMoveService.moveIntoClass(req, amani.id, { hubId: hub.id, classId: level2Class, notifyParent: false });
    assert.equal(moved.programme, "bootcamp", "a class of a run that hasn't ended is a bootcamp move");
    const [link] = await links(amani.id);
    assert.deepEqual([link.classId, link.status, link.admissionNumber], [level2Class, "active", "ADM-Amani"], "same place, new class, same admission number");
    const [row] = await db("learner_transfers").where({ learnerId: amani.id });
    assert.deepEqual([row.fromClassId, row.toClassId, row.toProgramme, row.toRecordId], [oldClass, level2Class, "bootcamp", run2.id]);
    await assert.rejects(LearnerMoveService.moveIntoClass(req, amani.id, { hubId: hub.id, classId: level2Class }), /already in that class/);
  });

  await t.test("a learner who left a hub can be taken back", async () => {
    await LearnerMoveService.moveIntoClass(req, dalia.id, { hubId: hub.id, classId: nextStarters, notifyParent: false });
    const [link] = await links(dalia.id);
    assert.deepEqual([link.classId, link.status], [nextStarters, "active"]);
  });

  await t.test("bring back learners from the earlier run", async () => {
    const before = await BootcampReturningService.candidates(run2);
    const byName = new Map(before.learners.map((l) => [l.name.split(" ")[0], l]));
    assert.ok(byName.get("Amani").inThisRun, "already moved in");
    assert.ok(!byName.get("Baraka").inThisRun);
    assert.ok(!byName.get("Chebet").inThisRun);
    assert.ok(!byName.has("Dalia"), "never on an earlier run");
    assert.equal(before.earlierRuns.length, 1);
    assert.deepEqual(before.hubs.map((h) => h.classes.length), [2]);

    const res = await BootcampReturningService.bringBack(req, run2, {
      hubId: hub.id, classId: nextStarters, learnerIds: [amani.id, baraka.id, chebet.id, dalia.id], notifyParent: false,
    });
    const by = new Map(res.results.map((r) => [r.learnerId, r]));
    assert.equal(res.moved, 2, JSON.stringify(res.results));
    assert.match(by.get(amani.id).reason, /Already in this run/);
    assert.match(by.get(dalia.id).reason, /Not a learner of an earlier run/);

    const [b] = await links(baraka.id);
    assert.deepEqual([b.hubId, b.classId, b.status], [hub.id, nextStarters, "active"], "same hub: moved, not added again");
    const c = await db("learner_hub_links").where({ learnerId: chebet.id });
    assert.deepEqual(c.find((l) => l.hubId === hub.id) && [c.find((l) => l.hubId === hub.id).classId, c.find((l) => l.hubId === hub.id).status], [nextStarters, "active"], "joined at this run's hub");
    assert.deepEqual([c.find((l) => l.hubId === hub2.id).status, c.find((l) => l.hubId === hub2.id).classId], ["transferred", null], "their earlier place at the other hub ended");

    const after = await BootcampReturningService.candidates(run2);
    assert.ok(after.learners.every((l) => l.inThisRun), "everyone from the earlier run is now in this one");
  });

  await t.test("the earlier run's class keeps them as Moved on, and says it has ended", async () => {
    const Former = require("../src/modules/classes/class-former-members");
    const former = await Former.formerMembers(oldClass);
    assert.deepEqual(former.map((f) => f.learnerId).sort(), [amani.id, baraka.id].sort());
    assert.deepEqual((await Former.formerMembers(oldClassAt2)).map((f) => f.learnerId), [chebet.id]);
    assert.deepEqual((await Former.finishingLearnerIds(oldClass)).sort(), [amani.id, baraka.id].sort(), "still on the old class's report and marking lists");
    assert.deepEqual(await Former.finishingLearnerIds(nextStarters).then((ids) => ids.sort()), [baraka.id, chebet.id, dalia.id].sort());
    const [oldInfo, nextInfo] = await Former.withRunInfo([{ id: oldClass }, { id: nextStarters }]);
    assert.deepEqual([oldInfo.bootcampRun.state, oldInfo.movedOnCount], ["ended", 2]);
    assert.deepEqual([nextInfo.bootcampRun.id, nextInfo.bootcampRun.state, nextInfo.movedOnCount], [run2.id, "upcoming", 0]);
  });

  await t.test("never into a run that has ended", async () => {
    await assert.rejects(BootcampReturningService.bringBack(req, await db("bootcamps").where({ id: run1.id }).first(), { hubId: hub.id, learnerIds: [baraka.id] }), /already ended/);
  });
});
