const { z } = require("zod");

const STATUSES = ["draft", "open", "closed"];
const FORMATS = ["individual", "pairs", "team"];
const CADENCES = ["one_off", "annual", "termly"];

// One Track card — the Track 1 / Track 2 / Track 3 blocks on the public site. `id` is a
// client-assigned string while editing; the server keeps it but doesn't require one (tracks
// live embedded in the competition document, not as addressable rows).
const trackSchema = z.object({
  id:          z.string().optional(),
  name:        z.string().trim().min(1, "Track name is required").max(120),
  // e.g. "Innovation and Entrepreneurship" — the green subheading under "Track 1".
  subtitle:    z.string().trim().max(150).optional().default(""),
  // Rich text (TipTap HTML) — capped generously above the old 2000-char plain-text limit.
  description: z.string().trim().max(10000).optional().default(""),
  // The bullet points on the card.
  highlights:  z.array(z.string().trim().min(1).max(400)).max(12).optional().default([]),
  // "Register Now" — an external registration form / partner site, or an internal /enroll link.
  registerUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional().default(""),
  // "Know More" — an external details page.
  knowMoreUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional().default(""),
});

// Dates are plain "YYYY-MM-DD" strings, same convention as bootcamps.
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").or(z.literal(""));

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

module.exports = {
  createCompetitionSchema,
  updateCompetitionSchema,
  COMPETITION_STATUSES: STATUSES,
  COMPETITION_FORMATS: FORMATS,
  COMPETITION_CADENCES: CADENCES,
};
