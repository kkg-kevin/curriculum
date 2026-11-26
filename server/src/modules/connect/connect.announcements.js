const db = require("../../config/db");
const { generateId, toJson } = require("../../shared/utils/model.utils");
const { adminIdsOf } = require("../../shared/utils/organisation");
const NotificationService = require("../notifications/notification.service");
const S = require("./connect.store");
const { checkText } = require("./connect.rules");
const { requireManager } = require("./connect.context");
const R = require("./connect.announcement.rules");

// Connect → Announcements (26 Nov 2026). The team posts to chosen groups of people in the system —
// educators, parents, learners, hubs, staff, supervisors, affiliates — narrowed by hub and class,
// and decides how they may engage: react, comment (one thread per group), confirm "I've read this".
// Everyone it reaches gets the bell (and an email when ticked); it sits on their portal's
// Announcements page; "Important" ones also pop up at sign-in. A child whose Connect isn't switched
// on by a parent only gets the bell (channel "notice") and never comments. Who it reached is fixed
// when it goes out (connect_announcement_recipients). Rules: connect.announcement.rules.js.
//
// Admin side: requireManager (admins, staff with Digifunzi Connect → Create / Edit), through
// /api/connect/admin/announcements. Reader side: /api/announcements (any signed-in person; each
// call checks their own recipient row).

const A = "connect_announcements";
const RC = "connect_announcement_recipients";
const CM = "connect_announcement_comments";
const RX = "connect_announcement_reactions";
const now = () => new Date();
const refuse = (status, message) => Object.assign(new Error(message), { statusCode: status });
const parse = (v, fallback) => {
  if (v == null) return fallback;
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return fallback; }
};
const chunk = (list, n = 500) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

// ── Who it reaches ─────────────────────────────────────────────────────────────────────────────────
// Every login of the workspace in the chosen groups, narrowed by hub (educators, parents, learners,
// hubs) and class (educators, parents, learners) → Map userId → group. A person in two groups is
// counted once, in the first that reaches them.
async function audienceMembers(ownerAdminId, audience) {
  const { groups, hubIds, classIds } = R.cleanAudience(audience);
  const want = new Set(groups);
  const members = new Map();
  const add = (ids, group) => ids.forEach((id) => { if (id && !members.has(id)) members.set(id, group); });
  const active = (q) => q.whereNull("deactivatedAt");
  const adminIds = await adminIdsOf(ownerAdminId);
  const allHubs = await db("learning_hubs").where({ ownerAdminId }).whereNot({ status: "removed" }).select("id", "email");
  const hubs = hubIds.length ? allHubs.filter((h) => hubIds.includes(h.id)) : allHubs;
  const hubIdList = hubs.map((h) => h.id);
  const classes = classIds.length && hubIdList.length ? await db("classes").whereIn("id", classIds).whereIn("schoolId", hubIdList).pluck("id") : [];
  const byClass = classIds.length > 0;

  if (want.has("staff")) {
    add(adminIds, "staff");
    if (adminIds.length) add(await active(db("users").whereIn("invitedByAdminId", adminIds).where({ role: "collaborator" })).pluck("id"), "staff");
  }
  if (want.has("supervisors") && adminIds.length) add(await active(db("users").whereIn("invitedByAdminId", adminIds).where({ role: "supervisor" })).pluck("id"), "supervisors");
  if (want.has("hubs")) {
    const emails = hubs.map((h) => h.email).filter(Boolean);
    if (emails.length) add(await active(db("users").whereIn("email", emails).where({ role: "school" })).pluck("id"), "hubs");
  }
  if (want.has("educators") && hubIdList.length) {
    let teacherIds = await db("teacher_hub_links").whereIn("hubId", hubIdList).pluck("teacherId");
    if (byClass) {
      const inClasses = new Set(classes.length ? await db("class_course_teacher_links").whereIn("classId", classes).pluck("teacherId") : []);
      teacherIds = teacherIds.filter((id) => inClasses.has(id));
    }
    const teachers = teacherIds.length ? await db("teachers").whereIn("id", [...new Set(teacherIds)]).whereNotIn("status", ["removed", "inactive"]).pluck("email") : [];
    const emails = [...new Set(teachers.filter(Boolean))];
    if (emails.length) add(await active(db("users").whereIn("email", emails).whereNot({ role: "learner" })).pluck("id"), "educators");
  }
  if ((want.has("parents") || want.has("learners")) && hubIdList.length) {
    let q = db("learner_hub_links").whereIn("hubId", hubIdList).where({ status: "active" });
    if (byClass) q = q.whereIn("classId", classes.length ? classes : ["-"]);
    const learnerIds = [...new Set(await q.pluck("learnerId"))];
    const learners = learnerIds.length ? await db("learners").whereIn("id", learnerIds).select("guardianEmail", "username", "teacherId") : [];
    const kids = learners.filter((l) => !l.teacherId); // educators' own TOT records aren't families
    const parentEmails = [...new Set(kids.map((l) => l.guardianEmail).filter(Boolean))];
    const usernames = [...new Set(kids.map((l) => l.username).filter(Boolean))];
    if (want.has("parents") && parentEmails.length) add(await active(db("users").whereIn("email", parentEmails).where({ role: "learner" })).pluck("id"), "parents");
    if (want.has("learners") && usernames.length) add(await active(db("users").whereIn("username", usernames).where({ role: "learner" })).pluck("id"), "learners");
  }
  if (want.has("affiliates")) add(await db("affiliates").where({ ownerAdminId, status: "active" }).whereNotNull("userId").pluck("userId"), "affiliates");
  return members;
}

