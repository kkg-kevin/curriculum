const { generateId, toJson, whereInChunks } = require("../../shared/utils/model.utils");
const { learnerAge } = require("../../shared/utils/age");
const R = require("./connect.rules");
const S = require("./connect.store");
const Notices = require("./connect.notifications");
const MemberService = require("./connect.members");
const Messages = require("./connect.messages");
const { canModerate, requireStaffOrModerator, requireManager, isSuspended, workspaceOfLearner } = require("./connect.context");

const { db, refuse, now, parseJson } = S;

// Keeping Connect safe: reports, posts waiting for a check, suspensions, the moderation history,
// engagement figures and Settings. Moderators see what they need to look after a learner — their
// real name and age, never contact details. A message is read by a moderator only through a report
// about it (the messages around it, for context).

// ── Reporting ────────────────────────────────────────────────────────────────────────────────────
async function targetOf(ctx, targetType, targetId) {
  const q = (table) => db(table).where({ id: targetId }).first();
  if (targetType === "post") {
    const p = await q("connect_posts");
    if (!p || p.ownerAdminId !== ctx.ownerAdminId) return null;
    return { memberId: p.authorMemberId, communityId: p.communityId, snapshot: { body: p.body, fileIds: parseJson(p.fileIds, []), link: p.link, category: p.category } };
  }
  if (targetType === "comment") {
    const c = await q("connect_comments");
    const p = c && (await db("connect_posts").where({ id: c.postId }).first());
    if (!p || p.ownerAdminId !== ctx.ownerAdminId) return null;
    return { memberId: c.authorMemberId, communityId: p.communityId, snapshot: { body: c.body, postId: p.id } };
  }
  if (targetType === "message") {
    const m = await q("connect_messages");
    if (!m) return null;
    const conv = await db("connect_conversations").where({ id: m.conversationId }).first();
    // Only someone in the conversation can report a message in it.
    const inIt = ctx.member && (await db("connect_conversation_participants").where({ conversationId: m.conversationId, memberId: ctx.member.id }).first("id"));
    if (!conv || conv.ownerAdminId !== ctx.ownerAdminId || !inIt) return null;
    return { memberId: m.senderMemberId, conversationId: m.conversationId, snapshot: { body: m.body, fileIds: parseJson(m.fileIds, []) } };
  }
  if (targetType === "member") {
    const m = await S.memberById(targetId);
    if (!m || m.ownerAdminId !== ctx.ownerAdminId) return null;
    return { memberId: m.id, snapshot: { displayName: m.displayName, bio: m.bio } };
  }
  if (targetType === "project") {
    const p = await q("connect_projects");
    if (!p || p.ownerAdminId !== ctx.ownerAdminId) return null;
    return { memberId: p.createdByMemberId, snapshot: { title: p.title, description: p.description } };
  }
  if (targetType === "update") {
    const u = await q("connect_project_updates");
    const p = u && (await db("connect_projects").where({ id: u.projectId }).first());
    if (!p || p.ownerAdminId !== ctx.ownerAdminId) return null;
    return { memberId: u.authorMemberId, snapshot: { body: u.body, projectId: p.id, fileIds: parseJson(u.fileIds, []) } };
  }
  return null;
}

const WHAT = { post: "post", comment: "comment", message: "message", member: "profile", project: "project", update: "project update" };

async function report(ctx, { targetType, targetId, reason, note }) {
  if (ctx.kind === "parent") throw refuse(403, "Parents report from their child's Connect page.");
  const target = await targetOf(ctx, targetType, targetId);
  if (!target) throw refuse(404, "We couldn't find what you're reporting.");
  if (ctx.member && target.memberId === ctx.member.id) throw refuse(400, "That's your own — you can delete it instead.");
  const existing = await db("connect_reports").where({ reporterUserId: ctx.userId, targetType, targetId, status: "open" }).first("id");
  if (existing) return { reported: true };
  const day = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await S.countSince("connect_reports", "reporterUserId", ctx.userId, day)) >= 30) throw refuse(429, "You've reported a lot today. A teacher will look at them soon.");
  await db("connect_reports").insert({
    id: generateId(), ownerAdminId: ctx.ownerAdminId, reporterUserId: ctx.userId, reporterMemberId: ctx.member?.id || null,
    targetType, targetId, targetMemberId: target.memberId || null, conversationId: target.conversationId || null,
    reason, note: note || null, snapshot: toJson(target.snapshot), status: "open", createdAt: now(),
  });
  Notices.reported(ctx.ownerAdminId, ctx.settings, target.communityId || null, WHAT[targetType]).catch(() => {});
  return { reported: true };
}

