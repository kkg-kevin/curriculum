const crypto = require("crypto");
const db = require("../../../config/db");
const MpesaAccounts = require("./mpesa.accounts");
const MpesaClient = require("./mpesa.client");
const { isConfigured, canQueryTransactions, canPayOut, callbackUrl, b2cOf } = require("./mpesa.config");
const { encrypt, canEncrypt } = require("./mpesa.secrets");

// Settings → Payments (owner only): a workspace's own Paybill. Saved, it takes over from the
// installation's Paybill for every invoice of this workspace — prompts, the Paybill number on
// invoices, Paybill payments and statement imports — and pays its educators' claims if a B2C
// shortcode is given. Secrets are write-only: the screen only learns whether each one is saved.

const TABLE = "mpesa_accounts";
const SECRETS = ["consumerKey", "consumerSecret", "passkey", "securityCredential", "b2cConsumerKey", "b2cConsumerSecret", "b2cSecurityCredential"];
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };

// The callback URLs with the secret token shortened — enough to recognise them.
function shownUrls(account) {
  const hide = (url) => url.replace(account.callbackToken, `${account.callbackToken.slice(0, 4)}…`);
  return { confirmation: hide(callbackUrl("confirm", account)), validation: hide(callbackUrl("validate", account)), prompts: hide(callbackUrl("stk", account)) };
}

function readiness(account) {
  return { prompts: isConfigured(account), checks: canQueryTransactions(account), payouts: canPayOut(account) };
}

async function view(ownerAdminId) {
  const row = await MpesaAccounts.findRow(ownerAdminId);
  const installation = MpesaAccounts.installation();
  const base = {
    canSaveSecrets: canEncrypt(),
    callbackBaseOk: /^https:\/\//.test(installation.callbackBase),
    installation: { enabled: isConfigured(installation), paybill: installation.shortcode || null, environment: installation.environment, ...readiness(installation) },
  };
  if (!row) return { ...base, account: null };
  const account = MpesaAccounts._internal.toAccount(row);
  const saved = Object.fromEntries(SECRETS.map((field) => [field, Boolean(row[field])]));
  // A secret that's saved but can't be read means MPESA_SECRETS_KEY changed or is missing.
  const decrypted = {
    consumerKey: account.consumerKey, consumerSecret: account.consumerSecret, passkey: account.passkey, securityCredential: account.securityCredential,
    b2cConsumerKey: account.b2c.consumerKey, b2cConsumerSecret: account.b2c.consumerSecret, b2cSecurityCredential: account.b2c.securityCredential,
  };
  const unreadable = SECRETS.filter((field) => row[field] && !decrypted[field]);
  return {
    ...base,
    account: {
      enabled: Boolean(row.enabled),
      environment: account.environment,
      shortcode: account.shortcode,
      accountLabel: row.accountLabel || "",
      initiatorName: row.initiatorName || "",
      b2cShortcode: row.b2cShortcode || "",
      b2cInitiatorName: row.b2cInitiatorName || "",
      saved,
      unreadable,
      ready: readiness(account),
      urls: shownUrls(account),
      c2bRegisteredAt: row.c2bRegisteredAt,
      updatedAt: row.updatedAt,
    },
  };
}

async function ownAccount(ownerAdminId) {
  const row = await MpesaAccounts.findRow(ownerAdminId);
  if (!row) fail("Save your Paybill's details first", 404);
  return MpesaAccounts._internal.toAccount(row);
}

const MpesaAccountSettings = {
  get(req) {
    return view(req.ownerAdminId);
  },

  async save(req, data) {
    const existing = await MpesaAccounts.findRow(req.ownerAdminId);
    const patch = {
      enabled: data.enabled,
      environment: data.environment,
      shortcode: data.shortcode,
      accountLabel: data.accountLabel || null,
      initiatorName: data.initiatorName || null,
      b2cShortcode: data.b2cShortcode || null,
      b2cInitiatorName: data.b2cInitiatorName || null,
      updatedBy: req.user.id,
      updatedAt: new Date(),
    };
    for (const field of SECRETS) {
      if (data[field] === null) patch[field] = null;
      else if (data[field]) patch[field] = encrypt(data[field]);
    }
    if (existing) {
      // A different Paybill must have its Paybill URLs registered again.
      if (existing.shortcode !== data.shortcode || existing.environment !== data.environment) Object.assign(patch, { c2bRegisteredAt: null, c2bRegisterResult: null });
      await db(TABLE).where({ id: existing.id }).update(patch);
    } else {
      await db(TABLE).insert({ ...patch, id: crypto.randomUUID(), ownerAdminId: req.ownerAdminId, callbackToken: crypto.randomBytes(24).toString("hex"), createdAt: new Date() });
    }
    MpesaAccounts.forget();
    const after = await view(req.ownerAdminId);
    if (after.account.enabled && !after.account.ready.prompts) {
      after.warning = "Saved, but M-Pesa won't work for your invoices until the consumer key, consumer secret and passkey are all in. Until then families can't pay by M-Pesa.";
    }
    return after;
  },

  // Stops using the workspace's own Paybill and forgets its keys. Payments already recorded stay.
  async remove(req) {
    await db(TABLE).where({ ownerAdminId: req.ownerAdminId }).del();
    MpesaAccounts.forget();
    return view(req.ownerAdminId);
  },

  // Can the saved keys get a token from Safaricom? The B2C app's too, when it has its own.
  async test(req) {
    const account = await ownAccount(req.ownerAdminId);
    const results = [];
    const tryKeys = async (label, keys) => {
      if (!keys.consumerKey || !keys.consumerSecret) return results.push({ label, ok: false, message: "Consumer key or secret missing" });
      try {
        await MpesaClient.testKeys({ ...account, consumerKey: keys.consumerKey, consumerSecret: keys.consumerSecret });
        results.push({ label, ok: true, message: "Safaricom accepted the keys" });
      } catch (err) {
        results.push({ label, ok: false, message: err.message });
      }
    };
    await tryKeys("Paybill app", account);
    if (account.b2c.consumerKey) await tryKeys("B2C app", b2cOf(account));
    return { results };
  },

  // Tells Safaricom where to send payments made straight to this Paybill. In production
  // Safaricom keeps the first URLs registered, so the screen asks for confirmation first.
  async registerUrls(req) {
    const account = await ownAccount(req.ownerAdminId);
    if (!isConfigured(account)) fail("Save the consumer key, consumer secret and passkey first", 409);
    let result;
    try {
      result = await MpesaClient.registerC2bUrls(account);
    } catch (err) {
      fail(`Safaricom didn't register the URLs: ${err.message}`, 409);
    }
    await db(TABLE).where({ id: account.id }).update({ c2bRegisteredAt: new Date(), c2bRegisterResult: JSON.stringify(result || null), updatedAt: new Date() });
    return { result, settings: await view(req.ownerAdminId) };
  },
};

module.exports = MpesaAccountSettings;