// Every learner is on Connect now (26 Nov 2026), so every child gets announcements in full
// ("feed"). "notice" (the bell only) stays for rows sent before.
async function channelsFor(userIds) {
  return new Map(userIds.map((id) => [id, "feed"]));
}

// How many it would reach, by group (the form's live count).
async function countAudience(ctx, audience) {
  requireManager(ctx);
  const members = await audienceMembers(ctx.ownerAdminId, audience);
  const byGroup = Object.fromEntries(R.GROUP_KEYS.map((k) => [k, 0]));
  for (const g of members.values()) byGroup[g] += 1;
  const learnerIds = [...members].filter(([, g]) => g === "learners").map(([id]) => id);
  const channels = await channelsFor(learnerIds);
  const onlyBell = [...channels.values()].filter((c) => c === "notice").length;
  return { total: members.size, byGroup, learnersOnlyBell: onlyBell };
}

// What the form can choose from: the workspace's hubs and their classes.
async function audienceOptions(ctx) {
  requireManager(ctx);
  const hubs = await db("learning_hubs").where({ ownerAdminId: ctx.ownerAdminId }).whereNotIn("status", ["removed"]).select("id", "name", "isHomeLearning").orderBy("name");
  const classes = hubs.length ? await db("classes").whereIn("schoolId", hubs.map((h) => h.id)).where({ status: "active" }).select("id", "schoolId", "gradeName", "streamName").orderBy("gradeName") : [];
  return {
    groups: R.GROUPS.map(({ key, label }) => ({ key, label, byHub: R.HUB_GROUPS.has(key), byClass: R.CLASS_GROUPS.has(key) })),
    reactions: R.REACTIONS,
    hubs: hubs.map((h) => ({ id: h.id, name: h.name, homeLearning: !!h.isHomeLearning })),
    classes: classes.map((c) => ({ id: c.id, hubId: c.schoolId, label: [c.gradeName, c.streamName].filter(Boolean).join(" · ") || "Class" })),
  };
}

