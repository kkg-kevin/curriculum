import { z } from "zod";

// Empty text input -> undefined (not set) rather than coercing "" to 0.
const optionalAge = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.number().int().min(0, "Must be 0 or more").max(120, "Must be 120 or less").optional()
);

export const courseSchema = z.object({
  name:          z.string().min(1, "Course name is required"),
  description:   z.string().optional().default(""),
  coverImage:    z.string().nullable().optional().default(null),
  ageMin:        optionalAge,
  ageMax:        optionalAge,
  // Not part of the Course record itself — reconciled into course-competency
  // links after save. See CreateCoursePage/EditCoursePage onSubmit.
  competencyIds: z.array(z.string()).optional().default([]),
  // Same pattern as competencyIds, reconciled into course-learning-area links.
  learningAreaIds: z.array(z.string()).optional().default([]),
}).refine(
  (data) => data.ageMin == null || data.ageMax == null || data.ageMax >= data.ageMin,
  { message: "Max age must be ≥ min age", path: ["ageMax"] }
);
