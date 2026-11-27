const db = require("../../config/db");
const { generateId, toJson } = require("../../shared/utils/model.utils");
const NotificationService = require("../notifications/notification.service");
const CompetencyModel = require("../settings/competencies/competency.model");
const CountedWork = require("../assessments/submissions/counted-work");
const { resolveScope, className } = require("./analytics.scope");
const { inChunks, fullName, json, kenyaDay } = require("./analytics.utils");
const { getAtRisk } = require("./analytics.risk");
const { getParents } = require("./analytics.parents");
const R = require("./analytics.cases.rules");

// Follow-up cases (26 Nov 2026). Every day each workspace's learners are checked against the
// figures Reports & Analytics already keeps, and a learner who needs help gets a CASE for each
// reason: the four at-risk reasons (low scores, low attendance, missed work, not signing in),
// absent several sessions in a row, a skill they're stuck on, and reports their parent hasn't
// opened. A case has an owner (the class's educator by default — else the admins), a due date, a
// status (open → contacted → plan agreed → resolved, or escalated to the admins), ready-made
// parent messages, a history (learner_followups with caseId) and a re-check after 14 days that
// closes it as "back on track" when the reason has gone. Owners hear about new cases once a day.
//
// Who sees which case (viewerOf): admins and staff with Reports — the whole workspace; a hub's
// login — its own hub; an educator — cases they own and cases for learners of classes they teach.

const T = "learner_followup_cases";
const F = "learner_followups";
const now = () => new Date();
const today = () => kenyaDay(new Date());
const fail = (status, message) => { throw Object.assign(new Error(message), { statusCode: status }); };

// ── Detecting who needs a follow-up ──────────────────────────────────────────────────────────────
const workspaceScope = (ownerAdminId) => resolveScope({ user: { role: "admin" }, ownerAdminId, query: {} });

async function candidatesFor(scope) {
  const out = new Map();
  const firstLink = new Map();
  for (const l of scope.links) if (!firstLink.has(l.learnerId)) firstLink.set(l.learnerId, l);
  const add = (learnerId, reason, reasonKey, details, classId = null) => {
    const link = firstLink.get(learnerId);
    out.set(R.openKeyOf(learnerId, reasonKey), { learnerId, reason, reasonKey, details, hubId: link?.hubId || null, classId: classId || link?.classId || null });
  };

  // The at-risk list's four reasons, with their numbers.
  const risk = await getAtRisk(scope);
  for (const r of risk.learners) {
    // Low scores need two marked pieces or more: one bad quiz isn't a case.
    if (r.flags.includes("lowScore") && r.markedPieces >= 2) add(r.learnerId, "lowScore", "lowScore", { score: r.score, pieces: r.markedPieces }, r.classId);
    if (r.flags.includes("lowAttendance")) add(r.learnerId, "lowAttendance", "lowAttendance", { rate: r.attendanceRate, days: r.attendanceDays }, r.classId);
    if (r.flags.includes("missedWork")) add(r.learnerId, "missedWork", "missedWork", { missed: r.missed }, r.classId);
    if (r.flags.includes("notSignedIn")) add(r.learnerId, "notSignedIn", "notSignedIn", { lastSignIn: r.lastSignIn }, r.classId);
  }

  // Absent the last 3+ sessions in a row (a class's register, the last 60 days).
  const since = R.addDays(today(), -60);
  const rows = await inChunks([...scope.learnerIds], (ids) => db("attendance").whereIn("learnerId", ids).where("date", ">=", since).select("learnerId", "classId", "date", "status"));
  const byLearnerClass = new Map();
  for (const r of rows) {
    const k = `${r.learnerId}|${r.classId}`;
    (byLearnerClass.get(k) || byLearnerClass.set(k, []).get(k)).push(r);
  }
  for (const [k, list] of byLearnerClass) {
    const run = R.absenceRun(list);
    if (run.count >= 3) {
      const [learnerId, classId] = k.split("|");
      add(learnerId, "absenceStreak", "absenceStreak", { count: run.count, dates: run.dates.slice(-5) }, classId);
    }
  }

  // Stuck on a skill: a competency under 40% across 3+ marked pieces in the last 90 days — the
  // weakest one per learner.
  const from = new Date(Date.now() - 90 * 86400000);
  let subs = await inChunks([...scope.learnerIds], (ids) => db("assessment_submissions").whereIn("learnerId", ids).where({ status: "graded" })
    .where("gradedAt", ">=", from).select("id", "issueId", "learnerId", "status", "reportPublished", "indicatorBreakdown", "gradedAt"));
  subs = (await CountedWork.sortWork(subs)).counted.map((e) => e.submission);
  if (subs.length) {
    const comps = await CompetencyModel.findAll();
    const indicatorComp = new Map();
    for (const c of comps) for (const ind of c.indicators || []) indicatorComp.set(ind.id, { id: c.id, name: c.name });
    const per = new Map(); // learnerId -> Map(compId -> {e,p,pieces:Set,name})
    for (const s of subs) {
      for (const r of json(s.indicatorBreakdown) || []) {
        const comp = indicatorComp.get(r.indicatorId);
        const p = Number(r.marksPossible) || 0;
        if (!comp || p <= 0) continue;
        const m = per.get(s.learnerId) || per.set(s.learnerId, new Map()).get(s.learnerId);
        const x = m.get(comp.id) || m.set(comp.id, { e: 0, p: 0, pieces: new Set(), name: comp.name }).get(comp.id);
        x.e += Number(r.marksEarned) || 0; x.p += p; x.pieces.add(s.id);
      }
    }
    for (const [learnerId, m] of per) {
      let worst = null;
      for (const [compId, x] of m) {
        const percent = Math.round(Math.min(100, (x.e / x.p) * 100));
        if (x.pieces.size >= 3 && percent < 40 && (!worst || percent < worst.percent)) worst = { competencyId: compId, competencyName: x.name, percent, pieces: x.pieces.size };
      }
      if (worst) add(learnerId, "stuckCompetency", `stuckCompetency:${worst.competencyId}`, worst);
    }
  }

  // Reports waiting that a parent with a login hasn't opened (2 or more, or one out for a week).
  const parents = await getParents(scope);
  const weekAgo = Date.now() - 7 * 86400000;
  for (const u of parents.unread) {
    if (!u.hasLogin) continue;
    if (u.reports >= 2 || new Date(u.lastPublished).getTime() <= weekAgo) add(u.learnerId, "reportsUnread", "reportsUnread", { reports: u.reports, lastPublished: u.lastPublished });
  }
  return out;
}

