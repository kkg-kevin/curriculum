const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");
const BillingModel = require("../billing/billing.model");
const ClaimSettingsModel = require("../claims/claim-settings.model");
const { workspaceTeacherIds } = require("../qa/qa.access");
const { can } = require("../access/access.service");
const R = require("./mentor-booking.rules");
const Notify = require("./mentor-booking.notifications");

// Mentor bookings (11 Nov 2026). Pathway learners learn on their own; their mentors mark the work.
// When a learner is stuck on a session, they ask for help (a help request — a child's login never
// sees money) and their parent books ANY published mentor of the workspaces their children learn in
// to take them through it:
//   1. the parent picks the mentor, what the child is stuck on, how long, online or at a hub's
//      space (desk & chair), and a free time — inside the mentor's weekly availability, never
//      sooner than the notice, never when the mentor has a class, a check-in or another booking;
//   2. pay first: the time is HELD (holdMinutes) and one invoice raised — the mentor session at the
//      workspace's rate (Settings → Educator Pay → Mentor bookings) and the space at its own price.
//      Paying it in full confirms the booking (billing.paid-hooks.js → onInvoicePaid). A hold not
//      paid in time is released (billing:process → releaseExpiredHolds). A pathway plan may include
//      some sessions each period (pathway_packages.includedHelpSessions): then the mentor line is 0,
//      and with nothing to pay the booking is confirmed at once;
//   3. after it, the mentor (or staff) marks it held or no-show with a note for the parent; held
//      bookings are paid to the mentor through a claim (claims/ — type "bookings") and count toward
//      their profile's hours;
//   4. desk fees (option C): the workspace collects everything; a partner hub's share (its desk fee
//      less the workspace's collection %, learning_hubs.deskFeeOwner / deskCollectionPercent) is
//      owed to it once the session has happened, and settled from its statement — paid out, or
//      credited on the hub's own unpaid invoices.
// Cancelling: see mentor-booking.rules.js's cancelOutcome. Money already paid on a cancelled
// booking is recorded as a refund due, which staff mark refunded once they've given it back.
//
// New tables (mentor_bookings, mentor_help_requests, hub_settlements) — no SQL joins to older ones.

const B = "mentor_bookings";
const H = "mentor_help_requests";
const S = "hub_settlements";
const OPEN_INVOICE = ["issued", "partially_paid", "overdue"];
const HAPPENED = ["completed", "no_show"];
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const parseJson = (v) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);
const lower = (v) => String(v || "").trim().toLowerCase();
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
const money = R.money;
const MONEY = ["mentorFee", "deskFee", "deskCollectionPercent", "hubShare", "educatorPay", "refundAmount"];

function shapeRow(row) {
  if (!row) return row;
  const out = { ...row, date: String(row.date).slice(0, 10), includedInPlan: !!row.includedInPlan };
  for (const k of MONEY) if (out[k] != null) out[k] = Number(out[k]);
  return out;
}

/* ── Settings (Settings → Educator Pay → Mentor bookings) ─────────────────────────────── */

async function settingsFor(ownerAdminId) {
  const row = ownerAdminId ? await db("claim_settings").where({ ownerAdminId }).first("mentorBookings") : null;
  return R.cleanSettings(parseJson(row?.mentorBookings) || {}).settings;
}

async function saveSettings(ownerAdminId, raw) {
  const { settings, error } = R.cleanSettings(raw);
  if (error) fail(error);
  if (!(await db("claim_settings").where({ ownerAdminId }).first("id"))) await ClaimSettingsModel.save(ownerAdminId, {});
  await db("claim_settings").where({ ownerAdminId }).update({ mentorBookings: JSON.stringify(settings), updatedAt: new Date() });
  return settings;
}

/* ── Who is asking ─────────────────────────────────────────────────────────────────────── */

//   manager  admins and staff (module "mentor-bookings"): the workspace's bookings, refunds, hub
//            settlements; with create/edit, cancelling, marking and settling
//   mentor   (teacher portal) their own bookings: mark, add the join link, cancel
//   hub      the hub's own login: bookings at its spaces, and its statement (read only)
//   parent   a parent's own email login: their children's bookings and help requests; books, pays,
//            cancels
//   child    a child's username login: asks for help, sees their own requests
async function contextOf(req) {
  const { role } = req.user;
  if (role === "admin") {
    const isStaff = req.user.actualRole === "collaborator";
    const p = req.user.permissions || null;
    return { kind: "manager", userId: req.user.id, ownerAdminId: req.ownerAdminId, canManage: !isStaff || can(p, "mentor-bookings", "edit") || can(p, "mentor-bookings", "create") };
  }
  if (role === "teacher") {
    const teacherIds = req.user.email ? await db("teachers").whereRaw("LOWER(email) = ?", [lower(req.user.email)]).pluck("id") : [];
    return { kind: "mentor", userId: req.user.id, teacherIds };
  }
  if (role === "school" && !req.user.hubLead) {
    return { kind: "hub", userId: req.user.id, hubIds: (req.ownSchools || (req.ownSchool ? [req.ownSchool] : [])).map((h) => h.id) };
  }
  if (role === "learner" && !req.user.totLearner) {
    if (req.user.username) return { kind: "child", userId: req.user.id, learner: req.ownLearner || null };
    return { kind: "parent", userId: req.user.id, learners: req.ownLearners || [] };
  }
  fail("You do not have permission to perform this action", 403);
}

const ownLearner = (ctx, learnerId) => {
  const l = (ctx.learners || []).find((x) => x.id === learnerId);
  if (!l) fail("Choose one of your children", 404);
  return l;
};

/* ── People ─────────────────────────────────────────────────────────────────────────────── */

async function parentUserIdsOf(learner) {
  const email = lower(learner?.guardianEmail);
  if (!email) return [];
  return db("users").whereRaw("LOWER(email) = ?", [email]).whereNull("username").pluck("id");
}
async function userIdOfTeacher(teacher) {
  return teacher?.email ? (await db("users").whereRaw("LOWER(email) = ?", [lower(teacher.email)]).first("id"))?.id || null : null;
}
const teacherById = (id) => db("teachers").where({ id }).first("id", "firstName", "lastName", "email", "phone", "photo", "status", "employmentType", "profilePublic", "profileSlug");
const learnerById = (id) => db("learners").where({ id }).first("id", "firstName", "lastName", "guardianEmail", "guardianName", "accountStatus");

// The workspaces a learner learns in: their hubs' and their pathway subscriptions'.
async function learnerWorkspaces(learnerId) {
  const hubIds = await db("learner_hub_links").where({ learnerId }).whereNot({ status: "inactive" }).distinct("hubId").pluck("hubId");
  const owners = new Set(hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).distinct("ownerAdminId").pluck("ownerAdminId") : []);
  const subIds = await db("pathway_subscription_children").where({ learnerId }).distinct("subscriptionId").pluck("subscriptionId");
  if (subIds.length) (await db("pathway_subscriptions").whereIn("id", subIds).distinct("ownerAdminId").pluck("ownerAdminId")).forEach((o) => owners.add(o));
  return [...owners].filter(Boolean);
}

