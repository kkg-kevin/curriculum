// Logins & engagement — from the Activity log's sign-in records (audit_log: login, logout,
// session_expired, login_failed). Who counts is the scope's people: the learners' own (username)
// logins, their parents' logins, the educators teaching the scope's classes, the hubs' own logins
// and, for the whole workspace only, its admins and staff.

const db = require("../../config/db");
const { kenyaDay, kenyaDowHour, daysOf, median, round, pct, inChunks, fullName } = require("./analytics.utils");

const KINDS = [
  { key: "learner", label: "Learners" },
  { key: "parent", label: "Parents" },
  { key: "educator", label: "Educators" },
  { key: "hub", label: "Hub logins" },
  { key: "staff", label: "Admins & staff" },
];
const INACTIVE_DAYS = 14;

// Which kind of person a sign-in row is, from the role the session ran as.
function kindOfRow(row, user) {
  if (row.actorRole === "learner") return user?.username && !user?.email ? "learner" : "parent";
  if (row.actorRole === "teacher") return "educator";
  if (row.actorRole === "school") return "hub";
  return "staff";
}

function device(ua = "") {
  const s = String(ua);
  const type = /iPad|Tablet|(Android(?!.*Mobile))/i.test(s) ? "Tablet" : /Mobi|iPhone|Android/i.test(s) ? "Phone" : s ? "Computer" : "Unknown";
  const browser = /SamsungBrowser/i.test(s) ? "Samsung Internet"
    : /OPR\/|Opera/i.test(s) ? "Opera"
      : /Edg\//i.test(s) ? "Edge"
        : /FBAN|FBAV|Instagram|; wv\)/i.test(s) ? "In-app browser"
          : /Firefox|FxiOS/i.test(s) ? "Firefox"
            : /Chrome|CriOS/i.test(s) ? "Chrome"
              : /Safari/i.test(s) ? "Safari" : s ? "Other" : "Unknown";
  return { type, browser };
}

// The people in scope, each with the kind(s) they're counted as and where they link to.
async function peopleInScope(scope) {
  const people = new Map(); // userId -> { user, kinds:Set, name, hubName, link }
  const add = (user, kind, extra) => {
    if (!user) return;
    const p = people.get(user.id) || { user, kinds: new Set(), ...extra };
    p.kinds.add(kind);
    people.set(user.id, p);
  };
  const hubNameOfLearner = new Map();
  for (const l of scope.links) if (!hubNameOfLearner.has(l.learnerId)) hubNameOfLearner.set(l.learnerId, scope.hubById.get(l.hubId)?.name || "—");

  // Learners' own logins and their parents'.
  const usernames = scope.learners.map((l) => l.username).filter(Boolean);
  const children = await inChunks(usernames, (u) => db("users").whereIn("username", u).select("id", "name", "email", "username", "role", "extraRoles", "createdAt"));
  const childByUsername = new Map(children.map((u) => [u.username, u]));
  const emails = [...new Set(scope.learners.map((l) => String(l.guardianEmail || "").toLowerCase()).filter(Boolean))];
  const parents = await inChunks(emails, (e) => db("users").whereIn(db.raw("LOWER(email)"), e).select("id", "name", "email", "username", "role", "extraRoles", "createdAt"));
  const parentByEmail = new Map(parents.map((u) => [String(u.email).toLowerCase(), u]));
  const learnersWithLogin = { child: 0, parent: 0, either: 0, none: [] };
  for (const l of scope.learners) {
    const child = l.username ? childByUsername.get(l.username) : null;
    const parent = l.guardianEmail ? parentByEmail.get(String(l.guardianEmail).toLowerCase()) : null;
    add(child, "learner", { name: fullName(l), hubName: hubNameOfLearner.get(l.id), link: { type: "learner", id: l.id } });
    add(parent, "parent", { name: parent?.name || l.guardianName || parent?.email, hubName: hubNameOfLearner.get(l.id), link: { type: "learner", id: l.id }, note: `Parent of ${fullName(l)}` });
    if (child) learnersWithLogin.child += 1;
    if (parent) learnersWithLogin.parent += 1;
    if (child || parent) learnersWithLogin.either += 1;
    else learnersWithLogin.none.push(l.id);
  }

  if (!scope.learnerFiltersOnly) {
    // Educators teaching the classes (and, for the whole workspace, every educator it has).
    const teacherIds = new Set(scope.classes.map((c) => c.classTeacherId).filter(Boolean));
    const links = await inChunks(scope.classIds, (ids) => db("class_course_teacher_links").whereIn("classId", ids).select("teacherId"));
    links.forEach((l) => teacherIds.add(l.teacherId));
    let teachers = await inChunks([...teacherIds], (ids) => db("teachers").whereIn("id", ids).select("id", "firstName", "lastName", "email"));
    if (!scope.isHubView && !scope.filters.hubId && !scope.narrowedByClass && scope.ownerAdminId) {
      const own = await db("teachers").where({ createdByAdminId: scope.ownerAdminId }).select("id", "firstName", "lastName", "email");
      const seen = new Set(teachers.map((t) => t.id));
      teachers = [...teachers, ...own.filter((t) => !seen.has(t.id))];
    }
    const tEmails = [...new Set(teachers.map((t) => String(t.email || "").toLowerCase()).filter(Boolean))];
    const tUsers = await inChunks(tEmails, (e) => db("users").whereIn(db.raw("LOWER(email)"), e).select("id", "name", "email", "username", "role", "extraRoles", "createdAt"));
    const tUserByEmail = new Map(tUsers.map((u) => [String(u.email).toLowerCase(), u]));
    for (const t of teachers) add(tUserByEmail.get(String(t.email || "").toLowerCase()), "educator", { name: fullName(t), hubName: "", link: { type: "educator", id: t.id } });

    if (!scope.narrowedByClass) {
      const hubEmails = [...new Set(scope.hubs.map((h) => String(h.email || "").toLowerCase()).filter(Boolean))];
      const hubUsers = await inChunks(hubEmails, (e) => db("users").whereIn(db.raw("LOWER(email)"), e).select("id", "name", "email", "username", "role", "extraRoles", "createdAt"));
      const hubByEmail = new Map(scope.hubs.map((h) => [String(h.email || "").toLowerCase(), h]));
      for (const u of hubUsers) add(u, "hub", { name: hubByEmail.get(String(u.email).toLowerCase())?.name || u.name, hubName: hubByEmail.get(String(u.email).toLowerCase())?.name || "", link: { type: "hub", id: hubByEmail.get(String(u.email).toLowerCase())?.id } });
    }

    if (!scope.isHubView && !scope.filters.hubId && !scope.narrowedByClass && scope.ownerAdminId) {
      const staff = await db("users")
        .where((w) => w.where({ id: scope.ownerAdminId }).orWhere({ organisationId: scope.ownerAdminId }).orWhere({ invitedByAdminId: scope.ownerAdminId }))
        .whereNull("deactivatedAt")
        .select("id", "name", "email", "username", "role", "extraRoles", "createdAt");
      for (const u of staff) add(u, "staff", { name: u.name || u.email, hubName: "", link: null });
    }
  }
  return { people, learnersWithLogin };
}