// Who looks after a case: the class's educator with a login (the primary one first) — else the
// workspace's admins (null).
async function ownerFor(classId) {
  if (!classId) return null;
  const links = await db("class_course_teacher_links").where({ classId }).select("teacherId", "isPrimary");
  links.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary));
  for (const l of links) {
    // eslint-disable-next-line no-await-in-loop
    const t = await db("teachers").where({ id: l.teacherId }).whereNotIn("status", ["removed", "inactive"]).first("email", "firstName", "lastName");
    // eslint-disable-next-line no-await-in-loop
    const u = t?.email ? await db("users").whereRaw("LOWER(email) = ?", [String(t.email).toLowerCase()]).whereNull("deactivatedAt").first("id", "name") : null;
    if (u) return { userId: u.id, name: u.name || fullName(t) };
  }
  return null;
}

async function event(caseRow, { action, note = null, by = null, byName = null, reasons = [] }) {
  await db(F).insert({
    id: generateId(), ownerAdminId: caseRow.ownerAdminId, hubId: caseRow.hubId, learnerId: caseRow.learnerId, caseId: caseRow.id,
    action, note: note ? String(note).slice(0, 2000) : null, reasons: JSON.stringify(reasons), createdBy: by, createdByName: byName, createdAt: now(),
  });
}

// Where a person opens a case, in their own portal.
async function routeFor(userId, caseId) {
  const u = userId ? await db("users").where({ id: userId }).first("role") : null;
  if (u?.role === "teacher") return `/teacher-portal/follow-ups${caseId ? `?case=${caseId}` : ""}`;
  if (u?.role === "school") return `/school-portal/reports?tab=followups${caseId ? `&case=${caseId}` : ""}`;
  return `/reports?tab=followups${caseId ? `&case=${caseId}` : ""}`;
}

