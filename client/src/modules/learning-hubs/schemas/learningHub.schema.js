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

// "school" is the original, fully-built hub type. The other 3 are places a curriculum can
// also be assigned to — differentiated required fields/behavior per type is deferred, so they
// all share this one form/schema for now.
export const LEARNING_HUB_TYPES = [
  { value: "school",           label: "School" },
  { value: "co_working_space", label: "Co-working Space" },
  { value: "innovation_lab",   label: "Innovation Lab" },
  { value: "makerspace",       label: "Makerspace" },
];

export const AMENITY_OPTIONS = [
  { value: "wifi",             label: "WiFi",             icon: "wifi" },
  { value: "charging_ports",   label: "Charging Ports",   icon: "power" },
  { value: "desks",            label: "Desks",            icon: "eventSeat" },
  { value: "chairs",           label: "Chairs",           icon: "chair" },
  { value: "whiteboard",       label: "Whiteboard",       icon: "borderColor" },
  { value: "projector",        label: "Projector",        icon: "videocam" },
  { value: "parking",          label: "Parking",          icon: "localParking" },
  { value: "washrooms",        label: "Washrooms",        icon: "wc" },
  { value: "food_available",   label: "Food Available",   icon: "restaurant" },
  { value: "coffee_available", label: "Coffee Available", icon: "coffee" },
  { value: "private_rooms",    label: "Private Rooms",    icon: "meetingRoom" },
  { value: "outdoor_seating",  label: "Outdoor Seating",  icon: "park" },
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
// flow anywhere in the app yet; this just records what a learning hub offers and at what price
// so that feature can be built against real data later.
const spaceSchema = z.object({
  name: z.string().min(1, "Space name is required").max(100),
  spaceType: z.string().max(50).default("desk"),
  building: z.string().min(1, "Building is required").max(100),
  floor: z.string().min(1, "Floor is required").max(50),
  room: z.string().max(50).default(""),
  minCapacity: z.coerce.number().int().positive("Must be at least 1").default(1),
  maxCapacity: z.coerce.number().int().positive("Must be at least 1").default(1),
  pricingModel: z.enum(["hourly", "daily", "fixed", "free"]).default("hourly"),
  rate: z.coerce.number().nonnegative("Must be 0 or more").default(0),
  priceUnit: z.string().max(30).default("per hour"),
  reservable: z.boolean().default(true),
  notes: z.string().max(500).default(""),
});

// Code stays required only for hubType "school" — this is what keeps the school-creation
// flow behaving exactly as it did before Learning Hub absorbed School, without forcing every
// other hub type to carry a code too.
export const learningHubSchema = z
  .object({
    name: z.string().min(1, "Learning hub name is required").max(150, "Max 150 characters"),
    hubType: z.enum(LEARNING_HUB_TYPES.map((t) => t.value), { errorMap: () => ({ message: "Select a valid learning hub type" }) }).default("school"),
    code: z
      .string()
      .max(20, "Max 20 characters")
      .regex(/^[A-Z0-9-]*$/i, "Only letters, numbers, and hyphens")
      .default(""),
    email: z.string().email("Invalid email address").or(z.literal("")).default(""),
    // Transient — never stored on the learning hub record itself. When present, it creates or
    // resets the matching school-portal login for this hub's email (see useLearningHub.js/learningHubApi).
    password: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")).default(""),
    phone: z.string().max(20, "Max 20 characters").default(""),
    contactPerson: z.string().max(150).default(""),
    address: addressSchema,
    mapLink: z.string().url("Enter a valid URL").or(z.literal("")).default(""),
    curriculumId: z.string().or(z.literal("")).nullable().default(""),
    // New hubs start as "draft" — invisible everywhere outside Settings until promoted to
    // "active", at which point they appear in the Learning Hubs module and every other consumer.
    status: z.enum(["draft", "active", "inactive"]).default("draft"),
    description: z.string().max(1000, "Max 1000 characters").default(""),
    photos: z.array(z.string()).default([]),
    amenities: z.array(z.string()).default([]),
    operatingHours: operatingHoursSchema.default({}),
    spaces: z.array(spaceSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.hubType === "school" && !data.code) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["code"], message: "School code is required" });
    }
    if (data.password) {
      if (!data.email) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Email is required to set a password" });
      }
      if (data.hubType !== "school") {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "Password can only be set for the School type" });
      }
    }
  });

// What a school-type learning hub account can edit about its own record — code/hubType/
// curriculumId/status stay platform-admin-only governance fields (see
// school-portal/pages/ProfilePage.jsx).
export const learningHubProfileSchema = z.object({
  name: z.string().min(1, "Learning hub name is required").max(150, "Max 150 characters"),
  email: z.string().email("Invalid email address").or(z.literal("")).default(""),
  phone: z.string().max(20, "Max 20 characters").default(""),
  address: addressSchema,
});

// Derives a short uppercase code from a name's word initials (or the first few letters of a
// single word), then disambiguates against codes already in use by appending "-2", "-3", etc.
export function generateHubCode(name, existingCodes = []) {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const base = (
    words.length === 1 ? words[0].slice(0, 3) : words.map((w) => w[0]).join("").slice(0, 4)
  ).toUpperCase();

  const taken = new Set(existingCodes.filter(Boolean).map((c) => c.toUpperCase()));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