// ── The moderator's lists ────────────────────────────────────────────────────────────────────────
async function learnerNames(memberIds) {
  const members = await whereInChunks(db, "connect_members", "id", memberIds);
  const learners = await whereInChunks(db, "learners", "id", members.map((m) => m.learnerId));
  const byId = new Map(learners.map((l) => [l.id, l]));
  return new Map(members.map((m) => {
    const l = byId.get(m.learnerId);
    return [m.id, { learnerId: m.learnerId, name: [l?.firstName, l?.lastName].filter(Boolean).join(" "), age: learnerAge(l), status: isSuspended(m) ? "suspended" : m.status, suspendedUntil: m.suspendedUntil }];
  }));
}

async function reports(ctx, { status = "open", page = 1 } = {}) {
  requireStaffOrModerator(ctx);
  let q = db("connect_reports").where({ ownerAdminId: ctx.ownerAdminId });
  if (status !== "all") q = q.where({ status });
  const size = 25;
  const rows = await q.orderBy("createdAt", status === "open" ? "asc" : "desc").limit(size + 1).offset((page - 1) * size);
  const pageRows = rows.slice(0, size);
  const memberIds = pageRows.flatMap((r) => [r.reporterMemberId, r.targetMemberId]).filter(Boolean);
  const [cards, names] = await Promise.all([S.memberCards(memberIds), learnerNames(memberIds)]);
  const files = await S.filesFor(pageRows.flatMap((r) => parseJson(r.snapshot, {})?.fileIds || []));
  const reasons = new Map(R.REPORT_REASONS.map((r) => [r.key, r.label]));
  const priorCounts = new Map();
  for (const id of new Set(pageRows.map((r) => r.targetMemberId).filter(Boolean))) {
    const n = await db("connect_reports").where({ targetMemberId: id, status: "actioned" }).count({ n: "*" }).first();
    priorCounts.set(id, Number(n?.n || 0));
  }
  const items = [];
  for (const r of pageRows) {
    const snap = parseJson(r.snapshot, {}) || {};
    // Community moderators only see reports about their own communities.
    if (!ctx.canModerateAll) {
      if (!["post", "comment"].includes(r.targetType)) continue;
      const t = await targetOf(ctx, r.targetType, r.targetId).catch(() => null);
      if (!t?.communityId || !canModerate(ctx, t.communityId)) continue;
    }
    items.push({
      id: r.id, targetType: r.targetType, targetId: r.targetId, what: WHAT[r.targetType],
      reason: r.reason, reasonLabel: reasons.get(r.reason) || r.reason, note: r.note || "",
      snapshot: { ...snap, files: (snap.fileIds || []).map((id) => files.get(id)).filter(Boolean) },
      reporter: r.reporterMemberId ? { ...cards.get(r.reporterMemberId), learner: names.get(r.reporterMemberId) } : { displayName: "Staff" },
      about: r.targetMemberId ? { ...cards.get(r.targetMemberId), learner: names.get(r.targetMemberId), earlierActions: priorCounts.get(r.targetMemberId) || 0 } : null,
      currentStatus: await currentStatus(r),
      status: r.status, action: r.action, decisionNote: r.decisionNote, decidedByName: r.decidedByName, decidedAt: r.decidedAt, createdAt: r.createdAt,
    });
  }
  return { items, hasMore: rows.length > size, page };
}

async function currentStatus(r) {
  const table = { post: "connect_posts", comment: "connect_comments", message: "connect_messages", project_update: "connect_project_updates", update: "connect_project_updates" }[r.targetType];
  if (table) return (await db(table).where({ id: r.targetId }).first("status"))?.status || "deleted";
  if (r.targetType === "project") return (await db("connect_projects").where({ id: r.targetId }).first("moderation"))?.moderation || "deleted";
  return null;
}

