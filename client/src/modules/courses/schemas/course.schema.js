import { z } from "zod";

// Empty text input -> undefined (not set) rather than coercing "" to 0.
const optionalAge = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.number().int().min(0, "Must be 0 or more").max(120, "Must be 120 or less").optional()
);

export const courseSchema = z.object({
  name:          z.string().min(1, "Course name is required"),
  // Auto-generated from the name — never typed in directly. See generateCourseCode.
  code:          z.string().max(20).regex(/^[A-Z0-9-]*$/i, "Only letters, numbers, and hyphens").default(""),
  // New courses start as "draft" until an admin promotes them to "active", or "archived" to
  // retire one without deleting it.
  status:        z.enum(["draft", "active", "archived"]).default("draft"),
  description:   z.string().optional().default(""),
  coverImage:    z.string().nullable().optional().default(null),
  ageMin:        optionalAge,
  ageMax:        optionalAge,
  // Not part of the Course record itself — reconciled into course-learning-area
  // links after save. See CreateCoursePage/EditCoursePage onSubmit.
  learningAreaIds: z.array(z.string()).optional().default([]),
}).refine(
  (data) => data.ageMin == null || data.ageMax == null || data.ageMax >= data.ageMin,
  { message: "Max age must be ≥ min age", path: ["ageMax"] }
);

// Derives a short uppercase code from a name's word initials (or the first few letters of a
// single word), then disambiguates against codes already in use by appending "-2", "-3", etc.
// Mirrors learning-hubs/schemas/learningHub.schema.js's generateHubCode.
export function generateCourseCode(name, existingCodes = []) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const base = (
    words.length === 1 ? words[0].slice(0, 3) : words.map((w) => w[0]).join("").slice(0, 4)
  ).toUpperCase();

  const taken = new Set(existingCodes.filter(Boolean).map((c) => c.toUpperCase()));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
