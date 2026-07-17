import { z } from "zod";

export const KENYA_COUNTIES = [
  "Baringo","Bomet","Bungoma","Busia","Elgeyo-Marakwet","Embu","Garissa",
  "Homa Bay","Isiolo","Kajiado","Kakamega","Kericho","Kiambu","Kilifi",
  "Kirinyaga","Kisii","Kisumu","Kitui","Kwale","Laikipia","Lamu","Machakos",
  "Makueni","Mandera","Marsabit","Meru","Migori","Mombasa","Muranga","Nairobi",
  "Nakuru","Nandi","Narok","Nyamira","Nyandarua","Nyeri","Samburu","Siaya",
  "Taita-Taveta","Tana River","Tharaka-Nithi","Trans Nzoia","Turkana",
  "Uasin Gishu","Vihiga","Wajir","West Pokot",
];

// "school" is the original, fully-built location type. The other 9 are places a curriculum can
// also be assigned to — differentiated required fields/behavior per type is deferred, so they
// all share this one form/schema for now.
export const LOCATION_TYPES = [
  { value: "school",         label: "School" },
  { value: "campus",         label: "Campus" },
  { value: "branch",         label: "Branch" },
  { value: "learning_space", label: "Learning Space" },
  { value: "classroom",      label: "Classroom" },
  { value: "room",           label: "Room" },
  { value: "hall",           label: "Hall" },
  { value: "lab",            label: "Lab" },
  { value: "library",        label: "Library" },
  { value: "training_room",  label: "Training Room" },
];

export const AMENITY_OPTIONS = [
  { value: "wifi",             label: "WiFi",             icon: "📶" },
  { value: "charging_ports",   label: "Charging Ports",   icon: "🔌" },
  { value: "desks",            label: "Desks",            icon: "🪑" },
  { value: "chairs",           label: "Chairs",           icon: "💺" },
  { value: "whiteboard",       label: "Whiteboard",       icon: "🖊️" },
  { value: "projector",        label: "Projector",        icon: "📽️" },
  { value: "parking",          label: "Parking",          icon: "🚗" },
  { value: "washrooms",        label: "Washrooms",        icon: "🚻" },
  { value: "food_available",   label: "Food Available",   icon: "🍽️" },
  { value: "coffee_available", label: "Coffee Available", icon: "☕" },
  { value: "private_rooms",    label: "Private Rooms",    icon: "🚪" },
  { value: "outdoor_seating",  label: "Outdoor Seating",  icon: "🌳" },
];

export const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const SPACE_TYPES = [
  { value: "desk",   label: "Desk" },
  { value: "table",  label: "Table" },
  { value: "room",   label: "Room" },
  { value: "booth",  label: "Booth" },
  { value: "hall",   label: "Hall" },
  { value: "studio", label: "Studio" },
  { value: "other",  label: "Other" },
];

export const PRICING_MODELS = [
  { value: "hourly", label: "Hourly" },
  { value: "daily",  label: "Daily" },
  { value: "fixed",  label: "Fixed" },
  { value: "free",   label: "Free" },
];

const addressSchema = z.object({
  street: z.string().max(200).default(""),
  city: z.string().max(100).default(""),
  county: z.string().min(1, "County is required").refine(
    (v) => KENYA_COUNTIES.includes(v),
    { message: "Select a valid Kenyan county" }
  ),
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
  minCapacity: z.coerce.number().int().positive("Must be at least 1").default(1),
  maxCapacity: z.coerce.number().int().positive("Must be at least 1").default(1),
  pricingModel: z.enum(["hourly", "daily", "fixed", "free"]).default("hourly"),
  rate: z.coerce.number().nonnegative("Must be 0 or more").default(0),
  priceUnit: z.string().max(30).default("per hour"),
  reservable: z.boolean().default(true),
  notes: z.string().max(500).default(""),
});

// Code stays required only for locationType "school" — this is what keeps the school-creation
// flow behaving exactly as it did before Location absorbed School, without forcing every other
// location type to carry a code too.
export const locationSchema = z
  .object({
    name: z.string().min(1, "Location name is required").max(150, "Max 150 characters"),
    locationType: z.enum(LOCATION_TYPES.map((t) => t.value), { errorMap: () => ({ message: "Select a valid location type" }) }).default("school"),
    code: z
      .string()
      .max(20, "Max 20 characters")
      .regex(/^[A-Z0-9-]*$/i, "Only letters, numbers, and hyphens")
      .default(""),
    email: z.string().email("Invalid email address").or(z.literal("")).default(""),
    phone: z.string().max(20, "Max 20 characters").default(""),
    contactPerson: z.string().max(150).default(""),
    address: addressSchema,
    curriculumId: z.string().or(z.literal("")).nullable().default(""),
    status: z.enum(["active", "inactive"]).default("active"),
    description: z.string().max(1000, "Max 1000 characters").default(""),
    photos: z.array(z.string()).default([]),
    amenities: z.array(z.string()).default([]),
    operatingHours: operatingHoursSchema.default({}),
    spaces: z.array(spaceSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.locationType === "school" && !data.code) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["code"], message: "School code is required" });
    }
  });

// What a school-type location account can edit about its own record — code/locationType/
// curriculumId/status stay platform-admin-only governance fields (see
// school-portal/pages/ProfilePage.jsx).
export const locationProfileSchema = z.object({
  name: z.string().min(1, "Location name is required").max(150, "Max 150 characters"),
  email: z.string().email("Invalid email address").or(z.literal("")).default(""),
  phone: z.string().max(20, "Max 20 characters").default(""),
  address: addressSchema,
});
