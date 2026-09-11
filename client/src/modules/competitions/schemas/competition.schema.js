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

const trackSchema = z.object({
  id:          z.string().optional(),
  name:        z.string().trim().min(1, "Track name is required").max(120),
  subtitle:    z.string().trim().max(150).default(""),
  description: z.string().trim().max(2000).default(""),
  highlights:  z.array(z.string().trim().min(1).max(400)).max(12).default([]),
  registerUrl: url,
  knowMoreUrl: url,
});

export const competitionSchema = z
  .object({
    name:        z.string().trim().min(1, "Competition name is required").max(150, "Max 150 characters"),
    description: z.string().trim().max(3000).default(""),
    edition:     z.string().trim().max(120).default(""),
    format:      z.enum(["individual", "pairs", "team"]).nullable().default(null),
    level:       z.string().trim().max(120).default(""),
    cadence:     z.enum(["one_off", "annual", "termly"]).nullable().default(null),
    startDate:   dateStr,
    endDate:     dateStr,
    coverImage:  z.string().nullable().default(null),
    eventId:     z.string().nullable().default(null),
    status:      z.enum(["draft", "open", "closed"]).default("draft"),
    isPublic:    z.boolean().default(false),
    tracks:      z.array(trackSchema).max(12).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.startDate && d.endDate && d.endDate < d.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after the start date" });
    }
  });

export const EMPTY_TRACK = { name: "", subtitle: "", description: "", highlights: [], registerUrl: "", knowMoreUrl: "" };
