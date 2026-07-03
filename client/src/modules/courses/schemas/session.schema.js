import { z } from "zod";

export const RESOURCE_AUDIENCES = ["teacher", "student", "both"];

const resourceSchema = z.object({
  id:       z.string().min(1),
  filename: z.string().min(1),
  url:      z.string().min(1),
  mimeType: z.string().min(1),
  size:     z.number(),
  audience: z.enum(RESOURCE_AUDIENCES).optional().default("both"),
});

const repeatableItemSchema = z.object({
  id:      z.string().min(1),
  title:   z.string().optional().default(""),
  content: z.string().optional().default(""),
});

// An Activity is one unit with two fixed sub-parts (Class Activity + Wrap Activity), not a
// single content blob — sessions can have multiple Activity units, each holding both parts.
const activityItemSchema = z.object({
  id:            z.string().min(1),
  title:         z.string().optional().default(""),
  classActivity: z.string().optional().default(""),
  wrapActivity:  z.string().optional().default(""),
});

export const sessionSchema = z.object({
  title:        z.string().optional().default(""),
  outcomes:     z.array(z.string().min(1)).optional().default([]),
  introduction: z.string().optional().default(""),
  iceBreaker:   z.string().optional().default(""),
  mainConcepts: z.array(repeatableItemSchema).optional().default([]),
  activities:   z.array(activityItemSchema).optional().default([]),
  notes:        z.array(repeatableItemSchema).optional().default([]),
  resources:    z.array(resourceSchema).optional().default([]),
});
