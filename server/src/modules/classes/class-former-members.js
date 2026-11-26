const db = require("../../config/db");
const { kenyaToday } = require("../../shared/utils/age");

// "Moved on" learners of a bootcamp run's class (27 Nov 2026). A hub holds one place per learner,
// so a learner brought back for the NEXT run of the same bootcamp (same curriculum, same hub)
// leaves this class for that run's class (learner-moves/ moveIntoClass, written to
// learner_transfers). They stay on this class as a FORMER member: shown under "Moved on" and kept
// on the lists its educator needs to finish the run — report pages, marking rosters, certificates
// — never on the live ones (attendance, timetable, issuing new work, analytics).
//
// A former member = a learner_transfers row from this class into ANOTHER RUN OF THE SAME BOOTCAMP
// series, who isn't back in this class now. An ordinary transfer (another hub, another programme,
// another bootcamp) doesn't count: that learner's work is finished where they went.

const list = (v) => {
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v || "[]"); } catch { return []; }
};

// classId -> bootcamp id, for the classes asked about (bootcamp_hubs keeps classIds as JSON).
async function runsOfClasses(classIds) {
  const wanted = new Set(classIds);
  const map = new Map();
  for (const o of await db("bootcamp_hubs").select("bootcampId", "classIds")) {
    for (const id of list(o.classIds)) if (wanted.has(id)) map.set(id, o.bootcampId);
  }
  return map;
}

// classIds -> Map(classId -> [{ learnerId, hubId, movedAt, toClassId, toLabel }]), newest move per learner.
async function formerMembersOf(classIds) {
  const ids = [...new Set((classIds || []).filter(Boolean))];
  const out = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return out;
  const rows = await db("learner_transfers").whereIn("fromClassId", ids).where({ toProgramme: "bootcamp" }).whereNotNull("toRecordId")
    .orderBy("createdAt", "desc").select("learnerId", "fromClassId", "fromHubId", "toClassId", "toRecordId", "toLabel", "createdAt");
  if (!rows.length) return out;
  const classRun = await runsOfClasses(ids);
  const runIds = [...new Set([...classRun.values(), ...rows.map((r) => r.toRecordId)])];
  const runs = new Map((await db("bootcamps").whereIn("id", runIds).select("id", "seriesId")).map((b) => [b.id, b.seriesId || b.id]));
  const now = await db("learner_hub_links").whereIn("learnerId", [...new Set(rows.map((r) => r.learnerId))])
    .whereNot("status", "transferred").select("learnerId", "classId");
  const inClassNow = new Set(now.map((l) => `${l.learnerId}:${l.classId}`));
  const seen = new Set();
  for (const r of rows) {
    const fromRun = classRun.get(r.fromClassId);
    if (!fromRun || fromRun === r.toRecordId) continue;
    if (runs.get(fromRun) !== runs.get(r.toRecordId)) continue; // another bootcamp: not a returning learner
    const key = `${r.learnerId}:${r.fromClassId}`;
    if (seen.has(key) || inClassNow.has(key)) continue;
    seen.add(key);
    out.get(r.fromClassId).push({ learnerId: r.learnerId, hubId: r.fromHubId, movedAt: r.createdAt, toClassId: r.toClassId, toLabel: r.toLabel || null });
  }
  return out;
}

async function formerMembers(classId) {
  return (await formerMembersOf([classId])).get(classId) || [];
}

// The learner ids a class's FINISHING work covers: its active learners plus its former members.
async function finishingLearnerIds(classId) {
  const active = await db("learner_hub_links").where({ classId, status: "active" }).pluck("learnerId");
  const former = (await formerMembers(classId)).map((f) => f.learnerId);
  return [...new Set([...active, ...former])];
}

const dayOf = (v) => (v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null);

// Where a bootcamp run stands on the Kenyan calendar: upcoming, running or ended.
function runState(run, today = kenyaToday()) {
  const start = dayOf(run.startDate);
  const end = dayOf(run.endDate);
  if (end && end < today) return "ended";
  if (start && start > today) return "upcoming";
  return "running";
}

// Each class with the bootcamp run it belongs to (`bootcampRun`: id, name, dates, state — null for
// a class that isn't a run's) and how many learners have moved on from it (`movedOnCount`). Two
// runs of one bootcamp at one hub run the same curriculum, so this is what tells their classes
// apart on screen (with the run's date in the class's stream name).
async function withRunInfo(classes) {
  if (!classes?.length) return classes || [];
  const ids = classes.map((c) => c.id);
  const classRun = await runsOfClasses(ids);
  if (!classRun.size) return classes.map((c) => ({ ...c, bootcampRun: null, movedOnCount: 0 }));
  const runs = new Map((await db("bootcamps").whereIn("id", [...new Set(classRun.values())]).select("id", "name", "startDate", "endDate", "seriesId")).map((b) => [b.id, b]));
  const former = await formerMembersOf([...classRun.keys()]);
  const today = kenyaToday();
  return classes.map((c) => {
    const run = runs.get(classRun.get(c.id));
    return {
      ...c,
      bootcampRun: run ? { id: run.id, name: run.name, startDate: dayOf(run.startDate), endDate: dayOf(run.endDate), seriesId: run.seriesId || run.id, state: runState(run, today) } : null,
      movedOnCount: (former.get(c.id) || []).length,
    };
  });
}

module.exports = { formerMembersOf, formerMembers, finishingLearnerIds, runsOfClasses, withRunInfo, runState };