// ── Saving and sending ─────────────────────────────────────────────────────────────────────────────
function fields(data) {
  return {
    title: String(data.title || "").trim().slice(0, 200),
    body: data.body ? String(data.body).slice(0, 60000) : null,
    imageUrl: data.imageUrl || null,
    fileUrl: data.fileUrl || null,
    fileName: data.fileUrl ? String(data.fileName || "File").slice(0, 255) : null,
    linkUrl: data.linkUrl ? String(data.linkUrl).trim().slice(0, 500) : null,
    linkLabel: data.linkUrl ? String(data.linkLabel || "").trim().slice(0, 80) : null,
    allowReactions: !!data.allowReactions,
    allowComments: !!data.allowComments,
    askAck: !!data.askAck,
    important: !!data.important,
    pinned: !!data.pinned,
    sendEmail: !!data.sendEmail,
    endsAt: data.endsAt ? new Date(data.endsAt) : null,
  };
}

async function create(ctx, data) {
  requireManager(ctx);
  const audience = R.cleanAudience(data.audience);
  const publishAt = data.publishAt ? new Date(data.publishAt) : null;
  const row = { ...fields(data), audience };
  const problems = R.announcementProblems({ ...row, publishAt });
  if (problems.length) throw refuse(400, problems.join(". "));
  const id = generateId();
  const later = publishAt && publishAt > now();
  await db(A).insert({
    id, ownerAdminId: ctx.ownerAdminId, ...row, audience: toJson(audience),
    status: "scheduled", publishAt: later ? publishAt : now(),
    createdBy: ctx.userId, authorName: ctx.name || "Digifunzi team", createdAt: now(), updatedAt: now(),
  });
  if (!later) await publish(id);
  return detail(ctx, id);
}

// Sends it: who it reaches is fixed now; each person gets the bell (and the email when ticked).
async function publish(id) {
  const a = await db(A).where({ id }).first();
  if (!a || a.deletedAt || a.status !== "scheduled") return 0;
  // Claim it first, so two runs never send it twice.
  const claimed = await db(A).where({ id, status: "scheduled" }).update({ status: "published", publishedAt: now(), updatedAt: now() });
  if (!claimed) return 0;
  const members = await audienceMembers(a.ownerAdminId, parse(a.audience, {}));
  const ids = [...members.keys()];
  const channels = await channelsFor(ids.filter((uid) => members.get(uid) === "learners"));
  const rows = ids.map((userId) => ({ id: generateId(), announcementId: id, userId, audienceGroup: members.get(userId), channel: members.get(userId) === "learners" ? channels.get(userId) || "notice" : "feed", createdAt: now() }));
  for (const part of chunk(rows)) await db(RC).insert(part);
  await db(A).where({ id }).update({ recipientCount: rows.length });
  // The bell for each person — after the request, so a big audience never holds the page up.
  setImmediate(() => { notifyAll({ ...a, status: "published" }, rows).catch((err) => console.error("[announcements] notify:", err.message)); });
  return rows.length;
}

async function notifyAll(a, rows) {
  const gist = R.summaryText(a.body, 240);
  for (const r of rows) {
    const notice = r.channel === "notice";
    // eslint-disable-next-line no-await-in-loop
    await NotificationService.notifyPerson(r.userId, {
      // announcement_email is emailed (Settings → Emails can switch it off); announcement is the bell only.
      type: a.sendEmail ? "announcement_email" : "announcement",
      title: `${a.important ? "Important: " : ""}${a.title}`,
      message: notice ? (gist || a.title) : (gist ? `${gist}` : "Open it to read more."),
      payload: { route: notice ? "/learner-portal" : R.routeFor(r.audienceGroup, a.id), announcementId: a.id },
      dedupeKey: `announcement:${a.id}:${r.userId}`,
      ownerAdminId: a.ownerAdminId,
    }).catch(() => {});
  }
}

// Scheduled ones whose time has come (checkins:process hourly, and whenever a list is read).
let lastSweep = 0;
async function publishDue({ force = false } = {}) {
  if (!force && Date.now() - lastSweep < 60 * 1000) return 0;
  lastSweep = Date.now();
  const due = await db(A).where({ status: "scheduled" }).whereNull("deletedAt").where("publishAt", "<=", now()).pluck("id");
  let sent = 0;
  for (const id of due) sent += await publish(id); // eslint-disable-line no-await-in-loop
  return sent;
}