async function getLogins(scope) {
  const { period } = scope;
  const { people, learnersWithLogin } = await peopleInScope(scope);
  const userIds = [...people.keys()];

  const rows = await inChunks(userIds, (ids) => db("audit_log")
    .whereIn("actorUserId", ids)
    .whereIn("action", ["login", "logout", "session_expired", "login_failed"])
    .whereBetween("createdAt", [period.prevStart, period.end])
    .select("actorUserId", "actorRole", "action", "userAgent", "createdAt"));
  // Failed sign-ins with no account behind them (a mistyped username) belong to the workspace only.
  if (!scope.isHubView && !scope.filters.hubId && !scope.narrowedByClass && !scope.learnerFiltersOnly && scope.ownerAdminId) {
    rows.push(...(await db("audit_log").whereNull("actorUserId").where({ action: "login_failed", ownerAdminId: scope.ownerAdminId })
      .whereBetween("createdAt", [period.prevStart, period.end]).select("actorUserId", "actorRole", "action", "userAgent", "createdAt")));
  }
  rows.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  // A row counts when its kind is one this person is counted as here.
  const counted = rows.filter((r) => {
    if (!r.actorUserId) return true;
    const p = people.get(r.actorUserId);
    return p && p.kinds.has(kindOfRow(r, p.user));
  });
  const inPeriod = (r) => new Date(r.createdAt) >= period.start;
  const cur = counted.filter(inPeriod);
  const prev = counted.filter((r) => !inPeriod(r));
  const logins = cur.filter((r) => r.action === "login");
  const prevLogins = prev.filter((r) => r.action === "login");

  const activeBy = (list) => {
    const byKind = Object.fromEntries(KINDS.map((k) => [k.key, new Set()]));
    for (const r of list) if (r.action === "login" && r.actorUserId) byKind[kindOfRow(r, people.get(r.actorUserId)?.user)]?.add(r.actorUserId);
    return byKind;
  };
  const active = activeBy(cur);
  const prevActive = activeBy(prev);
  const population = Object.fromEntries(KINDS.map((k) => [k.key, 0]));
  for (const p of people.values()) for (const k of p.kinds) population[k] += 1;

  // Per day: sign-ins and the people signing in.
  const days = daysOf(period).map((day) => ({ day, logins: 0, users: new Set() }));
  const dayIndex = new Map(days.map((d, i) => [d.day, i]));
  for (const r of logins) {
    const i = dayIndex.get(kenyaDay(r.createdAt));
    if (i == null) continue;
    days[i].logins += 1;
    if (r.actorUserId) days[i].users.add(r.actorUserId);
  }

  // When people sign in: weekday × hour, Kenyan time.
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of logins) { const { dow, hour } = kenyaDowHour(r.createdAt); heatmap[dow][hour] += 1; }

  const tally = (list, key) => {
    const m = new Map();
    for (const r of list) { const k = device(r.userAgent)[key]; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].map(([label, count]) => ({ label, count, percent: pct(count, list.length) })).sort((a, b) => b.count - a.count);
  };

  // How long a sign-in lasts: to the same person's next sign-out or expiry, within 12 hours.
  const sessionMinutes = [];
  const lastLogin = new Map();
  for (const r of counted) {
    if (!r.actorUserId) continue;
    if (r.action === "login") lastLogin.set(r.actorUserId, r);
    else if (r.action === "logout" || r.action === "session_expired") {
      const open = lastLogin.get(r.actorUserId);
      if (open && inPeriod(open)) {
        const minutes = (new Date(r.createdAt) - new Date(open.createdAt)) / 60000;
        if (minutes >= 0 && minutes <= 720) sessionMinutes.push(minutes);
      }
      lastLogin.delete(r.actorUserId);
    }
  }

  // Last sign-in ever, per person — for "never signed in" and "not seen lately".
  const last = await inChunks(userIds, (ids) => db("audit_log").whereIn("actorUserId", ids).where({ action: "login" })
    .groupBy("actorUserId").select("actorUserId").max({ at: "createdAt" }));
  const lastAt = new Map(last.map((r) => [r.actorUserId, r.at]));
  const cutoff = Date.now() - INACTIVE_DAYS * 86400000;
  const never = [];
  const inactive = [];
  for (const [id, p] of people) {
    const kind = [...p.kinds][0];
    const row = { userId: id, kind, kindLabel: KINDS.find((k) => k.key === kind)?.label.replace(/s$/, "") || kind, name: p.name || "—", note: p.note || null, hubName: p.hubName || "", link: p.link, lastSignIn: lastAt.get(id) || null, accountCreated: p.user.createdAt || null };
    if (!row.lastSignIn) never.push(row);
    else if (new Date(row.lastSignIn).getTime() < cutoff) inactive.push(row);
  }
  never.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
  inactive.sort((a, b) => new Date(a.lastSignIn) - new Date(b.lastSignIn));

  // Learners reached: signed in themselves, or their parent did, during the period.
  const reached = new Set();
  const userIdOf = new Map();
  for (const [id, p] of people) if (p.link?.type === "learner") (userIdOf.get(id) || userIdOf.set(id, []).get(id)).push(p.link.id);
  for (const r of logins) if (r.actorUserId && userIdOf.has(r.actorUserId)) userIdOf.get(r.actorUserId).forEach((lid) => reached.add(lid));
  // A parent of several children reaches all of them.
  const parentIdByEmail = new Map();
  for (const [id, p] of people) if (p.kinds.has("parent") && p.user.email) parentIdByEmail.set(String(p.user.email).toLowerCase(), id);
  const parentChildren = new Map();
  for (const l of scope.learners) {
    const id = l.guardianEmail ? parentIdByEmail.get(String(l.guardianEmail).toLowerCase()) : null;
    if (id) (parentChildren.get(id) || parentChildren.set(id, []).get(id)).push(l.id);
  }
  for (const r of logins) if (r.actorUserId && parentChildren.has(r.actorUserId)) parentChildren.get(r.actorUserId).forEach((lid) => reached.add(lid));

  const failed = cur.filter((r) => r.action === "login_failed").length;
  const prevFailed = prev.filter((r) => r.action === "login_failed").length;

  return {
    period,
    headline: {
      logins: logins.length,
      prevLogins: prevLogins.length,
      activeUsers: new Set(logins.map((r) => r.actorUserId).filter(Boolean)).size,
      prevActiveUsers: new Set(prevLogins.map((r) => r.actorUserId).filter(Boolean)).size,
      failed,
      prevFailed,
      medianSessionMinutes: round(median(sessionMinutes)),
      sessionsMeasured: sessionMinutes.length,
      learnersReached: reached.size,
      learnersReachedPercent: pct(reached.size, scope.learners.length),
      learnerCount: scope.learners.length,
    },
    byKind: KINDS.map((k) => ({ ...k, active: active[k.key].size, prevActive: prevActive[k.key].size, population: population[k.key], percent: pct(active[k.key].size, population[k.key]) })).filter((k) => k.population > 0 || k.active > 0),
    daily: days.map((d) => ({ day: d.day, logins: d.logins, users: d.users.size })),
    heatmap,
    devices: tally(logins, "type"),
    browsers: tally(logins, "browser"),
    accounts: {
      learners: scope.learners.length,
      withChildLogin: learnersWithLogin.child,
      withParentLogin: learnersWithLogin.parent,
      withNoLogin: learnersWithLogin.none.length,
      noLogin: learnersWithLogin.none.slice(0, 500).map((id) => { const l = scope.learnerById.get(id); return { learnerId: id, name: fullName(l), guardianName: l?.guardianName || "" }; }),
    },
    neverSignedIn: never.slice(0, 500),
    neverSignedInCount: never.length,
    notSeenLately: inactive.slice(0, 500),
    notSeenLatelyCount: inactive.length,
    inactiveDays: INACTIVE_DAYS,
  };
}

module.exports = { getLogins, device };
