const express = require("express");
const asyncHandler = require("express-async-handler");
const rateLimit = require("express-rate-limit");
const db = require("../../config/db");
const V = require("./connect.validation");
const Files = require("./connect.files");
const Members = require("./connect.members");
const Feed = require("./connect.feed");
const Messages = require("./connect.messages");
const Projects = require("./connect.projects");
const Challenges = require("./connect.challenges");
const Moderation = require("./connect.moderation");

// /api/connect — Digifunzi Connect. Mounted in app.js behind protect + attachOwnRecords +
// connectContext (connect.context.js), which says who is asking (learner / parent / staff /
// educator) and in which workspace. Every service checks what that person may do with each record.
// Named routes come before "/:id".

const router = express.Router();
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const h = (fn) => asyncHandler(async (req, res) => ok(res, await fn(req.connect, req, res)));
const oneOf = (value, allowed) => { if (!allowed.includes(value)) throw Object.assign(new Error("Not found"), { statusCode: 404 }); return value; };
const num = (v, d = 1) => Math.max(1, Number.parseInt(v, 10) || d);

// A ceiling on writes per person, on top of each kind's own limit in Settings.
const writes = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 300,
  keyGenerator: (req) => `connect:${req.user.id}`, // always signed in here
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "That's a lot of activity — wait a few minutes and try again." },
});
router.use(writes);

// Who reaches what: a parent only their children's switches (/parent/…) and /me; an educator only
// /me until named a moderator. Learners and staff go on to each service's own checks.
router.use((req, res, next) => {
  const ctx = req.connect;
  const open = req.path === "/me" || req.path === "/me/counts";
  if (ctx.kind === "parent" && !open && !req.path.startsWith("/parent/")) return next(Object.assign(new Error("Parents look after Connect from their child's page."), { statusCode: 403 }));
  if (ctx.kind !== "parent" && req.path.startsWith("/parent/")) return next(Object.assign(new Error("Only a parent can do this."), { statusCode: 403 }));
  if (ctx.kind === "educator" && !ctx.isModerator && !open) return next(Object.assign(new Error("Only Connect moderators can do this."), { statusCode: 403 }));
  return next();
});

// ── Me ───────────────────────────────────────────────────────────────────────────────────────────
router.get("/me", h((c) => Members.me(c)));
router.get("/me/counts", h((c) => Members.counts(c)));
router.put("/me/profile", h((c, req) => Members.updateProfile(c, V.profileSchema.parse(req.body))));
router.get("/me/achievements", h((c) => Members.achievements(c)));
router.get("/me/blocks", h((c) => Members.blocks(c)));
router.post("/files", Files.receiveFile, asyncHandler(async (req, res) => ok(res, await Members.upload(req.connect, req.file), 201)));

// ── People and connections ───────────────────────────────────────────────────────────────────────
router.get("/people", h((c, req) => Members.people(c, { q: String(req.query.q || ""), interest: String(req.query.interest || ""), page: num(req.query.page) })));
router.get("/people/:id", h((c, req) => Members.profile(c, req.params.id)));
router.get("/people/:id/posts", h((c, req) => Feed.list(c, { scope: "member", memberId: req.params.id, cursor: req.query.cursor })));
router.post("/people/:id/connect", h((c, req) => Members.requestConnection(c, req.params.id)));
router.delete("/people/:id/connect", h((c, req) => Members.removeConnection(c, req.params.id)));
router.post("/people/:id/block", h((c, req) => Members.setBlock(c, req.params.id, "block", true)));
router.delete("/people/:id/block", h((c, req) => Members.setBlock(c, req.params.id, "block", false)));
router.post("/people/:id/mute", h((c, req) => Members.setBlock(c, req.params.id, "mute", true)));
router.delete("/people/:id/mute", h((c, req) => Members.setBlock(c, req.params.id, "mute", false)));
router.get("/connections", h((c) => Members.connections(c)));
router.post("/connections/:id/accept", h((c, req) => Members.respondConnection(c, req.params.id, true)));
router.post("/connections/:id/decline", h((c, req) => Members.respondConnection(c, req.params.id, false)));