// The conversation around a reported message — read only for this report.
async function reportContext(ctx, reportId) {
  requireStaffOrModerator(ctx);
  if (!ctx.canModerateAll) throw refuse(403, "Only workspace moderators read reported messages.");
  const r = await db("connect_reports").where({ id: reportId, ownerAdminId: ctx.ownerAdminId }).first();
  if (!r) throw refuse(404, "That report isn't there.");
  if (r.targetType === "message") {
    await S.log(ctx.ownerAdminId, ctx, "report_messages_read", { targetType: "message", targetId: r.targetId, memberId: r.targetMemberId, reportId: r.id });
    return { messages: await Messages.contextAround(r.targetId) };
  }
  if (r.targetType === "comment") {
    const c = await db("connect_comments").where({ id: r.targetId }).first();
    const Feed = require("./connect.feed");
    return { post: c ? await Feed.get(ctx, c.postId).catch(() => null) : null };
  }
  return {};
}

// Deciding a report: dismiss, take the content down, or take it down and give the author a break.
async function decide(ctx, reportId, { action, days, note }) {
  requireStaffOrModerator(ctx);
  const r = await db("connect_reports").where({ id: reportId, ownerAdminId: ctx.ownerAdminId }).first();
  if (!r) throw refuse(404, "That report isn't there.");
  if (r.status !== "open") throw refuse(400, "Someone already dealt with this report.");
  if (!ctx.canModerateAll && (action === "suspend" || r.targetType === "message" || r.targetType === "member")) throw refuse(403, "Only workspace moderators can do this.");
  if (action !== "dismiss") await takeDown(ctx, r, note);
  if (action === "suspend") {
    if (!r.targetMemberId) throw refuse(400, "There's no learner to suspend for this report.");
    await suspend(ctx, r.targetMemberId, { days: days || 7, reason: note || "Not following Connect's rules" }, r.id);
  }
  // The same thing reported by others is settled with it.
  await db("connect_reports").where({ ownerAdminId: ctx.ownerAdminId, targetType: r.targetType, targetId: r.targetId, status: "open" }).update({
    status: action === "dismiss" ? "dismissed" : "actioned", action, decisionNote: note || null, decidedByUserId: ctx.userId, decidedByName: ctx.name, decidedAt: now(),
  });
  await S.log(ctx.ownerAdminId, ctx, `report_${action === "dismiss" ? "dismissed" : action === "suspend" ? "removed_and_suspended" : "removed"}`, { targetType: r.targetType, targetId: r.targetId, memberId: r.targetMemberId, reportId: r.id, note });
  if (r.reporterMemberId) Notices.reportSeen(r.reporterMemberId).catch(() => {});
  return { decided: true };
}

async function takeDown(ctx, r, reason) {
  const what = WHAT[r.targetType];
  if (r.targetType === "post") await db("connect_posts").where({ id: r.targetId }).whereNot({ status: "deleted" }).update({ status: "removed", removedReason: reason || null, pinned: false });
  if (r.targetType === "comment") {
    const c = await db("connect_comments").where({ id: r.targetId }).first();
    await db("connect_comments").where({ id: r.targetId }).update({ status: "removed" });
    if (c) await MemberService.recountPost(c.postId);
  }
  if (r.targetType === "message") await db("connect_messages").where({ id: r.targetId }).update({ status: "removed", removedBy: "moderator" });
  if (r.targetType === "update") await db("connect_project_updates").where({ id: r.targetId }).update({ status: "removed" });
  if (r.targetType === "project") {
    await db("connect_projects").where({ id: r.targetId }).update({ moderation: "removed", showcased: false });
    const p = await db("connect_projects").where({ id: r.targetId }).first();
    if (p) await Messages.syncProjectChat(p);
  }
  if (r.targetType === "member") {
    // A profile: the words go back to the defaults.
    const m = await S.memberById(r.targetId);
    const learner = m && (await db("learners").where({ id: m.learnerId }).first("firstName", "lastName"));
    if (m) await db("connect_members").where({ id: m.id }).update({ bio: null, displayName: R.shortName(learner?.firstName, learner?.lastName), avatar: toJson(R.defaultAvatar(m.learnerId)) });
  }
  if (r.targetMemberId) Notices.contentRemoved(r.targetMemberId, what, reason).catch(() => {});
}

// ── Posts waiting for a check ────────────────────────────────────────────────────────────────────
async function waiting(ctx) {
  requireStaffOrModerator(ctx);
  let q = db("connect_posts").where({ ownerAdminId: ctx.ownerAdminId, status: "pending" });
  if (!ctx.canModerateAll) q = q.whereIn("communityId", [...ctx.moderatedCommunityIds]);
  const rows = await q.orderBy("createdAt", "asc").limit(100);
  const Feed = require("./connect.feed");
  const views = await Feed.serialisePosts(ctx, rows);
  const names = await learnerNames(rows.map((r) => r.authorMemberId).filter(Boolean));
  return views.map((v, i) => ({ ...v, learner: names.get(rows[i].authorMemberId) || null }));
}

