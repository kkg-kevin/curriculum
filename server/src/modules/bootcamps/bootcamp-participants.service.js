const db = require("../../config/db");
const BootcampModel = require("./bootcamp.model");
const BootcampHubModel = require("./bootcamp-hub.model");
const { classIdsArray } = require("../../shared/utils/hub-offering.utils");
const { todayInKenya } = require("../checkins/checkin.dates");

// Who took part in a bootcamp — the learners and their parents, with contact details, so the
// families can be reached when it runs again. For one run, or every run of it ("Schedule another
// run" links them by seriesId). Gathered from what's already kept, nothing new is stored:
//   - the learners in each run's classes at its hubs (learner_hub_links) — website sign-ups and
//     learners staff placed there;
//   - the website enrolments for the run (leads with its bootcampId), which add the parent's own
//     contact, the child's age as given, and whether it was paid — including any whose sign-up
//     didn't finish (no learner), so they can still be followed up.
// A learner's guardian details come from the learner record (kept current by staff), the
// enrolment's when the record has none. Anonymised enquiries are left out.

const fullName = (l) => [l?.firstName, l?.lastName].filter(Boolean).join(" ").trim();

function ageFrom(dateOfBirth, today) {
  if (!dateOfBirth) return null;
  const dob = String(dateOfBirth).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  let age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  if (today.slice(5) < dob.slice(5)) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

async function runsFor(bootcamp, scope) {
  if (scope !== "series") return [bootcamp];
  const series = await BootcampModel.findSeries(bootcamp.seriesId || bootcamp.id);
  return series.length ? series : [bootcamp];
}

const BootcampParticipantsService = {
  async list(bootcamp, { scope = "run" } = {}) {
    const today = todayInKenya();
    const runs = await runsFor(bootcamp, scope);
    const runById = new Map(runs.map((r) => [r.id, r]));

    // Each run's classes, at its hubs.
    const classRun = new Map(); // classId -> runId
    for (const run of runs) {
      for (const offering of await BootcampHubModel.findByBootcampId(run.id)) {
        for (const classId of classIdsArray(offering.classIds)) classRun.set(classId, run.id);
      }
    }
    const classIds = [...classRun.keys()];
    const [links, leads] = await Promise.all([
      classIds.length ? db("learner_hub_links").whereIn("classId", classIds).select("learnerId", "hubId", "classId", "status", "createdAt") : [],
      db("leads").whereIn("bootcampId", runs.map((r) => r.id)).whereNull("anonymisedAt")
        .select("id", "bootcampId", "learnerId", "hubId", "name", "email", "phone", "learnerName", "learnerAge", "paidAt", "invoiceId", "createdAt"),
    ]);

    const learnerIds = [...new Set([...links.map((l) => l.learnerId), ...leads.map((l) => l.learnerId)].filter(Boolean))];
    const hubIds = [...new Set([...links.map((l) => l.hubId), ...leads.map((l) => l.hubId)].filter(Boolean))];
    const [learners, hubs, classes] = await Promise.all([
      learnerIds.length ? db("learners").whereIn("id", learnerIds).select("id", "firstName", "lastName", "gender", "dateOfBirth", "username", "accountStatus", "guardianName", "guardianEmail", "guardianPhone") : [],
      hubIds.length ? db("learning_hubs").whereIn("id", hubIds).select("id", "name") : [],
      classIds.length ? db("classes").whereIn("id", classIds).select("id", "gradeName") : [],
    ]);
    const learnerById = new Map(learners.map((l) => [l.id, l]));
    const hubName = new Map(hubs.map((h) => [h.id, h.name]));
    const cohortName = new Map(classes.map((c) => [c.id, c.gradeName]));

    // One row per learner per run (a learner in two runs is in both).
    const rows = new Map();
    const rowFor = (runId, key) => {
      const id = `${runId}:${key}`;
      if (!rows.has(id)) rows.set(id, { key: id, runId });
      return rows.get(id);
    };
    for (const link of links) {
      const runId = classRun.get(link.classId);
      Object.assign(rowFor(runId, link.learnerId), {
        learnerId: link.learnerId, hubId: link.hubId, cohort: cohortName.get(link.classId) || null,
        enrolmentStatus: link.status || null, joinedAt: link.createdAt, source: "staff",
      });
    }
    for (const lead of leads) {
      const row = rowFor(lead.bootcampId, lead.learnerId || `lead:${lead.id}`);
      Object.assign(row, {
        learnerId: lead.learnerId || null,
        hubId: row.hubId || lead.hubId || null,
        joinedAt: lead.createdAt,
        source: lead.learnerId ? "website" : "enquiry",
        leadId: lead.id,
        paid: lead.paidAt ? true : lead.invoiceId ? false : null,
        lead,
      });
    }

    const participants = [...rows.values()].map((row) => {
      const run = runById.get(row.runId);
      const learner = row.learnerId ? learnerById.get(row.learnerId) : null;
      const lead = row.lead || null;
      return {
        key: row.key,
        runId: row.runId,
        runName: run?.name || null,
        runStartDate: run?.startDate || null,
        runEndDate: run?.endDate || null,
        learnerId: learner ? learner.id : null,
        learnerName: fullName(learner) || lead?.learnerName || "—",
        age: ageFrom(learner?.dateOfBirth, today) ?? (lead?.learnerAge != null ? Number(lead.learnerAge) : null),
        gender: learner?.gender || null,
        username: learner?.username || null,
        accountStatus: learner?.accountStatus || null,
        hubName: hubName.get(row.hubId) || null,
        cohort: row.cohort || null,
        parentName: learner?.guardianName || lead?.name || null,
        parentEmail: learner?.guardianEmail || lead?.email || null,
        parentPhone: learner?.guardianPhone || lead?.phone || null,
        // website: signed up on the website; staff: placed in the class by staff; enquiry: a website
        // enrolment that never became a learner.
        source: row.source,
        paid: row.paid ?? null,
        joinedAt: row.joinedAt || null,
        leadId: row.leadId || null,
      };
    }).sort((a, b) => (b.runStartDate || "").localeCompare(a.runStartDate || "") || a.learnerName.localeCompare(b.learnerName));

    return {
      scope,
      runs: runs.map((r) => ({ id: r.id, name: r.name, startDate: r.startDate || null, endDate: r.endDate || null }))
        .sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999")),
      participants,
    };
  },
};

module.exports = BootcampParticipantsService;
module.exports._internal = { ageFrom };
