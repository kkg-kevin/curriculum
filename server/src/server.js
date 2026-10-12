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

// A promise that failed with nothing waiting on it (a fire-and-forget email or log write). Node
// would otherwise end the whole process — and every request in progress with it — over one
// background task. Logged instead, so it can be found and fixed.
process.on("unhandledRejection", (reason) => {
  console.error("[ERROR] Unhandled promise rejection:", reason);
});

bootstrap()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // Asked to stop (a Restart from the hosting panel, a deploy): stop taking new requests, let
    // the ones in progress finish, close the database connections, then go. Anything still
    // running after 10 seconds is cut off so a stuck request can't block the restart.
    let stopping = false;
    const shutdown = (signal) => {
      if (stopping) return;
      stopping = true;
      console.log(`${signal} received — shutting down.`);
      const force = setTimeout(() => process.exit(1), 10000);
      force.unref();
      server.close(() => {
        db.destroy().finally(() => process.exit(0));
      });
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((err) => {
    console.error("Startup failed:", err);
    process.exit(1);
  });