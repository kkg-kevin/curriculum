const { z } = require("zod");

const ORDER_STATUSES = ["awaiting_payment", "paid", "preparing", "ready_for_pickup", "dispatched", "completed", "cancelled"];

const phone = z.string().trim().min(9, "Enter a phone number we can reach you on").max(30)
  .regex(/^[+\d][\d\s()-]{6,28}$/, "Enter a valid phone number, e.g. 0712 345 678");

// One cart line: a Store item (with a quantity) or a Project (always one, for the child named on
// the order), optionally with the project's materials kit. Prices are never taken from here — the
// server reads them from the item or project itself.
const lineSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("store_item"), id: z.string().trim().min(1).max(60), quantity: z.coerce.number().int().min(1, "At least 1").max(20, "At most 20 of one item") }),
  z.object({ type: z.literal("project"), id: z.string().trim().min(1).max(60), withKit: z.boolean().optional().default(false) }),
]);

// The child who gets the order's projects: a new one (their own login is made now) or one who
// already has a login under this parent's email.
const childSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("new"),
    name: z.string().trim().min(2, "Enter the child's name").max(150),
    age: z.coerce.number().int().min(3, "Age must be between 3 and 19").max(19, "Age must be between 3 and 19"),
    username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username must be at most 30 characters")
      .regex(/^[a-zA-Z0-9._-]+$/, "Only letters, numbers, dots, underscores, and hyphens are allowed"),
    password: z.string().min(6, "The child's password must be at least 6 characters").max(72),
  }),
  z.object({
    mode: z.literal("existing"),
    username: z.string().trim().min(3, "Enter your child's username").max(30),
  }),
]);

// POST /api/public/orders — a checkout from the website cart.
const placeOrderSchema = z.object({
  lines: z.array(lineSchema).min(1, "Your cart is empty").max(30, "That's too many lines for one order"),
  customer: z.object({
    name: z.string().trim().min(2, "Enter your name").max(150),
    email: z.string().trim().email("Enter a valid email address").max(160),
    phone,
  }),
  fulfilment: z.object({
    method: z.enum(["pickup", "delivery", "none"]),
    hubId: z.string().trim().max(60).optional().nullable(),
    address: z.string().trim().max(300).optional().nullable(),
    town: z.string().trim().max(100).optional().nullable(),
    county: z.string().trim().max(100).optional().nullable(),
    note: z.string().trim().max(500).optional().nullable(),
  }),
  // Only when the cart has projects: the parent's own login and the child who gets them.
  parentPassword: z.string().min(6, "Your password must be at least 6 characters").max(72).optional().nullable(),
  child: childSchema.optional().nullable(),
  consent: z.literal(true, { message: "Please agree before placing your order" }),
  hp_field: z.string().optional(),
});

const listQuerySchema = z.object({
  status: z.enum([...ORDER_STATUSES, "open", "all"]).optional().default("open"),
});

// Staff moving an order along (Billing → Orders).
const statusSchema = z.object({
  status: z.enum(["preparing", "ready_for_pickup", "dispatched", "completed", "cancelled"]),
  note: z.string().trim().max(500).optional().nullable(),
});

module.exports = { ORDER_STATUSES, placeOrderSchema, listQuerySchema, statusSchema };
