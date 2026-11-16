const db = require("../../config/db");
const { periodWord, CURRENCY } = require("../home-learning/home-learning.pricing");
const { kenyaToday } = require("../../shared/utils/age");

// Where a learner is at, for the Move learner window (16 Nov 2026): each place they hold described
// in a few facts — class, curriculum, stage, educators, admission number and when they joined; for a
// household / membership / subscription its package, price, how far it's invoiced and how many
// children are on it; for a pathway plan the stage and the course they're on and until when its
// courses are open — plus what they're learning now on each pathway they're placed on.
// Read only, and only for the window: the move itself never needs it.
//
// Older and newer tables don't share a collation, so every lookup is its own query (no SQL joins).

const pad = (n) => String(n).padStart(2, "0");
const dayOf = (v) => {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
  return String(v).slice(0, 10);
};
const fmtDay = (v) => {
  const d = dayOf(v);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
const fmtWhen = (v) => (v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }) : null);
const money = (amount, period) => (amount == null ? null : `${CURRENCY} ${Number(amount).toLocaleString("en-KE")}${period ? ` · ${periodWord(period)}` : ""}`);
const classLabel = (cls) => (cls ? [cls.gradeName, cls.streamName].filter(Boolean).join(" · ") || "Class" : null);
// A start day still to come is when billing starts, not when it started.
const startFact = (v) => {
  const d = dayOf(v);
  if (!d) return [null, null];
  return [d > kenyaToday() ? "Billing starts" : "Started", fmtDay(d)];
};
const nameOf = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ");
const lower = (s) => String(s || "").trim().toLowerCase();

async function byId(table, ids, columns) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  return new Map((await db(table).whereIn("id", list).select(columns)).map((r) => [r.id, r]));
}

// The facts are [{ label, value }]; a fact with no value is left out.
const facts = (...pairs) => pairs.filter(([, value]) => value != null && value !== "").map(([label, value]) => ({ label, value: String(value) }));