async function tell(ownerAdminId, userId, ev) {
  if (userId) return NotificationService.notifyPerson(userId, { ...ev, ownerAdminId, payload: { ...(ev.payload || {}), route: await routeFor(userId, ev.payload?.caseId) } }).catch(() => {});
  return NotificationService._notify(ownerAdminId, { ...ev, ownerAdminId, payload: { ...(ev.payload || {}), route: `/reports?tab=followups${ev.payload?.caseId ? `&case=${ev.payload.caseId}` : ""}` } }).catch(() => {});
}

// One workspace: open cases for new reasons, refresh the numbers on open ones, re-check those due,
// close those whose learner has left. Safe to repeat; normally once a day (processWorkspace).
async function detectWorkspace(ownerAdminId) {
  const scope = await workspaceScope(ownerAdminId);
  const candidates = await candidatesFor(scope);
  const day = today();
  const open = await db(T).where({ ownerAdminId }).whereNot({ status: "resolved" });
  const openByKey = new Map(open.map((c) => [c.openKey, c]));
  const recentClosed = await db(T).where({ ownerAdminId, status: "resolved" }).where("resolvedAt", ">=", new Date(Date.now() - R.REOPEN_GAP_DAYS * 86400000)).select("learnerId", "reasonKey", "resolvedAt");
  const closedAt = new Map(recentClosed.map((c) => [R.openKeyOf(c.learnerId, c.reasonKey), c.resolvedAt]));
  const fresh = new Map(); // owner userId (or "") -> count
  let opened = 0;

  for (const [key, cand] of candidates) {
    if (!R.mayOpen({ openExists: openByKey.has(key), lastClosedAt: closedAt.get(key), today: day })) continue;
    // eslint-disable-next-line no-await-in-loop
    const owner = await ownerFor(cand.classId);
    const row = {
      id: generateId(), ownerAdminId, hubId: cand.hubId, classId: cand.classId, learnerId: cand.learnerId,
      reason: cand.reason, reasonKey: cand.reasonKey, openKey: key, details: toJson(cand.details), status: "open",
      ownerUserId: owner?.userId || null, ownerName: owner?.name || null, dueOn: R.addDays(day, R.DUE_DAYS), recheckOn: R.addDays(day, R.RECHECK_DAYS),
      stillFlagged: true, source: "auto", openedAt: now(), createdAt: now(), updatedAt: now(),
    };
    try {
      // eslint-disable-next-line no-await-in-loop
      await db(T).insert(row);
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY") continue;
      throw err;
    }
    // eslint-disable-next-line no-await-in-loop
    await event(row, { action: "opened", note: R.REASONS[cand.reason].summary(cand.details), reasons: [R.REASONS[cand.reason].label] });
    fresh.set(row.ownerUserId || "", (fresh.get(row.ownerUserId || "") || 0) + 1);
    opened += 1;
  }

  let closed = 0;
  let still = 0;
  for (const c of open) {
    const cand = candidates.get(c.openKey);
    const flagged = !!cand;
    // The learner left every hub in scope: nothing to follow up here any more.
    if (!scope.learnerIds.has(c.learnerId)) {
      // eslint-disable-next-line no-await-in-loop
      await db(T).where({ id: c.id }).update({ status: "resolved", outcome: "left", openKey: null, resolvedAt: now(), stillFlagged: false, updatedAt: now() });
      // eslint-disable-next-line no-await-in-loop
      await event(c, { action: "resolved", note: "Closed: the learner is no longer at the hub." });
      closed += 1;
      continue;
    }
    const patch = { stillFlagged: flagged, updatedAt: now() };
    if (cand) patch.details = toJson(cand.details);
    const due = c.recheckOn && String(c.recheckOn).slice(0, 10) <= day;
    if (due) {
      const next = R.recheckOutcome({ stillFlagged: flagged, today: day });
      const summary = flagged ? `Still needs help: ${R.REASONS[c.reason].summary(cand.details)}` : "The reason has gone: back on track.";
      Object.assign(patch, { lastCheck: toJson({ at: now().toISOString(), still: flagged, summary }), recheckOn: next.recheckOn });
      if (next.status === "resolved") Object.assign(patch, { status: "resolved", outcome: next.outcome, openKey: null, resolvedAt: now() });
      // eslint-disable-next-line no-await-in-loop
      await event(c, { action: "recheck", note: summary });
      if (flagged) {
        still += 1;
        // eslint-disable-next-line no-await-in-loop
        const learner = await db("learners").where({ id: c.learnerId }).first("firstName", "lastName");
        // eslint-disable-next-line no-await-in-loop
        await tell(ownerAdminId, c.ownerUserId, { type: "followup_recheck", title: `${fullName(learner)} still needs help`, message: `${R.REASONS[c.reason].label}: ${R.REASONS[c.reason].summary(cand.details)} Two weeks on, it hasn't improved.`, payload: { caseId: c.id, learnerId: c.learnerId }, dedupeKey: `followup_recheck:${c.id}:${day}` });
      } else closed += 1;
    }
    // eslint-disable-next-line no-await-in-loop
    await db(T).where({ id: c.id }).update(patch);
  }

  // One notice a day per owner about their new cases.
  for (const [userId, n] of fresh) {
    // eslint-disable-next-line no-await-in-loop
    await tell(ownerAdminId, userId || null, { type: "followup_assigned", title: `${n} new learner follow-up${n === 1 ? "" : "s"}`, message: `${n === 1 ? "A learner needs" : `${n} learners need`} a follow-up from you: what's wrong is on each one, with a message ready to send to the parent.`, payload: {}, dedupeKey: `followup_new:${userId || ownerAdminId}:${day}` });
  }
  await db("learner_followup_runs").insert({ ownerAdminId, lastRunAt: now() }).onConflict("ownerAdminId").merge();
  return { candidates: candidates.size, opened, closed, still };
}

