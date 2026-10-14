const db = require("../../config/db");

// An organisation is a set of admins who share one pool of content (see the
// 20261013110000_add_organisation_to_users.js migration). Its key is what every `ownerAdminId`
// column holds: `users.organisationId` for an admin who has joined one, else the admin's own id
// (an admin on their own is an organisation of one).

// The key an admin account works under.
function organisationIdOf(user) {
  return user?.organisationId || user?.id || null;
}

// Every admin of the organisation with this key. Empty when `organisationId` isn't an
// organisation's key at all (an educator's or learner's user id, say). Cached briefly — it is
// asked each time something is addressed to "the admin".
const cache = new Map();
const CACHE_MS = 60 * 1000;

async function adminIdsOf(organisationId) {
  if (!organisationId) return [];
  const hit = cache.get(organisationId);
  if (hit && hit.at > Date.now() - CACHE_MS) return hit.ids;
  const ids = await db("users")
    .where({ role: "admin" })
    .andWhere((q) => q.where({ id: organisationId }).orWhere({ organisationId }))
    .pluck("id");
  cache.set(organisationId, { ids, at: Date.now() });
  return ids;
}

function forgetAdmins(organisationId) {
  if (organisationId) cache.delete(organisationId);
  else cache.clear();
}

module.exports = { organisationIdOf, adminIdsOf, forgetAdmins };
