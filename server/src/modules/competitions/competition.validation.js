const { z } = require("zod");

const STATUSES = ["draft", "open", "closed"];
const FORMATS = ["individual", "pairs", "team"];
const CADENCES = ["one_off", "annual", "termly"];

// Dates are plain "YYYY-MM-DD" strings, same convention as bootcamps.
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").or(z.literal(""));

const ENTRY_MODES = ["individual", "group"];
const age = z.coerce.number().int().min(3).max(100).optional().nullable();
const money = z.coerce.number().min(0).max(10000000).optional().nullable();
const milestoneSchema = z.object({ label: z.string().trim().min(1).max(120), date: dateStr.optional().default("") });
const richText = (max) => z.string().trim().max(max).optional().default("");

// How a track is entered (20 Nov 2026): individual and/or group, a team's size, and the track's
// own prices — one for an individual, one per team (user: a team pays one fee). Left out, a track
// follows the competition's entry modes (competition-registration.rules.js's trackEntry).
const trackEntrySchema = z.object({
  individual:      z.boolean().optional().default(true),
  group:           z.boolean().optional().default(true),
  teamMin:         z.coerce.number().int().min(2).max(50).optional().default(2),
  teamMax:         z.coerce.number().int().min(2).max(50).optional().default(5),
  individualPrice: money,
  teamPrice:       money,
  currency:        z.string().trim().max(8).optional().default("KES"),
}).superRefine((e, ctx) => {
  if (!e.individual && !e.group) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["individual"], message: "Allow individuals, groups or both" });
  if (e.teamMax < e.teamMin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["teamMax"], message: "The largest team can't be smaller than the smallest" });
});