// The workspace a learner may book this mentor in — a published, active educator of one of the
// learner's workspaces (the same mentors Find a mentor lists). Fails otherwise.
async function bookableWorkspace(learnerId, teacher) {
  if (!teacher || ["inactive", "removed"].includes(teacher.status) || teacher.status === "in_training") fail("This mentor can't be booked", 404);
  if (!teacher.profilePublic) fail("This mentor hasn't published their profile, so they can't be booked yet", 404);
  for (const owner of await learnerWorkspaces(learnerId)) {
    if ((await workspaceTeacherIds(owner)).includes(teacher.id)) return owner;
  }
  fail("This mentor isn't at any of your child's learning centres", 404);
}

// The hub an online booking is invoiced through: the learner's own hub in this workspace, else
// their pathway subscription's, else one of the mentor's hubs there, else any active hub.
async function invoiceHubFor(ownerAdminId, learnerId, teacherId) {
  const owned = db("learning_hubs").where({ ownerAdminId }).select("id");
  const link = await db("learner_hub_links").where({ learnerId }).whereNot({ status: "inactive" }).whereIn("hubId", owned).first("hubId");
  if (link) return link.hubId;
  const subIds = await db("pathway_subscription_children").where({ learnerId }).pluck("subscriptionId");
  const sub = subIds.length ? await db("pathway_subscriptions").whereIn("id", subIds).where({ ownerAdminId }).whereNotNull("hubId").first("hubId") : null;
  if (sub) return sub.hubId;
  const teach = await db("teacher_hub_links").where({ teacherId }).whereIn("hubId", owned).first("hubId");
  if (teach) return teach.hubId;
  return (await db("learning_hubs").where({ ownerAdminId, status: "active" }).first("id"))?.id || null;
}

// The workspace's hubs a family can come to: active, physical, with spaces open for booking.
async function bookableHubs(ownerAdminId) {
  const hubs = await db("learning_hubs").where({ ownerAdminId, status: "active" }).whereNot({ deliveryMode: "virtual" })
    .where((q) => q.whereNull("isHomeLearning").orWhere({ isHomeLearning: false }))
    .select("id", "name", "spaces", "deskFeeOwner", "deskCollectionPercent", "address");
  return hubs.map((h) => ({
    id: h.id, name: h.name, deskFeeOwner: h.deskFeeOwner || "ours", deskCollectionPercent: Number(h.deskCollectionPercent) || 0,
    town: parseJson(h.address)?.county || null,
    spaces: (parseJson(h.spaces) || []).filter((s) => s && s.id && s.reservable !== false),
  })).filter((h) => h.spaces.length);
}

/* ── What the learner is stuck on ───────────────────────────────────────────────────────── */

