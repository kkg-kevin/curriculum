const db = require("../../config/db");
const { kenyaToday } = require("../../shared/utils/age");

// "Moved on" learners of a bootcamp run's class (26 Nov 2026). A hub holds one place per learner,
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


const fmtDay = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

// A class of a bootcamp run only takes dates inside that run. When someone dates an OLD run's class
// for the next run (26 Nov 2026 — both runs' classes sit side by side at the hub), this says which
// run the class belongs to and names the same cohort's class in the newest run of the same bootcamp
// at that hub that hasn't ended. null for a class that isn't a run's.
async function laterRunClassOf(classId) {
  const [info] = await withRunInfo([{ id: classId }]);
  const run = info?.bootcampRun;
  if (!run) return null;
  const cls = await db("classes").where({ id: classId }).first("schoolId", "gradeId", "gradeName");
  const today = kenyaToday();
  const later = (await db("bootcamps").where((q) => q.where({ seriesId: run.seriesId }).orWhere({ id: run.seriesId })).whereNot({ id: run.id })
    .select("id", "name", "startDate", "endDate"))
    .filter((b) => runState(b, today) !== "ended" && (dayOf(b.startDate) || "") > (run.startDate || ""))
    .sort((a, b) => (dayOf(a.startDate) || "").localeCompare(dayOf(b.startDate) || ""));
  let next = null;
  for (const b of later) {
    // eslint-disable-next-line no-await-in-loop
    const offering = await db("bootcamp_hubs").where({ bootcampId: b.id, hubId: cls?.schoolId }).first("classIds");
    const ids = list(offering?.classIds);
    // eslint-disable-next-line no-await-in-loop
    const match = ids.length ? await db("classes").whereIn("id", ids).where({ gradeId: cls.gradeId }).whereNot({ status: "inactive" }).first("id", "gradeName", "streamName") : null;
    if (match) { next = { id: match.id, label: [match.gradeName, match.streamName].filter(Boolean).join(" · "), runId: b.id, startDate: dayOf(b.startDate), endDate: dayOf(b.endDate) }; break; }
  }
  return { run, next, laterRunWithoutClass: !next && later.length ? { id: later[0].id, startDate: dayOf(later[0].startDate) } : null };
}

// The sentence for a date refused on a run's class: whose run it is, and where to go instead.
async function outsideRunHint(classId) {
  const found = await laterRunClassOf(classId).catch(() => null);
  if (!found) return "";
  const { run, next, laterRunWithoutClass } = found;
  const span = `${fmtDay(run.startDate)} to ${fmtDay(run.endDate)}`;
  if (next) return ` This class belongs to the run of ${span}. For the run starting ${fmtDay(next.startDate)}, use its own class: ${next.label}.`;
  if (laterRunWithoutClass) return ` This class belongs to the run of ${span}. The run starting ${fmtDay(laterRunWithoutClass.startDate)} has no class for this cohort at this hub yet: open that run's page and add the hub (or "Add missing classes" on it).`;
  if (run.state === "ended") return ` This class belongs to the run of ${span}, which has ended. To run the bootcamp again, use "Schedule another run" on the bootcamp's page: the new run gets its own classes with its own dates.`;
  return ` This class's run is ${span}.`;
}

module.exports = { formerMembersOf, formerMembers, finishingLearnerIds, runsOfClasses, withRunInfo, runState, laterRunClassOf, outsideRunHint };
