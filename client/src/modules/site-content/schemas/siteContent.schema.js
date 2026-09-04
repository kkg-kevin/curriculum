import { z } from "zod";

// Mirrors server/src/modules/public-site/public-site.validation.js's bootcampSchema exactly —
// field-for-field, so don't add/drop fields here without updating the server schema too.
export const bootcampSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  description: z.string().trim().min(1, "Description is required"),
  coverImage: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["upcoming", "active", "completed"]).default("upcoming"),
  startDate: z.string().trim().optional().nullable(),
  endDate: z.string().trim().optional().nullable(),
  educationLevel: z.string().trim().max(50).optional().nullable(),
  gradeFrom: z.string().trim().max(30).optional().nullable(),
  gradeTo: z.string().trim().max(30).optional().nullable(),
  classes: z.array(z.string()).optional().default([]),
  courses: z.array(z.object({ name: z.string().min(1), slug: z.string().min(1) })).optional().default([]),
  isPublished: z.boolean().default(true),
});

export const BOOTCAMP_DEFAULT_VALUES = {
  name: "",
  description: "",
  coverImage: null,
  status: "upcoming",
  startDate: "",
  endDate: "",
  educationLevel: "",
  gradeFrom: "",
  gradeTo: "",
  classes: [],
  courses: [],
  isPublished: true,
};

// Empty text input -> undefined (not set) rather than coercing "" to 0 — same posture as
// course.schema.js's optionalAge.
const optionalInt = (max) => z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.number().int().min(0, "Must be 0 or more").max(max, `Must be ${max} or less`).optional()
);

// Mirrors server/src/modules/public-site/public-site.validation.js's projectSchema exactly.
export const projectSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  description: z.string().trim().min(1, "Description is required"),
  coverImage: z.string().trim().max(500).optional().nullable(),
  ageMin: optionalInt(25),
  ageMax: optionalInt(25),
  sessionCount: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.coerce.number().int().min(0, "Must be 0 or more").optional()
  ),
  requirements: z.array(z.string()).optional().default([]),
  modules: z.array(z.string()).optional().default([]),
  isPublished: z.boolean().default(true),
}).refine(
  (data) => data.ageMin == null || data.ageMax == null || data.ageMax >= data.ageMin,
  { message: "Max age must be ≥ min age", path: ["ageMax"] }
);

export const PROJECT_DEFAULT_VALUES = {
  name: "",
  description: "",
  coverImage: null,
  ageMin: "",
  ageMax: "",
  sessionCount: "",
  requirements: [],
  modules: [],
  isPublished: true,
};
