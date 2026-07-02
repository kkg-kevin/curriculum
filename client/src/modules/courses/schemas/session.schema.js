import { z } from "zod";

const resourceSchema = z.object({
  id:       z.string().min(1),
  filename: z.string().min(1),
  url:      z.string().min(1),
  mimeType: z.string().min(1),
  size:     z.number(),
});

export const sessionSchema = z.object({
  title:        z.string().min(1, "Session title is required"),
  outcomes:     z.array(z.string().min(1)).optional().default([]),
  introduction: z.string().optional().default(""),
  mainConcepts: z.string().optional().default(""),
  activities:   z.string().optional().default(""),
  notes:        z.string().optional().default(""),
  resources:    z.array(resourceSchema).optional().default([]),
});
