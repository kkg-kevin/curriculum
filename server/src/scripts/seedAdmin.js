// One-off bootstrap: creates the first admin account from server/.env so there's a way to
// log in before any "create user" UI exists. Safe to re-run — skips if that email exists.
require("dotenv").config();

const UserModel = require("../modules/auth/user.model");
const AuthService = require("../modules/auth/auth.service");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Admin User";

  if (!email || !password) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env before seeding.");
    process.exitCode = 1;
    return;
  }

  if (UserModel.findByEmail(email)) {
    console.log(`Admin user already exists for ${email} — nothing to do.`);
    return;
  }

  await AuthService.createUser({ name, email, password, role: "admin" });
  console.log(`Admin user created: ${email}`);
}

seedAdmin();
