const crypto = require("crypto");
const db = require("../../../config/db");
const { config, baseUrlFor, callbackBaseFrom } = require("./mpesa.config");
const { decrypt } = require("./mpesa.secrets");

// Which Paybill a workspace's money goes into. A workspace that saved its own in Settings →
// Payments (mpesa_accounts) uses that one; every other workspace uses the installation's (.env).
// Each prompt and payment records the account it belongs to (accountId — null for the
// installation's), so it's always checked and matched against the right Paybill, even after a
// workspace changes accounts.

const TABLE = "mpesa_accounts";
const CACHE_MS = 30 * 1000;
const cache = new Map();

function remember(key, load) {
  const hit = cache.get(key);
  if (hit && hit.at > Date.now() - CACHE_MS) return hit.value;
  const value = load().catch((err) => { cache.delete(key); throw err; });
  cache.set(key, { at: Date.now(), value });
  return value;
}

function forget() {
  cache.clear();
}

// A saved row → the same shape readConfig() gives the installation's account.
function toAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    ownerAdminId: row.ownerAdminId,
    enabled: Boolean(row.enabled),
    environment: row.environment === "production" ? "production" : "sandbox",
    baseUrl: baseUrlFor(row.environment),
    consumerKey: decrypt(row.consumerKey) || "",
    consumerSecret: decrypt(row.consumerSecret) || "",
    shortcode: String(row.shortcode || "").trim(),
    passkey: decrypt(row.passkey) || "",
    callbackToken: row.callbackToken,
    callbackBase: callbackBaseFrom(),
    accountLabel: row.accountLabel || config.accountLabel,
    defaultOwnerAdminId: row.ownerAdminId,
    maxAmount: config.maxAmount,
    initiatorName: row.initiatorName || "",
    securityCredential: decrypt(row.securityCredential) || "",
    b2c: {
      shortcode: String(row.b2cShortcode || "").trim(),
      consumerKey: decrypt(row.b2cConsumerKey) || "",
      consumerSecret: decrypt(row.b2cConsumerSecret) || "",
      initiatorName: row.b2cInitiatorName || "",
      securityCredential: decrypt(row.b2cSecurityCredential) || "",
    },
  };
}

// What's stored in accountId for this account: null for the installation's.
function idOf(account) {
  return !account || account.id === "env" ? null : account.id;
}

function sameAccount(a, b) {
  return (a || null) === (b || null);
}

const MpesaAccounts = {
  installation: () => config,
  idOf,
  sameAccount,
  forget,

  findRow(ownerAdminId) {
    return ownerAdminId ? db(TABLE).where({ ownerAdminId }).first() : null;
  },

  // The account a workspace's invoices are paid into.
  forOwner(ownerAdminId) {
    if (!ownerAdminId) return Promise.resolve(config);
    return remember(`owner:${ownerAdminId}`, async () => {
      const row = await db(TABLE).where({ ownerAdminId, enabled: true }).first();
      return row ? toAccount(row) : config;
    });
  },

  // The account a prompt or payment was recorded against.
  byId(accountId) {
    if (!accountId || accountId === "env") return Promise.resolve(config);
    return remember(`id:${accountId}`, async () => toAccount(await db(TABLE).where({ id: accountId }).first()));
  },

  // Whose callback this is — the token in the URL. Null when it's nobody's.
  async byCallbackToken(token) {
    const given = Buffer.from(String(token || ""));
    if (given.length < 24) return null;
    const own = Buffer.from(config.callbackToken || "");
    if (own.length === given.length && crypto.timingSafeEqual(own, given)) return config;
    return toAccount(await db(TABLE).where({ callbackToken: String(token) }).first());
  },

  // Every account with prompts to check — for the reconcile job.
  async all() {
    return [config, ...(await db(TABLE).select()).map(toAccount)];
  },
};

module.exports = MpesaAccounts;
module.exports._internal = { toAccount };
