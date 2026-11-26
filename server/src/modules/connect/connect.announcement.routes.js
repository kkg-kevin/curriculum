const express = require("express");
const asyncHandler = require("express-async-handler");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const Announcements = require("./connect.announcements");
const R = require("./connect.announcement.rules");

// Connect → Announcements (26 Nov 2026).
//   adminRouter  — mounted inside /api/connect (connect.routes.js) at /admin/announcements: the team
//                  writes, sends and follows them (requireManager in the service).
//   readerRouter — /api/announcements, for anyone signed in (app.js, protect only): what reached
//                  them, opening one, reacting, commenting in their group's thread, "I've read this".
//                  Every call checks the person's own recipient row.

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const optionalUrl = z.union([z.string().trim().max(500), z.literal(""), z.null()]).optional().transform((v) => v || null);
const when = z.union([z.string().trim().max(40), z.literal(""), z.null()]).optional().transform((v) => (v ? v : null))
  .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Use a date and time");
const announcementSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(200),
  body: z.union([z.string().max(60000), z.null()]).optional(),
  imageUrl: optionalUrl,
  fileUrl: optionalUrl,
  fileName: z.union([z.string().trim().max(255), z.null()]).optional(),
  linkUrl: optionalUrl,
  linkLabel: z.union([z.string().trim().max(80), z.null()]).optional(),
  audience: z.object({
    groups: z.array(z.enum(R.GROUP_KEYS)).min(1, "Choose who it's for"),
    hubIds: z.array(z.string().max(36)).max(300).optional().default([]),
    classIds: z.array(z.string().max(36)).max(500).optional().default([]),
  }),
  allowReactions: z.boolean().optional().default(true),
  allowComments: z.boolean().optional().default(false),
  askAck: z.boolean().optional().default(false),
  important: z.boolean().optional().default(false),
  pinned: z.boolean().optional().default(false),
  sendEmail: z.boolean().optional().default(false),
  publishAt: when,
  endsAt: when,
});
const audienceSchema = z.object({
  groups: z.array(z.enum(R.GROUP_KEYS)).optional().default([]),
  hubIds: z.array(z.string().max(36)).max(300).optional().default([]),
  classIds: z.array(z.string().max(36)).max(500).optional().default([]),
});

// ── The team (inside /api/connect, req.connect set by connect.context.js) ────────────────────────
const adminRouter = express.Router();
const h = (fn) => asyncHandler(async (req, res) => ok(res, await fn(req.connect, req)));
adminRouter.get("/options", h((c) => Announcements.audienceOptions(c)));
adminRouter.post("/count", h((c, req) => Announcements.countAudience(c, audienceSchema.parse(req.body || {}))));
adminRouter.get("/", h((c) => Announcements.list(c)));
adminRouter.post("/", h((c, req) => Announcements.create(c, announcementSchema.parse(req.body || {}))));
adminRouter.get("/:id", h((c, req) => Announcements.detail(c, req.params.id)));
adminRouter.put("/:id", h((c, req) => Announcements.update(c, req.params.id, announcementSchema.parse(req.body || {}))));
adminRouter.post("/:id/end", h((c, req) => Announcements.end(c, req.params.id)));
adminRouter.delete("/:id", h((c, req) => Announcements.remove(c, req.params.id)));
adminRouter.post("/:id/comments", h((c, req) => {
  const { group, body } = z.object({ group: z.enum(R.GROUP_KEYS), body: z.string().trim().min(1, "Write the comment first").max(2000) }).parse(req.body || {});
  return Announcements.teamComment(c, req.params.id, group, body);
}));
adminRouter.post("/:id/comments/:commentId/hide", h((c, req) => Announcements.hideComment(c, req.params.id, req.params.commentId, z.object({ hidden: z.boolean() }).parse(req.body || {}).hidden)));

// ── Everyone it reaches ──────────────────────────────────────────────────────────────────────────
const readerRouter = express.Router();
const writes = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  keyGenerator: (req) => `announcements:${req.user.id}`,
  skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "That's a lot of activity. Wait a few minutes and try again." },
});
readerRouter.use(writes);
const u = (fn) => asyncHandler(async (req, res) => ok(res, await fn(req.user, req)));
readerRouter.get("/", u((user) => Announcements.mine(user.id)));
readerRouter.get("/popup", u((user) => Announcements.popup(user.id)));
readerRouter.get("/:id", u((user, req) => Announcements.view(user.id, req.params.id)));
readerRouter.post("/:id/seen", u((user, req) => Announcements.markSeen(user.id, req.params.id)));
readerRouter.post("/:id/ack", u((user, req) => Announcements.ack(user.id, req.params.id)));
readerRouter.post("/:id/react", u((user, req) => Announcements.react(user.id, req.params.id, z.object({ kind: z.union([z.enum(R.REACTIONS), z.null()]) }).parse(req.body || {}).kind)));
readerRouter.post("/:id/comments", u((user, req) => Announcements.comment(user, req.params.id, z.object({ body: z.string().trim().min(1, "Write your comment first").max(1000) }).parse(req.body || {}).body)));
readerRouter.delete("/:id/comments/:commentId", u((user, req) => Announcements.deleteMyComment(user.id, req.params.id, req.params.commentId)));

module.exports = { adminRouter, readerRouter };