async function owned(ctx, id) {
  requireManager(ctx);
  const a = await db(A).where({ id, ownerAdminId: ctx.ownerAdminId }).whereNull("deletedAt").first();
  if (!a) throw refuse(404, "Announcement not found");
  return a;
}

// Content and engagement can change at any time; who it's for and when it goes out only before it does.
async function update(ctx, id, data) {
  const a = await owned(ctx, id);
  const scheduled = a.status === "scheduled";
  const row = fields(data);
  const audience = scheduled ? R.cleanAudience(data.audience) : parse(a.audience, {});
  const publishAt = scheduled && data.publishAt ? new Date(data.publishAt) : a.publishAt;
  const problems = R.announcementProblems({ ...row, audience, publishAt: scheduled ? publishAt : null });
  if (problems.length) throw refuse(400, problems.join(". "));
  const patch = { ...row, updatedAt: now() };
  if (scheduled) Object.assign(patch, { audience: toJson(audience), publishAt: publishAt && publishAt > now() ? publishAt : now() });
  if (!scheduled) delete patch.sendEmail; // already sent
  if (a.status === "ended" && row.endsAt && row.endsAt > now()) Object.assign(patch, { status: "published", endedAt: null });
  await db(A).where({ id }).update(patch);
  if (scheduled && (!publishAt || publishAt <= now())) await publish(id);
  return detail(ctx, id);
}

async function end(ctx, id) {
  await owned(ctx, id);
  await db(A).where({ id }).update({ status: "ended", endedAt: now(), pinned: false, updatedAt: now() });
  return detail(ctx, id);
}

// Deleted: gone from everyone's lists (kept for the record, never shown).
async function remove(ctx, id) {
  await owned(ctx, id);
  await db(A).where({ id }).update({ deletedAt: now(), pinned: false, updatedAt: now() });
  return { deleted: true };
}

// ── The team's view ────────────────────────────────────────────────────────────────────────────────
async function statsFor(ids) {
  const out = new Map(ids.map((id) => [id, { seen: 0, acked: 0, comments: 0, reactions: 0 }]));
  if (!ids.length) return out;
  const [seen, acked, comments, reactions] = await Promise.all([
    db(RC).whereIn("announcementId", ids).whereNotNull("seenAt").groupBy("announcementId").select("announcementId").count({ n: "*" }),
    db(RC).whereIn("announcementId", ids).whereNotNull("ackAt").groupBy("announcementId").select("announcementId").count({ n: "*" }),
    db(CM).whereIn("announcementId", ids).whereNull("hiddenAt").groupBy("announcementId").select("announcementId").count({ n: "*" }),
    db(RX).whereIn("announcementId", ids).groupBy("announcementId").select("announcementId").count({ n: "*" }),
  ]);
  for (const [list, key] of [[seen, "seen"], [acked, "acked"], [comments, "comments"], [reactions, "reactions"]]) {
    for (const r of list) out.get(r.announcementId)[key] = Number(r.n);
  }
  return out;
}

function shapeForTeam(a, stats) {
  return {
    id: a.id, title: a.title, body: a.body, imageUrl: a.imageUrl, fileUrl: a.fileUrl, fileName: a.fileName, linkUrl: a.linkUrl, linkLabel: a.linkLabel,
    audience: parse(a.audience, {}), allowReactions: !!a.allowReactions, allowComments: !!a.allowComments, askAck: !!a.askAck,
    important: !!a.important, pinned: !!a.pinned, sendEmail: !!a.sendEmail,
    state: R.stateOf(a), publishAt: a.publishAt, publishedAt: a.publishedAt, endsAt: a.endsAt, endedAt: a.endedAt,
    recipientCount: a.recipientCount, authorName: a.authorName, createdAt: a.createdAt, updatedAt: a.updatedAt,
    summary: R.summaryText(a.body, 160), stats: stats || null,
  };
}

