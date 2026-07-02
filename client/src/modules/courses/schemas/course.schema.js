import { z } from "zod";

const introductionSchema = z.object({
  overview:   z.string().optional().default(""),
  iceBreaker: z.string().optional().default(""),
});

const activitiesSchema = z.object({
  classActivity: z.string().optional().default(""),
  wrapActivity:  z.string().optional().default(""),
});

export const courseSchema = z.object({
  name:         z.string().min(1, "Course name is required"),
  description:  z.string().optional().default(""),
  outcomes:     z.array(z.string().min(1)).optional().default([]),
  introduction: introductionSchema.optional().default({}),
  mainConcept:  z.string().optional().default(""),
  activities:   activitiesSchema.optional().default({}),
  teachersNote: z.string().optional().default(""),
});