// At most every `hours` per workspace (the pages call this; the hourly cron forces a daily run).
async function processWorkspace(ownerAdminId, { hours = 6 } = {}) {
  if (!ownerAdminId) return null;
  const last = await db("learner_followup_runs").where({ ownerAdminId }).first("lastRunAt");
  if (last && Date.now() - new Date(last.lastRunAt).getTime() < hours * 3600000) return null;
  return detectWorkspace(ownerAdminId);
}

async function processAll() {
  const owners = await db("learning_hubs").whereNot({ status: "removed" }).distinct("ownerAdminId").pluck("ownerAdminId");
  const out = {};
  for (const o of owners.filter(Boolean)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await processWorkspace(o, { hours: 20 });
      if (r) out[o] = r;
    } catch (err) {
      console.error("[followups]", o, err.message);
    }
  }
  return out;
}

// ── Who is asking ────────────────────────────────────────────────────────────────────────────────
async function viewerOf(req) {
  const role = req.user.role;
  const user = await db("users").where({ id: req.user.id }).first("id", "name", "email");
  const base = { userId: req.user.id, name: user?.name || user?.email || "Staff" };
  if (role === "admin") return { ...base, kind: "admin", ownerAdminIds: [req.ownerAdminId].filter(Boolean) };
  if (role === "school") {
    if (!req.ownSchool) fail(403, "No learning hub is linked to this login");
    return { ...base, kind: "hub", ownerAdminIds: [req.ownSchool.ownerAdminId], hubId: req.ownSchool.id };
  }
  if (role === "teacher") {
    const teacherIds = user?.email ? await db("teachers").whereRaw("LOWER(email) = ?", [String(user.email).toLowerCase()]).pluck("id") : [];
    const classIds = teacherIds.length ? await db("class_course_teacher_links").whereIn("teacherId", teacherIds).distinct("classId").pluck("classId") : [];
    const hubIds = teacherIds.length ? await db("teacher_hub_links").whereIn("teacherId", teacherIds).pluck("hubId") : [];
    const owners = hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).distinct("ownerAdminId").pluck("ownerAdminId") : [];
    return { ...base, kind: "educator", ownerAdminIds: owners.filter(Boolean), classIds: new Set(classIds) };
  }
  fail(403, "Follow-ups aren't part of this sign-in");
  return null;
}

function canSee(v, c) {
  if (!v.ownerAdminIds.includes(c.ownerAdminId)) return false;
  if (v.kind === "admin") return true;
  if (v.kind === "hub") return c.hubId === v.hubId;
  return c.ownerUserId === v.userId || (c.classId && v.classIds.has(c.classId));
}