async function approve(ctx, postId) {
  const post = await db("connect_posts").where({ id: postId, ownerAdminId: ctx.ownerAdminId }).first();
  if (!post || post.status !== "pending") throw refuse(404, "That post isn't waiting any more.");
  if (!canModerate(ctx, post.communityId)) throw refuse(403, "Only moderators can do this.");
  await db("connect_posts").where({ id: post.id }).update({ status: "visible", reviewReason: null, createdAt: now(), updatedAt: now() });
  if (post.communityId) await require("./connect.feed").recountCommunity(post.communityId);
  await S.log(ctx.ownerAdminId, ctx, "post_approved", { targetType: "post", targetId: post.id, memberId: post.authorMemberId });
  if (post.authorMemberId) {
    Notices.postApproved(post.authorMemberId, post).catch(() => {});
    MemberService.awardBadges(post.authorMemberId).catch(() => {});
  }
  return { approved: true };
}

async function reject(ctx, postId, reason) {
  const post = await db("connect_posts").where({ id: postId, ownerAdminId: ctx.ownerAdminId }).first();
  if (!post || post.status !== "pending") throw refuse(404, "That post isn't waiting any more.");
  if (!canModerate(ctx, post.communityId)) throw refuse(403, "Only moderators can do this.");
  await db("connect_posts").where({ id: post.id }).update({ status: "removed", removedReason: reason || null, updatedAt: now() });
  await S.log(ctx.ownerAdminId, ctx, "post_rejected", { targetType: "post", targetId: post.id, memberId: post.authorMemberId, note: reason });
  if (post.authorMemberId) Notices.contentRemoved(post.authorMemberId, "post", reason).catch(() => {});
  return { rejected: true };
}

// ── Members ──────────────────────────────────────────────────────────────────────────────────────
async function members(ctx, { q = "", status = "" } = {}) {
  requireStaffOrModerator(ctx);
  let query = db("connect_members").where({ ownerAdminId: ctx.ownerAdminId });
  if (status === "suspended") query = query.where({ status: "suspended" }).andWhere((w) => w.whereNull("suspendedUntil").orWhere("suspendedUntil", ">", now()));
  else if (status === "off") query = query.where({ status: "off" });
  else if (status === "active") query = query.whereNot({ status: "off" });
  const rows = await query.orderBy("createdAt", "desc").limit(1000);
  const names = await learnerNames(rows.map((r) => r.id));
  const needle = q.trim().toLowerCase();
  const filtered = rows.filter((m) => !needle || m.displayName.toLowerCase().includes(needle) || (names.get(m.id)?.name || "").toLowerCase().includes(needle)).slice(0, 200);
  const cards = await S.memberCards(filtered.map((m) => m.id));
  const reportCounts = filtered.length ? await db("connect_reports").whereIn("targetMemberId", filtered.map((m) => m.id)).groupBy("targetMemberId").select("targetMemberId").count({ n: "*" }) : [];
  const reportsBy = new Map(reportCounts.map((r) => [r.targetMemberId, Number(r.n)]));
  return filtered.map((m) => ({
    id: m.id, card: cards.get(m.id), displayName: m.displayName, learner: names.get(m.id),
    status: m.status === "off" ? "off" : isSuspended(m) ? "suspended" : "active",
    suspendedUntil: isSuspended(m) ? m.suspendedUntil : null, suspendedReason: isSuspended(m) ? m.suspendedReason : null,
    consentMethod: m.consentMethod, consentAt: m.consentAt, consentNote: ctx.kind === "staff" ? m.consentNote : undefined, withdrawnAt: m.withdrawnAt,
    directMessages: !!m.directMessages, postsSent: m.postsSent, reports: reportsBy.get(m.id) || 0, lastSeenAt: m.lastSeenAt,
  }));
}

async function suspend(ctx, memberId, { days, reason }, reportId = null) {
  requireStaffOrModerator(ctx);
  if (!ctx.canModerateAll) throw refuse(403, "Only workspace moderators can suspend learners.");
  const m = await S.memberById(memberId);
  if (!m || m.ownerAdminId !== ctx.ownerAdminId || m.status === "off") throw refuse(404, "That learner isn't on Connect.");
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db("connect_members").where({ id: m.id }).update({ status: "suspended", suspendedUntil: until, suspendedReason: reason, updatedAt: now() });
  await S.log(ctx.ownerAdminId, ctx, "member_suspended", { targetType: "member", targetId: m.id, memberId: m.id, reportId, note: `${days} day(s): ${reason}` });
  Notices.suspended(m, until, reason).catch(() => {});
  return { suspendedUntil: until };
}

