import { z } from "zod";

export const COMPETITION_STATUSES = [
  { value: "draft",  label: "Draft" },
  { value: "open",   label: "Open" },
  { value: "closed", label: "Closed" },
];
export const COMPETITION_FORMATS = [
  { value: "individual", label: "Individual" },
  { value: "pairs",      label: "Pairs" },
  { value: "team",       label: "Team" },
];
export const COMPETITION_CADENCES = [
  { value: "one_off", label: "One-off" },
  { value: "annual",  label: "Annual" },
  { value: "termly",  label: "Termly" },
];

const url = z.string().url("Enter a valid URL").or(z.literal("")).default("");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").or(z.literal("")).default("");

const coursePriceSchema = z.object({
  courseId:      z.string().min(1),
  priceAmount:   z.coerce.number().int().min(0).max(10000000).nullable().default(null),
  priceCurrency: z.string().trim().max(8).default("KES"),
});

// A number box left empty is "not set" (null) — never 0.
const optNum = (min, max) => z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? null : Number(v)), z.number().min(min).max(max).nullable()).default(null);
const intNum = (min, max, fallback) => z.preprocess((v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? fallback : Number(v)), z.number().int().min(min).max(max)).default(fallback);
const milestone = z.object({ label: z.string().trim().min(1, "Name it").max(120), date: dateStr });

export const ENTRY_MODES = [
  { value: "individual", label: "Individuals" },
  { value: "group",      label: "Groups / teams" },
];
export const COMPETITION_MODES = [
  { value: "online",    label: "Online" },
  { value: "in_person", label: "In person" },
  { value: "both",      label: "Online and in person" },
];

// How a track is entered (20 Nov 2026): individuals and/or teams, team size, and its own prices —
// one per individual, one per team.
const trackEntrySchema = z.object({
  individual:      z.boolean().default(true),
  group:           z.boolean().default(true),
  teamMin:         intNum(2, 50, 2),
  teamMax:         intNum(2, 50, 5),
  individualPrice: optNum(0, 10000000),
  teamPrice:       optNum(0, 10000000),
  currency:        z.string().trim().max(8).default("KES"),
}).superRefine((e, ctx) => {
  if (!e.individual && !e.group) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["individual"], message: "Allow individuals, teams or both" });
  if (e.teamMax < e.teamMin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["teamMax"], message: "Can't be smaller than the smallest team" });
});

const trackSchema = z.object({
  id:          z.string().optional(),
  name:        z.string().trim().min(1, "Track name is required").max(120),
  subtitle:    z.string().trim().max(150).default(""),
  // The card's short summary — rich text (TipTap HTML).
  description: z.string().trim().max(10000).default(""),
  highlights:  z.array(z.string().trim().min(1).max(400)).max(12).default([]),
  ageMin:      optNum(3, 100),
  ageMax:      optNum(3, 100),
  entry:       trackEntrySchema,
  // The track's own page on the website ("Know More").
  coverImage:  z.string().nullable().default(null),
  overview:    z.string().trim().max(20000).default(""),
  whatToDo:    z.string().trim().max(20000).default(""),
  rules:       z.string().trim().max(20000).default(""),
  judging:     z.array(z.object({ name: z.string().trim().min(1, "Name it").max(150), weight: optNum(0, 100), description: z.string().trim().max(600).default("") })).max(20).default([]),
  prizes:      z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  timeline:    z.array(milestone).max(20).default([]),
  resources:   z.array(z.object({ label: z.string().trim().min(1, "Name it").max(150), url: z.string().url("Enter a valid URL") })).max(20).default([]),
  faqs:        z.array(z.object({ question: z.string().trim().min(1, "Write the question").max(300), answer: z.string().trim().min(1, "Write the answer").max(3000) })).max(30).default([]),
  // Empty = our own sign-up with payment; set = an outside form a partner runs.
  registerUrl: url,
  knowMoreUrl: url,
}).superRefine((t, ctx) => {
  if (t.ageMin != null && t.ageMax != null && t.ageMax < t.ageMin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageMax"], message: "Can't be below the youngest age" });
});

// "Competition information" — shown after the description on the website (20 Nov 2026).
const infoSchema = z.object({
  ageMin:          optNum(3, 100),
  ageMax:          optNum(3, 100),
  eligibilityNote: z.string().trim().max(300).default(""),
  entryModes:      z.array(z.enum(["individual", "group"])).min(1, "Allow individuals, groups or both").default(["individual", "group"]),
  mode:            z.preprocess((v) => (v === "" ? null : v), z.enum(["online", "in_person", "both"]).nullable()).default(null),
  venue:           z.string().trim().max(300).default(""),
  milestones:      z.array(milestone).max(20).default([]),
  prizes:          z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  extras:          z.array(z.object({ label: z.string().trim().min(1, "Name it").max(80), value: z.string().trim().min(1, "Fill it in").max(300) })).max(20).default([]),
  // Entry fees — the same for every track (20 Nov 2026). Empty = free.
  individualPrice: optNum(0, 10000000),
  teamPrice:       optNum(0, 10000000),
  currency:        z.string().trim().max(8).default("KES"),
}).superRefine((i, ctx) => {
  if (i.ageMin != null && i.ageMax != null && i.ageMax < i.ageMin) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageMax"], message: "Can't be below the youngest age" });
});

export const competitionSchema = z
  .object({
    name:        z.string().trim().min(1, "Competition name is required").max(150, "Max 150 characters"),
    // Rich text (TipTap HTML) — capped generously above the old 3000-char plain-text limit.
    description: z.string().trim().max(15000).default(""),
    edition:     z.string().trim().max(120).default(""),
    format:      z.enum(["individual", "pairs", "team"]).nullable().default(null),
    level:       z.string().trim().max(120).default(""),
    cadence:     z.enum(["one_off", "annual", "termly"]).nullable().default(null),
    startDate:             dateStr,
    endDate:               dateStr,
    registrationOpenDate:  dateStr,
    registrationCloseDate: dateStr,
    coverImage:  z.string().nullable().default(null),
    curriculumId: z.string().nullable().default(null),
    status:      z.enum(["draft", "open", "closed"]).default("draft"),
    isPublic:    z.boolean().default(false),
    info:        infoSchema,
    tracks:      z.array(trackSchema).max(12).default([]),
    coursePricing: z.array(coursePriceSchema).max(200).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.startDate && d.endDate && d.endDate < d.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after the start date" });
    }
    if (d.registrationOpenDate && d.registrationCloseDate && d.registrationCloseDate < d.registrationOpenDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationCloseDate"], message: "Registration close date must be on or after the open date" });
    }
  });

export const EMPTY_ENTRY = { individual: true, group: true, teamMin: 2, teamMax: 5, individualPrice: null, teamPrice: null, currency: "KES" };
export const EMPTY_TRACK = {
  name: "", subtitle: "", description: "", highlights: [],
  ageMin: null, ageMax: null, entry: { ...EMPTY_ENTRY },
  coverImage: null, overview: "", whatToDo: "", rules: "",
  judging: [], prizes: [], timeline: [], resources: [], faqs: [],
  registerUrl: "", knowMoreUrl: "",
};
export const EMPTY_INFO = { ageMin: null, ageMax: null, eligibilityNote: "", entryModes: ["individual", "group"], mode: null, venue: "", milestones: [], prizes: [], extras: [], individualPrice: null, teamPrice: null, currency: "KES" };
