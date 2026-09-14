import { z } from "zod";

export const BOOTCAMP_SALE_STATUSES = [
  { value: "internal",  label: "Internal only" },
  { value: "for_sale",  label: "For sale" },
];
export const BOOTCAMP_FORMATS = [
  { value: "holiday",      label: "Holiday" },
  { value: "weekend",      label: "Weekend" },
  { value: "after_school", label: "After school" },
  { value: "online",       label: "Online" },
];

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").or(z.literal(""));

const coursePriceSchema = z.object({
  courseId:      z.string().min(1),
  priceAmount:   z.coerce.number().int().min(0).max(10000000).nullable().default(null),
  priceCurrency: z.string().trim().max(8).default("KES"),
});

export const bootcampSchema = z
  .object({
    name:          z.string().trim().min(1, "Bootcamp name is required").max(150, "Max 150 characters"),
    description:   z.string().trim().max(3000).default(""),
    tagline:       z.string().trim().max(200).default(""),
    coverImage:    z.string().nullable().default(null),
    curriculumId:  z.string().nullable().default(null),
    startDate:             dateStr.default(""),
    endDate:               dateStr.default(""),
    registrationOpenDate:  dateStr.default(""),
    registrationCloseDate: dateStr.default(""),
    saleStatus:    z.enum(["internal", "for_sale"]).default("internal"),
    format:        z.enum(["holiday", "weekend", "after_school", "online"]).nullable().default(null),
    durationLabel: z.string().trim().max(60).default(""),
    ageMin:        z.coerce.number().int().min(0).max(25).nullable().default(null),
    ageMax:        z.coerce.number().int().min(0).max(25).nullable().default(null),
    priceAmount:   z.coerce.number().int().min(0).max(10000000).nullable().default(null),
    priceCurrency: z.string().trim().max(8).default("KES"),
    priceNote:     z.string().trim().max(300).default(""),
    highlights:    z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    coursePricing: z.array(coursePriceSchema).max(200).default([]),
  })
  .superRefine((d, ctx) => {
    if (d.ageMin != null && d.ageMax != null && d.ageMax < d.ageMin) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ageMax"], message: "Maximum age must be greater than or equal to minimum age" });
    }
    if (d.startDate && d.endDate && d.endDate < d.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must be on or after the start date" });
    }
    if (d.registrationOpenDate && d.registrationCloseDate && d.registrationCloseDate < d.registrationOpenDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationCloseDate"], message: "Registration close date must be on or after the open date" });
    }
  });