async function list(ctx) {
  requireManager(ctx);
  await publishDue();
  const rows = await db(A).where({ ownerAdminId: ctx.ownerAdminId }).whereNull("deletedAt").orderBy("createdAt", "desc").limit(300);
  const stats = await statsFor(rows.map((a) => a.id));
  return rows.map((a) => shapeForTeam(a, stats.get(a.id)));
}

const nameOf = (u) => u?.name || u?.username || "Someone";

async function detail(ctx, id) {
  const a = await owned(ctx, id);
  const [stats, recipients, comments, reactions] = await Promise.all([
    statsFor([id]),
    db(RC).where({ announcementId: id }).select("userId", "audienceGroup", "channel", "seenAt", "ackAt"),
    db(CM).where({ announcementId: id }).orderBy("createdAt", "asc"),
    db(RX).where({ announcementId: id }).select("kind"),
  ]);
  const users = recipients.length ? await db("users").whereIn("id", recipients.map((r) => r.userId)).select("id", "name", "username", "email") : [];
  const userById = new Map(users.map((u) => [u.id, u]));
  const byGroup = {};
  for (const r of recipients) {
    const g = byGroup[r.audienceGroup] || (byGroup[r.audienceGroup] = { key: r.audienceGroup, label: R.groupLabel(r.audienceGroup), reached: 0, seen: 0, acked: 0, onlyBell: 0, comments: [] });
    g.reached += 1;
    if (r.seenAt) g.seen += 1;
    if (r.ackAt) g.acked += 1;
    if (r.channel === "notice") g.onlyBell += 1;
  }
  for (const c of comments) {
    const g = byGroup[c.audienceGroup] || (byGroup[c.audienceGroup] = { key: c.audienceGroup, label: R.groupLabel(c.audienceGroup), reached: 0, seen: 0, acked: 0, onlyBell: 0, comments: [] });
    g.comments.push({ id: c.id, body: c.body, authorName: c.authorName, authorRole: c.authorRole, fromTeam: !!c.fromTeam, hidden: !!c.hiddenAt, hiddenBy: c.hiddenBy, createdAt: c.createdAt });
  }
  // Who hasn't opened it (or, when asked, hasn't confirmed reading it) — those it can reach in full.
  const waiting = recipients
    .filter((r) => r.channel === "feed" && (a.askAck ? !r.ackAt : !r.seenAt))
    .map((r) => ({ userId: r.userId, name: nameOf(userById.get(r.userId)), group: r.audienceGroup, groupLabel: R.groupLabel(r.audienceGroup), seen: !!r.seenAt }))
    .sort((x, y) => x.groupLabel.localeCompare(y.groupLabel) || x.name.localeCompare(y.name));
  const reactionCounts = Object.fromEntries(R.REACTIONS.map((k) => [k, reactions.filter((r) => r.kind === k).length]));
  return {
    ...shapeForTeam(a, stats.get(id)),
    groups: R.GROUP_KEYS.filter((k) => byGroup[k]).map((k) => byGroup[k]),
    waiting: waiting.slice(0, 500),
    waitingCount: waiting.length,
    reactionCounts,
  };
}

async function hideComment(ctx, id, commentId, hidden) {
  await owned(ctx, id);
  const done = await db(CM).where({ id: commentId, announcementId: id }).update(hidden ? { hiddenAt: now(), hiddenBy: ctx.name || "Our team" } : { hiddenAt: null, hiddenBy: null });
  if (!done) throw refuse(404, "Comment not found");
  return detail(ctx, id);
}

// The team answers in one group's thread.
async function teamComment(ctx, id, group, body) {
  const a = await owned(ctx, id);
  if (!R.GROUP_KEYS.includes(group)) throw refuse(400, "Choose the group to answer");
  const text = String(body || "").trim().slice(0, 2000);
  if (!text) throw refuse(400, "Write the comment first");
  await db(CM).insert({ id: generateId(), announcementId: a.id, audienceGroup: group, userId: ctx.userId, authorName: ctx.name || "Digifunzi team", authorRole: "Digifunzi team", fromTeam: true, body: text, createdAt: now() });
  return detail(ctx, id);
}

