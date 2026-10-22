const crypto = require("crypto");
const fs = require("fs");

// M-Pesa (Safaricom Daraja) settings. An "account" is one Paybill and everything needed to use it.
// The installation's account comes from .env (below); a workspace can also save its own in
// Settings → Payments (mpesa.accounts.js), which then takes over for that workspace's invoices.
// All optional: with nothing set, M-Pesa is simply off (no buttons, the callbacks answer 404),
// the same posture as email without SMTP.
//
//   MPESA_ENV=sandbox|production
//   MPESA_CONSUMER_KEY=, MPESA_CONSUMER_SECRET=   the Daraja app's keys
//   MPESA_SHORTCODE=                              the Paybill number
//   MPESA_PASSKEY=                                the Lipa na M-Pesa Online (M-Pesa Express) passkey
//   MPESA_CALLBACK_TOKEN=                         a long random string; part of the callback URLs
//   MPESA_CALLBACK_BASE_URL=                      optional — where Safaricom reaches this API
//                                                 (default API_PUBLIC_URL); a tunnel URL locally
//   MPESA_ACCOUNT_LABEL=                          optional — the name payers see, e.g. "Digifunzi"
//   MPESA_OWNER_ADMIN_ID=                         optional — whose workspace a Paybill payment that
//                                                 matches no invoice goes to (default
//                                                 PUBLIC_CONTENT_ADMIN_ID)
//   MPESA_MAX_AMOUNT=                             optional — largest single payment (default 250000)
//
// Checking and reversing transactions (optional) — the Paybill's API operator:
//   MPESA_INITIATOR_NAME=
//   MPESA_SECURITY_CREDENTIAL=                    the operator's password, encrypted (Daraja's
//                                                 simulator generates it), or instead:
//   MPESA_INITIATOR_PASSWORD= + MPESA_CERT_PATH=  the password and Safaricom's public certificate
//                                                 (sandbox or production), encrypted here
//
// Paying educators by M-Pesa (B2C, optional) — a disbursement shortcode. Each B2C_ value left
// empty uses the Paybill's:
//   MPESA_B2C_SHORTCODE=, MPESA_B2C_CONSUMER_KEY=, MPESA_B2C_CONSUMER_SECRET=,
//   MPESA_B2C_INITIATOR_NAME=, MPESA_B2C_SECURITY_CREDENTIAL= (or MPESA_B2C_INITIATOR_PASSWORD=)
//
// Callback hardening (optional):
//   MPESA_VERIFY_CALLBACKS=false                  don't ask Safaricom to confirm a "paid" prompt
//                                                 result before crediting it (default: confirm)
//   MPESA_CALLBACK_IPS=                           only accept callbacks from these addresses —
//                                                 comma-separated, or "safaricom" for Safaricom's
//                                                 published list. Needs TRUST_PROXY set right.
//   MPESA_SECRETS_KEY=                            long random string; encrypts the keys workspaces
//                                                 save in Settings → Payments
//
// Read straight from process.env (server.js and the scripts load .env first) so the tests can
// hand readConfig() their own values.

const SANDBOX_URL = "https://sandbox.safaricom.co.ke";
const PRODUCTION_URL = "https://api.safaricom.co.ke";

// The addresses Safaricom's Daraja documentation lists for its callbacks. Check the current list
// in the Daraja docs before relying on it.
const SAFARICOM_CALLBACK_IPS = [
  "196.201.214.200", "196.201.214.206", "196.201.213.114", "196.201.214.207", "196.201.214.208", "196.201.213.44",
  "196.201.212.127", "196.201.212.138", "196.201.212.129", "196.201.212.136", "196.201.212.74", "196.201.212.69",
];

function baseUrlFor(environment) {
  return environment === "production" ? PRODUCTION_URL : SANDBOX_URL;
}