// ── Feed ─────────────────────────────────────────────────────────────────────────────────────────
router.get("/posts", h((c, req) => Feed.list(c, {
  scope: req.query.scope === "mine" ? "mine" : "feed", category: req.query.category, sort: req.query.sort === "top" ? "top" : "new", cursor: req.query.cursor, page: num(req.query.page),
})));
router.post("/posts", h((c, req) => Feed.create(c, V.postSchema.parse(req.body))));
router.get("/posts/:id", h((c, req) => Feed.get(c, req.params.id)));
router.put("/posts/:id", h((c, req) => Feed.update(c, req.params.id, V.postEditSchema.parse(req.body))));
router.delete("/posts/:id", h((c, req) => Feed.remove(c, req.params.id)));
router.post("/posts/:id/remove", h((c, req) => Feed.moderateRemove(c, req.params.id, V.removeSchema.parse(req.body || {}).reason)));
router.post("/posts/:id/pin", h((c, req) => Feed.setPinned(c, req.params.id, true)));
router.delete("/posts/:id/pin", h((c, req) => Feed.setPinned(c, req.params.id, false)));
router.post("/posts/:id/share", h((c, req) => Feed.share(c, req.params.id, V.shareSchema.parse(req.body || {}))));
router.put("/posts/:id/reaction", h((c, req) => Feed.react(c, req.params.id, V.reactionSchema.parse(req.body).kind)));
router.delete("/posts/:id/reaction", h((c, req) => Feed.unreact(c, req.params.id)));
router.post("/posts/:id/comments", h((c, req) => Feed.addComment(c, req.params.id, V.commentSchema.parse(req.body))));
router.put("/comments/:id", h((c, req) => Feed.editComment(c, req.params.id, V.commentEditSchema.parse(req.body))));
router.delete("/comments/:id", h((c, req) => Feed.deleteComment(c, req.params.id, String(req.query.reason || "") || null)));

// ── Communities ──────────────────────────────────────────────────────────────────────────────────
router.get("/communities", h((c, req) => Feed.communities(c, { q: String(req.query.q || ""), mine: req.query.mine === "1", includeArchived: req.query.archived === "1" })));
router.post("/communities", h((c, req) => Feed.createCommunity(c, V.communitySchema.parse(req.body))));
router.get("/communities/by-slug/:slug", h((c, req) => Feed.communityBySlug(c, req.params.slug)));
router.get("/communities/:id/posts", h((c, req) => Feed.list(c, { scope: "community", communityId: req.params.id, category: req.query.category, sort: req.query.sort === "top" ? "top" : "new", cursor: req.query.cursor, page: num(req.query.page) })));
router.put("/communities/:id", h((c, req) => Feed.updateCommunity(c, req.params.id, V.communitySchema.partial().parse(req.body))));
router.post("/communities/:id/archive", h((c, req) => Feed.setCommunityStatus(c, req.params.id, "archived")));
router.post("/communities/:id/restore", h((c, req) => Feed.setCommunityStatus(c, req.params.id, "active")));
router.put("/communities/:id/moderators", h((c, req) => Feed.setModerators(c, req.params.id, V.moderatorsSchema.parse(req.body).userIds)));
router.post("/communities/:id/join", h((c, req) => Feed.join(c, req.params.id)));
router.delete("/communities/:id/join", h((c, req) => Feed.leave(c, req.params.id)));
router.get("/communities/:id/members", h((c, req) => Feed.communityMembers(c, req.params.id)));
router.post("/communities/:id/invite", h((c, req) => Feed.inviteToCommunity(c, req.params.id, V.inviteMembersSchema.parse(req.body).memberIds)));
router.post("/communities/:id/members/:memberId/:action", h((c, req) => Feed.setMembership(c, req.params.id, req.params.memberId, oneOf(req.params.action, ["approve", "decline", "remove"]))));

