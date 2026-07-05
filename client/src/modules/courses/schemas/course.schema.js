import { z } from "zod";

export const courseSchema = z.object({
  name:          z.string().min(1, "Course name is required"),
  description:   z.string().optional().default(""),
  coverImage:    z.string().nullable().optional().default(null),
  // Not part of the Course record itself — reconciled into course-competency
  // links after save. See CreateCoursePage/EditCoursePage onSubmit.
  competencyIds: z.array(z.string()).optional().default([]),
  // Same pattern as competencyIds, reconciled into course-learning-area links.
  learningAreaIds: z.array(z.string()).optional().default([]),
});
