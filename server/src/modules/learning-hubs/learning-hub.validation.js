const { z } = require("zod");

const KENYA_COUNTIES = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa",
  "Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi",
  "Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos",
  "Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Muranga","Nairobi",
  "Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya",
  "Taita-Taveta","Tana River","Tharaka-Nithi","Trans Nzoia","Turkana",
  "Uasin Gishu","Vihiga","Wajir","West Pokot",
];

// "school" is the original, fully-built hub type (its own required Code, login-matching
// via email). The others are places a curriculum can also be assigned to — differentiated
// required fields/behavior per type is deferred; for now they all share this one schema.
const LEARNING_HUB_TYPES = [
  "school", "co_working_space", "innovation_lab", "makerspace", "tech_club",
];

// How a hub is delivered — orthogonal to hubType. `virtual` hubs have no physical address (the
// county requirement below is relaxed for them) and carry a `meetingLink` instead. Every
// existing hub is `in_person`.
const DELIVERY_MODES = ["in_person", "virtual", "hybrid"];

// county is required for a physical presence (in_person / hybrid) and optional — "" allowed —
// for a purely virtual hub. The conditional check runs in the schema's superRefine so it can
// see deliveryMode.
const addressSchema = z.object({
  street: z.string().max(200).default(""),
  city: z.string().max(100).default(""),
  county: z
    .string()
    .max(60)
    .default("")
    .refine((v) => v === "" || KENYA_COUNTIES.includes(v), {
      message: "Please select a valid county",
    }),
});

const operatingHoursSchema = z.object({
  opensAt: z.string().max(10).default(""),
  closesAt: z.string().max(10).default(""),
  days: z.array(z.string()).default([]),
});

// A club's details for parents (non-school hubs; shown on the website's Estate Tech Club page):
// the ages it's for, when the club meets — session times, distinct from the venue's opening hours
// above — class size, a description written for parents, and FAQs. All optional.
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00");
const optionalWhole = (min, max) => z.number().int().min(min).max(max).nullable().optional();
const clubDetailsSchema = z.object({
  ageMin: optionalWhole(2, 25),
  ageMax: optionalWhole(2, 25),
  classSize: optionalWhole(1, 500),
  sessions: z.array(z.object({
    day: z.enum(WEEK_DAYS, { message: "Choose a day for each session" }),
    startsAt: clockTime,
    endsAt: clockTime,
  }).refine((s) => s.endsAt > s.startsAt, { message: "A session must end after it starts", path: ["endsAt"] })).max(21).default([]),
  parentDescription: z.string().trim().max(5000).default(""),
  faqs: z.array(z.object({
    question: z.string().trim().min(1, "Write the question").max(200),
    answer: z.string().trim().min(1, "Write the answer").max(2000),
  })).max(15).default([]),
}).refine((d) => d.ageMin == null || d.ageMax == null || d.ageMin <= d.ageMax, { message: "The youngest age must be below the oldest", path: ["ageMax"] });

// Bookable seating/space configuration — data capture only. There is no reservation/booking
// flow anywhere in the app yet; this just records what a hub offers and at what price so
// that feature can be built against real data later.
//
// id is assigned server-side (learning-hub.service.js's space-id backfill) the first time a
// space is saved — a learner's enrollment (learner_hub_links.spaceId) and a logged hub visit
// (hub_visits.spaceId) reference it to say "which space." Optional here since a newly-added
// space from the client has none yet; an existing space keeps the id it was given.
const spaceSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Space name is required").max(100),
  spaceType: z.string().max(50).default("desk"),
  building: z.string().min(1, "Building is required").max(100),
  floor: z.string().min(1, "Floor is required").max(50),
  room: z.string().max(50).default(""),
  minCapacity: z.coerce.number().int().positive().default(1),
  maxCapacity: z.coerce.number().int().positive().default(1),
  pricingModel: z.enum(["hourly", "daily", "fixed", "free"]).default("hourly"),
  rate: z.coerce.number().nonnegative().default(0),
  priceUnit: z.string().max(30).default("per hour"),
  reservable: z.boolean().default(true),
  notes: z.string().max(500).default(""),
});