// ── Lists and one case ───────────────────────────────────────────────────────────────────────────
async function shape(rows) {
  const learners = await inChunks([...new Set(rows.map((c) => c.learnerId))], (ids) => db("learners").whereIn("id", ids).select("id", "firstName", "lastName", "guardianName", "guardianPhone", "guardianEmail"));
  const classes = await inChunks([...new Set(rows.map((c) => c.classId).filter(Boolean))], (ids) => db("classes").whereIn("id", ids).select("id", "gradeName", "streamName"));
  const hubs = await inChunks([...new Set(rows.map((c) => c.hubId).filter(Boolean))], (ids) => db("learning_hubs").whereIn("id", ids).select("id", "name"));
  const lById = new Map(learners.map((l) => [l.id, l]));
  const cById = new Map(classes.map((c) => [c.id, c]));
  const hById = new Map(hubs.map((h) => [h.id, h]));
  const last = await inChunks(rows.map((c) => c.id), (ids) => db(F).whereIn("caseId", ids).orderBy("createdAt", "desc").select("caseId", "action", "note", "createdByName", "createdAt"));
  const lastByCase = new Map();
  for (const e of last) if (!lastByCase.has(e.caseId) && e.action !== "opened") lastByCase.set(e.caseId, e);
  const day = today();
  return rows.map((c) => {
    const details = json(c.details) || {};
    const l = lById.get(c.learnerId);
    return {
      id: c.id, learnerId: c.learnerId, learnerName: fullName(l), firstName: l?.firstName || "",
      hubId: c.hubId, hubName: hById.get(c.hubId)?.name || "", classId: c.classId, className: c.classId ? className(cById.get(c.classId)) : "",
      reason: c.reason, reasonLabel: R.REASONS[c.reason]?.label || c.reason, reasonTone: R.REASONS[c.reason]?.tone || "neutral",
      summary: R.REASONS[c.reason]?.summary(details) || "", details,
      status: c.status, statusLabel: R.STATUSES[c.status]?.label || c.status, statusTone: R.STATUSES[c.status]?.tone || "neutral",
      ownerUserId: c.ownerUserId, ownerName: c.ownerUserId ? c.ownerName || "Educator" : "Admins",
      dueOn: c.dueOn ? String(c.dueOn).slice(0, 10) : null, overdue: R.isOverdue(c, day),
      recheckOn: c.recheckOn ? String(c.recheckOn).slice(0, 10) : null, stillFlagged: !!c.stillFlagged, lastCheck: json(c.lastCheck),
      outcome: c.outcome, outcomeLabel: c.outcome ? R.OUTCOMES[c.outcome] || c.outcome : null, outcomeNote: c.outcomeNote,
      source: c.source, openedAt: c.openedAt, resolvedAt: c.resolvedAt, updatedAt: c.updatedAt,
      lastAction: lastByCase.get(c.id) ? { action: lastByCase.get(c.id).action, note: lastByCase.get(c.id).note, by: lastByCase.get(c.id).createdByName, at: lastByCase.get(c.id).createdAt } : null,
    };
  });
}

async function list(req, { view = "open", reason = "", hubId = "", learnerId = "" } = {}) {
  const v = await viewerOf(req);
  for (const o of v.ownerAdminIds) await processWorkspace(o).catch((err) => console.error("[followups]", err.message)); // eslint-disable-line no-await-in-loop
  if (!v.ownerAdminIds.length) return { cases: [], counts: {}, reasons: [], statuses: [] };
  let q = db(T).whereIn("ownerAdminId", v.ownerAdminIds);
  if (learnerId) q = q.where({ learnerId });
  if (v.kind === "hub") q = q.where({ hubId: v.hubId });
  const rows = (await q.orderBy("openedAt", "desc").limit(3000)).filter((c) => canSee(v, c));
  const day = today();
  const isMine = (c) => (v.kind === "admin" ? c.ownerUserId === v.userId || !c.ownerUserId : c.ownerUserId === v.userId);
  const counts = {
    open: rows.filter((c) => c.status !== "resolved").length,
    mine: rows.filter((c) => c.status !== "resolved" && isMine(c)).length,
    overdue: rows.filter((c) => R.isOverdue(c, day)).length,
    escalated: rows.filter((c) => c.status === "escalated").length,
    resolved: rows.filter((c) => c.status === "resolved").length,
  };
  let shown = rows;
  if (view === "open") shown = rows.filter((c) => c.status !== "resolved");
  if (view === "mine") shown = rows.filter((c) => c.status !== "resolved" && isMine(c));
  if (view === "overdue") shown = rows.filter((c) => R.isOverdue(c, day));
  if (view === "escalated") shown = rows.filter((c) => c.status === "escalated");
  if (view === "resolved") shown = rows.filter((c) => c.status === "resolved");
  if (reason) shown = shown.filter((c) => c.reason === reason);
  if (hubId) shown = shown.filter((c) => c.hubId === hubId);
  const byReason = Object.fromEntries(R.REASON_KEYS.map((k) => [k, rows.filter((c) => c.status !== "resolved" && c.reason === k).length]));
  const backOnTrack = rows.filter((c) => c.outcome === "back_on_track").length;
  return {
    viewer: { kind: v.kind },
    counts: { ...counts, byReason, backOnTrack },
    reasons: R.REASON_KEYS.map((k) => ({ key: k, label: R.REASONS[k].label })),
    statuses: Object.entries(R.STATUSES).map(([key, s]) => ({ key, label: s.label })),
    outcomes: Object.entries(R.OUTCOMES).map(([key, label]) => ({ key, label })),
    cases: await shape(shown.slice(0, 1000)),
  };
}

