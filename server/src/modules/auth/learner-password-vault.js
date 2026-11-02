const crypto = require("crypto");
const db = require("../../config/db");
const { JWT_SECRET, PASSWORD_VAULT_KEY } = require("../../config/env");

// A child's own login password, kept so staff can tell it to a child who forgot it (learner page →
// Login → Show). Passwords are otherwise only ever stored as a one-way hash; this keeps a second,
// reversible copy for children's username logins ONLY — never a parent's, staff's or admin's.
// Encrypted with AES-256-GCM under PASSWORD_VAULT_KEY (any long random string), else a key derived
// from JWT_SECRET; changing that key makes the kept passwords unreadable (they show as "not
// available" until set again) and never stops anyone signing in. Kept in learner_login_secrets.
const TABLE = "learner_login_secrets";
const key = () => crypto.createHash("sha256").update(String(PASSWORD_VAULT_KEY || `${JWT_SECRET}:learner-password-vault`)).digest();

function seal(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

function open(sealed) {
  try {
    const [version, iv, tag, body] = String(sealed).split(":");
    if (version !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null; // a different key, or a damaged row — shown as not available
  }
}

// A child's login is a learner-role login signed in with a username (no email).
const isChildLogin = (user) => Boolean(user && user.role === "learner" && user.username && !user.email);

const LearnerPasswordVault = {
  isChildLogin,

  // Called wherever a password is set; keeps it only for a child's login, and drops any copy
  // otherwise (a login that stopped being a child's). Never fails the password change itself.
  async remember(user, plain) {
    try {
      if (!user?.id) return;
      if (!isChildLogin(user) || !plain) {
        await db(TABLE).where({ userId: user.id }).del();
        return;
      }
      const row = { sealed: seal(plain), updatedAt: new Date() };
      const updated = await db(TABLE).where({ userId: user.id }).update(row);
      if (!updated) await db(TABLE).insert({ userId: user.id, ...row });
    } catch (err) {
      console.error("[learner-password-vault] could not keep the password:", err.message);
    }
  },

  async forget(userId) {
    if (userId) await db(TABLE).where({ userId }).del().catch(() => {});
  },

  // { password, setAt } — password null when none is kept (set before this existed, or unreadable).
  async reveal(userId) {
    const row = userId ? await db(TABLE).where({ userId }).first() : null;
    return { password: row ? open(row.sealed) : null, setAt: row?.updatedAt || null };
  },
};

module.exports = LearnerPasswordVault;
