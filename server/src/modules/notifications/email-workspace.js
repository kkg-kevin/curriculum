// Workspace-level email switches: an admin decides which emails their workspace sends at all
// (Settings → Emails). Checked before each person's own preference — see notification.emails.js
// and billing.emails.js.
const crypto = require("crypto");
const UserModel = require("../auth/user.model");
const LearnerModel = require("../learners/learner.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const EmailSettingsModel = require("./email-settings.model");
const { JWT_SECRET } = require("../../config/env");

// The automatic billing emails an admin can switch off. Emailed notifications are listed in
// notification.emails.js's EMAIL_TYPES. Password emails are never listed: they always send.
const BILLING_EMAIL_TYPES = {
  invoice_issued: { label: "An invoice is issued", group: "Parents and hubs you bill" },
  payment_receipt: { label: "A payment is recorded (receipt)", group: "Parents and hubs you bill" },
};

async function adminOfHub(hubId) {
  if (!hubId) return null;
  return (await LearningHubModel.findById(hubId))?.ownerAdminId || null;
}

async function adminOfLearner(learner) {
  if (!learner) return null;
  const links = await LearnerHubLinkModel.findByLearnerId(learner.id);
  const link = links.find((l) => l.status === "active") || links[0];
  return adminOfHub(link?.hubId);
}

// The workspace (admin id) an email to `user` belongs to, or null when it can't be told — in
// which case nothing is held back. `learnerId` is the child a learner notification is about: a
// parent can have children in more than one workspace.
async function workspaceOf(user, { learnerId } = {}) {
  if (!user) return null;
  if (user.role === "admin") return user.id;
  if (user.invitedByAdminId) return user.invitedByAdminId; // staff and supervisors
  if (user.role === "learner") {
    if (learnerId) return adminOfLearner(await LearnerModel.findById(learnerId));
    if (user.username) return adminOfLearner(await LearnerModel.findByUsername(user.username));
    if (user.email) return adminOfLearner((await LearnerModel.findAll({ guardianEmail: user.email }))[0]);
  }
  return null;
}

async function workspaceAllows(ownerAdminId, type) {
  if (!ownerAdminId) return true;
  return !(await EmailSettingsModel.disabledTypes(ownerAdminId)).includes(type);
}

// The link in an email's footer that opens that person's email preferences without signing in.
// It is not a sign-in token: it is an HMAC of the user id, good for that one page only.
const sign = (userId) => crypto.createHmac("sha256", JWT_SECRET).update(`email-preferences:${userId}`).digest("base64url");
const preferencesToken = (userId) => `${userId}.${sign(userId)}`;

// The user a preferences token belongs to, or null if it isn't one we issued.
async function userForPreferencesToken(token) {
  const [userId, signature] = String(token || "").split(".");
  if (!userId || !signature) return null;
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  return UserModel.findById(userId);
}

module.exports = { BILLING_EMAIL_TYPES, adminOfHub, workspaceOf, workspaceAllows, preferencesToken, userForPreferencesToken };