async function restore(ctx, memberId) {
  requireStaffOrModerator(ctx);
  if (!ctx.canModerateAll) throw refuse(403, "Only workspace moderators can do this.");
  const m = await S.memberById(memberId);
  if (!m || m.ownerAdminId !== ctx.ownerAdminId || m.status === "off") throw refuse(404, "That learner isn't on Connect.");
  await db("connect_members").where({ id: m.id }).update({ status: "active", suspendedUntil: null, suspendedReason: null, updatedAt: now() });
  await S.log(ctx.ownerAdminId, ctx, "member_restored", { targetType: "member", targetId: m.id, memberId: m.id });
  return { restored: true };
}

// Learners of the workspace who could be switched on with consent recorded by an admin: they have
// their own login and aren't on Connect yet.
async function consentCandidates(ctx, q = "") {
  requireManager(ctx);
  const needle = String(q || "").trim().toLowerCase();
  if (needle.length < 2) return [];
  const rows = await db("learners").whereNotNull("username").whereNull("teacherId")
    .andWhere((w) => w.whereRaw("LOWER(firstName) LIKE ?", [`%${needle}%`]).orWhereRaw("LOWER(lastName) LIKE ?", [`%${needle}%`]).orWhereRaw("LOWER(CONCAT(firstName, ' ', lastName)) LIKE ?", [`%${needle}%`]).orWhereRaw("LOWER(username) LIKE ?", [`%${needle}%`]))
    .limit(40);
  const members = await whereInChunks(db, "connect_members", "learnerId", rows.map((r) => r.id));
  const on = new Map(members.map((m) => [m.learnerId, m.status]));
  const out = [];
  for (const l of rows) {
    if ((await workspaceOfLearner(l)) !== ctx.ownerAdminId) continue;
    out.push({ learnerId: l.id, name: [l.firstName, l.lastName].filter(Boolean).join(" "), age: learnerAge(l), status: on.get(l.id) || "not_member" });
  }
  return out.slice(0, 20);
}

// ── History ──────────────────────────────────────────────────────────────────────────────────────
async function history(ctx, { page = 1, memberId } = {}) {
  requireStaffOrModerator(ctx);
  let q = db("connect_moderation_log").where({ ownerAdminId: ctx.ownerAdminId });
  if (memberId) q = q.where({ memberId });
  const size = 50;
  const rows = await q.orderBy("createdAt", "desc").limit(size + 1).offset((page - 1) * size);
  const pageRows = rows.slice(0, size);
  const cards = await S.memberCards(pageRows.map((r) => r.memberId));
  return { items: pageRows.map((r) => ({ ...r, member: r.memberId ? cards.get(r.memberId) : null })), hasMore: rows.length > size, page };
}