async function loadCase(v, id) {
  const c = await db(T).where({ id }).first();
  if (!c || !canSee(v, c)) fail(404, "Follow-up not found");
  return c;
}

async function educatorOptions(ownerAdminId) {
  const hubIds = await db("learning_hubs").where({ ownerAdminId }).whereNot({ status: "removed" }).pluck("id");
  const teacherIds = hubIds.length ? await db("teacher_hub_links").whereIn("hubId", hubIds).distinct("teacherId").pluck("teacherId") : [];
  const teachers = teacherIds.length ? await db("teachers").whereIn("id", teacherIds).whereNotIn("status", ["removed", "inactive"]).whereNotNull("email").select("email", "firstName", "lastName") : [];
  const emails = [...new Set(teachers.map((t) => String(t.email).toLowerCase()))];
  const users = emails.length ? await db("users").whereIn(db.raw("LOWER(email)"), emails).whereNull("deactivatedAt").select("id", "name", "email") : [];
  return users.map((u) => ({ id: u.id, name: u.name || u.email })).sort((a, b) => a.name.localeCompare(b.name));
}

async function detail(req, id) {
  const v = await viewerOf(req);
  const c = await loadCase(v, id);
  const [shaped] = await shape([c]);
  const learner = await db("learners").where({ id: c.learnerId }).first("id", "firstName", "lastName", "guardianName", "guardianPhone", "guardianEmail");
  const parent = learner?.guardianEmail ? await db("users").whereRaw("LOWER(email) = ?", [String(learner.guardianEmail).toLowerCase()]).whereNull("deactivatedAt").first("id") : null;
  const events = await db(F).where({ caseId: c.id }).orderBy("createdAt", "desc").limit(100).select("id", "action", "note", "createdByName", "createdAt");
  // The learner's other cases, open or closed (what was tried before).
  const others = await db(T).where({ learnerId: c.learnerId }).whereNot({ id: c.id }).orderBy("openedAt", "desc").limit(20);
  return {
    ...shaped,
    viewer: { kind: v.kind, isOwner: c.ownerUserId === v.userId },
    parent: { name: learner?.guardianName || "", phone: learner?.guardianPhone || "", email: learner?.guardianEmail || "", hasLogin: !!parent },
    suggestedMessage: R.suggestedMessage(c.reason, { first: learner?.firstName, parent: learner?.guardianName, className: shaped.className, details: shaped.details }),
    events,
    otherCases: (await shape(others.filter((o) => canSee(v, o)))).map(({ id: oid, reasonLabel, status, statusLabel, outcomeLabel, openedAt, resolvedAt, summary }) => ({ id: oid, reasonLabel, status, statusLabel, outcomeLabel, openedAt, resolvedAt, summary })),
    owners: v.kind === "admin" ? [{ id: null, name: "Admins" }, ...(await educatorOptions(c.ownerAdminId))] : null,
    statuses: Object.entries(R.STATUSES).map(([key, s]) => ({ key, label: s.label })),
    outcomes: Object.entries(R.OUTCOMES).filter(([k]) => k !== "left").map(([key, label]) => ({ key, label })),
  };
}