const baseLearningHubSchema = z.object({
  name: z.string().min(1, "Learning hub name is required").max(150, "Max 150 characters"),
  hubType: z.enum(LEARNING_HUB_TYPES, { errorMap: () => ({ message: "Select a valid learning hub type" }) }).default("school"),
  deliveryMode: z.enum(DELIVERY_MODES, { errorMap: () => ({ message: "Select a valid delivery mode" }) }).default("in_person"),
  // The join link for a virtual / hybrid hub (Zoom, Meet, …). Optional here — a hub can be
  // marked virtual before the link is sorted; the portal form nudges for it.
  meetingLink: z.string().url("Enter a valid URL").or(z.literal("")).default(""),
  code: z
    .string()
    .max(20, "Max 20 characters")
    .regex(/^[A-Z0-9-]*$/i, "Only letters, numbers, and hyphens")
    .default(""),
  email: z.string().email("Invalid email address").or(z.literal("")).default(""),
  // Transient — never persisted onto the learning hub record itself. When present, the controller
  // uses it to create/reset the matching school-portal login (see auth.service.js's
  // setOrCreatePassword) and then strips it before saving the learning hub.
  password: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
  phone: z.string().max(20, "Max 20 characters").default(""),
  contactPerson: z.string().max(150).default(""),
  address: addressSchema,
  mapLink: z.string().url("Enter a valid URL").or(z.literal("")).default(""),
  curriculumId: z.string().or(z.literal("")).nullable().default(null),
  // A hub can itself be the parent of other hubs (its "branches") — the parent hub's own
  // "school" admin gets access to switch into and manage each branch hub too (see
  // scope.middleware.js's req.ownSchools/req.ownSchool resolution). Same shape as curriculumId:
  // a plain outward-pointing field, no separate link table. One level only — enforced in the
  // controller (not here, since that needs to know this record's own id and look up the target):
  // a hub can't be its own parent, and a hub that already has a parentHubId can't itself be
  // chosen as a parent (no chains).
  parentHubId: z.string().or(z.literal("")).nullable().default(null),
  // Who runs this hub's check-ins (modules/checkins): two people of the workspace who can take
  // part in Hub check-ins — checked in the controller. Empty until named.
  accountManagerId: z.string().max(36).or(z.literal("")).nullable().default(null),
  trainingLeadId: z.string().max(36).or(z.literal("")).nullable().default(null),
  // New hubs start as "draft" — invisible everywhere outside Settings until an admin promotes
  // them to "active", at which point they appear in the Learning Hubs module and every other
  // consumer (Teachers/Classes/Learners pickers, curriculum view, dashboard, etc).
  status: z.enum(["draft", "active", "inactive"]).default("draft"),
  // Rich text (TipTap HTML) — capped generously above the old 1000-char plain-text limit.
  description: z.string().max(10000).default(""),
  // Single profile/logo image — distinct from the `photos` gallery below.
  photo: z.string().optional().nullable().default(null),
  // At most 3 — the website shows a hub's (Estate Tech Club's) photos as one gallery.
  photos: z.array(z.string()).max(3, "A learning hub can have at most 3 photos").default([]),
  amenities: z.array(z.string()).default([]),
  operatingHours: operatingHoursSchema.default({}),
  spaces: z.array(spaceSchema).default([]),
  clubDetails: clubDetailsSchema.nullable().default(null),
});

// Code stays required only for hubType "school"; county stays required for a physical presence
// (in_person / hybrid). This keeps the school-creation flow and every existing physical hub
// behaving exactly as before, while letting a purely virtual hub skip the address.
const createLearningHubSchema = baseLearningHubSchema.superRefine((data, ctx) => {
  if (data.hubType === "school" && !data.code) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["code"], message: "School code is required" });
  }
  if (data.password && !data.email) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email is required to set a password" });
  }
  if (data.deliveryMode !== "virtual" && !data.address?.county) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["address", "county"], message: "County is required for a physical hub" });
  }
});

const updateLearningHubSchema = baseLearningHubSchema.partial().extend({
  address: addressSchema.partial().optional(),
  operatingHours: operatingHoursSchema.partial().optional(),
});

const attachHubCurriculumSchema = z.object({
  curriculumId: z.string().min(1, "Curriculum is required"),
  role: z.enum(["complementary", "substitutional"], { errorMap: () => ({ message: "Select a valid curriculum role" }) }),
});

const updateHubCurriculumStatusSchema = z.object({
  status: z.enum(["active", "inactive", "completed"], { errorMap: () => ({ message: "Select a valid curriculum status" }) }),
});

module.exports = {
  createLearningHubSchema,
  updateLearningHubSchema,
  attachHubCurriculumSchema,
  updateHubCurriculumStatusSchema,
  LEARNING_HUB_TYPES,
  DELIVERY_MODES,
  KENYA_COUNTIES,
};
