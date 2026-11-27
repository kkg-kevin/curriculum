const db = require("../../config/db");

// What an expense was for (27 Nov 2026). Each line of a claim can be linked to ONE record of the
// workspace — the Home Learning family visited, the class taught, the bootcamp run, the QA visit
// made… — so the money is traceable both ways: the claim names the record, and the record's page
// lists what was spent on it (GET /api/expenses/linked). "general" = work not tied to one record.
//
// Who may link what (the same rule decides what the picker offers and what a save accepts):
//   admins and staff         anything in the workspace
//   educators                their own: hubs they're linked to, classes they teach, Home Learning
//                            families they teach, Tech Club families at their hubs, their QA
//                            visits, hub check-ins they run or attend, their parent check-ins and
//                            mentor sessions — plus the workspace's bootcamps, competitions and
//                            events, which anyone may have worked on
//   supervisors              the same, for the educators they supervise (and QA visits they review)
//   enquiries                admins and staff only
// The record's name is kept on the line (linkLabel), so it still reads after a rename or removal.

const TYPES = [
  { key: "household", label: "Home Learning family", group: "Families" },
  { key: "club", label: "Tech Club family", group: "Families" },
  { key: "lead", label: "Enquiry / prospective family", group: "Families", staffOnly: true },
  { key: "class", label: "Class", group: "Teaching" },
  { key: "hub", label: "Learning hub / school", group: "Teaching" },
  { key: "mentor_booking", label: "Mentor session", group: "Teaching" },
  { key: "bootcamp", label: "Bootcamp", group: "Programmes & events" },
  { key: "competition", label: "Competition", group: "Programmes & events" },
  { key: "general_event", label: "Event", group: "Programmes & events" },
  { key: "qa_visit", label: "QA visit", group: "Quality" },
  { key: "hub_checkin", label: "Hub check-in", group: "Quality" },
  { key: "mentor_checkin", label: "Parent–mentor check-in", group: "Quality" },
];
const GENERAL = "general";
const TYPE_KEYS = TYPES.map((t) => t.key);
const typeOf = (key) => TYPES.find((t) => t.key === key) || null;