// ── Engagement ───────────────────────────────────────────────────────────────────────────────────
async function overview(ctx) {
  requireStaffOrModerator(ctx);
  const ws = ctx.ownerAdminId;
  const n = (row) => Number(row?.n || 0);
  const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const month = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [members, active7, active30, posts30, comments30, messages30, projects, showcased, challengesOpen, entries, openReports, waitingPosts, suspended] = await Promise.all([
    db("connect_members").where({ ownerAdminId: ws }).whereNot({ status: "off" }).count({ n: "*" }).first(),
    db("connect_members").where({ ownerAdminId: ws }).whereNot({ status: "off" }).andWhere("lastSeenAt", ">=", week).count({ n: "*" }).first(),
    db("connect_members").where({ ownerAdminId: ws }).whereNot({ status: "off" }).andWhere("lastSeenAt", ">=", month).count({ n: "*" }).first(),
    db("connect_posts").where({ ownerAdminId: ws, status: "visible" }).andWhere("createdAt", ">=", month).count({ n: "*" }).first(),
    db("connect_comments as c").join("connect_posts as p", "p.id", "c.postId").where({ "p.ownerAdminId": ws, "c.status": "visible" }).andWhere("c.createdAt", ">=", month).count({ n: "*" }).first(),
    db("connect_messages as m").join("connect_conversations as c", "c.id", "m.conversationId").where({ "c.ownerAdminId": ws }).andWhere("m.createdAt", ">=", month).count({ n: "*" }).first(),
    db("connect_projects").where({ ownerAdminId: ws }).whereNot({ moderation: "deleted" }).groupBy("status").select("status").count({ n: "*" }),
    db("connect_projects").where({ ownerAdminId: ws, showcased: true, moderation: "visible" }).count({ n: "*" }).first(),
    db("connect_challenges").where({ ownerAdminId: ws, status: "open" }).count({ n: "*" }).first(),
    db("connect_challenge_entries as e").join("connect_challenges as c", "c.id", "e.challengeId").where({ "c.ownerAdminId": ws }).whereNot("e.status", "withdrawn").count({ n: "*" }).first(),
    db("connect_reports").where({ ownerAdminId: ws, status: "open" }).count({ n: "*" }).first(),
    db("connect_posts").where({ ownerAdminId: ws, status: "pending" }).count({ n: "*" }).first(),
    db("connect_members").where({ ownerAdminId: ws, status: "suspended" }).andWhere("suspendedUntil", ">", now()).count({ n: "*" }).first(),
  ]);
  // Posts and comments by week, the last 12 weeks.
  const since = new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000);
  const [postRows, commentRows] = await Promise.all([
    db("connect_posts").where({ ownerAdminId: ws, status: "visible" }).andWhere("createdAt", ">=", since).select("createdAt"),
    db("connect_comments as c").join("connect_posts as p", "p.id", "c.postId").where({ "p.ownerAdminId": ws }).andWhere("c.createdAt", ">=", since).select("c.createdAt"),
  ]);
  const weeks = [];
  for (let i = 11; i >= 0; i -= 1) {
    const start = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
    const inWeek = (r) => new Date(r.createdAt) >= start && new Date(r.createdAt) < end;
    weeks.push({ week: end.toISOString().slice(0, 10), posts: postRows.filter(inWeek).length, comments: commentRows.filter(inWeek).length });
  }
  const communities = await db("connect_communities").where({ ownerAdminId: ws, status: "active" }).orderBy("memberCount", "desc").limit(10).select("id", "name", "slug", "memberCount", "postCount");
  const decided = await db("connect_reports").where({ ownerAdminId: ws }).whereNot({ status: "open" }).andWhere("decidedAt", ">=", month).select("createdAt", "decidedAt");
  const hours = decided.map((r) => (new Date(r.decidedAt) - new Date(r.createdAt)) / 3600000).sort((a, b) => a - b);
  return {
    members: n(members), activeWeek: n(active7), activeMonth: n(active30),
    postsMonth: n(posts30), commentsMonth: n(comments30), messagesMonth: n(messages30),
    projects: Object.fromEntries(projects.map((p) => [p.status, Number(p.n)])), showcased: n(showcased),
    challengesOpen: n(challengesOpen), entries: n(entries),
    openReports: n(openReports), waitingPosts: n(waitingPosts), suspended: n(suspended),
    reportsDecidedMonth: decided.length, medianHoursToDecide: hours.length ? Math.round(hours[Math.floor(hours.length / 2)] * 10) / 10 : null,
    weeks, communities,
  };
}

// ── Settings ─────────────────────────────────────────────────────────────────────────────────────
async function getSettings(ctx) {
  requireStaffOrModerator(ctx);
  const Feed = require("./connect.feed");
  return { settings: ctx.settings, moderatorOptions: ctx.kind === "staff" ? await Feed.moderatorOptions(ctx) : [], canEdit: ctx.kind === "staff" && ctx.canManage };
}

async function saveSettings(ctx, input) {
  requireManager(ctx);
  if (input.moderatorUserIds) {
    const Feed = require("./connect.feed");
    const allowed = new Set((await Feed.moderatorOptions(ctx)).filter((o) => o.role === "Educator").map((o) => o.userId));
    input = { ...input, moderatorUserIds: input.moderatorUserIds.filter((id) => allowed.has(id)) };
  }
  const settings = await S.saveSettings(ctx.ownerAdminId, input);
  await S.log(ctx.ownerAdminId, ctx, "settings_changed", { note: Object.keys(input).join(", ") });
  return settings;
}

module.exports = { report, reports, reportContext, decide, waiting, approve, reject, members, suspend, restore, consentCandidates, history, overview, getSettings, saveSettings };