async function describePlaces(learnerId, places) {
  const links = await db("learner_hub_links").where({ learnerId });
  const linkAt = (hubId) => links.find((l) => l.hubId === hubId) || null;

  const hl = await db("home_learning_enrollments").where({ learnerId });
  const subChildren = await db("pathway_subscription_children").where({ learnerId });

  const ofKind = (prefix) => places.filter((p) => p.key.startsWith(prefix)).map((p) => p.recordId);
  const households = await byId("home_learning_households", ofKind("hl:"), ["id", "packageId", "amount", "billingPeriod", "billedThrough", "startDate", "childCount", "status"]);
  const memberships = await byId("club_memberships", ofKind("club:"), ["id", "packageId", "amount", "billingPeriod", "billedThrough", "startDate", "childCount", "status"]);
  const subs = await byId("pathway_subscriptions", ofKind("pathway:"), ["id", "packageId", "amount", "billingPeriod", "accessUntil", "startDate", "childCount", "status", "curriculumId", "pathwayName"]);
  const bootcamps = await byId("bootcamps", places.filter((p) => p.programme === "bootcamp").map((p) => p.recordId), ["id", "startDate", "endDate"]);

  const hlPackages = await byId("home_learning_packages", [...households.values()].map((h) => h.packageId), ["id", "name"]);
  const clubPackages = await byId("club_packages", [...memberships.values()].map((m) => m.packageId), ["id", "name"]);

  const classIds = [...places.map((p) => p.classId), ...hl.map((e) => e.classId)].filter(Boolean);
  const classes = await byId("classes", classIds, ["id", "gradeName", "streamName", "curriculumId", "academicYear"]);
  const curricula = await byId("curricula", [...places.map((p) => p.curriculumId), ...[...classes.values()].map((c) => c.curriculumId), ...hl.map((e) => e.curriculumId)], ["id", "name"]);
  const stages = await byId("age_categories", links.map((l) => l.currentStageId), ["id", "name"]);

  // Each class's educators (the class's course links), and Home Learning's own educator.
  const teacherLinks = classIds.length ? await db("class_course_teacher_links").whereIn("classId", [...new Set(classIds)]).select("classId", "teacherId") : [];
  const teachers = await byId("teachers", [...teacherLinks.map((t) => t.teacherId), ...hl.map((e) => e.educatorId)], ["id", "firstName", "lastName"]);
  const educatorsOf = (classId) => [...new Set(teacherLinks.filter((t) => t.classId === classId).map((t) => nameOf(teachers.get(t.teacherId))).filter(Boolean))].join(", ") || null;

  // Pathway placements: the course they're on, on each pathway row.
  const placements = await db("learner_pathways").where({ learnerId });
  const pathwayRows = await byId("pathways", [...placements.map((p) => p.pathwayId), ...subChildren.map((c) => c.pathwayId)], ["id", "name", "curriculumId", "ageCategoryId"]);
  const rowStages = await byId("age_categories", [...pathwayRows.values()].map((r) => r.ageCategoryId), ["id", "name"]);
  const courses = await byId("courses", placements.map((p) => p.currentCourseId), ["id", "name"]);
  const curriculaOfRows = await byId("curricula", [...pathwayRows.values()].map((r) => r.curriculumId), ["id", "name"]);

  const classFacts = (classId, link) => {
    const cls = classes.get(classId);
    return [
      ["Class", cls ? `${classLabel(cls)}${cls.academicYear ? ` (${cls.academicYear})` : ""}` : null],
      ["Curriculum", cls ? curricula.get(cls.curriculumId)?.name : null],
      ["Stage", link?.currentStageId ? stages.get(link.currentStageId)?.name : null],
      ["Educators", classId ? educatorsOf(classId) : null],
    ];
  };
  const linkFacts = (link) => [
    ["Admission no.", link?.admissionNumber],
    ["Joined", fmtWhen(link?.createdAt)],
  ];

  const details = {};
  for (const p of places) {
    const link = p.hubId ? linkAt(p.hubId) : null;
    if (p.programme === "hub" || p.programme === "bootcamp") {
      const run = p.programme === "bootcamp" ? bootcamps.get(p.recordId) : null;
      details[p.key] = facts(
        ...classFacts(p.classId, link),
        ["Bootcamp dates", run ? [fmtDay(run.startDate), fmtDay(run.endDate)].filter(Boolean).join(" – ") : null],
        ...linkFacts(link),
      );
    } else if (p.programme === "home_learning") {
      const h = households.get(p.recordId);
      const e = hl.find((x) => x.householdId === p.recordId);
      details[p.key] = facts(
        ["Curriculum", e ? [curricula.get(e.curriculumId)?.name, e.gradeName].filter(Boolean).join(" · ") : null],
        ["Educator", e?.educatorId ? nameOf(teachers.get(e.educatorId)) : "None yet"],
        ["Stage", link?.currentStageId ? stages.get(link.currentStageId)?.name : null],
        ["Package", h ? hlPackages.get(h.packageId)?.name : null],
        ["Price", h ? money(h.amount, h.billingPeriod) : null],
        ["Children on it", h ? `${p.activeChildren ?? 0} of ${h.childCount}` : null],
        startFact(h?.startDate),
        ["Invoiced up to", fmtDay(h?.billedThrough)],
      );
    } else if (p.programme === "tech_club") {
      const m = memberships.get(p.recordId);
      details[p.key] = facts(
        ...classFacts(p.classId, link),
        ["Package", m ? clubPackages.get(m.packageId)?.name : null],
        ["Price", m ? money(m.amount, m.billingPeriod) : null],
        ["Children on it", m ? `${p.activeChildren ?? 0} of ${m.childCount}` : null],
        startFact(m?.startDate),
        ["Invoiced up to", fmtDay(m?.billedThrough)],
      );
    } else if (p.programme === "pathway") {
      const s = subs.get(p.recordId);
      const child = subChildren.find((c) => c.subscriptionId === p.recordId);
      const row = child?.pathwayId ? pathwayRows.get(child.pathwayId) : null;
      // The course they're on: their placement on any stage of this pathway in its curriculum.
      const sameRows = new Set([...pathwayRows.values()].filter((r) => r.curriculumId === s?.curriculumId && lower(r.name) === lower(s?.pathwayName)).map((r) => r.id));
      const placed = placements.filter((x) => sameRows.has(x.pathwayId)).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];
      details[p.key] = facts(
        ["Curriculum", s ? curricula.get(s.curriculumId)?.name : null],
        ["Stage", row?.ageCategoryId ? rowStages.get(row.ageCategoryId)?.name : null],
        ["Now on", placed ? courses.get(placed.currentCourseId)?.name : null],
        ["Price", s ? money(s.amount, s.billingPeriod) : null],
        ["Courses open until", s?.accessUntil ? fmtDay(s.accessUntil) : "Not paid yet"],
        ["Children on it", s ? `${p.activeChildren ?? 0} of ${s.childCount}` : null],
        startFact(s?.startDate),
      );
    }
  }

  // What they're learning now: each pathway they're placed on and the course they're at.
  const learning = placements
    .map((x) => {
      const row = pathwayRows.get(x.pathwayId);
      if (!row) return null;
      return {
        pathway: row.name,
        stage: row.ageCategoryId ? rowStages.get(row.ageCategoryId)?.name || null : null,
        course: courses.get(x.currentCourseId)?.name || null,
        curriculum: curriculaOfRows.get(row.curriculumId)?.name || null,
        since: fmtWhen(x.updatedAt || x.createdAt),
      };
    })
    .filter(Boolean);

  return { details, learning };
}

module.exports = { describePlaces };