// An operator's password encrypted with Safaricom's public certificate — what Daraja calls the
// "security credential". Null when either is missing or the certificate can't be read.
function encryptCredential(password, certPath, readFile = fs.readFileSync) {
  if (!password || !certPath) return null;
  try {
    const cert = readFile(certPath);
    return crypto.publicEncrypt({ key: cert, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(String(password))).toString("base64");
  } catch (err) {
    console.error(`[mpesa] couldn't encrypt the initiator password with ${certPath}:`, err.message);
    return null;
  }
}

function callbackBaseFrom(source = process.env) {
  return String(source.MPESA_CALLBACK_BASE_URL || source.API_PUBLIC_URL || "").replace(/\/+$/, "");
}

// The installation's account.
function readConfig(source = process.env, { readFile } = {}) {
  const environment = source.MPESA_ENV === "production" ? "production" : "sandbox";
  const securityCredential = source.MPESA_SECURITY_CREDENTIAL || encryptCredential(source.MPESA_INITIATOR_PASSWORD, source.MPESA_CERT_PATH, readFile);
  const b2cSecurityCredential = source.MPESA_B2C_SECURITY_CREDENTIAL || encryptCredential(source.MPESA_B2C_INITIATOR_PASSWORD, source.MPESA_CERT_PATH, readFile);
  return {
    id: "env",
    ownerAdminId: null,
    environment,
    baseUrl: baseUrlFor(environment),
    consumerKey: source.MPESA_CONSUMER_KEY || "",
    consumerSecret: source.MPESA_CONSUMER_SECRET || "",
    shortcode: String(source.MPESA_SHORTCODE || "").trim(),
    passkey: source.MPESA_PASSKEY || "",
    callbackToken: source.MPESA_CALLBACK_TOKEN || "",
    callbackBase: callbackBaseFrom(source),
    accountLabel: source.MPESA_ACCOUNT_LABEL || source.MAIL_BRAND_NAME || "Digifunzi",
    defaultOwnerAdminId: source.MPESA_OWNER_ADMIN_ID || source.PUBLIC_CONTENT_ADMIN_ID || null,
    maxAmount: Number(source.MPESA_MAX_AMOUNT) > 0 ? Number(source.MPESA_MAX_AMOUNT) : 250000,
    initiatorName: source.MPESA_INITIATOR_NAME || "",
    securityCredential: securityCredential || "",
    b2c: {
      shortcode: String(source.MPESA_B2C_SHORTCODE || "").trim(),
      consumerKey: source.MPESA_B2C_CONSUMER_KEY || "",
      consumerSecret: source.MPESA_B2C_CONSUMER_SECRET || "",
      initiatorName: source.MPESA_B2C_INITIATOR_NAME || "",
      securityCredential: b2cSecurityCredential || "",
    },
  };
}

// Installation-wide switches, the same for every account.
function readSettings(source = process.env) {
  const ips = String(source.MPESA_CALLBACK_IPS || "").trim();
  return {
    verifyCallbacks: !/^(false|0|no|off)$/i.test(String(source.MPESA_VERIFY_CALLBACKS || "").trim()),
    callbackIps: !ips ? null : ips.toLowerCase() === "safaricom" ? SAFARICOM_CALLBACK_IPS : ips.split(",").map((s) => s.trim()).filter(Boolean),
  };
}

const config = readConfig();
const settings = readSettings();

// Everything a payment prompt needs. The callback must be public HTTPS: Safaricom won't call
// http:// or localhost.
function isConfigured(account = config) {
  return Boolean(account && account.consumerKey && account.consumerSecret && account.shortcode && account.passkey
    && account.callbackToken && account.callbackToken.length >= 24 && /^https:\/\//.test(account.callbackBase));
}

// Checking and reversing the Paybill's transactions — needs its API operator.
function canQueryTransactions(account = config) {
  return isConfigured(account) && Boolean(account.initiatorName && account.securityCredential);
}

// The B2C side with the Paybill's values filling the gaps — what a payout actually uses.
function b2cOf(account = config) {
  const b2c = account?.b2c || {};
  return {
    shortcode: b2c.shortcode || "",
    consumerKey: b2c.consumerKey || account?.consumerKey || "",
    consumerSecret: b2c.consumerKey ? b2c.consumerSecret || "" : account?.consumerSecret || "",
    initiatorName: b2c.initiatorName || account?.initiatorName || "",
    securityCredential: b2c.securityCredential || (b2c.initiatorName ? "" : account?.securityCredential || ""),
  };
}

// Paying educators — needs a disbursement shortcode and its operator.
function canPayOut(account = config) {
  const b2c = b2cOf(account);
  return isConfigured(account) && Boolean(b2c.shortcode && b2c.consumerKey && b2c.consumerSecret && b2c.initiatorName && b2c.securityCredential);
}

// Where Safaricom sends its results. The path avoids words Daraja refuses in registered URLs
// ("mpesa", "safaricom", …); the secret token in it says whose call it is.
//   kind: "stk" | "confirm" | "validate" | "result:<operation>" | "timeout:<operation>"
function callbackUrl(kind, account = config) {
  const paths = { stk: "stk", confirm: "c2b/confirm", validate: "c2b/validate" };
  const [stage, operation] = String(kind).split(":");
  const path = paths[kind] || `${stage}/${operation}`;
  return `${account.callbackBase}/api/public/pay-hooks/${account.callbackToken}/${path}`;
}

module.exports = {
  config, settings, readConfig, readSettings, isConfigured, canQueryTransactions, canPayOut, b2cOf, callbackUrl,
  baseUrlFor, callbackBaseFrom, SAFARICOM_CALLBACK_IPS,
};
