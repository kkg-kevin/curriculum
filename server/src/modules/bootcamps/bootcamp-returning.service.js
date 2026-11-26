const db = require("../../config/db");
const BootcampModel = require("./bootcamp.model");
const BootcampHubModel = require("./bootcamp-hub.model");
const { classIdsArray } = require("../../shared/utils/hub-offering.utils");
const { kenyaToday, learnerAge } = require("../../shared/utils/age");

// Bringing learners back for another run of a bootcamp (26 Nov 2026). A bootcamp run again is a
// new bootcamp record ("Schedule another run", shared seriesId) with its own classes at each hub,
// and a hub holds one place per learner — so a returning learner isn't added again, they're MOVED:
// out of their class in the earlier run, into a class of this run (learner-moves/, the same move
// as the learner page's Move learner: written down, placed on the run's pathway, an invoice if
// asked, the parent told). Their earlier work, reports and certificates stay theirs.
//
// Who can come back: the learners of every OTHER run of the series — still in its classes, moved
// out of them since (learner_transfers), or signed up for it on the website (leads). Nothing new is
// stored; it's worked out each time.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const fullName = (l) => [l?.firstName, l?.lastName].filter(Boolean).join(" ").trim() || "A learner";
const dayOf = (v) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);
const classLabel = (c) => (c ? [c.gradeName, c.streamName].filter(Boolean).join(" · ") : null);
const MAX_AT_ONCE = 200;

async function offeringsOf(bootcampId) {
  const offerings = await BootcampHubModel.findByBootcampId(bootcampId);
  return offerings.map((o) => ({ ...o, classIds: classIdsArray(o.classIds) }));
}

// This run, its hubs with their classes, and the other runs of the series with their classes.
async function loadRuns(bootcamp) {
  const series = await BootcampModel.findSeries(bootcamp.seriesId || bootcamp.id);
  const others = (series.length ? series : [bootcamp]).filter((r) => r.id !== bootcamp.id);
  const here = await offeringsOf(bootcamp.id);
  const otherClass = new Map(); // classId -> { runId, hubId }
  for (const run of others) {
    for (const o of await offeringsOf(run.id)) for (const classId of o.classIds) otherClass.set(classId, { runId: run.id, hubId: o.hubId });
  }
  return { others, here, otherClass };
}

