const { z } = require("zod");

const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal(""));

// Same phone rule the public enquiry form uses (lead.validation.js), so a household created from an
// enquiry and one typed in by staff are held to the same standard.
const phone = z
  .string()
  .trim()
  .min(7, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^[+0-9()\-\s]+$/, "Enter a valid phone number");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD)")
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), "Use a valid date (YYYY-MM-DD)");

const householdSchema = z.object({
  guardianName: z.string().trim().min(1, "Guardian name is required").max(150),
  guardianEmail: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  guardianPhone: phone,
  county: optionalText(100),
  subCounty: optionalText(100),
  town: optionalText(100),
  addressLine: optionalText(255),
  landmark: optionalText(255),
  packageId: z.string().min(1, "Choose a package"),
  // How many children the family is enrolling. Optional — defaults to the package's included
  // children; more than that is only accepted by a package that allows extra children.
  childCount: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(["pending", "active", "paused", "cancelled"]).optional(),
  startDate: isoDate.optional().or(z.literal("")),
  notes: z.string().max(5000).optional().or(z.literal("")),
});

const enrollmentSchema = z.object({
  learnerId: z.string().min(1, "Choose a learner"),
  curriculumId: z.string().min(1, "Choose a curriculum"),
  gradeId: z.string().min(1, "Choose a grade / level"),
  educatorId: z.string().optional().or(z.literal("")),
  status: z.enum(["active", "paused", "completed"]).default("active"),
});

// Registering a brand-new child — the enrollment half (learner is created from `learner`).
const newLearnerEnrollmentSchema = enrollmentSchema.omit({ learnerId: true });

const money = z.coerce.number().int("Use whole shillings").min(0).max(10_000_000);

// A Home Learning package as the admin edits it (Home Learning → Packages).
const packageSchema = z.object({
  name: z.string().trim().min(1, "Package name is required").max(150),
  slug: z.string().trim().max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens").optional().or(z.literal("")),
  summary: z.string().trim().max(300).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  childrenIncluded: z.coerce.number().int().min(1, "A package includes at least 1 child").max(50),
  monthlyAmount: money,
  allowExtraChildren: z.boolean().default(false),
  extraChildAmount: money.nullable().optional(),
  maxChildren: z.coerce.number().int().min(1).max(50).optional(),
  features: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  badge: z.string().trim().max(40).optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
  status: z.enum(["active", "archived"]).default("active"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
}).superRefine((data, ctx) => {
  if (data.allowExtraChildren) {
    if (data.extraChildAmount == null) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["extraChildAmount"], message: "Set the price per extra child" });
    if (data.maxChildren != null && data.maxChildren <= data.childrenIncluded) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxChildren"], message: "Maximum children must be more than the children included" });
  }
});

// "YYYY-MM" — the month an invoice covers.
const invoiceSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month (YYYY-MM)"),
  dueDate: isoDate.optional().or(z.literal("")),
});

module.exports = { householdSchema, enrollmentSchema, newLearnerEnrollmentSchema, invoiceSchema, packageSchema };
