const express = require("express");
const rateLimit = require("express-rate-limit");
const asyncHandler = require("express-async-handler");
const { z } = require("zod");
const { authorize } = require("../../shared/middleware/auth.middleware");
const { visitSourceFrom } = require("../leads/visit-source");
const { requirePublicContentAdminId } = require("../../shared/utils/public-content");
const UsageService = require("../usage/usage.service");
const Service = require("./general-event.service");
const R = require("./general-event.rules");

// General events (general-event.service.js). Three routers:
//   router        /api/general-events  — admins and staff with "general-events" (access.registry.js)
//   mineRouter    /api/my-events       — anyone signed in: the sign-in pop-up and registering
//   publicRouter  /api/public          — the website: events, its pop-up, registering, the
//                                        registration's own page (by its private token)
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time");
const optional = (schema) => schema.optional().nullable().or(z.literal("").transform(() => null));
const url = z.string().trim().max(500).regex(/^https?:\/\//i, "Use a full link starting with https://");

const eventSchema = z.object({
  title: z.string().trim().min(3, "Give the event a name").max(200),
  kind: z.enum(Object.keys(R.KINDS)).default("showcase"),
  tagline: optional(z.string().trim().max(300)),
  description: optional(z.string().max(60000)),
  coverImage: optional(z.string().trim().max(500)),
  images: z.array(z.string().trim().max(500)).max(12).optional().default([]),
  startDate: date,
  startTime: time,
  endDate: optional(date),
  endTime: optional(time),
  format: z.enum(Object.keys(R.FORMATS)).default("in_person"),
  hubId: optional(z.string().max(36)),
  venueName: optional(z.string().trim().max(200)),
  venueAddress: optional(z.string().trim().max(300)),
  mapUrl: optional(url),
  meetingLink: optional(url),
  bootcampId: optional(z.string().max(36)),
  capacity: z.coerce.number().int().min(1).max(100000).optional().nullable().or(z.literal("").transform(() => null)),
  waitlistOn: z.boolean().optional().default(true),
  maxPartySize: z.coerce.number().int().min(1).max(20).optional().default(5),
  registrationOpen: z.boolean().optional().default(true),
  registrationClosesOn: optional(date),
  askAboutYou: z.boolean().optional().default(true),
  isPublic: z.boolean().optional().default(true),
  websitePopup: z.boolean().optional().default(true),
  systemPopup: z.boolean().optional().default(true),
  systemAudience: z.array(z.enum(Object.keys(R.AUDIENCE_GROUPS))).optional().nullable(),
  popupFrom: optional(date),
  popupUntil: optional(date),
  priceAmount: z.coerce.number().min(0).optional().nullable(),
  ageMin: z.coerce.number().int().min(1).max(99).optional().nullable().or(z.literal("").transform(() => null)),
  ageMax: z.coerce.number().int().min(1).max(99).optional().nullable().or(z.literal("").transform(() => null)),
  highlights: z.array(z.string().trim().max(160)).max(8).optional().default([]),
  status: z.enum(["draft", "published"]).optional(),
}).superRefine((d, ctx) => {
  if (d.format !== "online" && !d.hubId && !d.venueName) ctx.addIssue({ code: "custom", path: ["venueName"], message: "Pick a hub or type where it is" });
});

const phone = z.string().trim().min(9, "Enter your phone number").max(40).regex(/^[+\d][\d\s()-]{7,}$/, "Enter a valid phone number");
const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(150),
  email: z.string().trim().email("Enter a valid email address").max(255),
  phone,
  partySize: z.coerce.number().int().min(1).max(20).optional().default(1),
  marketingConsent: z.boolean().optional().default(false),
});
const detailsSchema = z.object({
  personType: z.enum(Object.keys(R.PERSON_TYPES)).optional().nullable(),
  organisation: z.string().trim().max(200).optional().nullable(),
  childrenAges: z.array(z.coerce.number().int().min(1).max(18)).max(10).optional(),
  interests: z.array(z.enum(Object.keys(R.INTERESTS))).max(10).optional(),
  heardFrom: z.enum(Object.keys(R.HEARD_FROM)).optional().nullable(),
  marketingConsent: z.boolean().optional(),
});

