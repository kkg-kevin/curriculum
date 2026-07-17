const { z } = require("zod");

const KENYA_COUNTIES = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa",
  "Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi",
  "Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos",
  "Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Muranga","Nairobi",
  "Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya",
  "Taita-Taveta","Tana River","Tharaka-Nithi","Trans Nzoia","Turkana",
  "Uasin Gishu","Vihiga","Wajir","West Pokot",
];

// "school" is the original, fully-built location type (its own required Code, login-matching
// via email). The other 9 are places a curriculum can also be assigned to — differentiated
// required fields/behavior per type is deferred; for now they all share this one schema.
const LOCATION_TYPES = [
  "school", "campus", "branch", "learning_space", "classroom",
  "room", "hall", "lab", "library", "training_room",
];

const addressSchema = z.object({
  street: z.string().max(200).default(""),
  city: z.string().max(100).default(""),
  county: z.string().refine((v) => KENYA_COUNTIES.includes(v), {
    message: "Please select a valid county",
  }),
});

const operatingHoursSchema = z.object({
  opensAt: z.string().max(10).default(""),
  closesAt: z.string().max(10).default(""),
  days: z.array(z.string()).default([]),
});

// Bookable seating/space configuration — data capture only. There is no reservation/booking
// flow anywhere in the app yet; this just records what a location offers and at what price so
// that feature can be built against real data later.
const spaceSchema = z.object({
  name: z.string().min(1, "Space name is required").max(100),
  spaceType: z.string().max(50).default("desk"),
  minCapacity: z.coerce.number().int().positive().default(1),
  maxCapacity: z.coerce.number().int().positive().default(1),
  pricingModel: z.enum(["hourly", "daily", "fixed", "free"]).default("hourly"),
  rate: z.coerce.number().nonnegative().default(0),
  priceUnit: z.string().max(30).default("per hour"),
  reservable: z.boolean().default(true),
  notes: z.string().max(500).default(""),
});

const baseLocationSchema = z.object({
  name: z.string().min(1, "Location name is required").max(150, "Max 150 characters"),
  locationType: z.enum(LOCATION_TYPES, { errorMap: () => ({ message: "Select a valid location type" }) }).default("school"),
  code: z
    .string()
    .max(20, "Max 20 characters")
    .regex(/^[A-Z0-9-]*$/i, "Only letters, numbers, and hyphens")
    .default(""),
  email: z.string().email("Invalid email address").or(z.literal("")).default(""),
  phone: z.string().max(20, "Max 20 characters").default(""),
  contactPerson: z.string().max(150).default(""),
  address: addressSchema,
  curriculumId: z.string().or(z.literal("")).nullable().default(null),
  status: z.enum(["active", "inactive"]).default("active"),
  description: z.string().max(1000, "Max 1000 characters").default(""),
  photos: z.array(z.string()).default([]),
  amenities: z.array(z.string()).default([]),
  operatingHours: operatingHoursSchema.default({}),
  spaces: z.array(spaceSchema).default([]),
});

// Code stays required only for locationType "school" — this is what keeps the school-creation
// flow behaving exactly as it did before the merge, without forcing every other location type
// to carry a code too.
const createLocationSchema = baseLocationSchema.superRefine((data, ctx) => {
  if (data.locationType === "school" && !data.code) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["code"], message: "School code is required" });
  }
});

const updateLocationSchema = baseLocationSchema.partial().extend({
  address: addressSchema.partial().optional(),
  operatingHours: operatingHoursSchema.partial().optional(),
});

module.exports = { createLocationSchema, updateLocationSchema, LOCATION_TYPES, KENYA_COUNTIES };
