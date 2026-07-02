import { z } from "zod";

export const courseSchema = z.object({
  name:        z.string().min(1, "Course name is required"),
  description: z.string().optional().default(""),
  coverImage:  z.string().nullable().optional().default(null),
});