// ── The reader's view (/api/announcements) ─────────────────────────────────────────────────────────
async function recipientOf(userId, id) {
  const r = await db(RC).where({ announcementId: id, userId }).first();
  if (!r || r.channel !== "feed") throw refuse(404, "Announcement not found");
  const a = await db(A).where({ id }).whereNull("deletedAt").first();
  if (!a || a.status === "scheduled") throw refuse(404, "Announcement not found");
  return { r, a };
}

function shapeForReader(a, r, extra = {}) {
  const state = R.stateOf(a);
  return {
    id: a.id, title: a.title, body: a.body, imageUrl: a.imageUrl, fileUrl: a.fileUrl, fileName: a.fileName, linkUrl: a.linkUrl, linkLabel: a.linkLabel,
    important: !!a.important, pinned: !!a.pinned && state === "live", publishedAt: a.publishedAt, endsAt: a.endsAt, state,
    authorName: a.authorName || "Digifunzi team", summary: R.summaryText(a.body, 180),
    seen: !!r.seenAt, acked: !!r.ackAt, group: r.audienceGroup,
    can: { react: R.canEngage(a, r, "react"), comment: R.canEngage(a, r, "comment"), ack: R.canEngage(a, r, "ack") },
    allowReactions: !!a.allowReactions, allowComments: !!a.allowComments, askAck: !!a.askAck,
    ...extra,
  };
}

// Everything that reached this person (newest first, pinned on top); ended ones for 30 days.
async function mine(userId) {
  await publishDue();
  const rs = await db(RC).where({ userId, channel: "feed" }).orderBy("createdAt", "desc").limit(200);
  if (!rs.length) return { announcements: [], unread: 0 };
  const as = await db(A).whereIn("id", rs.map((r) => r.announcementId)).whereNull("deletedAt").whereNot({ status: "scheduled" });
  const byId = new Map(as.map((a) => [a.id, a]));
  const cutoff = Date.now() - 30 * 864e5;
  const out = rs
    .filter((r) => byId.has(r.announcementId))
    .map((r) => shapeForReader(byId.get(r.announcementId), r))
    .filter((a) => a.state === "live" || new Date(a.endsAt || a.publishedAt || 0).getTime() > cutoff)
    .map(({ body, ...rest }) => rest);
  return { announcements: R.sortForReaders(out), unread: out.filter((a) => !a.seen && a.state === "live").length };
}

// The sign-in pop-up: the newest live "Important" one they haven't opened yet.
async function popup(userId) {
  await publishDue();
  const rs = await db(RC).where({ userId, channel: "feed" }).whereNull("seenAt").orderBy("createdAt", "desc").limit(30);
  if (!rs.length) return null;
  const as = await db(A).whereIn("id", rs.map((r) => r.announcementId)).whereNull("deletedAt").where({ important: true, status: "published" });
  const live = as.filter((a) => R.stateOf(a) === "live").sort((x, y) => new Date(y.publishedAt) - new Date(x.publishedAt));
  if (!live.length) return null;
  const r = rs.find((x) => x.announcementId === live[0].id);
  return shapeForReader(live[0], r);
}

async function readerCommentName(user, group) {
  if (group === "learners") {
    const learner = user.username ? await db("learners").where({ username: user.username }).first("id", "firstName") : null;
    const member = learner ? await db("connect_members").where({ learnerId: learner.id }).first("displayName", "status", "suspendedUntil") : null;
    return { name: member?.displayName || learner?.firstName || "A learner", member, role: "Learner" };
  }
  const roles = { parents: "Parent", educators: "Educator", hubs: "Learning hub", supervisors: "Supervisor", staff: "Staff", affiliates: "Affiliate" };
  return { name: user.name || user.username || "Someone", role: roles[group] || null };
}