const LIMIT = 300;
const day = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const classLabel = (c) => [c?.gradeName, c?.streamName].filter(Boolean).join(" · ") || "Class";
const parseJson = (v) => (typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return null; } })() : v);
const prettyDate = (d) => (d ? new Date(`${day(d)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null);
const join = (...parts) => parts.filter(Boolean).join(" · ");

// Only educators and supervisors are limited to their own records.
const restricted = (ctx) => ctx.role === "teacher" || ctx.role === "supervisor";

// The educator records whose work this person may claim for: their own, or the ones they supervise.
async function teacherIdsOf(ctx) {
  if (ctx._teacherIds) return ctx._teacherIds;
  let ids = [];
  if (ctx.role === "teacher" && ctx.teacher) ids = [ctx.teacher.id];
  if (ctx.role === "supervisor") ids = await db("teachers").where({ supervisorId: ctx.userId }).pluck("id");
  Object.defineProperty(ctx, "_teacherIds", { value: ids, enumerable: false, configurable: true });
  return ids;
}
const none = (q) => q.whereRaw("1 = 0");
const inIds = (q, column, ids) => (ids.length ? q.whereIn(column, ids) : none(q));

async function workspaceHubs(ownerAdminId) {
  return db("learning_hubs").where({ ownerAdminId }).select("id", "name", "status", "isHomeLearning", "address");
}
const hubNames = async (ownerAdminId) => new Map((await workspaceHubs(ownerAdminId)).map((h) => [h.id, h.name]));

// Each kind: rows(ctx, ids) → [{ id, label, sub, date }] that this person may link, newest first;
// `ids` narrows it to those records (checking a save).
const KINDS = {
  async hub(ctx, ids) {
    let q = db("learning_hubs").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "removed" });
    if (restricted(ctx)) q = inIds(q, "id", await db("teacher_hub_links").whereIn("teacherId", (await teacherIdsOf(ctx)).concat("-")).pluck("hubId"));
    if (ids) q = q.whereIn("id", ids);
    return (await q.select("id", "name", "status", "address", "isHomeLearning").orderBy("name").limit(LIMIT)).map((h) => ({
      id: h.id, label: h.name, sub: join(h.isHomeLearning ? "Home Learning" : null, parseJson(h.address)?.county || parseJson(h.address)?.city, h.status !== "active" ? h.status : null),
    }));
  },

  async class(ctx, ids) {
    const hubs = await hubNames(ctx.ownerAdminId);
    let q = db("classes").whereIn("schoolId", [...hubs.keys(), "-"]);
    if (restricted(ctx)) {
      const tids = (await teacherIdsOf(ctx)).concat("-");
      const linked = await db("class_course_teacher_links").whereIn("teacherId", tids).distinct("classId").pluck("classId");
      q = q.where((w) => w.whereIn("id", linked.concat("-")).orWhereIn("classTeacherId", tids));
    }
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "gradeName", "streamName", "schoolId", "academicYear", "status").orderBy("updatedAt", "desc").limit(LIMIT);
    return rows.sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1)).map((c) => ({
      id: c.id, label: classLabel(c), sub: join(hubs.get(c.schoolId), c.academicYear, c.status && c.status !== "active" ? c.status : null),
    }));
  },

  async household(ctx, ids) {
    let q = db("home_learning_households").where({ ownerAdminId: ctx.ownerAdminId });
    if (restricted(ctx)) {
      q = inIds(q, "id", await db("home_learning_enrollments").whereIn("educatorId", (await teacherIdsOf(ctx)).concat("-")).distinct("householdId").pluck("householdId"));
    }
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "guardianName", "town", "subCounty", "county", "status", "childCount").orderBy("updatedAt", "desc").limit(LIMIT);
    return rows.map((h) => ({
      id: h.id, label: `${h.guardianName || "A"} family`, sub: join("Home Learning", h.town || h.subCounty || h.county, h.childCount ? `${h.childCount} ${h.childCount === 1 ? "child" : "children"}` : null, h.status !== "active" ? h.status : null),
    }));
  },

  async club(ctx, ids) {
    const hubs = await hubNames(ctx.ownerAdminId);
    let q = db("club_memberships").where({ ownerAdminId: ctx.ownerAdminId });
    if (restricted(ctx)) q = inIds(q, "hubId", await db("teacher_hub_links").whereIn("teacherId", (await teacherIdsOf(ctx)).concat("-")).pluck("hubId"));
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "guardianName", "hubId", "status", "childCount").orderBy("updatedAt", "desc").limit(LIMIT);
    return rows.map((m) => ({ id: m.id, label: `${m.guardianName || "A"} family`, sub: join("Tech Club", hubs.get(m.hubId), m.status !== "active" ? m.status : null) }));
  },

  async lead(ctx, ids) {
    if (restricted(ctx)) return [];
    let q = db("leads").whereNull("anonymisedAt");
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "name", "learnerName", "source", "interestedIn", "status", "createdAt").orderBy("createdAt", "desc").limit(LIMIT);
    return rows.map((l) => ({ id: l.id, label: l.name || "Enquiry", sub: join(l.learnerName ? `for ${l.learnerName}` : null, l.interestedIn, prettyDate(l.createdAt)), date: day(l.createdAt) }));
  },

  async mentor_booking(ctx, ids) {
    let q = db("mentor_bookings").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "cancelled" });
    if (restricted(ctx)) q = inIds(q, "teacherId", await teacherIdsOf(ctx));
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "learnerId", "teacherId", "date", "startTime", "mode", "hubName").orderBy("date", "desc").limit(LIMIT);
    const learners = new Map((await db("learners").whereIn("id", rows.map((r) => r.learnerId).concat("-")).select("id", "firstName", "lastName")).map((l) => [l.id, fullName(l)]));
    const teachers = new Map((await db("teachers").whereIn("id", rows.map((r) => r.teacherId).concat("-")).select("id", "firstName", "lastName")).map((t) => [t.id, fullName(t)]));
    return rows.map((b) => ({
      id: b.id, label: `Mentor session · ${learners.get(b.learnerId) || "a learner"}`,
      sub: join(`${prettyDate(b.date)} ${b.startTime}`, restricted(ctx) && ctx.role === "teacher" ? null : teachers.get(b.teacherId), b.mode === "online" ? "Online" : b.hubName), date: day(b.date),
    }));
  },

  async bootcamp(ctx, ids) {
    let q = db("bootcamps").where({ ownerAdminId: ctx.ownerAdminId });
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "name", "startDate", "endDate", "audience").orderBy("startDate", "desc").limit(LIMIT);
    return rows.map((b) => ({ id: b.id, label: b.name, sub: join(b.startDate ? `${prettyDate(b.startDate)}${b.endDate && day(b.endDate) !== day(b.startDate) ? ` – ${prettyDate(b.endDate)}` : ""}` : null, b.audience === "educators" ? "TOT" : null), date: day(b.startDate) }));
  },

  async competition(ctx, ids) {
    let q = db("competitions").where({ ownerAdminId: ctx.ownerAdminId });
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "name", "edition", "startDate", "status").orderBy("startDate", "desc").limit(LIMIT);
    return rows.map((c) => ({ id: c.id, label: join(c.name, c.edition), sub: join(prettyDate(c.startDate), c.status), date: day(c.startDate) }));
  },

  async general_event(ctx, ids) {
    let q = db("general_events").where({ ownerAdminId: ctx.ownerAdminId });
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "title", "startDate", "startTime", "venueName", "status").orderBy("startDate", "desc").limit(LIMIT);
    return rows.map((e) => ({ id: e.id, label: e.title, sub: join(prettyDate(e.startDate), e.venueName, e.status !== "published" ? e.status : null), date: day(e.startDate) }));
  },

  async qa_visit(ctx, ids) {
    let q = db("qa_visits").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "cancelled" });
    if (ctx.role === "teacher") q = inIds(q, "teacherId", await teacherIdsOf(ctx));
    if (ctx.role === "supervisor") {
      const tids = (await teacherIdsOf(ctx)).concat("-");
      q = q.where((w) => w.where({ reviewerId: ctx.userId }).orWhereIn("teacherId", tids));
    }
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "teacherId", "hubId", "scheduledDate", "status").orderBy("scheduledDate", "desc").limit(LIMIT);
    const hubs = await hubNames(ctx.ownerAdminId);
    const teachers = new Map((await db("teachers").whereIn("id", rows.map((r) => r.teacherId).concat("-")).select("id", "firstName", "lastName")).map((t) => [t.id, fullName(t)]));
    return rows.map((v) => ({ id: v.id, label: `QA visit · ${teachers.get(v.teacherId) || "an educator"}`, sub: join(prettyDate(v.scheduledDate), hubs.get(v.hubId)), date: day(v.scheduledDate) }));
  },

  async hub_checkin(ctx, ids) {
    let q = db("checkin_sessions").where({ ownerAdminId: ctx.ownerAdminId });
    if (restricted(ctx)) {
      const attending = await db("checkin_participants").where({ userId: ctx.userId }).pluck("sessionId");
      q = q.where((w) => w.where({ accountManagerId: ctx.userId }).orWhere({ trainingLeadId: ctx.userId }).orWhereIn("id", attending.concat("-")));
    }
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "hubId", "scheduledDate", "status").orderBy("scheduledDate", "desc").limit(LIMIT);
    const hubs = await hubNames(ctx.ownerAdminId);
    return rows.map((s) => ({ id: s.id, label: `Hub check-in · ${hubs.get(s.hubId) || "a hub"}`, sub: join(prettyDate(s.scheduledDate), s.status === "reported" ? "reported" : null), date: day(s.scheduledDate) }));
  },

  async mentor_checkin(ctx, ids) {
    let q = db("mentor_checkin_meetings").where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "cancelled" });
    if (restricted(ctx)) {
      const tids = new Set(await teacherIdsOf(ctx));
      const rounds = (await db("mentor_checkin_rounds").where({ ownerAdminId: ctx.ownerAdminId }).select("id", "educatorIds"))
        .filter((r) => (parseJson(r.educatorIds) || []).some((id) => tids.has(id))).map((r) => r.id);
      q = inIds(q, "roundId", rounds);
    }
    if (ids) q = q.whereIn("id", ids);
    const rows = await q.select("id", "learnerIds", "classId", "hubId", "date", "startTime").orderBy("date", "desc").limit(LIMIT);
    const learnerIds = [...new Set(rows.flatMap((r) => parseJson(r.learnerIds) || []))];
    const learners = new Map((await db("learners").whereIn("id", learnerIds.concat("-")).select("id", "firstName", "lastName")).map((l) => [l.id, fullName(l)]));
    const hubs = await hubNames(ctx.ownerAdminId);
    return rows.map((m) => ({
      id: m.id, label: `Parent check-in · ${(parseJson(m.learnerIds) || []).map((id) => learners.get(id)).filter(Boolean).join(", ") || "a family"}`,
      sub: join(`${prettyDate(m.date)} ${m.startTime || ""}`.trim(), hubs.get(m.hubId)), date: day(m.date),
    }));
  },
};

// The kinds this person may link (enquiries are for admins and staff).
const typesFor = (ctx) => TYPES.filter((t) => !(t.staffOnly && restricted(ctx))).map(({ key, label, group }) => ({ key, label, group }));

// The picker: records of one kind matching what was typed, up to 40.
async function search(ctx, type, q = "") {
  if (!KINDS[type] || !typesFor(ctx).some((t) => t.key === type)) return [];
  const words = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  const rows = await KINDS[type](ctx);
  return rows.filter((r) => words.every((w) => `${r.label} ${r.sub || ""}`.toLowerCase().includes(w))).slice(0, 40);
}

// Checks the links on a claim's lines before they're saved, and names each one. A line linked to a
// record this person may not link fails the save; "general" and no link pass.
async function resolveLines(ctx, items) {
  const byType = new Map();
  for (const item of items) {
    if (!item.linkType || item.linkType === GENERAL) continue;
    if (!KINDS[item.linkType]) throw Object.assign(new Error("Choose what the expense was for from the list"), { statusCode: 400 });
    if (!item.linkId) throw Object.assign(new Error(`Choose which ${typeOf(item.linkType).label.toLowerCase()} the expense was for`), { statusCode: 400 });
    (byType.get(item.linkType) || byType.set(item.linkType, new Set()).get(item.linkType)).add(item.linkId);
  }
  const names = new Map();
  for (const [type, ids] of byType) {
    if (!typesFor(ctx).some((t) => t.key === type)) throw Object.assign(new Error(`You can't link an expense to ${typeOf(type).label.toLowerCase()}s`), { statusCode: 403 });
    for (const row of await KINDS[type](ctx, [...ids])) names.set(`${type}:${row.id}`, row.label);
    for (const id of ids) {
      if (!names.has(`${type}:${id}`)) throw Object.assign(new Error(`One expense is linked to ${typeOf(type).label.toLowerCase()} you can't claim for — choose it again`), { statusCode: 403 });
    }
  }
  return items.map((item) => {
    if (!item.linkType) return { ...item, linkType: null, linkId: null, linkLabel: null };
    if (item.linkType === GENERAL) return { ...item, linkId: null, linkLabel: null };
    return { ...item, linkLabel: String(names.get(`${item.linkType}:${item.linkId}`) || "").slice(0, 255) };
  });
}

module.exports = { TYPES, TYPE_KEYS, GENERAL, typeOf, typesFor, search, resolveLines };