// ── Messages ─────────────────────────────────────────────────────────────────────────────────────
router.get("/conversations", h((c) => Messages.list(c)));
router.post("/conversations", h((c, req) => Messages.start(c, V.conversationSchema.parse(req.body))));
router.get("/conversations/:id/messages", h((c, req) => Messages.messages(c, req.params.id, { before: req.query.before, after: req.query.after })));
router.post("/conversations/:id/messages", h((c, req) => Messages.send(c, req.params.id, V.messageSchema.parse(req.body))));
router.post("/conversations/:id/read", h((c, req) => Messages.markRead(c, req.params.id)));
router.put("/conversations/:id/mute", h((c, req) => Messages.mute(c, req.params.id, V.muteSchema.parse(req.body).muted)));
router.post("/conversations/:id/leave", h((c, req) => Messages.leaveConversation(c, req.params.id)));
router.delete("/messages/:id", h((c, req) => Messages.removeMessage(c, req.params.id)));

// ── Projects ─────────────────────────────────────────────────────────────────────────────────────
router.get("/projects", h((c, req) => Projects.list(c, { view: String(req.query.view || "all"), q: String(req.query.q || ""), category: String(req.query.category || ""), page: num(req.query.page) })));
router.post("/projects", h((c, req) => Projects.create(c, V.projectSchema.parse(req.body))));
router.get("/projects/:id", h((c, req) => Projects.get(c, req.params.id)));
router.put("/projects/:id", h((c, req) => Projects.update(c, req.params.id, V.projectEditSchema.parse(req.body))));
router.delete("/projects/:id", h((c, req) => Projects.remove(c, req.params.id)));
router.post("/projects/:id/invite", h((c, req) => Projects.invite(c, req.params.id, V.projectInviteSchema.parse(req.body).memberIds)));
router.post("/projects/:id/invitation/accept", h((c, req) => Projects.respondInvite(c, req.params.id, true)));
router.post("/projects/:id/invitation/decline", h((c, req) => Projects.respondInvite(c, req.params.id, false)));
router.post("/projects/:id/request", h((c, req) => Projects.requestJoin(c, req.params.id)));
router.post("/projects/:id/members/:memberId/:action", h((c, req) => Projects.setMember(c, req.params.id, req.params.memberId, { action: oneOf(req.params.action, ["accept", "decline", "remove"]) })));
router.put("/projects/:id/members/:memberId", h((c, req) => Projects.setMember(c, req.params.id, req.params.memberId, { action: "edit", ...V.projectMemberSchema.parse(req.body) })));
router.post("/projects/:id/milestones", h((c, req) => Projects.addMilestone(c, req.params.id, V.milestoneSchema.parse(req.body))));
router.put("/projects/:id/milestones/:milestoneId", h((c, req) => Projects.editMilestone(c, req.params.id, req.params.milestoneId, V.milestoneEditSchema.parse(req.body))));
router.delete("/projects/:id/milestones/:milestoneId", h((c, req) => Projects.deleteMilestone(c, req.params.id, req.params.milestoneId)));
router.post("/projects/:id/updates", h((c, req) => Projects.addUpdate(c, req.params.id, V.updateSchema.parse(req.body))));
router.delete("/projects/:id/updates/:updateId", h((c, req) => Projects.deleteUpdate(c, req.params.id, req.params.updateId)));
router.post("/projects/:id/showcase", h((c, req) => Projects.showcase(c, req.params.id, { body: String(req.body?.body || "").slice(0, 1000) })));
router.post("/projects/:id/moderate/:action", h((c, req) => Projects.moderate(c, req.params.id, oneOf(req.params.action, ["remove", "restore", "unshowcase"]), V.removeSchema.parse(req.body || {}).reason)));

// ── Challenges ───────────────────────────────────────────────────────────────────────────────────
router.get("/challenges", h((c, req) => Challenges.list(c, { view: String(req.query.view || "current") })));
router.get("/challenges/competition-options", h((c) => Challenges.competitionOptions(c)));
router.post("/challenges", h((c, req) => Challenges.create(c, V.challengeSchema.parse(req.body))));
router.get("/challenges/:id", h((c, req) => Challenges.get(c, req.params.id)));
router.put("/challenges/:id", h((c, req) => Challenges.update(c, req.params.id, V.challengeEditSchema.parse(req.body))));
router.delete("/challenges/:id", h((c, req) => Challenges.remove(c, req.params.id)));
router.post("/challenges/:id/publish", h((c, req) => Challenges.publish(c, req.params.id)));
router.post("/challenges/:id/close", h((c, req) => Challenges.close(c, req.params.id)));
router.post("/challenges/:id/enter", h((c, req) => Challenges.enter(c, req.params.id, V.enterSchema.parse(req.body))));
router.put("/challenges/:id/entries/:entryId", h((c, req) => Challenges.saveEntry(c, req.params.id, req.params.entryId, V.entrySchema.parse(req.body))));
router.delete("/challenges/:id/entries/:entryId", h((c, req) => Challenges.withdraw(c, req.params.id, req.params.entryId)));
router.put("/challenges/:id/entries/:entryId/award", h((c, req) => Challenges.award(c, req.params.id, req.params.entryId, V.awardSchema.parse(req.body))));