// ── Doing something about it ─────────────────────────────────────────────────────────────────────
// action: message_parent | tell_educators | note | status | escalate | assign
async function act(req, id, input) {
  const v = await viewerOf(req);
  const c = await loadCase(v, id);
  if (c.status === "resolved" && input.action !== "note") fail(409, "This follow-up is closed. A new one opens if the reason comes back.");
  const learner = await db("learners").where({ id: c.learnerId }).first("id", "firstName", "lastName", "guardianEmail", "guardianPhone");
  const first = learner?.firstName || "your child";
  const patch = { updatedAt: now() };
  const by = { by: v.userId, byName: v.name };

  if (input.action === "message_parent") {
    const text = String(input.message || "").trim();
    if (!text) fail(400, "Write the message to the parent");
    const parent = learner?.guardianEmail ? await db("users").whereRaw("LOWER(email) = ?", [String(learner.guardianEmail).toLowerCase()]).whereNull("deactivatedAt").first("id") : null;
    if (!parent) fail(409, `${first}'s parent has no login, so the message can't reach them here. Call them on ${learner?.guardianPhone || "their phone"} and note the call.`);
    await NotificationService.notifyPerson(parent.id, { type: "learner_followup", title: `A message about ${first}`, message: text, payload: { learnerId: c.learnerId, route: `/parent/children/${c.learnerId}` }, ownerAdminId: c.ownerAdminId });
    await event(c, { action: "parent_message", note: text, ...by });
    if (["open"].includes(c.status)) patch.status = "contacted";
  } else if (input.action === "tell_educators") {
    const teacherIds = c.classId ? await db("class_course_teacher_links").where({ classId: c.classId }).distinct("teacherId").pluck("teacherId") : [];
    const emails = teacherIds.length ? (await db("teachers").whereIn("id", teacherIds).whereNotNull("email").pluck("email")).map((e) => String(e).toLowerCase()) : [];
    const users = emails.length ? await db("users").whereIn(db.raw("LOWER(email)"), emails).whereNull("deactivatedAt").whereNot({ id: v.userId }).select("id") : [];
    if (!users.length) fail(409, `No other educator with a login teaches ${first}'s class.`);
    const body = `${fullName(learner)}: ${R.REASONS[c.reason]?.summary(json(c.details) || {})} ${String(input.note || "").trim()}`.trim();
    await Promise.all(users.map((u) => NotificationService.notifyPerson(u.id, { type: "learner_flagged", title: `${fullName(learner)} needs support`, message: body, payload: { learnerId: c.learnerId, classId: c.classId, route: c.classId ? `/teacher-portal/classes/${c.classId}` : "/teacher-portal" }, ownerAdminId: c.ownerAdminId })));
    await event(c, { action: "educator_told", note: body, ...by });
  } else if (input.action === "note") {
    const text = String(input.note || "").trim();
    if (!text) fail(400, "Write the note first");
    await event(c, { action: "note", note: text, ...by });
  } else if (input.action === "status") {
    const problem = R.statusProblem(c.status, input.status);
    if (problem) fail(409, problem);
    if (input.status === "escalated") fail(400, "Use Escalate to hand it to the admins");
    patch.status = input.status;
    if (input.status === "resolved") {
      Object.assign(patch, { outcome: R.OUTCOMES[input.outcome] ? input.outcome : "sorted", outcomeNote: input.note ? String(input.note).slice(0, 1000) : null, openKey: null, resolvedAt: now() });
    }
    await event(c, { action: "status", note: `${R.STATUSES[input.status].label}${input.status === "resolved" ? ` (${R.OUTCOMES[patch.outcome]})` : ""}${input.note ? `: ${String(input.note).trim()}` : ""}`, ...by });
  } else if (input.action === "escalate") {
    const why = String(input.note || "").trim();
    if (!why) fail(400, "Say why it needs the admins");
    Object.assign(patch, { status: "escalated", ownerUserId: null, ownerName: null, dueOn: R.addDays(today(), R.DUE_DAYS) });
    await event(c, { action: "escalated", note: why, ...by });
    await tell(c.ownerAdminId, null, { type: "followup_assigned", title: `Follow-up escalated: ${fullName(learner)}`, message: `${v.name} needs the admins' help (${R.REASONS[c.reason]?.label}): ${why}`, payload: { caseId: c.id, learnerId: c.learnerId }, dedupeKey: `followup_escalated:${c.id}:${Date.now()}` });
  } else if (input.action === "assign") {
    if (v.kind !== "admin") fail(403, "Only the admins move a follow-up to someone else");
    const to = input.ownerUserId || null;
    let toName = null;
    if (to) {
      const options = await educatorOptions(c.ownerAdminId);
      const pick = options.find((o) => o.id === to);
      if (!pick) fail(400, "Choose an educator of this workspace");
      toName = pick.name;
    }
    Object.assign(patch, { ownerUserId: to, ownerName: toName, dueOn: R.addDays(today(), R.DUE_DAYS), ...(c.status === "escalated" ? { status: "open" } : {}) });
    await event(c, { action: "assigned", note: `Now with ${toName || "the admins"}${input.note ? `: ${String(input.note).trim()}` : ""}`, ...by });
    if (to && to !== v.userId) await tell(c.ownerAdminId, to, { type: "followup_assigned", title: `Follow-up for you: ${fullName(learner)}`, message: `${R.REASONS[c.reason]?.label}: ${R.REASONS[c.reason]?.summary(json(c.details) || {})}`, payload: { caseId: c.id, learnerId: c.learnerId }, dedupeKey: `followup_assigned:${c.id}:${to}:${Date.now()}` });
  } else {
    fail(400, "Unknown action");
  }
  await db(T).where({ id: c.id }).update(patch);
  return detail(req, id);
}

