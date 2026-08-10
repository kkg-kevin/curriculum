require("dotenv").config();

const app = require("./app");
const db = require("./config/db");
const UserModel = require("./modules/auth/user.model");
const AuthService = require("./modules/auth/auth.service");

const PORT = process.env.PORT || 5000;

// Creates the first admin login from ADMIN_EMAIL/ADMIN_PASSWORD if it doesn't exist yet —
// the boot-time equivalent of scripts/seedAdmin.js, so a freshly-migrated environment (e.g.
// live, right after its database is created) gets a working login without a manual step.
async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin bootstrap.");
    return;
  }
  if (await UserModel.findByEmail(email)) return;
  await AuthService.createUser({ name: process.env.ADMIN_NAME || "Admin User", email, password, role: "admin" });
  console.log(`Admin user created: ${email}`);
}

// Runs schema migrations before accepting any requests, so every environment (local or a
// fresh live deploy) self-syncs its schema on startup instead of needing a manual
// `npm run db:migrate` step. Idempotent — a no-op when nothing's pending.
async function bootstrap() {
  const [, applied] = await db.migrate.latest();
  if (applied.length) console.log(`Applied ${applied.length} migration(s): ${applied.join(", ")}`);
  await ensureAdmin();
}

bootstrap()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });