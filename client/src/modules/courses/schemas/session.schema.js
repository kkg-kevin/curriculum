import { z } from "zod";

export const RESOURCE_AUDIENCES = ["teacher", "student", "both"];
export const RESOURCE_TYPES = ["file", "link"];

// A resource is either an uploaded file (mimeType/size populated by the upload endpoint) or an
// external link (just a URL + label, no upload) — `type` defaults to "file" so resources saved
// before links existed keep validating unchanged.
const resourceSchema = z.object({
  id:       z.string().min(1),
  filename: z.string().min(1),
  url:      z.string().min(1),
  type:     z.enum(RESOURCE_TYPES).optional().default("file"),
  mimeType: z.string().optional().default(""),
  size:     z.number().optional().default(0),
  audience: z.enum(RESOURCE_AUDIENCES).optional().default("both"),
});

const repeatableItemSchema = z.object({
  id:      z.string().min(1),
  title:   z.string().optional().default(""),
  content: z.string().optional().default(""),
});

const activityItemSchema = repeatableItemSchema.extend({
  mode: z.enum(["individual", "group"]).optional().default("individual"),
});

const assessmentAttachmentSchema = z.object({
  assessmentId: z.string().min(1),
  mode: z.enum(["individual", "group"]).optional().default("individual"),
});

export const sessionSchema = z.object({
  title:        z.string().optional().default(""),
  moduleId:     z.string().nullable().optional().default(null),
  outcomes:     z.array(z.string().min(1)).optional().default([]),
  introduction: z.string().optional().default(""),
  mainConcepts: z.array(repeatableItemSchema).optional().default([]),
  activities:   z.array(activityItemSchema).optional().default([]),
  assessmentIds: z.array(z.string().min(1)).optional().default([]),
  assessmentAttachments: z.array(assessmentAttachmentSchema).optional().default([]),
  notes:        z.array(repeatableItemSchema).optional().default([]),
  resources:    z.array(resourceSchema).optional().default([]),
});