const BootcampReturningService = {
  // Every learner of the other runs, with where they were and whether they're already in this run.
  async candidates(bootcamp) {
    const today = kenyaToday();
    const { others, here, otherClass } = await loadRuns(bootcamp);
    const thisClassIds = new Set(here.flatMap((o) => o.classIds));
    const allClassIds = [...new Set([...thisClassIds, ...otherClass.keys()])];
    const hubIds = [...new Set(here.map((o) => o.hubId))];
    const [hubRows, classRows] = await Promise.all([
      db("learning_hubs").whereIn("id", [...new Set([...hubIds, ...[...otherClass.values()].map((v) => v.hubId)])]).select("id", "name"),
      allClassIds.length ? db("classes").whereIn("id", allClassIds).select("id", "gradeName", "streamName", "gradeId", "status") : [],
    ]);
    const hubName = new Map(hubRows.map((h) => [h.id, h.name]));
    const classById = new Map(classRows.map((c) => [c.id, c]));
    const hubs = here.map((o) => ({
      hubId: o.hubId,
      hubName: hubName.get(o.hubId) || "A hub",
      classes: o.classIds.map((id) => classById.get(id)).filter(Boolean)
        .map((c) => ({ id: c.id, label: c.gradeName || classLabel(c), active: (c.status || "active") === "active" })),
    }));
    const run = { id: bootcamp.id, name: bootcamp.name, startDate: dayOf(bootcamp.startDate), endDate: dayOf(bootcamp.endDate), ended: !!bootcamp.endDate && dayOf(bootcamp.endDate) < today };
    if (!others.length) return { run, hubs, earlierRuns: [], learners: [] };

    const otherIds = [...otherClass.keys()];
    const [stillIn, movedOut, leads] = await Promise.all([
      otherIds.length ? db("learner_hub_links").whereIn("classId", otherIds).whereNot("status", "transferred").select("learnerId", "hubId", "classId") : [],
      otherIds.length ? db("learner_transfers").whereIn("fromClassId", otherIds).select("learnerId", "fromClassId", "createdAt") : [],
      db("leads").whereIn("bootcampId", others.map((r) => r.id)).whereNotNull("learnerId").whereNull("anonymisedAt").select("learnerId", "bootcampId", "hubId"),
    ]);
    // learnerId -> the runs they were on, and their class there if known.
    const seen = new Map();
    const note = (learnerId, runId, hubId, classId) => {
      if (!learnerId || !runId) return;
      const list = seen.get(learnerId) || [];
      list.push({ runId, hubId: hubId || null, classId: classId || null });
      seen.set(learnerId, list);
    };
    for (const l of stillIn) note(l.learnerId, otherClass.get(l.classId)?.runId, l.hubId, l.classId);
    for (const t of movedOut) note(t.learnerId, otherClass.get(t.fromClassId)?.runId, otherClass.get(t.fromClassId)?.hubId, t.fromClassId);
    for (const l of leads) note(l.learnerId, l.bootcampId, l.hubId, null);
    const learnerIds = [...seen.keys()];
    if (!learnerIds.length) return { run, hubs, earlierRuns: others.map(runSummary), learners: [] };

    const [learnerRows, links] = await Promise.all([
      db("learners").whereIn("id", learnerIds).select("id", "firstName", "lastName", "dateOfBirth", "statedAge", "statedAgeOn", "accountStatus", "teacherId", "guardianName", "guardianPhone"),
      db("learner_hub_links").whereIn("learnerId", learnerIds).whereNot("status", "transferred").select("learnerId", "hubId", "classId", "status"),
    ]);
    // Classes they're in now that we haven't read yet (somewhere outside this series).
    const unknown = [...new Set(links.map((l) => l.classId).filter((id) => id && !classById.has(id)))];
    if (unknown.length) for (const c of await db("classes").whereIn("id", unknown).select("id", "gradeName", "streamName")) classById.set(c.id, c);
    const extraHubs = [...new Set(links.map((l) => l.hubId).filter((id) => !hubName.has(id)))];
    if (extraHubs.length) for (const h of await db("learning_hubs").whereIn("id", extraHubs).select("id", "name")) hubName.set(h.id, h.name);
    const runById = new Map(others.map((r) => [r.id, r]));

    const learners = learnerRows
      .filter((l) => !l.teacherId) // educators in training come back through their own page
      .map((l) => {
        const where = seen.get(l.id) || [];
        const latest = [...where].sort((a, b) => String(dayOf(runById.get(b.runId)?.startDate) || "").localeCompare(String(dayOf(runById.get(a.runId)?.startDate) || "")))[0];
        const lastRun = runById.get(latest?.runId) || null;
        const mine = links.filter((k) => k.learnerId === l.id);
        const inRun = mine.find((k) => k.classId && thisClassIds.has(k.classId)) || null;
        const now = mine.filter((k) => k.classId).map((k) => [hubName.get(k.hubId), classLabel(classById.get(k.classId))].filter(Boolean).join(" · "));
        return {
          id: l.id,
          name: fullName(l),
          age: learnerAge(l, today),
          accountStatus: l.accountStatus || "active",
          guardianName: l.guardianName || null,
          guardianPhone: l.guardianPhone || null,
          lastRun: lastRun ? { id: lastRun.id, name: lastRun.name, startDate: dayOf(lastRun.startDate) } : null,
          lastPlace: latest ? [hubName.get(latest.hubId), classLabel(classById.get(latest.classId))].filter(Boolean).join(" · ") || null : null,
          lastHubId: latest?.hubId || null,
          now,
          inThisRun: inRun ? { hubId: inRun.hubId, classId: inRun.classId, label: [hubName.get(inRun.hubId), classLabel(classById.get(inRun.classId))].filter(Boolean).join(" · ") } : null,
        };
      })
      .sort((a, b) => String(b.lastRun?.startDate || "").localeCompare(String(a.lastRun?.startDate || "")) || a.name.localeCompare(b.name));
    return { run, hubs, earlierRuns: others.map(runSummary), learners };
  },

  // Moves the chosen learners into this run at one hub — into the class picked, or each into the
  // class for their stage when none is (as a website sign-up joins). One learner failing never
  // stops the rest; each gets its own answer.
  //   { hubId, learnerIds, classId?, invoice?, notifyParent?, leaveEarlierPlace? }
  async bringBack(req, bootcamp, input) {
    const today = kenyaToday();
    if (bootcamp.endDate && dayOf(bootcamp.endDate) < today) fail(`${bootcamp.name} has already ended — bring them back into a run that hasn't`);
    const { here, otherClass } = await loadRuns(bootcamp);
    const offering = here.find((o) => o.hubId === input.hubId);
    if (!offering) fail(`${bootcamp.name} doesn't run at that hub — add the hub to this run first`);
    if (input.classId && !offering.classIds.includes(input.classId)) fail("Choose one of this run's classes at that hub");
    const ids = [...new Set(input.learnerIds || [])];
    if (!ids.length) fail("Tick the learners to bring back");
    if (ids.length > MAX_AT_ONCE) fail(`Bring back up to ${MAX_AT_ONCE} learners at a time`);

    const { learners } = await this.candidates(bootcamp);
    const byId = new Map(learners.map((l) => [l.id, l]));
    const LearnerMoveService = require("../learner-moves/learner-move.service");
    const results = [];
    for (const learnerId of ids) {
      const who = byId.get(learnerId);
      if (!who) { results.push({ learnerId, name: null, ok: false, reason: "Not a learner of an earlier run of this bootcamp" }); continue; }
      if (who.inThisRun) { results.push({ learnerId, name: who.name, ok: false, reason: `Already in this run (${who.inThisRun.label})` }); continue; }
      // Their place in the earlier run at ANOTHER hub is left too (the run is over), unless asked
      // not to; a place at this hub is always left — a hub holds one place per learner.
      const alsoEndKeys = [];
      if (input.leaveEarlierPlace !== false) {
        // eslint-disable-next-line no-await-in-loop
        const links = await db("learner_hub_links").where({ learnerId }).whereNot("status", "transferred").select("hubId", "classId");
        for (const k of links) if (k.hubId !== offering.hubId && k.classId && otherClass.has(k.classId)) alsoEndKeys.push(`link:${k.hubId}`);
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const moved = await LearnerMoveService.moveIntoClass(req, learnerId, {
          hubId: offering.hubId, classId: input.classId || null, bootcampId: bootcamp.id,
          invoice: !!input.invoice, notifyParent: input.notifyParent !== false, alsoEndKeys,
        });
        results.push({ learnerId, name: who.name, ok: true, label: moved.label, invoice: moved.invoice || null, parentTold: !!moved.parentTold });
      } catch (err) {
        if (!err.statusCode || err.statusCode >= 500) console.error(`[bootcamp-returning] ${learnerId}:`, err.message);
        results.push({ learnerId, name: who.name, ok: false, reason: err.message });
      }
    }
    return { moved: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  },
};

function runSummary(r) {
  return { id: r.id, name: r.name, startDate: dayOf(r.startDate), endDate: dayOf(r.endDate) };
}

module.exports = BootcampReturningService;
