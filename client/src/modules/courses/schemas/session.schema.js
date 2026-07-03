import { z } from "zod";

const resourceSchema = z.object({
  id:       z.string().min(1),
  filename: z.string().min(1),
  url:      z.string().min(1),
  mimeType: z.string().min(1),
  size:     z.number(),
});

export const sessionSchema = z.object({
  title:                 z.string().optional().default(""),
  outcomes:              z.array(z.string().min(1)).optional().default([]),
  introduction:          z.string().optional().default(""),
  iceBreaker:            z.string().optional().default(""),
  mainConceptsIntro:     z.string().optional().default(""),
  mainConceptsBodyTitle: z.string().optional().default("Body"),
  mainConceptsBody:      z.string().optional().default(""),
  classActivity:         z.string().optional().default(""),
  wrapActivity:          z.string().optional().default(""),
  notes:                 z.string().optional().default(""),
  resources:             z.array(resourceSchema).optional().default([]),
});