// ── Reporting (anyone on Connect) ────────────────────────────────────────────────────────────────
router.post("/reports", h((c, req) => Moderation.report(c, V.reportSchema.parse(req.body))));

// ── Moderators and admins ────────────────────────────────────────────────────────────────────────
router.get("/admin/overview", h((c) => Moderation.overview(c)));
router.get("/admin/reports", h((c, req) => Moderation.reports(c, { status: String(req.query.status || "open"), page: num(req.query.page) })));
router.get("/admin/reports/:id/context", h((c, req) => Moderation.reportContext(c, req.params.id)));
router.post("/admin/reports/:id/decision", h((c, req) => Moderation.decide(c, req.params.id, V.decisionSchema.parse(req.body))));
router.get("/admin/waiting", h((c) => Moderation.waiting(c)));
router.post("/admin/posts/:id/approve", h((c, req) => Moderation.approve(c, req.params.id)));
router.post("/admin/posts/:id/reject", h((c, req) => Moderation.reject(c, req.params.id, V.rejectSchema.parse(req.body || {}).reason)));
router.get("/admin/members", h((c, req) => Moderation.members(c, { q: String(req.query.q || ""), status: String(req.query.status || "") })));
router.post("/admin/members/:id/suspend", h((c, req) => Moderation.suspend(c, req.params.id, V.suspendSchema.parse(req.body))));
router.post("/admin/members/:id/restore", h((c, req) => Moderation.restore(c, req.params.id)));
router.get("/admin/history", h((c, req) => Moderation.history(c, { page: num(req.query.page), memberId: req.query.memberId || undefined })));
// Announcements from the team to groups of people in the system (26 Nov 2026 — connect.announcements.js).
router.use("/admin/announcements", require("./connect.announcement.routes").adminRouter);
router.get("/admin/settings", h((c) => Moderation.getSettings(c)));
router.put("/admin/settings", h((c, req) => Moderation.saveSettings(c, V.settingsSchema.parse(req.body))));

// ── Parents ──────────────────────────────────────────────────────────────────────────────────────
router.get("/parent/children", h((c) => Members.parentChildren(c)));
router.put("/parent/children/:learnerId/switches", h((c, req) => Members.parentSwitches(c, req.params.learnerId, V.switchesSchema.parse(req.body))));
router.get("/parent/children/:learnerId/activity", h((c, req) => Members.parentActivity(c, req.params.learnerId)));
router.get("/parent/children/:learnerId/conversations/:conversationId", h((c, req) => Members.parentConversation(c, req.params.learnerId, req.params.conversationId)));
router.post("/parent/children/:learnerId/blocks", h((c, req) => Members.parentBlock(c, req.params.learnerId, V.parentBlockSchema.parse(req.body).memberId, true)));
router.delete("/parent/children/:learnerId/blocks/:memberId", h((c, req) => Members.parentBlock(c, req.params.learnerId, req.params.memberId, false)));

// ── Files by signed link (mounted on its own, before sign-in — the signature is the access) ──────
const mediaRouter = express.Router();
mediaRouter.get("/:fileId/:exp/:sig", asyncHandler(async (req, res) => {
  const { fileId, exp, sig } = req.params;
  if (!Files.verifySignature(fileId, exp, sig)) return res.status(403).end();
  const file = await db("connect_files").where({ id: fileId }).first();
  if (!file) return res.status(404).end();
  return Files.sendStored(res, file, exp);
}));

module.exports = { router, mediaRouter };
