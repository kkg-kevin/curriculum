const crypto = require("crypto");
const UserModel = require("../../modules/auth/user.model");

const DOMAIN = "digifunzi.com";

function slugPart(value) {
  return (value || "").toLowerCase().replace(/[^a-z]/g, "");
}

// firstname.lastname@digifunzi.com, appending 2/3/... on collision against an existing user.
// Used to mint the real login for a learner auto-provisioned from a public bootcamp enrollment
// (see the bootcamp-enrollment module) - this is the account's actual guardianEmail/login, not
// a display name.
async function generateDigifunziEmail(firstName, lastName) {
  const first = slugPart(firstName) || "learner";
  const last = slugPart(lastName);
  const base = last ? `${first}.${last}` : first;
  let candidate = `${base}@${DOMAIN}`;
  let suffix = 2;
  while (await UserModel.findByEmail(candidate)) {
    candidate = `${base}${suffix}@${DOMAIN}`;
    suffix += 1;
  }
  return candidate;
}

// A one-time temporary password shown to the visitor exactly once (see
// bootcamp-enrollment.service.js) - never logged, never persisted beyond its bcrypt hash. Kept
// simple (an 8-digit number, easy to read off a screen and retype on a phone keyboard) but still
// randomly generated per account - a fixed password shared by every new account would mean one
// leaked/guessed value logs into every read-only-until-paid account system-wide, not just one.
function generateTemporaryPassword() {
  return String(crypto.randomInt(0, 100000000)).padStart(8, "0");
}

module.exports = { generateDigifunziEmail, generateTemporaryPassword };