// Their courses: their classes' (the curriculum's live version, their grade) and their pathways'.
async function learnerCourses(learnerId) {
  const Versions = require("../curriculum/versions/curriculum-versions.service");
  const ids = new Set();
  const links = await db("learner_hub_links").where({ learnerId, status: "active" }).whereNotNull("classId");
  for (const link of links) {
    const cls = await db("classes").where({ id: link.classId }).first("curriculumId", "gradeId");
    if (cls?.curriculumId) (await Versions.getCurrentCourses(cls.curriculumId, cls.gradeId).catch(() => [])).forEach((c) => ids.add(c.id));
  }
  (await require("../pathway-subscriptions/pathway-access").openCourseIds(learnerId)).forEach((id) => ids.add(id));
  if (!ids.size) return [];
  const courses = await db("courses").whereIn("id", [...ids]).select("id", "name");
  const sessions = await db("course_sessions").whereIn("courseId", [...ids]).select("id", "courseId", "title", "order").orderBy("order", "asc");
  return courses.map((c) => ({ id: c.id, name: c.name, sessions: sessions.filter((s) => s.courseId === c.id).map((s, i) => ({ id: s.id, title: s.title || `Session ${i + 1}` })) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function courseAndSession(courseId, sessionId) {
  const course = courseId ? await db("courses").where({ id: courseId }).first("id", "name") : null;
  const session = sessionId ? await db("course_sessions").where({ id: sessionId }).first("id", "courseId", "title") : null;
  if (session && course && session.courseId !== course.id) fail("That session isn't part of that course");
  return { course, session };
}

/* ── Plans that include sessions ───────────────────────────────────────────────────────── */

// The learner's active pathway subscription in this workspace that includes mentor sessions, and
// how many of this period's are left: { subscriptionId, pathwayName, included, used, left, period }.
async function allowanceFor(ownerAdminId, learnerId) {
  const subIds = await db("pathway_subscription_children").where({ learnerId }).whereNot({ status: "removed" }).pluck("subscriptionId");
  if (!subIds.length) return null;
  const today = R.kenyaNow().date;
  for (const sub of await db("pathway_subscriptions").whereIn("id", subIds).where({ ownerAdminId, status: "active" })) {
    const plan = sub.packageId ? await db("pathway_packages").where({ id: sub.packageId }).first("includedHelpSessions") : null;
    const included = Number(plan?.includedHelpSessions) || 0;
    if (!included) continue;
    const period = await db("billing_invoices").where({ pathwaySubscriptionId: sub.id, status: "paid" })
      .where("periodStart", "<=", today).where("periodEnd", ">=", today).first("periodStart", "periodEnd");
    if (!period) continue;
    const start = String(period.periodStart).slice(0, 10);
    const end = String(period.periodEnd).slice(0, 10);
    const used = Number((await db(B).where({ planSubscriptionId: sub.id, includedInPlan: true }).whereNot({ status: "cancelled" })
      .whereBetween("date", [start, end]).count({ n: "*" }).first())?.n || 0);
    return { subscriptionId: sub.id, pathwayName: sub.pathwayName, included, used, left: R.allowanceLeft(included, used), period: { start, end } };
  }
  return null;
}

/* ── Busy times ─────────────────────────────────────────────────────────────────────────── */

// The bookings holding a mentor's (or a learner's, or a space's) time between two dates.
async function holdingBookings(where, from, to, { exceptId = null } = {}) {
  let q = db(B).whereIn("status", R.ACTIVE).whereBetween("date", [from, to]).where(where);
  if (exceptId) q = q.whereNot({ id: exceptId });
  const now = new Date();
  return (await q.select("id", "date", "startTime", "endTime", "status", "holdExpiresAt", "spaceId", "hubId")).map(shapeRow).filter((b) => R.holdsTime(b, now));
}

// Everything that makes a mentor busy: their weekly classes, their parent check-ins, their other
// bookings — and the learner's other bookings.
async function busyFor(teacherId, learnerId, from, to) {
  const weekly = await db("timetable_slots").where({ teacherId }).select("dayOfWeek", "startTime", "endTime");
  const checkins = await require("../mentor-checkins/mentor-checkin.service")._internal.busyFor([teacherId], from, to, { withBookings: false });
  const dated = [
    ...(checkins.dated || []),
    ...(await holdingBookings({ teacherId }, from, to)),
    ...(learnerId ? await holdingBookings({ learnerId }, from, to) : []),
  ];
  return { weekly: [...weekly, ...(checkins.weekly || [])], dated };
}

// A space is full at a time when its capacity of bookings overlap it.
async function spaceFull(hubId, spaceId, slot, capacity, { exceptId = null } = {}) {
  const at = await holdingBookings({ hubId, spaceId }, slot.date, slot.date, { exceptId });
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return at.filter((b) => toMin(b.startTime) < toMin(slot.endTime) && toMin(slot.startTime) < toMin(b.endTime)).length >= capacity;
}

/* ── Shaping for the screens ─────────────────────────────────────────────────────────────── */

async function decorate(rows, ctx) {
  if (!rows.length) return [];
  const teachers = new Map((await db("teachers").whereIn("id", [...new Set(rows.map((r) => r.teacherId))]).select("id", "firstName", "lastName", "photo", "profileSlug", "email")).map((t) => [t.id, t]));
  const learners = new Map((await db("learners").whereIn("id", [...new Set(rows.map((r) => r.learnerId))]).select("id", "firstName", "lastName", "guardianName", "guardianEmail", "guardianPhone")).map((l) => [l.id, l]));
  const invoiceIds = rows.map((r) => r.invoiceId).filter(Boolean);
  const invoices = new Map((invoiceIds.length ? await db("billing_invoices").whereIn("id", invoiceIds).select("id", "invoiceNumber", "status", "total", "amountPaid", "currency") : []).map((i) => [i.id, i]));
  const now = new Date();
  return rows.map((raw) => {
    const b = shapeRow(raw);
    const t = teachers.get(b.teacherId);
    const l = learners.get(b.learnerId);
    const inv = invoices.get(b.invoiceId);
    const state = R.bookingState(b, now);
    const manager = ctx.kind === "manager";
    const mine = ctx.kind === "mentor" && ctx.teacherIds.includes(b.teacherId);
    const family = ctx.kind === "parent";
    const live = R.ACTIVE.includes(b.status) && state !== "cancelled";
    const out = {
      ...b,
      state,
      mentor: t ? { id: t.id, name: fullName(t), photo: t.photo || null, slug: t.profileSlug || null } : null,
      learner: l ? { id: l.id, name: fullName(l) } : null,
      invoice: inv ? { id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status, total: Number(inv.total), amountPaid: Number(inv.amountPaid), currency: inv.currency } : null,
      total: money(b.mentorFee + b.deskFee),
      can: {
        pay: family && b.status === "held" && state === "held" && !!inv && OPEN_INVOICE.includes(inv.status),
        cancel: live && ((manager && ctx.canManage) || mine || family),
        mark: (manager && ctx.canManage || mine) && R.canMark(b, now),
        editLink: (manager && ctx.canManage || mine) && live && b.mode === "online",
        refund: manager && ctx.canManage && b.refundStatus === "due",
      },
    };
    // What each side may see: the family and the hub never see the mentor's pay or the hub split;
    // the mentor sees their pay, never the hub split.
    if (!manager) { delete out.hubShare; delete out.deskCollectionPercent; delete out.settlementId; }
    if (ctx.kind === "hub") { delete out.educatorPay; delete out.mentorNote; delete out.topic; }
    if (family || ctx.kind === "child") { delete out.educatorPay; delete out.claimId; }
    if (manager) out.parent = l ? { name: l.guardianName || null, email: l.guardianEmail || null, phone: l.guardianPhone || null } : null;
    return out;
  });
}

function canSee(ctx, b) {
  switch (ctx.kind) {
    case "manager": return b.ownerAdminId === ctx.ownerAdminId;
    case "mentor": return ctx.teacherIds.includes(b.teacherId);
    case "hub": return b.mode === "hub" && ctx.hubIds.includes(b.hubId);
    case "parent": return (ctx.learners || []).some((l) => l.id === b.learnerId);
    default: return false;
  }
}

async function load(ctx, id, { trx = db, forUpdate = false } = {}) {
  let q = trx(B).where({ id });
  if (forUpdate) q = q.forUpdate();
  const row = shapeRow(await q.first());
  if (!row || !canSee(ctx, row)) fail("Booking not found", 404);
  return row;
}

async function nextInvoiceNumber(trx) {
  const year = new Date().getFullYear();
  return `INV-${year}-${String(await BillingModel.nextNumber("invoice", year, trx)).padStart(6, "0")}`;
}

async function cancelInvoiceIfUnpaid(invoiceId, actorUserId, reason) {
  if (!invoiceId) return 0;
  const inv = await db("billing_invoices").where({ id: invoiceId }).first();
  if (!inv) return 0;
  const paid = Number(inv.amountPaid) || 0;
  if (paid <= 0 && OPEN_INVOICE.includes(inv.status)) {
    await BillingModel.transaction(async (trx) => {
      await BillingModel.updateInvoice(inv.id, { status: "cancelled" }, trx);
      await BillingModel.createAuditEvent({ invoiceId: inv.id, actorUserId, eventType: "invoice_cancelled", previousStatus: inv.status, newStatus: "cancelled", metadata: { reason } }, trx);
    });
  }
  return paid;
}

// Everyone to tell about a booking.
async function peopleOf(b) {
  const learner = await learnerById(b.learnerId);
  const teacher = await teacherById(b.teacherId);
  return {
    parentUserIds: [...new Set([b.parentUserId, ...(await parentUserIdsOf(learner))].filter(Boolean))],
    mentorUserId: await userIdOfTeacher(teacher),
    childName: learner?.firstName || "your child",
    mentorName: fullName(teacher) || "the mentor",
  };
}

async function confirm(b) {
  await db(B).where({ id: b.id }).update({ status: "confirmed", confirmedAt: new Date(), holdExpiresAt: null, updatedAt: new Date() });
  const fresh = shapeRow(await db(B).where({ id: b.id }).first());
  await Notify.confirmed(fresh, await peopleOf(fresh));
  return fresh;
}

/* ── The service ─────────────────────────────────────────────────────────────────────────── */

const MentorBookingService = {
  settingsFor,

  async getSettings(req) {
    const ctx = await contextOf(req);
    if (ctx.kind !== "manager") fail("Not allowed", 403);
    return settingsFor(ctx.ownerAdminId);
  },

  async updateSettings(req, body) {
    const ctx = await contextOf(req);
    if (ctx.kind !== "manager" || req.user.actualRole === "collaborator") fail("Only admins change the booking rates", 403);
    return saveSettings(ctx.ownerAdminId, body);
  },

  // Booking a mentor, step one: for this child and this mentor, what can be booked — the lengths
  // and prices, the child's courses and sessions, the hubs and spaces, their open help requests,
  // and any sessions their plan includes.
  async options(req, { learnerId, teacherId }) {
    const ctx = await contextOf(req);
    if (ctx.kind !== "parent") fail("For parents", 403);
    const learner = ownLearner(ctx, learnerId);
    const teacher = await teacherById(teacherId);
    const ownerAdminId = await bookableWorkspace(learner.id, teacher);
    const settings = await settingsFor(ownerAdminId);
    const hubs = await bookableHubs(ownerAdminId);
    const atDesk = new Set(await db("learner_hub_links").where({ learnerId: learner.id, status: "active" }).whereNotNull("spaceId").pluck("hubId"));
    return {
      enabled: settings.enabled,
      lengths: settings.lengths.filter((l) => l.price > 0).map((l) => ({ minutes: l.minutes, price: l.price })),
      noticeHours: settings.noticeHours, cancelHours: settings.cancelHours, holdMinutes: settings.holdMinutes,
      mentor: { id: teacher.id, name: fullName(teacher), photo: teacher.photo || null, slug: teacher.profileSlug || null },
      hasAvailability: !!(await db("teacher_availability_slots").where({ teacherId }).first("id")),
      courses: await learnerCourses(learner.id),
      helpRequests: await db(H).where({ learnerId: learner.id, status: "open" }).orderBy("createdAt", "desc"),
      hubs: hubs.map((h) => ({
        id: h.id, name: h.name, town: h.town, hasDesk: atDesk.has(h.id),
        spaces: h.spaces.map((s) => ({ id: s.id, name: s.name, spaceType: s.spaceType || "desk", pricingModel: s.pricingModel, rate: Number(s.rate) || 0, priceUnit: s.priceUnit || "", capacity: R.spaceCapacity(s) })),
      })),
      allowance: await allowanceFor(ownerAdminId, learner.id),
    };
  },

  // Step two: the mentor's free times for this length (and space).
  async freeTimes(req, { learnerId, teacherId, minutes, hubId = null, spaceId = null, from = null, to = null }) {
    const ctx = await contextOf(req);
    if (ctx.kind !== "parent") fail("For parents", 403);
    const learner = ownLearner(ctx, learnerId);
    const teacher = await teacherById(teacherId);
    const ownerAdminId = await bookableWorkspace(learner.id, teacher);
    const settings = await settingsFor(ownerAdminId);
    if (!settings.enabled) fail("Booking a mentor isn't open yet", 409);
    if (!R.priceFor(settings, minutes)) fail("Choose one of the session lengths offered");
    const windows = await db("teacher_availability_slots").where({ teacherId }).select("dayOfWeek", "startTime", "endTime");
    const today = R.kenyaNow().date;
    const end = require("../checkins/checkin.dates").addDays(today, settings.horizonDays);
    const busy = await busyFor(teacherId, learner.id, from || today, to || end);
    let slots = R.freeSlots({ windows, minutes: Number(minutes), busy, noticeHours: settings.noticeHours, horizonDays: settings.horizonDays, from, to });
    if (hubId && spaceId) {
      const hub = (await bookableHubs(ownerAdminId)).find((h) => h.id === hubId);
      const space = hub?.spaces.find((s) => s.id === spaceId);
      if (!space) fail("Choose one of the hub's spaces", 404);
      const out = [];
      for (const s of slots) if (!(await spaceFull(hubId, spaceId, s, R.spaceCapacity(space)))) out.push(s);
      slots = out;
    }
    return { slots, hasAvailability: windows.length > 0 };
  },

  // Step three: book it. The time is held and the invoice raised (or, with nothing to pay,
  // confirmed at once). Returns the booking and the invoice to pay.
  async book(req, input) {
    const ctx = await contextOf(req);
    if (ctx.kind !== "parent") fail("For parents", 403);
    const learner = ownLearner(ctx, input.learnerId);
    const teacher = await teacherById(input.teacherId);
    const ownerAdminId = await bookableWorkspace(learner.id, teacher);
    const settings = await settingsFor(ownerAdminId);
    if (!settings.enabled) fail("Booking a mentor isn't open yet", 409);
    const price = R.priceFor(settings, input.minutes);
    if (!price) fail("Choose one of the session lengths offered");
    const minutes = Number(input.minutes);

    // The time must still be free (worked out again — never trusted from the screen).
    const windows = await db("teacher_availability_slots").where({ teacherId: teacher.id }).select("dayOfWeek", "startTime", "endTime");
    const busy = await busyFor(teacher.id, learner.id, input.date, input.date);
    const slot = R.freeSlots({ windows, minutes, busy, noticeHours: settings.noticeHours, horizonDays: settings.horizonDays, from: input.date, to: input.date })
      .find((s) => s.startTime === input.startTime);
    if (!slot) fail("That time isn't free any more — pick another", 409);

    // Where: online, or a hub's space (its fee, unless the learner already has a desk there).
    let hub = null;
    let space = null;
    let deskFee = 0;
    let meetingLink = null;
    if (input.mode === "hub") {
      hub = (await bookableHubs(ownerAdminId)).find((h) => h.id === input.hubId);
      space = hub?.spaces.find((s) => s.id === input.spaceId);
      if (!hub || !space) fail("Choose one of the hub's spaces", 404);
      if (await spaceFull(hub.id, space.id, slot, R.spaceCapacity(space))) fail(`${space.name} is full at that time — pick another time or space`, 409);
      const hasDesk = await db("learner_hub_links").where({ learnerId: learner.id, hubId: hub.id, status: "active" }).whereNotNull("spaceId").first("id");
      deskFee = hasDesk ? 0 : R.deskFeeFor(space, minutes);
    }
    const invoiceHubId = hub?.id || await invoiceHubFor(ownerAdminId, learner.id, teacher.id);
    if (!invoiceHubId) fail("This learning centre has no active hub to bill through yet", 409);
    if (input.mode !== "hub") meetingLink = (await db("learning_hubs").where({ id: invoiceHubId }).first("meetingLink"))?.meetingLink || null;
    const hubRow = await db("learning_hubs").where({ id: invoiceHubId }).first("id", "name", "deskFeeOwner", "deskCollectionPercent");

    const { course, session } = await courseAndSession(input.courseId, input.sessionId);
    const help = input.helpRequestId ? await db(H).where({ id: input.helpRequestId, learnerId: learner.id }).first() : null;

    // A plan that includes sessions: the mentor line is free while some are left.
    const allowance = await allowanceFor(ownerAdminId, learner.id);
    const included = !!allowance && allowance.left > 0;
    const mentorFee = included ? 0 : price.price;
    const total = money(mentorFee + deskFee);
    const deskOwner = hub ? (hub.deskFeeOwner === "hub" ? "hub" : "ours") : null;
    const collection = hub ? hub.deskCollectionPercent : 0;

    const id = generateId();
    const now = new Date();
    const holdExpiresAt = new Date(now.getTime() + settings.holdMinutes * 60000);
    const key = `${slot.date} ${slot.startTime}`;
    // A hold on this exact time that has run out gives the time back first.
    for (const stale of await db(B).where({ teacherId: teacher.id, slotKey: key, status: "held" }).where("holdExpiresAt", "<", now)) {
      await MentorBookingService.releaseHold(shapeRow(stale), "Not paid in time");
    }

    let invoiceId = null;
    try {
      await db.transaction(async (trx) => {
        await trx(B).insert({
          id, ownerAdminId, learnerId: learner.id, parentUserId: ctx.userId, teacherId: teacher.id, helpRequestId: help?.id || null,
          courseId: course?.id || null, sessionId: session?.id || null, courseName: course?.name || help?.courseName || null,
          sessionTitle: session?.title || help?.sessionTitle || null, topic: input.topic ? String(input.topic).trim().slice(0, 1000) : (help?.message || null),
          mode: input.mode === "hub" ? "hub" : "online", hubId: invoiceHubId, hubName: hub?.name || hubRow?.name || null,
          spaceId: space?.id || null, spaceName: space?.name || null, meetingLink,
          date: slot.date, startTime: slot.startTime, endTime: slot.endTime, minutes, slotKey: key,
          status: total > 0 ? "held" : "confirmed", holdExpiresAt: total > 0 ? holdExpiresAt : null, confirmedAt: total > 0 ? null : now,
          currency: "KES", mentorFee, includedInPlan: included, planSubscriptionId: included ? allowance.subscriptionId : null,
          deskFee, deskFeeOwner: deskOwner, deskCollectionPercent: collection, hubShare: R.hubShareFor(deskFee, deskOwner, collection),
          educatorPay: price.educatorPay, createdByUserId: ctx.userId, createdAt: now, updatedAt: now,
        });
        if (total > 0) {
          const invoice = await BillingModel.createInvoice({
            invoiceNumber: await nextInvoiceNumber(trx),
            issuerType: "platform", issuerHubId: null, payerUserId: ctx.userId, payerHubId: null,
            learnerId: learner.id, hubId: invoiceHubId, invoiceType: "mentor_booking", status: "issued",
            currency: "KES", subtotal: total, discount: 0, total, amountPaid: 0,
            periodStart: slot.date, periodEnd: slot.date, periodLabel: `Mentor session · ${slot.date} ${slot.startTime}`,
            issuedAt: now, dueAt: holdExpiresAt, notes: `Pay by ${holdExpiresAt.toISOString().slice(0, 16).replace("T", " ")} UTC to keep this time — after that it's released.`,
          }, trx);
          invoiceId = invoice.id;
          await BillingModel.createItem({
            invoiceId, learnerId: learner.id, courseId: course?.id || null,
            description: `Mentor session with ${fullName(teacher)} — ${minutes} min, ${slot.date} ${slot.startTime}${included ? ` (included in ${allowance.pathwayName})` : ""}`,
            quantity: 1, unitAmount: mentorFee, totalAmount: mentorFee, metadata: { mentorBookingId: id, line: "mentor" },
          }, trx);
          if (deskFee > 0) {
            await BillingModel.createItem({
              invoiceId, learnerId: learner.id, courseId: null,
              description: `${space.name} at ${hub.name} — ${minutes} min`,
              quantity: 1, unitAmount: deskFee, totalAmount: deskFee, metadata: { mentorBookingId: id, line: "desk", hubId: hub.id, spaceId: space.id },
            }, trx);
          }
          await BillingModel.createAuditEvent({ invoiceId, actorUserId: ctx.userId, eventType: "invoice_issued", newStatus: "issued", amount: total, metadata: { source: "mentor_booking" } }, trx);
          await trx(B).where({ id }).update({ invoiceId });
        }
        if (help) await trx(H).where({ id: help.id }).update({ status: "booked", bookingId: id, updatedAt: now });
      });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") fail("That time was just taken — pick another", 409);
      throw err;
    }
    const booking = shapeRow(await db(B).where({ id }).first());
    if (booking.status === "confirmed") await Notify.confirmed(booking, await peopleOf(booking));
    else require("../billing/billing.service").emailIssuedInvoice(invoiceId);
    return { booking: (await decorate([booking], ctx))[0], invoiceId };
  },

  async list(req, query = {}) {
    const ctx = await contextOf(req);
    let q = db(B);
    if (ctx.kind === "manager") q = q.where({ ownerAdminId: ctx.ownerAdminId });
    else if (ctx.kind === "mentor") q = ctx.teacherIds.length ? q.whereIn("teacherId", ctx.teacherIds) : q.whereRaw("1 = 0");
    else if (ctx.kind === "hub") q = ctx.hubIds.length ? q.where({ mode: "hub" }).whereIn("hubId", ctx.hubIds) : q.whereRaw("1 = 0");
    else if (ctx.kind === "parent") { const ids = ctx.learners.map((l) => l.id); q = ids.length ? q.whereIn("learnerId", ids) : q.whereRaw("1 = 0"); }
    else fail("Not allowed", 403);
    if (query.teacherId && ctx.kind === "manager") q = q.where({ teacherId: query.teacherId });
    if (query.hubId && ["manager", "hub"].includes(ctx.kind)) q = q.where({ hubId: query.hubId });
    if (query.learnerId) q = q.where({ learnerId: query.learnerId });
    if (query.refunds) q = q.whereNotNull("refundStatus");
    const rows = await q.orderBy("date", "desc").orderBy("startTime", "desc").limit(500);
    const shaped = await decorate(rows, ctx);
    // Held times that ran out show as cancelled; the family doesn't need to see those.
    return ctx.kind === "parent" ? shaped.filter((b) => !(b.status === "held" && b.state === "cancelled")) : shaped;
  },

  async get(req, id) {
    const ctx = await contextOf(req);
    const b = await load(ctx, id);
    const [out] = await decorate([b], ctx);
    if (ctx.kind === "manager" && b.hubId) out.hubDeskFeeOwner = b.deskFeeOwner;
    return out;
  },

  // Cancel: the family (up to the cut-off), the mentor or staff. Money paid becomes a refund due.
  async cancel(req, id, { reason = "" } = {}) {
    const ctx = await contextOf(req);
    const b = await load(ctx, id);
    const by = ctx.kind === "parent" ? "parent" : ctx.kind === "mentor" ? "mentor" : ctx.kind === "manager" && ctx.canManage ? "staff" : null;
    if (!by) fail("Not allowed", 403);
    const settings = await settingsFor(b.ownerAdminId);
    const inv = b.invoiceId ? await db("billing_invoices").where({ id: b.invoiceId }).first("amountPaid") : null;
    const paid = Number(inv?.amountPaid) || 0;
    const outcome = R.cancelOutcome(b, { by, paid, cancelHours: settings.cancelHours });
    if (!outcome.allowed) fail(outcome.reason, 409);
    if (by !== "parent" && !String(reason).trim()) fail("Say why, so the family understands");
    const refund = b.status === "held" ? await cancelInvoiceIfUnpaid(b.invoiceId, ctx.userId, "Mentor booking cancelled") : outcome.refund;
    await db(B).where({ id }).update({
      status: "cancelled", slotKey: null, cancelledAt: new Date(), cancelledBy: by, cancelReason: String(reason || "").trim().slice(0, 500) || null,
      hubShare: 0, refundStatus: refund > 0 ? "due" : null, refundAmount: refund > 0 ? refund : null, updatedAt: new Date(),
    });
    if (b.helpRequestId) await db(H).where({ id: b.helpRequestId, bookingId: id }).update({ status: "open", bookingId: null, updatedAt: new Date() });
    const fresh = shapeRow(await db(B).where({ id }).first());
    if (b.status === "confirmed") await Notify.cancelled(fresh, { ...(await peopleOf(fresh)), by, refund });
    if (refund > 0) await Notify.refundDue(fresh, refund);
    return (await decorate([fresh], ctx))[0];
  },

  // Staff hand a booking still to come to another mentor (removing an educator — modules/removals/):
  // same time, place and price; the new mentor's pay is theirs when it's held. Refused when the new
  // mentor can't teach or is busy then (their classes, parent check-ins, other bookings — the
  // UNIQUE (teacherId, slotKey) catches two at once). The family and both mentors hear.
  async reassignMentor(req, id, toTeacherId) {
    const ctx = await contextOf(req);
    if (ctx.kind !== "manager" || !ctx.canManage) fail("Not allowed", 403);
    const b = await load(ctx, id);
    if (!R.ACTIVE.includes(b.status)) fail("Only a booking still to come can change mentor", 409);
    if (b.teacherId === toTeacherId) return b;
    const to = await teacherById(toTeacherId);
    const cantTeach = require("../teachers/teacher.validation").cantTeachReason(to);
    if (!to) fail("Mentor not found", 404);
    if (cantTeach) fail(cantTeach, 409);
    const date = String(b.date).slice(0, 10);
    if (R.isBusy({ date, startTime: b.startTime, endTime: b.endTime }, await busyFor(toTeacherId, null, date, date))) {
      fail(`${fullName(to)} is busy then (${date}, ${b.startTime})`, 409);
    }
    const before = await peopleOf(b);
    try {
      await db(B).where({ id }).update({ teacherId: toTeacherId, updatedAt: new Date() });
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") fail(`${fullName(to)} already has a session then`, 409);
      throw err;
    }
    const fresh = shapeRow(await db(B).where({ id }).first());
    await Notify.mentorChanged(fresh, { ...(await peopleOf(fresh)), previousMentorUserId: before.mentorUserId });
    return fresh;
  },

  // After it: held (completed) or the learner didn't come (no_show), with a note for the family.
  async mark(req, id, { outcome, note = "" }) {
    const ctx = await contextOf(req);
    const b = await load(ctx, id);
    const allowed = (ctx.kind === "mentor" && ctx.teacherIds.includes(b.teacherId)) || (ctx.kind === "manager" && ctx.canManage);
    if (!allowed) fail("Not allowed", 403);
    if (!["completed", "no_show"].includes(outcome)) fail("Say whether the session was held");
    if (!R.canMark(b)) fail(b.status === "confirmed" ? "You can say how it went once it has started" : "This booking can't be marked", 409);
    const text = String(note || "").trim();
    if (outcome === "completed" && !text) fail("Write a short note for the family — what you covered and what to try next");
    await db(B).where({ id }).update({ status: outcome, mentorNote: text.slice(0, 5000) || null, markedAt: new Date(), markedBy: req.user.id, updatedAt: new Date() });
    if (b.helpRequestId) await db(H).where({ id: b.helpRequestId }).update({ status: "closed", updatedAt: new Date() });
    const fresh = shapeRow(await db(B).where({ id }).first());
    await Notify.noted(fresh, await peopleOf(fresh));
    // A held session counts toward the mentor's profile figures.
    require("../educator-profiles/educator-profile.stats").getStats(b.teacherId, { fresh: true }).catch(() => {});
    return (await decorate([fresh], ctx))[0];
  },

  // The join link of an online session (the mentor's or staff's).
  async setLink(req, id, { meetingLink }) {
    const ctx = await contextOf(req);
    const b = await load(ctx, id);
    const allowed = (ctx.kind === "mentor" && ctx.teacherIds.includes(b.teacherId)) || (ctx.kind === "manager" && ctx.canManage);
    if (!allowed || b.mode !== "online") fail("Not allowed", 403);
    await db(B).where({ id }).update({ meetingLink: meetingLink || null, updatedAt: new Date() });
    return MentorBookingService.get(req, id);
  },

  // Staff gave a cancelled booking's money back.
  async markRefunded(req, id, { reference }) {
    const ctx = await contextOf(req);
    if (ctx.kind !== "manager" || !ctx.canManage) fail("Not allowed", 403);
    const b = await load(ctx, id);
    if (b.refundStatus !== "due") fail("There's no refund due on this booking", 409);
    await db(B).where({ id }).update({ refundStatus: "refunded", refundReference: String(reference || "").trim().slice(0, 120) || null, refundedAt: new Date(), updatedAt: new Date() });
    return MentorBookingService.get(req, id);
  },

  /* ── Help requests ───────────────────────────────────────────────────────────────────── */

  // A child (or their parent, for them) says they're stuck on a session.
  async askForHelp(req, { learnerId = null, courseId = null, sessionId = null, message = "" }) {
    const ctx = await contextOf(req);
    const learner = ctx.kind === "child" ? ctx.learner : ctx.kind === "parent" ? ownLearner(ctx, learnerId) : null;
    if (!learner) fail("Not allowed", 403);
    const { course, session } = await courseAndSession(courseId, sessionId);
    const existing = await db(H).where({ learnerId: learner.id, status: "open", sessionId: session?.id || null, courseId: course?.id || null }).first();
    if (existing) return existing;
    const ownerAdminId = (await learnerWorkspaces(learner.id))[0] || null;
    const now = new Date();
    const row = {
      id: generateId(), ownerAdminId, learnerId: learner.id, courseId: course?.id || null, sessionId: session?.id || null,
      courseName: course?.name || null, sessionTitle: session?.title || null, message: String(message || "").trim().slice(0, 1000) || null,
      status: "open", bookingId: null, createdByUserId: ctx.userId, createdAt: now, updatedAt: now,
    };
    await db(H).insert(row);
    const full = await learnerById(learner.id);
    if (ctx.kind === "child") await Notify.helpRequested(row, { parentUserIds: await parentUserIdsOf(full), childName: full?.firstName });
    return row;
  },

  async listHelp(req) {
    const ctx = await contextOf(req);
    const ids = ctx.kind === "child" ? [ctx.learner?.id].filter(Boolean) : ctx.kind === "parent" ? ctx.learners.map((l) => l.id) : null;
    if (!ids) fail("Not allowed", 403);
    if (!ids.length) return [];
    const rows = await db(H).whereIn("learnerId", ids).orderBy("createdAt", "desc").limit(100);
    const names = new Map((await db("learners").whereIn("id", ids).select("id", "firstName", "lastName")).map((l) => [l.id, fullName(l)]));
    return rows.map((r) => ({ ...r, learnerName: names.get(r.learnerId) || null }));
  },

  async closeHelp(req, id) {
    const ctx = await contextOf(req);
    const row = await db(H).where({ id }).first();
    const ids = ctx.kind === "child" ? [ctx.learner?.id] : ctx.kind === "parent" ? ctx.learners.map((l) => l.id) : [];
    if (!row || !ids.includes(row.learnerId)) fail("Not found", 404);
    await db(H).where({ id }).update({ status: "closed", updatedAt: new Date() });
    return { id, status: "closed" };
  },

  /* ── Payment ─────────────────────────────────────────────────────────────────────────── */

  // The invoice is paid in full (billing.paid-hooks.js): confirm its booking. A hold that ran out
  // before the money came is taken again if the time is still free; otherwise the money is a
  // refund due and the admins are told.
  async onInvoicePaid(invoice) {
    if (invoice.invoiceType !== "mentor_booking") return;
    const b = shapeRow(await db(B).where({ invoiceId: invoice.id }).first());
    if (!b || b.status === "confirmed" || HAPPENED.includes(b.status)) return;
    if (b.status === "held") return confirm(b);
    if (b.status === "cancelled" && b.cancelledBy === "system") {
      try {
        await db(B).where({ id: b.id }).update({ slotKey: `${b.date} ${b.startTime}`, status: "held", cancelledAt: null, cancelledBy: null, cancelReason: null, refundStatus: null, refundAmount: null, hubShare: R.hubShareFor(b.deskFee, b.deskFeeOwner, b.deskCollectionPercent) });
        return confirm(b);
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
      }
    }
    const paid = Number(invoice.amountPaid) || 0;
    await db(B).where({ id: b.id }).update({ refundStatus: "due", refundAmount: paid, updatedAt: new Date() });
    await Notify.refundDue({ ...b }, paid);
  },

  // A hold that wasn't paid in time: the time goes back and its invoice is cancelled (part of it
  // paid: that part is a refund due).
  async releaseHold(b, reason = "Not paid in time") {
    const paid = await cancelInvoiceIfUnpaid(b.invoiceId, null, reason);
    await db(B).where({ id: b.id, status: "held" }).update({
      status: "cancelled", slotKey: null, cancelledAt: new Date(), cancelledBy: "system", cancelReason: reason, hubShare: 0,
      refundStatus: paid > 0 ? "due" : null, refundAmount: paid > 0 ? paid : null, updatedAt: new Date(),
    });
    if (b.helpRequestId) await db(H).where({ id: b.helpRequestId, bookingId: b.id }).update({ status: "open", bookingId: null, updatedAt: new Date() });
    if (paid > 0) await Notify.refundDue(b, paid);
  },

  // npm run billing:process — every hold past its time is released.
  async releaseExpiredHolds() {
    let released = 0;
    for (const row of await db(B).where({ status: "held" }).where("holdExpiresAt", "<", new Date())) {
      try {
        await MentorBookingService.releaseHold(shapeRow(row));
        released += 1;
      } catch (err) {
        console.error(`[mentor-bookings] could not release ${row.id}:`, err.message);
      }
    }
    return released;
  },

  // npm run checkins:process — "it's today" to the family and the mentor.
  async sendTodayNotices(today = R.kenyaNow().date) {
    let sent = 0;
    for (const row of await db(B).where({ status: "confirmed", date: today }).where((q) => q.whereNull("remindedFor").orWhereNot({ remindedFor: today }))) {
      const b = shapeRow(row);
      await Notify.today(b, await peopleOf(b));
      await db(B).where({ id: b.id }).update({ remindedFor: today });
      sent += 1;
    }
    return sent;
  },

  /* ── Hub settlements (option C) ───────────────────────────────────────────────────────── */

  // A partner hub's statement: what it's owed (sessions that have happened, paid, not yet settled),
  // what's coming (paid, still to happen), and its settlements. The hub's own login reads its own.
  async statement(req, hubId) {
    const ctx = await contextOf(req);
    const hub = await db("learning_hubs").where({ id: hubId }).first("id", "name", "ownerAdminId", "deskFeeOwner", "deskCollectionPercent");
    if (!hub) fail("Hub not found", 404);
    if (!((ctx.kind === "manager" && hub.ownerAdminId === ctx.ownerAdminId) || (ctx.kind === "hub" && ctx.hubIds.includes(hubId)))) fail("Hub not found", 404);
    const rows = (await db(B).where({ hubId, mode: "hub", deskFeeOwner: "hub" }).where("hubShare", ">", 0).orderBy("date", "desc")).map(shapeRow);
    const owed = rows.filter((b) => HAPPENED.includes(b.status) && !b.settlementId);
    const upcoming = rows.filter((b) => b.status === "confirmed");
    const settled = rows.filter((b) => b.settlementId);
    const learnerNames = new Map((rows.length ? await db("learners").whereIn("id", [...new Set(rows.map((r) => r.learnerId))]).select("id", "firstName", "lastName") : []).map((l) => [l.id, fullName(l)]));
    const line = (b) => ({ id: b.id, date: b.date, startTime: b.startTime, minutes: b.minutes, spaceName: b.spaceName, learnerName: learnerNames.get(b.learnerId) || null, deskFee: b.deskFee, hubShare: b.hubShare, status: b.status, settlementId: b.settlementId || null });
    const sum = (list) => money(list.reduce((n, b) => n + b.hubShare, 0));
    const settlements = await db(S).where({ hubId }).orderBy("createdAt", "desc");
    const out = {
      hub: { id: hub.id, name: hub.name, deskFeeOwner: hub.deskFeeOwner || "ours", deskCollectionPercent: Number(hub.deskCollectionPercent) || 0 },
      owed: { total: sum(owed), bookings: owed.map(line) },
      upcoming: { total: sum(upcoming), bookings: upcoming.map(line) },
      settled: { total: sum(settled), bookings: settled.map(line) },
      settlements: settlements.map((s) => ({ ...s, amount: Number(s.amount) })),
    };
    // Its own unpaid invoices the amount owed can be credited on (staff only).
    if (ctx.kind === "manager") {
      out.openInvoices = (await db("billing_invoices").where({ payerHubId: hubId }).whereIn("status", OPEN_INVOICE).orderBy("issuedAt", "asc").select("id", "invoiceNumber", "total", "amountPaid", "periodLabel"))
        .map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, periodLabel: i.periodLabel, due: money(Number(i.total) - Number(i.amountPaid)) }));
    }
    return out;
  },

  // Staff: every partner hub with what it's owed now.
  async hubsOwed(req) {
    const ctx = await contextOf(req);
    if (ctx.kind !== "manager") fail("Not allowed", 403);
    const hubs = await db("learning_hubs").where({ ownerAdminId: ctx.ownerAdminId }).select("id", "name", "deskFeeOwner", "deskCollectionPercent");
    const out = [];
    for (const h of hubs) {
      const rows = (await db(B).where({ hubId: h.id, mode: "hub", deskFeeOwner: "hub" }).where("hubShare", ">", 0)).map(shapeRow);
      if (h.deskFeeOwner !== "hub" && !rows.length) continue;
      const owed = rows.filter((b) => HAPPENED.includes(b.status) && !b.settlementId);
      const upcoming = rows.filter((b) => b.status === "confirmed");
      const last = await db(S).where({ hubId: h.id }).orderBy("createdAt", "desc").first("createdAt", "amount");
      out.push({
        id: h.id, name: h.name, deskFeeOwner: h.deskFeeOwner || "ours", deskCollectionPercent: Number(h.deskCollectionPercent) || 0,
        owed: money(owed.reduce((n, b) => n + b.hubShare, 0)), owedCount: owed.length,
        upcoming: money(upcoming.reduce((n, b) => n + b.hubShare, 0)),
        lastSettled: last ? { at: last.createdAt, amount: Number(last.amount) } : null,
      });
    }
    return out.sort((a, b) => b.owed - a.owed || a.name.localeCompare(b.name));
  },

  // Staff settle what a partner hub is owed now: paid out (M-Pesa / bank / cash) or credited on one
  // of the hub's own unpaid invoices.
  async settle(req, hubId, { method, reference = "", offsetInvoiceId = null, note = "" }) {
    const ctx = await contextOf(req);
    if (ctx.kind !== "manager" || !ctx.canManage) fail("Not allowed", 403);
    const hub = await db("learning_hubs").where({ id: hubId, ownerAdminId: ctx.ownerAdminId }).first("id", "name");
    if (!hub) fail("Hub not found", 404);
    const owed = (await db(B).where({ hubId, mode: "hub", deskFeeOwner: "hub" }).whereIn("status", HAPPENED).whereNull("settlementId").where("hubShare", ">", 0)).map(shapeRow);
    const amount = money(owed.reduce((n, b) => n + b.hubShare, 0));
    if (!(amount > 0)) fail(`${hub.name} isn't owed anything right now`, 409);
    if (!["mpesa", "bank", "cash", "offset"].includes(method)) fail("Choose how it was settled");
    const settlementId = generateId();
    let ref = String(reference || "").trim().slice(0, 120) || null;
    if (method === "offset") {
      const inv = offsetInvoiceId ? await db("billing_invoices").where({ id: offsetInvoiceId, payerHubId: hubId }).whereIn("status", OPEN_INVOICE).first() : null;
      if (!inv) fail(`Choose one of ${hub.name}'s unpaid invoices for the credit`);
      const due = money(Number(inv.total) - Number(inv.amountPaid));
      if (amount > due) fail(`The credit (KSh ${amount.toLocaleString("en-KE")}) is more than ${inv.invoiceNumber} still owes (KSh ${due.toLocaleString("en-KE")}) — choose another invoice, or pay it out.`);
      await require("../billing/billing.service").applyPayment(inv.id, {
        amount, provider: "hub_settlement", paymentMethod: "hub_credit", providerReference: settlementId,
        recordedBy: req.user.id, idempotencyKey: `hub_settlement:${settlementId}`, notes: `Desk fees owed to ${hub.name} from mentor sessions`,
      });
      ref = inv.invoiceNumber;
    } else if (method !== "cash" && !ref) {
      fail(method === "mpesa" ? "Enter the M-Pesa code" : "Enter the bank reference");
    }
    await db.transaction(async (trx) => {
      await trx(S).insert({
        id: settlementId, ownerAdminId: ctx.ownerAdminId, hubId, amount, currency: "KES", method, reference: ref,
        offsetInvoiceId: method === "offset" ? offsetInvoiceId : null, bookingCount: owed.length, note: String(note || "").trim().slice(0, 500) || null,
        settledBy: req.user.id, createdAt: new Date(), updatedAt: new Date(),
      });
      await trx(B).whereIn("id", owed.map((b) => b.id)).update({ settlementId, updatedAt: new Date() });
    });
    return MentorBookingService.statement(req, hubId);
  },

  /* ── For the mentor's pay and profile ─────────────────────────────────────────────────── */

  // Held sessions not yet claimed, per workspace (claims/claim.service.js).
  async unclaimed(teacherId) {
    return (await db(B).where({ teacherId }).whereIn("status", HAPPENED).whereNull("claimId").where("educatorPay", ">", 0).orderBy("date", "asc")).map(shapeRow);
  },

  // The times a mentor's bookings hold (for parent check-ins' clash rules).
  async heldTimes(teacherIds, from, to) {
    if (!teacherIds.length) return [];
    const now = new Date();
    return (await db(B).whereIn("teacherId", teacherIds).whereIn("status", R.ACTIVE).whereBetween("date", [from, to]).select("date", "startTime", "endTime", "status", "holdExpiresAt"))
      .map(shapeRow).filter((b) => R.holdsTime(b, now));
  },

  // Held sessions for a mentor's profile: date and minutes.
  async heldSessions(teacherId) {
    return (await db(B).where({ teacherId, status: "completed" }).select("date", "minutes", "learnerId")).map(shapeRow);
  },
};

module.exports = MentorBookingService;
module.exports.contextOf = contextOf;