// One Track — its card on the competition page and its own page ("Know More", 20 Nov 2026).
// `id` is a client-assigned string while editing; the server keeps it but doesn't require one
// (tracks live embedded in the competition document, not as addressable rows).
const trackSchema = z.object({
  id:          z.string().optional(),
  name:        z.string().trim().min(1, "Track name is required").max(120),
  // e.g. "Innovation and Entrepreneurship" — the subheading under the track's name.
  subtitle:    z.string().trim().max(150).optional().default(""),
  // The card's short summary. Rich text (TipTap HTML).
  description: richText(10000),
  // The bullet points on the card.
  highlights:  z.array(z.string().trim().min(1).max(400)).max(12).optional().default([]),
  // ── Who can enter and how ──
  ageMin:      age,
  ageMax:      age,
  entry:       trackEntrySchema.optional().nullable(),
  // ── The track's own page ──
  coverImage:  z.string().max(500).optional().nullable(),
  overview:    richText(20000),
  whatToDo:    richText(20000),
  rules:       richText(20000),
  judging:     z.array(z.object({ name: z.string().trim().min(1).max(150), weight: z.coerce.number().min(0).max(100).optional().nullable(), description: z.string().trim().max(600).optional().default("") })).max(20).optional().default([]),
  prizes:      z.array(z.string().trim().min(1).max(300)).max(20).optional().default([]),
  timeline:    z.array(milestoneSchema).max(20).optional().default([]),
  resources:   z.array(z.object({ label: z.string().trim().min(1).max(150), url: z.string().url("Enter a valid URL") })).max(20).optional().default([]),
  faqs:        z.array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(3000) })).max(30).optional().default([]),
  // "Register Now" — empty = our own sign-up (with payment); set = an outside form a partner runs.
  registerUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional().default(""),
  // Older tracks' outside "Know More" page — kept, shown on the track's own page as a link.
  knowMoreUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional().default(""),
}).superRefine((t, ctx) => {
  if (t.ageMin != null && t.ageMax != null && t.ageMax < t.ageMin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageMax"], message: "The oldest age can't be below the youngest" });
});

// The "Competition information" section — after the description on the website (20 Nov 2026).
const infoSchema = z.object({
  ageMin:          age,
  ageMax:          age,
  eligibilityNote: z.string().trim().max(300).optional().default(""),
  // How people can enter (user: "all options open" — individuals and groups).
  entryModes:      z.array(z.enum(ENTRY_MODES)).min(1, "Allow individuals, groups or both").max(2).optional().default(["individual", "group"]),
  mode:            z.enum(["online", "in_person", "both"]).optional().nullable(),
  venue:           z.string().trim().max(300).optional().default(""),
  milestones:      z.array(milestoneSchema).max(20).optional().default([]),
  prizes:          z.array(z.string().trim().min(1).max(300)).max(20).optional().default([]),
  extras:          z.array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().min(1).max(300) })).max(20).optional().default([]),
  // Entry fees for every track (20 Nov 2026 — the same for all tracks): one per individual, one
  // per team. Empty = free.
  individualPrice: money,
  teamPrice:       money,
  currency:        z.string().trim().max(8).optional().default("KES"),
}).superRefine((i, ctx) => {
  if (i.ageMin != null && i.ageMax != null && i.ageMax < i.ageMin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageMax"], message: "The oldest age can't be below the youngest" });
});

// One priced course from the selected curriculum's pathways. `courseId` is checked against the
// curriculum in competition.service.js (a Zod string here can't confirm it actually belongs
// there). Same shape as bootcamp.validation.js's coursePriceSchema.
const coursePriceSchema = z.object({
  courseId:      z.string().min(1),
  priceAmount:   z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  priceCurrency: z.string().trim().max(8).optional().default("KES"),
});

const competitionFields = z.object({
  name:        z.string().trim().min(1, "Competition name is required").max(150),
  // Rich text (TipTap HTML) — capped generously above the old 3000-char plain-text limit.
  description: z.string().trim().max(15000).optional().default(""),
  edition:     z.string().trim().max(120).optional().default(""),
  format:      z.enum(FORMATS).optional().nullable(),
  level:       z.string().trim().max(120).optional().default(""),
  cadence:     z.enum(CADENCES).optional().nullable(),
  startDate:             dateStr.optional().default(""),
  endDate:               dateStr.optional().default(""),
  registrationOpenDate:  dateStr.optional().default(""),
  registrationCloseDate: dateStr.optional().default(""),
  coverImage:  z.string().max(500).optional().nullable(),
  // curriculumId is never client-forced into the general payload beyond an id string — the
  // controller checks it belongs to the same admin (same posture as curriculum.linkCourse).
  curriculumId: z.string().max(36).optional().nullable(),
  status:      z.enum(STATUSES).optional().default("draft"),
  isPublic:    z.boolean().optional().default(false),
  info:        infoSchema.optional().nullable(),
  tracks:      z.array(trackSchema).max(12).optional().default([]),
  // Per-course prices for this competition's curriculum — set from the curriculum's pathways.
  coursePricing: z.array(coursePriceSchema).max(200).optional().default([]),
});

// Every check below only fires when both sides of the comparison are actually present — a
// partial update patch (or a competition that hasn't set its dates yet) must not be blocked by
// a rule about a field it doesn't currently carry.
function applyDateRefinements(data, ctx) {
  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after the start date" });
  }
  // Deliberately no check that registrationCloseDate <= startDate — rolling/late registration
  // after kickoff is legitimate.
  if (data.registrationOpenDate && data.registrationCloseDate && data.registrationCloseDate < data.registrationOpenDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["registrationCloseDate"],
      message: "Registration close date must be on or after the open date",
    });
  }
}

const createCompetitionSchema = competitionFields.superRefine(applyDateRefinements);
const updateCompetitionSchema = competitionFields.partial().superRefine(applyDateRefinements);

// A registration from the website (competition-registration.service.js). Contact details are the
// person registering — a parent for a child, or the teacher / school entering a team.
const participantSchema = z.object({
  name:        z.string().trim().min(2, "Enter each participant's full name").max(150),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter each participant's date of birth"),
  school:      z.string().trim().max(200).optional().default(""),
});
const registrationSchema = z.object({
  trackId:      z.string().trim().min(1).max(64),
  entryType:    z.enum(ENTRY_MODES),
  teamName:     z.string().trim().max(150).optional().default(""),
  organisation: z.string().trim().max(200).optional().default(""),
  contactName:  z.string().trim().min(2, "Enter your name").max(150),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email address").max(255),
  contactPhone: z.string().trim().min(7, "Enter a phone number").max(40),
  contactRole:  z.enum(["parent", "teacher", "school", "participant", "other"]).optional().default("parent"),
  participants: z.array(participantSchema).min(1, "Add the participant").max(50),
  // Honeypot — real people never fill it.
  hp_field:     z.string().optional().default(""),
});
const cancelRegistrationSchema = z.object({ reason: z.string().trim().min(2, "Say why").max(500) });

module.exports = {
  createCompetitionSchema,
  updateCompetitionSchema,
  registrationSchema,
  cancelRegistrationSchema,
  ENTRY_MODES,
};
