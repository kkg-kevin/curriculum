const db = require("../../config/db");
const R = require("./removal.rules");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const { generateId } = require("../../shared/utils/model.utils");
const { todayInKenya } = require("../checkins/checkin.dates");

// Removing a learning hub (modules/removals/removal.service.js says how the steps fit together).
//
// Deactivate: the hub's usual switch-off (learning-hub.service.js's cascadeHubDeactivation — its
// branches too, its learners' places and people only here go inactive). Moving someone to another
// hub switches them back on there.
// Handed over to another active hub of the workspace (each item may go to a different one):
//   each class — with its learners' places (an existing place at the new hub is kept), its
//   educators (linked there), its parent check-in rounds; learners and educators not in a class;
//   rooms (renamed if the new hub has one of that name); branch hubs (or left on their own);
//   bootcamp and competition runs; Tech Club memberships and the club packages offered here;
//   pathway subscriptions and pathways shown at it on the website; QA schedules; open enquiries.
// Sorted out first elsewhere: mentor sessions still to come in its spaces, desk fees still owed
// to it, events still to come there, draft invoices.
// By itself on delete: check-in schedules end, its Account Manager / Training Lead come off, its
// own login is retired.
// Kept under its name: invoices and receipts (still payable, still open from Billing), orders, hub
// visits, check-in and QA reports, certificates, settlements — so the hub stays as a tombstone
// (status "removed", email cleared), hidden from every list but billing's.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const lower = (s) => String(s || "").trim().toLowerCase();
const nameOf = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const classLabel = (c) => [c?.gradeName, c?.streamName].filter(Boolean).join(" ").trim() + (c?.academicYear ? ` (${c.academicYear})` : "") || "A class";
const jsonHas = (column, id) => [`CAST(?? AS CHAR) LIKE ?`, [column, `%${id}%`]];
const parseList = (v) => {
  if (Array.isArray(v)) return v;
  try { const parsed = JSON.parse(v || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};
const count = async (q) => Number((await q.count({ n: "*" }).first())?.n || 0);

async function load(req, id) {
  const person = await LearningHubModel.findById(id);
  if (!person || person.ownerAdminId !== req.ownerAdminId) fail("Learning hub not found", 404);
  if (person.isHomeLearning) fail("The Home Learning hub can't be removed — it holds every Home Learning child", 409);
  return { req, id, person, ownerAdminId: req.ownerAdminId };
}

function describe({ person }) {
  return {
    id: person.id,
    name: person.name || "Learning hub",
    detail: [person.code, person.email || person.removedEmail].filter(Boolean).join(" · ") || null,
    status: person.status,
    deactivated: ["inactive", "removed"].includes(person.status),
    removed: person.status === "removed",
    removedAt: person.removedAt || null,
    deactivateNote: "Deactivating switches the hub off with its branches: its learners' places, and educators who teach nowhere else, go inactive. Whoever you move to another hub is switched back on there.",
  };
}

// ---- What it holds -----------------------------------------------------------------------------

async function holdings(ctx) {
  const { id } = ctx;
  const items = [];
  const add = (type, group, rowId, label, detail = null, extra = {}) => items.push({ key: R.itemKey(type, rowId), type, group, id: rowId, label, detail, ...extra });

  const classes = await db("classes").where({ schoolId: id }).orderBy("gradeName").select("id", "gradeName", "streamName", "academicYear");
  for (const c of classes) {
    const learners = await count(db("learner_hub_links").where({ hubId: id, classId: c.id }));
    add("class", "Classes", c.id, classLabel(c), `${R.counted(learners, "learner", "learners")} move with it`);
  }
  const loose = await count(db("learner_hub_links").where({ hubId: id }).where((w) => w.whereNull("classId").orWhere("classId", "")));
  if (loose) add("looseLearners", "Learners", id, R.counted(loose, "learner not in a class", "learners not in a class"));
  const classIds = classes.map((c) => c.id);
  const teaching = classIds.length ? await db("class_course_teacher_links").whereIn("classId", classIds).distinct("teacherId").pluck("teacherId") : [];
  const looseEducators = await db("teacher_hub_links").where({ hubId: id }).whereNotIn("teacherId", teaching.length ? teaching : [""]).pluck("teacherId");
  if (looseEducators.length) add("looseEducators", "Educators", id, R.counted(looseEducators.length, "educator not teaching a class here", "educators not teaching a class here"), "Linked to the new hub");

  for (const r of await db("rooms").where({ hubId: id }).orderBy("name").select("id", "name")) add("room", "Rooms", r.id, r.name);
  for (const b of await db("learning_hubs").where({ parentHubId: id }).whereNot({ status: "removed" }).orderBy("name").select("id", "name", "status")) {
    add("branch", "Branch hubs", b.id, b.name, "Under another hub, or on its own", { allowNone: true });
  }

  const bootcampRuns = await db("bootcamp_hubs").where({ hubId: id }).select("id", "bootcampId");
  const bootcamps = new Map((bootcampRuns.length ? await db("bootcamps").whereIn("id", bootcampRuns.map((b) => b.bootcampId)).select("id", "name", "endDate") : []).map((b) => [b.id, b]));
  const today = todayInKenya();
  for (const run of bootcampRuns) {
    const b = bootcamps.get(run.bootcampId);
    if (b?.endDate && String(b.endDate).slice(0, 10) < today) continue; // a past run is history
    add("bootcampRun", "Bootcamps and competitions", run.id, b?.name || "A bootcamp");
  }
  const competitionRuns = await db("competition_hubs").where({ hubId: id }).select("id", "competitionId");
  const competitions = new Map((competitionRuns.length ? await db("competitions").whereIn("id", competitionRuns.map((c) => c.competitionId)).select("id", "name") : []).map((c) => [c.id, c]));
  for (const run of competitionRuns) add("competitionRun", "Bootcamps and competitions", run.id, competitions.get(run.competitionId)?.name || "A competition");

  const clubs = await count(db("club_memberships").where({ hubId: id }).whereNot({ status: "cancelled" }));
  if (clubs) add("clubMemberships", "Tech Club", id, R.counted(clubs, "Tech Club membership", "Tech Club memberships"));
  for (const p of await db("club_packages").where({ ownerAdminId: ctx.ownerAdminId }).whereRaw(...jsonHas("hubIds", id)).select("id", "name", "hubIds")) {
    if (parseList(p.hubIds).includes(id)) add("clubPackage", "Tech Club", p.id, `Package "${p.name}" offered here`);
  }

  const subs = await count(db("pathway_subscriptions").where({ hubId: id }).whereNot({ status: "cancelled" }));
  if (subs) add("pathwaySubscriptions", "Pathways", id, R.counted(subs, "pathway subscription", "pathway subscriptions"));
  for (const p of await db("pathway_templates").where({ ownerAdminId: ctx.ownerAdminId }).whereRaw(...jsonHas("websiteHubIds", id)).select("id", "name", "websiteHubIds")) {
    if (parseList(p.websiteHubIds).includes(id)) add("websitePathway", "Pathways", p.id, `${p.name} — shown at this hub on the website`);
  }

  const qa = await count(db("qa_schedules").where({ hubId: id, status: "active" }));
  if (qa) add("qaSchedules", "Other", id, R.counted(qa, "QA visit schedule", "QA visit schedules"));
  const leads = await count(db("leads").where({ hubId: id }).whereIn("status", ["new", "contacted"]));
  if (leads) add("leads", "Other", id, R.counted(leads, "open enquiry", "open enquiries"));
  return items;
}

async function candidates(ctx) {
  const hubs = await LearningHubModel.findAll({ ownerAdminId: ctx.ownerAdminId, status: "active" });
  return hubs.filter((h) => h.id !== ctx.id && !h.isHomeLearning)
    .map((h) => ({ id: h.id, name: h.name, detail: [h.code, h.parentHubId ? "Branch" : null].filter(Boolean).join(" · ") || null }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Handing over --------------------------------------------------------------------------------

async function targetHub(ctx, toId) {
  const hub = await LearningHubModel.findById(toId);
  if (!hub || hub.ownerAdminId !== ctx.ownerAdminId || hub.status !== "active" || hub.isHomeLearning) fail("Choose an active learning hub", 409);
  return hub;
}

// A learner's place here moves to `to` (in `classId`, or none). Already placed at `to`: that place
// is kept (given this class when it has none) and this one goes. Either way it's written to the
// learner's transfers, and someone the hub's deactivation switched off is switched back on.
async function moveLearnerLink(ctx, link, to, classId) {
  const existing = await db("learner_hub_links").where({ learnerId: link.learnerId, hubId: to.id }).first();
  if (existing) {
    const patch = { status: "active", updatedAt: new Date() };
    if (classId && !existing.classId) patch.classId = classId;
    await db("learner_hub_links").where({ id: existing.id }).update(patch);
    await db("learner_hub_links").where({ id: link.id }).del();
  } else {
    await db("learner_hub_links").where({ id: link.id }).update({ hubId: to.id, classId: classId || null, spaceId: null, status: "active", updatedAt: new Date() });
  }
  await db("learner_transfers").insert({
    id: generateId(), learnerId: link.learnerId, fromHubId: ctx.id, toHubId: to.id, fromClassId: link.classId || null, toClassId: classId || null,
    fromAdmissionNumber: link.admissionNumber || null, transferredBy: ctx.req.user.id, notes: `${ctx.person.name} was removed`, createdAt: new Date(),
  });
  await db("learners").where({ id: link.learnerId, accountStatus: "inactive" }).update({ accountStatus: "active", updatedAt: new Date() });
}

// An educator now teaching at `to`: linked there, and switched back on if the hub's deactivation
// switched them off (never one being removed).
async function moveEducator(teacherId, to) {
  await TeacherHubLinkModel.link(teacherId, to.id);
  await db("teachers").where({ id: teacherId, status: "inactive" }).update({ status: "active", updatedAt: new Date() });
}

const replaceInList = (list, from, to) => {
  const next = list.filter((x) => x !== from);
  if (to && !next.includes(to)) next.push(to);
  return next;
};

const HANDLERS = {
  async class(ctx, item, toId) {
    const cls = await db("classes").where({ id: item.id, schoolId: ctx.id }).first();
    if (!cls) return;
    const to = await targetHub(ctx, toId);
    const clash = await db("classes").where({ schoolId: to.id, curriculumId: cls.curriculumId, gradeId: cls.gradeId, academicYear: cls.academicYear })
      .whereRaw("LOWER(COALESCE(streamName, '')) = ?", [lower(cls.streamName)]).first("id");
    if (clash) fail(`${to.name} already has a class ${classLabel(cls)} — rename one of them first, or choose another hub`, 409);
    await db("classes").where({ id: cls.id }).update({ schoolId: to.id, updatedAt: new Date() });
    for (const link of await db("learner_hub_links").where({ hubId: ctx.id, classId: cls.id })) await moveLearnerLink(ctx, link, to, cls.id);
    for (const teacherId of await db("class_course_teacher_links").where({ classId: cls.id }).distinct("teacherId").pluck("teacherId")) await moveEducator(teacherId, to);
    await db("mentor_checkin_rounds").where({ classId: cls.id, hubId: ctx.id }).update({ hubId: to.id, updatedAt: new Date() });
  },

  async looseLearners(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    const links = await db("learner_hub_links").where({ hubId: ctx.id }).where((w) => w.whereNull("classId").orWhere("classId", ""));
    for (const link of links) await moveLearnerLink(ctx, link, to, null);
  },

  async looseEducators(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    for (const teacherId of await db("teacher_hub_links").where({ hubId: ctx.id }).pluck("teacherId")) {
      const teachesHere = await db("class_course_teacher_links").join("classes", "classes.id", "class_course_teacher_links.classId")
        .where("classes.schoolId", ctx.id).where("class_course_teacher_links.teacherId", teacherId).first("class_course_teacher_links.id");
      if (!teachesHere) await moveEducator(teacherId, to);
    }
  },

  async room(ctx, item, toId) {
    const room = await db("rooms").where({ id: item.id, hubId: ctx.id }).first();
    if (!room) return;
    const to = await targetHub(ctx, toId);
    let name = room.name;
    if (await db("rooms").where({ hubId: to.id }).whereRaw("LOWER(name) = ?", [lower(name)]).first("id")) name = `${room.name} (from ${ctx.person.name})`.slice(0, 150);
    await db("rooms").where({ id: room.id }).update({ hubId: to.id, name, updatedAt: new Date() });
  },

  async branch(ctx, item, target) {
    if (target === R.NOBODY) {
      await db("learning_hubs").where({ id: item.id, parentHubId: ctx.id }).update({ parentHubId: null, updatedAt: new Date() });
      return;
    }
    const to = await targetHub(ctx, target);
    if (to.id === item.id) fail("A hub can't be its own branch", 409);
    if (to.parentHubId) fail(`${to.name} is a branch itself — choose a main hub, or leave it on its own`, 409);
    await db("learning_hubs").where({ id: item.id, parentHubId: ctx.id }).update({ parentHubId: to.id, updatedAt: new Date() });
  },

  async bootcampRun(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    const run = await db("bootcamp_hubs").where({ id: item.id }).first();
    if (!run) return;
    if (await db("bootcamp_hubs").where({ bootcampId: run.bootcampId, hubId: to.id }).first("id")) fail(`This bootcamp already runs at ${to.name}`, 409);
    await db("bootcamp_hubs").where({ id: run.id }).update({ hubId: to.id, updatedAt: new Date() });
  },

  async competitionRun(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    const run = await db("competition_hubs").where({ id: item.id }).first();
    if (!run) return;
    if (await db("competition_hubs").where({ competitionId: run.competitionId, hubId: to.id }).first("id")) fail(`This competition already runs at ${to.name}`, 409);
    await db("competition_hubs").where({ id: run.id }).update({ hubId: to.id, updatedAt: new Date() });
  },

  async clubMemberships(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    await db("club_memberships").where({ hubId: ctx.id }).whereNot({ status: "cancelled" }).update({ hubId: to.id, updatedAt: new Date() });
  },

  // An empty list means "every club" (club-package.model.js), so the new hub always takes its place.
  async clubPackage(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    const pkg = await db("club_packages").where({ id: item.id }).first("hubIds");
    if (!pkg) return;
    await db("club_packages").where({ id: item.id }).update({ hubIds: JSON.stringify(replaceInList(parseList(pkg.hubIds), ctx.id, to.id)), updatedAt: new Date() });
  },

  async pathwaySubscriptions(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    await db("pathway_subscriptions").where({ hubId: ctx.id }).whereNot({ status: "cancelled" }).update({ hubId: to.id, updatedAt: new Date() });
  },

  async websitePathway(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    const p = await db("pathway_templates").where({ id: item.id }).first("websiteHubIds");
    if (!p) return;
    await db("pathway_templates").where({ id: item.id }).update({ websiteHubIds: JSON.stringify(replaceInList(parseList(p.websiteHubIds), ctx.id, to.id)), updatedAt: new Date() });
  },

  async qaSchedules(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    await db("qa_schedules").where({ hubId: ctx.id, status: "active" }).update({ hubId: to.id, updatedAt: new Date() });
    await db("qa_visits").where({ hubId: ctx.id, status: "open" }).update({ hubId: to.id, updatedAt: new Date() });
  },

  async leads(ctx, item, toId) {
    const to = await targetHub(ctx, toId);
    await db("leads").where({ hubId: ctx.id }).whereIn("status", ["new", "contacted"]).update({ hubId: to.id, updatedAt: new Date() });
  },
};

async function transferItem(ctx, item, target) {
  const handler = HANDLERS[item.type];
  if (!handler) fail("This can't be handed over here", 400);
  await handler(ctx, item, target);
}

// ---- Settle, automatic, history ------------------------------------------------------------------

async function toSettle(ctx) {
  const { id } = ctx;
  const today = todayInKenya();
  const out = [];
  const bookings = await count(db("mentor_bookings").where({ hubId: id, mode: "hub" }).whereIn("status", ["held", "confirmed"]).where("date", ">=", today));
  if (bookings) out.push({ label: `${R.counted(bookings, "mentor session", "mentor sessions")} still to come in its spaces`, detail: "Cancel them, or ask the families to book another place.", href: "/mentor-bookings" });
  const owed = await db("mentor_bookings").where({ hubId: id }).whereIn("status", ["completed", "no_show"]).whereNull("settlementId").where("hubShare", ">", 0).select("hubShare");
  if (owed.length) {
    const total = owed.reduce((s, b) => s + Number(b.hubShare || 0), 0);
    out.push({ label: `Desk fees still owed to it (KSh ${total.toLocaleString("en-KE")})`, detail: "Settle them from Mentor Bookings → Hub settlements.", href: "/mentor-bookings?tab=settlements" });
  }
  const events = await count(db("general_events").where({ hubId: id }).whereNot({ status: "cancelled" }).where("endDate", ">=", today));
  if (events) out.push({ label: `${R.counted(events, "event", "events")} still to come there`, detail: "Change the venue, or cancel the event.", href: "/events#general" });
  const drafts = await count(db("billing_invoices").where({ status: "draft" }).where((w) => w.where({ hubId: id }).orWhere({ issuerHubId: id }).orWhere({ payerHubId: id })));
  if (drafts) out.push({ label: `${R.counted(drafts, "draft invoice", "draft invoices")}`, detail: "Issue or delete them in Billing.", href: "/billing" });
  return out;
}

async function automatic(ctx) {
  const { id, person } = ctx;
  const schedules = await count(db("checkin_schedules").where({ hubId: id, status: "active" }));
  return [
    schedules && `${R.counted(schedules, "hub check-in schedule", "hub check-in schedules")} will end`,
    (person.accountManagerId || person.trainingLeadId) && "Its Account Manager and Training Lead come off it",
    person.email && "The hub's own sign-in stops (any other role on the same login stays)",
    "It disappears from hub lists and the website; its invoices stay in Billing",
  ].filter(Boolean);
}

async function runAutomatic(ctx) {
  const { id, person } = ctx;
  const today = todayInKenya();
  const now = new Date();
  const schedules = await db("checkin_schedules").where({ hubId: id, status: "active" }).select("id");
  for (const s of schedules) {
    await db("checkin_schedules").where({ id: s.id }).update({ status: "ended", endDate: today, updatedBy: ctx.req.user.id, updatedAt: now });
    const upcoming = await db("checkin_sessions").where({ scheduleId: s.id, status: "open" }).where("scheduledDate", ">", today).pluck("id");
    if (upcoming.length) {
      await db("checkin_participants").whereIn("sessionId", upcoming).del();
      await db("checkin_sessions").whereIn("id", upcoming).del();
    }
  }
  const leads = [person.accountManagerId, person.trainingLeadId].filter(Boolean);
  if (leads.length) {
    await db("learning_hubs").where({ id }).update({ accountManagerId: null, trainingLeadId: null, updatedAt: now });
    await require("../checkins/checkin.service").syncHubLeadRole(leads);
  }
}

async function history(ctx) {
  const { id } = ctx;
  const [invoices, orders, visits, checkins, qa, certificates, settlements, reports] = await Promise.all([
    count(db("billing_invoices").where((w) => w.where({ hubId: id }).orWhere({ issuerHubId: id }).orWhere({ payerHubId: id }))),
    count(db("orders").where((w) => w.where({ hubId: id }).orWhere({ pickupHubId: id }))),
    count(db("hub_visits").where({ hubId: id })),
    count(db("checkin_sessions").where({ hubId: id, status: "reported" })),
    count(db("qa_visits").where({ hubId: id, status: "submitted" })),
    count(db("certificates").where({ hubId: id })),
    count(db("hub_settlements").where({ hubId: id })),
    count(db("reports").where({ hubId: id })),
  ]);
  return [
    invoices && R.counted(invoices, "invoice", "invoices"),
    orders && R.counted(orders, "website order", "website orders"),
    visits && R.counted(visits, "hub visit", "hub visits"),
    checkins && R.counted(checkins, "hub check-in report", "hub check-in reports"),
    qa && R.counted(qa, "QA report", "QA reports"),
    certificates && R.counted(certificates, "certificate", "certificates"),
    settlements && R.counted(settlements, "desk-fee settlement", "desk-fee settlements"),
    reports && R.counted(reports, "learner report", "learner reports"),
  ].filter(Boolean);
}

async function deactivate(ctx) {
  await require("../learning-hubs/learning-hub.service").updateLearningHub(ctx.id, { status: "inactive" });
}

async function hubLogin(ctx) {
  if (!ctx.person.email) return null;
  const others = await db("learning_hubs").whereRaw("LOWER(email) = ?", [lower(ctx.person.email)]).whereNot({ id: ctx.id }).whereNot({ status: "removed" }).first("id");
  if (others) return null;
  return db("users").whereRaw("LOWER(email) = ?", [lower(ctx.person.email)]).first();
}

async function remove(ctx, { history: kept = [] } = {}) {
  const AuthService = require("../auth/auth.service");
  const login = await hubLogin(ctx);
  if (!kept.length) {
    await require("../learning-hubs/learning-hub.service").deleteLearningHub(ctx.id);
    if (login) await AuthService.dropRole(login, "school");
    return "deleted";
  }
  // Whatever is left of its own (nothing ongoing — that's been handed over): links and rooms go,
  // the record stays for its history.
  await db("learning_hub_curricula").where({ hubId: ctx.id }).del();
  await db("teacher_hub_links").where({ hubId: ctx.id }).del();
  await db("learner_hub_links").where({ hubId: ctx.id }).del();
  await db("learning_hubs").where({ id: ctx.id }).update({
    status: "removed", removedAt: new Date(), removedBy: ctx.req.user.id, removedEmail: ctx.person.email || null, email: null,
    accountManagerId: null, trainingLeadId: null, updatedAt: new Date(),
  });
  if (login) await AuthService.retireRole(login, "school");
  return "tombstone";
}

module.exports = { load, describe, holdings, candidates, transferItem, toSettle, automatic, runAutomatic, history, deactivate, remove };