// The team opens a follow-up by hand (a call from a parent, something seen in class).
async function openManual(req, { learnerId, note }) {
  const v = await viewerOf(req);
  if (v.kind === "educator") fail(403, "Ask an admin to open it, or use the learner's class page");
  const text = String(note || "").trim();
  if (!text) fail(400, "Say what needs following up");
  const link = await db("learner_hub_links").where({ learnerId, status: "active" }).first("hubId", "classId");
  const hub = link ? await db("learning_hubs").where({ id: link.hubId }).first("ownerAdminId") : null;
  if (!hub || !v.ownerAdminIds.includes(hub.ownerAdminId) || (v.kind === "hub" && link.hubId !== v.hubId)) fail(404, "That learner isn't at your hubs");
  const owner = await ownerFor(link.classId);
  const day = today();
  const row = {
    id: generateId(), ownerAdminId: hub.ownerAdminId, hubId: link.hubId, classId: link.classId, learnerId,
    reason: "other", reasonKey: `other:${generateId().slice(0, 8)}`, openKey: null, details: toJson({ note: text.slice(0, 300) }), status: "open",
    ownerUserId: owner?.userId || null, ownerName: owner?.name || null, dueOn: R.addDays(day, R.DUE_DAYS), recheckOn: null,
    stillFlagged: true, source: "manual", openedBy: v.userId, openedAt: now(), createdAt: now(), updatedAt: now(),
  };
  await db(T).insert(row);
  await event(row, { action: "opened", note: text, by: v.userId, byName: v.name });
  if (row.ownerUserId && row.ownerUserId !== v.userId) await tell(row.ownerAdminId, row.ownerUserId, { type: "followup_assigned", title: "A follow-up for you", message: text, payload: { caseId: row.id, learnerId }, dedupeKey: `followup_assigned:${row.id}` });
  return detail(req, row.id);
}

// The at-risk list's actions (analytics.followups.js) join the learner's open cases.
async function attachAtRiskAction(learnerId, action) {
  const open = await db(T).where({ learnerId }).whereNot({ status: "resolved" }).select("id", "status");
  if (!open.length) return null;
  if (action === "parent_message") await db(T).whereIn("id", open.filter((c) => c.status === "open").map((c) => c.id)).update({ status: "contacted", updatedAt: now() });
  if (action === "followed_up") await db(T).whereIn("id", open.map((c) => c.id)).update({ updatedAt: now() });
  return open[0].id;
}

module.exports = { candidatesFor, detectWorkspace, processWorkspace, processAll, list, detail, act, openManual, attachAtRiskAction, viewerOf };