// One announcement, opened: marks it seen; their group's thread of comments and the reactions.
async function view(userId, id) {
  const { r, a } = await recipientOf(userId, id);
  if (!r.seenAt) await db(RC).where({ id: r.id }).update({ seenAt: now() });
  const [comments, reactions] = await Promise.all([
    a.allowComments ? db(CM).where({ announcementId: id, audienceGroup: r.audienceGroup }).whereNull("hiddenAt").orderBy("createdAt", "asc").limit(500) : [],
    db(RX).where({ announcementId: id }).select("userId", "kind"),
  ]);
  const counts = Object.fromEntries(R.REACTIONS.map((k) => [k, reactions.filter((x) => x.kind === k).length]));
  return shapeForReader(a, { ...r, seenAt: r.seenAt || now() }, {
    reactions: a.allowReactions ? counts : null,
    myReaction: reactions.find((x) => x.userId === userId)?.kind || null,
    comments: comments.map((c) => ({ id: c.id, body: c.body, authorName: c.authorName, authorRole: c.authorRole, fromTeam: !!c.fromTeam, mine: c.userId === userId, createdAt: c.createdAt })),
  });
}

async function markSeen(userId, id) {
  const { r } = await recipientOf(userId, id);
  if (!r.seenAt) await db(RC).where({ id: r.id }).update({ seenAt: now() });
  return { seen: true };
}

async function ack(userId, id) {
  const { r, a } = await recipientOf(userId, id);
  if (!R.canEngage(a, r, "ack")) throw refuse(409, "This announcement doesn't ask for that now.");
  await db(RC).where({ id: r.id }).update({ ackAt: r.ackAt || now(), seenAt: r.seenAt || now() });
  return view(userId, id);
}

async function react(userId, id, kind) {
  const { r, a } = await recipientOf(userId, id);
  if (!R.canEngage(a, r, "react")) throw refuse(409, "Reactions aren't open on this announcement.");
  await db(RX).where({ announcementId: id, userId }).del();
  if (kind) {
    if (!R.REACTIONS.includes(kind)) throw refuse(400, "Choose a reaction");
    await db(RX).insert({ id: generateId(), announcementId: id, userId, kind, createdAt: now() });
  }
  return view(userId, id);
}

async function comment(user, id, body) {
  const { r, a } = await recipientOf(user.id, id);
  if (!R.canEngage(a, r, "comment")) throw refuse(409, "Comments aren't open on this announcement.");
  const text = String(body || "").trim().slice(0, 1000);
  if (!text) throw refuse(400, "Write your comment first");
  const who = await readerCommentName(user, r.audienceGroup);
  if (r.audienceGroup === "learners") {
    // Children's comments get Connect's own safety checks, and a paused member can't post.
    if (who.member?.status === "suspended" && (!who.member.suspendedUntil || new Date(who.member.suspendedUntil) > now())) throw refuse(403, "You can read but not comment on Connect for now.");
    const settings = await S.settingsFor(a.ownerAdminId);
    const problem = checkText(text, { blockedWords: settings.blockedWords || [], linkDomains: settings.linkDomains || [] });
    if (problem) throw refuse(400, problem.message);
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const recent = Number((await db(CM).where({ announcementId: id, userId: user.id }).where("createdAt", ">", since).count({ n: "*" }).first()).n) || 0;
    if (recent >= 5) throw refuse(429, "That's a lot of comments. Wait a few minutes and try again.");
  }
  await db(CM).insert({ id: generateId(), announcementId: id, audienceGroup: r.audienceGroup, userId: user.id, authorName: who.name, authorRole: who.role, fromTeam: false, body: text, createdAt: now() });
  return view(user.id, id);
}

async function deleteMyComment(userId, id, commentId) {
  await recipientOf(userId, id);
  const done = await db(CM).where({ id: commentId, announcementId: id, userId }).del();
  if (!done) throw refuse(404, "Comment not found");
  return view(userId, id);
}

module.exports = {
  audienceMembers, channelsFor, countAudience, audienceOptions, create, publish, publishDue, update, end, remove, list, detail, hideComment, teamComment,
  mine, popup, view, markSeen, ack, react, comment, deleteMyComment,
};
