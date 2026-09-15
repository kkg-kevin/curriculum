const { z } = require("zod");

// One logged learner-at-one-space-on-one-day visit at a non-school hub. hours is required only
// when the resolved space's pricingModel is "hourly" - the service checks that (it depends on
// hub state this schema can't see), so it stays optional/nullable here.
const logVisitSchema = z.object({
  hubId:     z.string().min(1, "Learning hub is required"),
  learnerId: z.string().min(1, "Learner is required"),
  spaceId:   z.string().min(1, "Space is required"),
  visitDate: z.string().min(1, "Visit date is required"),
  hours:     z.coerce.number().positive("Hours must be greater than 0").optional().nullable(),
  notes:     z.string().max(500).optional().default(""),
});

// billingStatus here only ever moves unbilled <-> waived by hand - flipping to/from "invoiced"
// is exclusively generateCharges' job (and the service blocks any other edit to an already-
// invoiced visit, notes aside), so that value isn't offered here.
const updateVisitSchema = z.object({
  hours:         z.coerce.number().positive("Hours must be greater than 0").optional().nullable(),
  notes:         z.string().max(500).optional(),
  billingStatus: z.enum(["unbilled", "waived"]).optional(),
});

const generateChargesPreviewSchema = z.object({
  hubId: z.string().min(1, "Learning hub is required"),
  from:  z.string().min(1, "Start date is required"),
  to:    z.string().min(1, "End date is required"),
});

const generateChargesSchema = generateChargesPreviewSchema.extend({
  dueAt:       z.string().optional().nullable(),
  periodLabel: z.string().max(100).optional().nullable(),
});

module.exports = { logVisitSchema, updateVisitSchema, generateChargesPreviewSchema, generateChargesSchema };
