const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../../config/db");
const UserModel = require("./user.model");
const passwords = require("../../shared/utils/password");
const { JWT_SECRET } = require("../../config/env");
const { OWN_ONLY_ROLES } = require("./account-roles");

// A parent who has proved their password once on the website doesn't type it again in the same
// visit: a website sign-up (bootcamp enrolment) hands back a short-lived "parent token" for the
// login it used or made, and so does "Already have a Digifunzi account? Sign in"
// (POST /api/public/parent-sign-in). The next sign-up sends the token instead of the password —
// "Enrol another child" — and parentLoginFor (parent-login.js) takes it as the proof.
//
// Signed with its own key derived from JWT_SECRET, so it can never pass for a portal session (the
// session middleware verifies with JWT_SECRET itself), and it lasts two hours.
const PURPOSE = "parent-signup";
const LIFETIME = "2h";
const SECRET = () => crypto.createHmac("sha256", String(JWT_SECRET)).update(PURPOSE).digest("hex");
const lower = (v) => String(v || "").trim().toLowerCase();

function expired() {
  const err = new Error("Your sign-in has run out — enter your password again.");
  err.statusCode = 401;
  err.code = "PARENT_TOKEN_EXPIRED";
  return err;
}

function issueParentToken(user) {
  return jwt.sign({ purpose: PURPOSE, email: lower(user.email) }, SECRET(), { subject: String(user.id), expiresIn: LIFETIME });
}

// The login a token stands for — refused once it has run out, if it's for another email than
// the form's, or if the login has gone or been switched off since.
async function userFromParentToken(token, email = null) {
  let payload;
  try {
    payload = jwt.verify(token, SECRET());
  } catch {
    throw expired();
  }
  if (payload.purpose !== PURPOSE || (email && lower(email) !== payload.email)) throw expired();
  const user = await UserModel.findById(payload.sub);
  if (!user || lower(user.email) !== payload.email || user.deactivatedAt) throw expired();
  return user;
}

// "Already have a Digifunzi account? Sign in" on a website sign-up: the email + password checked
// like a portal sign-in, then a token and the details to fill the form with. Staff-only logins
// (admins, curriculum admins) are never a family's — parentLoginFor's linking refuses them too.
async function signInParent(email, password) {
  const user = await UserModel.findByEmail(email);
  const ok = user && user.passwordHash && !user.deactivatedAt && (await passwords.compare(password, user.passwordHash));
  if (!ok) {
    const err = new Error("That email and password don't match a Digifunzi account.");
    err.statusCode = 401;
    throw err;
  }
  if (OWN_ONLY_ROLES.includes(user.role)) {
    const err = new Error("This is a staff account — use a different email for your family's account.");
    err.statusCode = 409;
    throw err;
  }
  // The phone to pre-fill: the login's own, else the one on their children's records.
  const child = user.phone ? null : await db("learners").whereRaw("LOWER(guardianEmail) = ?", [lower(user.email)]).whereNotNull("guardianPhone").orderBy("createdAt", "desc").first("guardianPhone");
  return {
    token: issueParentToken(user),
    parent: { name: user.name || "", email: user.email, phone: user.phone || child?.guardianPhone || "" },
  };
}

module.exports = { issueParentToken, userFromParentToken, signInParent };
