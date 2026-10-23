const UserModel = require("./user.model");
const passwords = require("../../shared/utils/password");
const { releaseIfLeftover } = require("./leftover-login");

// The parent's login for a website sign-up or order, checked before anything is written: none yet
// (null — the caller creates one), or the existing login under that email — whose password must
// match, so nobody can attach a child to someone else's account by typing their email. A login
// nothing points at any more (leftover-login.js) gives its email up. Used by bootcamp enrolments
// and Store orders with projects.
async function parentLoginFor(email, password) {
  let existing = await UserModel.findByEmail(email);
  if (existing && (await releaseIfLeftover(existing))) existing = null;
  if (!existing) return null;
  if (!(await passwords.compare(password, existing.passwordHash))) {
    const err = new Error("This email already has a Digifunzi account. Enter that account's password, or use a different email.");
    err.statusCode = 409;
    err.code = "PARENT_PASSWORD_MISMATCH";
    throw err;
  }
  return existing;
}

module.exports = { parentLoginFor };
