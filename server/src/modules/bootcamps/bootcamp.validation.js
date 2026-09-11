const { z } = require("zod");

const SALE_STATUSES = ["internal", "for_sale"];
const FORMATS = ["holiday", "weekend", "after_school", "online"];

const bootcampFields = z.object({
  name:          z.string().trim().min(1, "Bootcamp name is required").max(150),
  description:   z.string().trim().max(3000).optional().default(""),
  tagline:       z.string().trim().max(200).optional().default(""),
  // A stored "/uploads/x.png" path or an absolute URL — same shape as course.coverImage.
  coverImage:    z.string().max(500).optional().nullable(),
  // eventId is never client-forced into the general payload beyond an id string — the
  // controller checks it belongs to the same admin (same posture as competition.eventId).
  eventId:       z.string().max(36).optional().nullable(),
  saleStatus:    z.enum(SALE_STATUSES).optional().default("internal"),
  format:        z.enum(FORMATS).optional().nullable(),
  durationLabel: z.string().trim().max(60).optional().default(""),
  ageMin:        z.coerce.number().int().min(0).max(25).optional().nullable(),
  ageMax:        z.coerce.number().int().min(0).max(25).optional().nullable(),
  // Whole currency units, no fractional pricing. Coerced so the portal's number input
  // (which yields a string) is accepted.
  priceAmount:   z.coerce.number().int().min(0).max(10000000).optional().nullable(),
  priceCurrency: z.string().trim().max(8).optional().default("KES"),
  priceNote:     z.string().trim().max(300).optional().default(""),
  highlights:    z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
});

const ageRefinement = (d) => d.ageMin == null || d.ageMax == null || d.ageMax >= d.ageMin;
const ageRefinementOpts = {
  message: "Maximum age must be greater than or equal to minimum age",
  path: ["ageMax"],
};

const createBootcampSchema = bootcampFields.superRefine((data, ctx) => {
  if (!ageRefinement(data)) ctx.addIssue({ code: z.ZodIssueCode.custom, ...ageRefinementOpts });
});
const updateBootcampSchema = bootcampFields.partial().superRefine((data, ctx) => {
  if (!ageRefinement(data)) ctx.addIssue({ code: z.ZodIssueCode.custom, ...ageRefinementOpts });
});

module.exports = {
  createBootcampSchema,
  updateBootcampSchema,
  BOOTCAMP_SALE_STATUSES: SALE_STATUSES,
  BOOTCAMP_FORMATS: FORMATS,
};