// ---- Admin --------------------------------------------------------------------------------------
const router = express.Router();
router.use(authorize("admin"));
router.get("/", asyncHandler(async (req, res) => ok(res, await Service.list(req.ownerAdminId))));
router.get("/options", asyncHandler(async (req, res) => ok(res, await Service.options(req.ownerAdminId))));
router.post("/", asyncHandler(async (req, res) => ok(res, await Service.create(req, eventSchema.parse(req.body || {})), 201)));
router.get("/:id", asyncHandler(async (req, res) => ok(res, await Service.get(req.ownerAdminId, req.params.id))));
router.put("/:id", asyncHandler(async (req, res) => ok(res, await Service.update(req, req.params.id, eventSchema.parse(req.body || {})))));
router.delete("/:id", asyncHandler(async (req, res) => {
  if (await UsageService.guardDelete(req, res, "generalEvent", req.params.id, "This event")) return;
  ok(res, await Service.remove(req, req.params.id));
}));
router.post("/:id/cancel", asyncHandler(async (req, res) => {
  const body = z.object({ reason: z.string().trim().max(500).optional().nullable(), notify: z.boolean().optional().default(true) }).parse(req.body || {});
  ok(res, await Service.cancel(req, req.params.id, body));
}));
router.get("/:id/registrations", asyncHandler(async (req, res) => ok(res, await Service.registrations(req.ownerAdminId, req.params.id))));
router.post("/:id/registrations", asyncHandler(async (req, res) => {
  const body = contactSchema.extend({ walkIn: z.boolean().optional().default(false), details: detailsSchema.optional() }).parse(req.body || {});
  ok(res, await Service.addRegistration(req, req.params.id, body), 201);
}));
router.put("/:id/registrations/:regId", asyncHandler(async (req, res) => {
  const body = z.object({
    status: z.enum(["registered", "waitlisted", "cancelled"]).optional(),
    partySize: z.coerce.number().int().min(1).max(50).optional(),
    name: z.string().trim().min(2).max(150).optional(),
    phone: phone.optional(),
    details: detailsSchema.optional(),
  }).parse(req.body || {});
  ok(res, await Service.updateRegistration(req, req.params.id, req.params.regId, body));
}));
router.post("/:id/registrations/:regId/arrived", asyncHandler(async (req, res) => {
  const { arrived } = z.object({ arrived: z.boolean() }).parse(req.body || {});
  ok(res, await Service.markArrived(req, req.params.id, req.params.regId, arrived));
}));
router.post("/:id/message", asyncHandler(async (req, res) => {
  const body = z.object({
    to: z.enum(["everyone", "registered", "waitlisted", "came", "missed"]),
    subject: z.string().trim().min(3, "Add a subject").max(200),
    body: z.string().trim().min(5, "Write your message").max(5000),
  }).parse(req.body || {});
  ok(res, await Service.message(req, req.params.id, body));
}));
router.post("/:id/invite", asyncHandler(async (req, res) => {
  const body = z.object({ audience: z.enum(["bootcamp", "everyone"]) }).parse(req.body || {});
  ok(res, await Service.invite(req, req.params.id, body));
}));

// ---- Anyone signed in ---------------------------------------------------------------------------
const mineRouter = express.Router();
mineRouter.get("/", asyncHandler(async (req, res) => ok(res, await Service.myList(req))));
mineRouter.get("/popup", asyncHandler(async (req, res) => ok(res, await Service.myPopup(req, { eventId: req.query.event ? String(req.query.event) : null }))));
mineRouter.post("/:id/register", asyncHandler(async (req, res) => {
  const body = z.object({
    name: z.string().trim().min(2, "Enter your name").max(150).optional(),
    email: z.string().trim().email("Enter a valid email address").max(255).optional(),
    phone,
    partySize: z.coerce.number().int().min(1).max(20).optional().default(1),
    marketingConsent: z.boolean().optional().default(false),
    fromPopup: z.boolean().optional().default(false),
  }).parse(req.body || {});
  ok(res, await Service.myRegister(req, req.params.id, body), 201);
}));
mineRouter.post("/:id/hide", asyncHandler(async (req, res) => ok(res, await Service.myHide(req, req.params.id, req.body?.days))));
mineRouter.put("/registrations/:regId/details", asyncHandler(async (req, res) => ok(res, await Service.myDetails(req, req.params.regId, detailsSchema.parse(req.body || {})))));
mineRouter.post("/registrations/:regId/cancel", asyncHandler(async (req, res) => ok(res, await Service.myCancel(req, req.params.regId))));

// ---- The website --------------------------------------------------------------------------------
const publicRouter = express.Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many tries. Please try again later." },
});
publicRouter.get("/events", asyncHandler(async (req, res) => ok(res, await Service.publicList(requirePublicContentAdminId(), { past: req.query.past === "1" }))));
publicRouter.get("/events-popup", asyncHandler(async (req, res) => ok(res, await Service.publicPopup(requirePublicContentAdminId()))));
publicRouter.get("/events/:slug", asyncHandler(async (req, res) => ok(res, await Service.publicDetail(requirePublicContentAdminId(), req.params.slug))));
publicRouter.get("/events/:slug/calendar.ics", asyncHandler(async (req, res) => {
  const event = await Service.publicBySlug(requirePublicContentAdminId(), req.params.slug);
  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.set("Content-Disposition", `attachment; filename="${event.slug}.ics"`);
  res.send(await Service.calendar(event));
}));
publicRouter.post("/events/:slug/registrations", limiter, asyncHandler(async (req, res) => {
  const body = contactSchema.extend({
    fromPopup: z.boolean().optional().default(false),
    referralCode: z.string().trim().max(30).optional().nullable(),
    hp_field: z.string().max(200).optional().nullable(),
  }).parse(req.body || {});
  // Only a bot fills the hidden field — it's told it worked, and nothing is saved.
  if (body.hp_field) return ok(res, { already: false, registration: null, event: null }, 201);
  const result = await Service.publicRegister(requirePublicContentAdminId(), req.params.slug, {
    ...body, source: body.fromPopup ? "website_popup" : "website", visitSource: visitSourceFrom(req),
  });
  ok(res, result, 201);
}));
// The registration's own page — whoever has the link from the email (or just registered).
publicRouter.get("/event-registrations/:token", asyncHandler(async (req, res) => ok(res, await Service.tokenView(req.params.token))));
publicRouter.put("/event-registrations/:token/details", limiter, asyncHandler(async (req, res) => ok(res, await Service.tokenDetails(req.params.token, detailsSchema.parse(req.body || {})))));
publicRouter.post("/event-registrations/:token/cancel", limiter, asyncHandler(async (req, res) => ok(res, await Service.tokenCancel(req.params.token))));

module.exports = { router, mineRouter, publicRouter };
