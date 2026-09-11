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
  description: z.string().trim().max(2000).optional().default(""),
  // The bullet points on the card.
  highlights:  z.array(z.string().trim().min(1).max(400)).max(12).optional().default([]),
  // "Register Now" — an external registration form / partner site, or an internal /enroll link.
  registerUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional().default(""),
  // "Know More" — an external details page.
  knowMoreUrl: z.string().url("Enter a valid URL").or(z.literal("")).optional().default(""),
});

// Dates are plain "YYYY-MM-DD" strings, same convention as events.
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").or(z.literal(""));

const competitionFields = z.object({
  name:        z.string().trim().min(1, "Competition name is required").max(150),
  description: z.string().trim().max(3000).optional().default(""),
  edition:     z.string().trim().max(120).optional().default(""),
  format:      z.enum(FORMATS).optional().nullable(),
  level:       z.string().trim().max(120).optional().default(""),
  cadence:     z.enum(CADENCES).optional().nullable(),
  startDate:   dateStr.optional().default(""),
  endDate:     dateStr.optional().default(""),
  coverImage:  z.string().max(500).optional().nullable(),
  // eventId is never client-forced into the general payload beyond an id string — the
  // controller checks it belongs to the same admin (same posture as curriculum.linkCourse).
  eventId:     z.string().max(36).optional().nullable(),
  status:      z.enum(STATUSES).optional().default("draft"),
  isPublic:    z.boolean().optional().default(false),
  tracks:      z.array(trackSchema).max(12).optional().default([]),
});

const dateRefinement = (d) =>
  !d.startDate || !d.endDate || d.endDate >= d.startDate;
const dateRefinementOpts = { message: "End date must be on or after the start date", path: ["endDate"] };

const createCompetitionSchema = competitionFields.refine(dateRefinement, dateRefinementOpts);
const updateCompetitionSchema = competitionFields.partial().refine(dateRefinement, dateRefinementOpts);

module.exports = {
  createCompetitionSchema,
  updateCompetitionSchema,
  COMPETITION_STATUSES: STATUSES,
  COMPETITION_FORMATS: FORMATS,
  COMPETITION_CADENCES: CADENCES,
};
