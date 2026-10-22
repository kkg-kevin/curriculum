// The calls this app makes to Safaricom's Daraja API. Plain fetch (Node 22) — no SDK. Every call
// takes the account (Paybill) it's made for — see mpesa.accounts.js.
const { callbackUrl, b2cOf } = require("./mpesa.config");
const { darajaTimestamp, stkPassword } = require("./mpesa.utils");

const TIMEOUT_MS = 20000;

// A Daraja error, with what Safaricom said, for logs and staff. `pending` marks the STK Query
// answer "the transaction is being processed" — not a failure, just not finished yet.
class DarajaError extends Error {
  constructor(message, { status = null, code = null, body = null } = {}) {
    super(message);
    this.name = "DarajaError";
    this.status = status;
    this.code = code;
    this.body = body;
    this.pending = /being processed/i.test(String(body?.errorMessage || message));
  }
}

async function request(baseUrl, path, { method = "POST", headers = {}, body } = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new DarajaError(`M-Pesa could not be reached (${err.name === "TimeoutError" ? "timed out" : err.message})`);
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 500) }; }
  if (!response.ok) {
    throw new DarajaError(data?.errorMessage || data?.ResponseDescription || `M-Pesa answered ${response.status}`, { status: response.status, code: data?.errorCode || null, body: data });
  }
  return data;
}

// Access tokens last an hour; each app's is kept until a minute before it runs out.
const tokens = new Map();
async function accessToken(baseUrl, consumerKey, consumerSecret) {
  const key = `${baseUrl}|${consumerKey}`;
  const cached = tokens.get(key);
  if (cached && cached.expiresAt > Date.now() + 60 * 1000) return cached.value;
  const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const data = await request(baseUrl, "/oauth/v1/generate?grant_type=client_credentials", { method: "GET", headers: { Authorization: `Basic ${basic}` } });
  if (!data?.access_token) throw new DarajaError("M-Pesa did not return an access token", { body: data });
  tokens.set(key, { value: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3599) * 1000 });
  return data.access_token;
}

// `app` is which Daraja app's keys to use: the Paybill's, or the B2C shortcode's.
async function authorised(account, path, body, app = account) {
  const token = () => accessToken(account.baseUrl, app.consumerKey, app.consumerSecret);
  try {
    return await request(account.baseUrl, path, { headers: { Authorization: `Bearer ${await token()}` }, body });
  } catch (err) {
    // A token Safaricom has dropped early: fetch a new one once and try again.
    if (err.status === 401) {
      tokens.delete(`${account.baseUrl}|${app.consumerKey}`);
      return request(account.baseUrl, path, { headers: { Authorization: `Bearer ${await token()}` }, body });
    }
    throw err;
  }
}

// Calls answered later at a result URL (B2C, Transaction Status, Reversal) first say whether
// Safaricom took the request.
function accepted(data, what) {
  if (String(data?.ResponseCode) !== "0") {
    throw new DarajaError(data?.ResponseDescription || `M-Pesa did not accept the ${what}`, { code: data?.ResponseCode, body: data });
  }
  return { conversationId: data.ConversationID || null, originatorConversationId: data.OriginatorConversationID || null, description: data.ResponseDescription || null };
}

const MpesaClient = {
  DarajaError,

  // Can these keys get a token? For Settings → Payments' "Test the keys".
  async testKeys(account) {
    tokens.delete(`${account.baseUrl}|${account.consumerKey}`);
    await accessToken(account.baseUrl, account.consumerKey, account.consumerSecret);
    return true;
  },

  // Sends the "enter your M-Pesa PIN" prompt to a phone, paying `amount` into the Paybill under
  // `accountReference`. Returns Daraja's MerchantRequestID / CheckoutRequestID.
  async stkPush(account, { phone, amount, accountReference, description }) {
    const timestamp = darajaTimestamp();
    const data = await authorised(account, "/mpesa/stkpush/v1/processrequest", {
      BusinessShortCode: account.shortcode,
      Password: stkPassword(account.shortcode, account.passkey, timestamp),
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: account.shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl("stk", account),
      AccountReference: String(accountReference).slice(0, 12),
      TransactionDesc: String(description || "Payment").slice(0, 13),
    });
    if (String(data?.ResponseCode) !== "0") {
      throw new DarajaError(data?.ResponseDescription || "M-Pesa did not accept the payment request", { code: data?.ResponseCode, body: data });
    }
    return { merchantRequestId: data.MerchantRequestID, checkoutRequestId: data.CheckoutRequestID, customerMessage: data.CustomerMessage || null };
  },

  // Asks what became of a prompt. Returns { resultCode, resultDesc } once it's finished; throws a
  // DarajaError with `pending` set while the payer still hasn't answered.
  async stkQuery(account, checkoutRequestId) {
    const timestamp = darajaTimestamp();
    const data = await authorised(account, "/mpesa/stkpushquery/v1/query", {
      BusinessShortCode: account.shortcode,
      Password: stkPassword(account.shortcode, account.passkey, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    });
    return { resultCode: data?.ResultCode === undefined ? null : String(data.ResultCode), resultDesc: data?.ResultDesc || null, raw: data };
  },

  // Tells Safaricom where to send payments made straight to the Paybill. Done once per Paybill.
  // In production Safaricom keeps the first URLs registered — changing them later means asking
  // them to delete the old ones.
  async registerC2bUrls(account) {
    return authorised(account, "/mpesa/c2b/v1/registerurl", {
      ShortCode: account.shortcode,
      // "Completed": if our validation URL can't be reached, Safaricom accepts the payment anyway.
      ResponseType: "Completed",
      ConfirmationURL: callbackUrl("confirm", account),
      ValidationURL: callbackUrl("validate", account),
    });
  },

  // Sends money from the B2C shortcode to a phone (an educator's claim). The outcome arrives later
  // at the "payout" result URL, matched on originatorConversationId.
  async b2cPayment(account, { phone, amount, remarks, occasion, originatorConversationId }) {
    const b2c = b2cOf(account);
    const data = await authorised(account, "/mpesa/b2c/v3/paymentrequest", {
      OriginatorConversationID: originatorConversationId,
      InitiatorName: b2c.initiatorName,
      SecurityCredential: b2c.securityCredential,
      CommandID: "BusinessPayment",
      Amount: amount,
      PartyA: b2c.shortcode,
      PartyB: phone,
      Remarks: String(remarks || "Payment").slice(0, 100),
      QueueTimeOutURL: callbackUrl("timeout:payout", account),
      ResultURL: callbackUrl("result:payout", account),
      Occasion: String(occasion || "").slice(0, 100),
    }, b2c);
    return accepted(data, "payout");
  },

  // Asks what became of a transaction on the Paybill (by its M-Pesa receipt). Answered later at
  // the "status" result URL.
  async transactionStatus(account, { transId, remarks }) {
    const data = await authorised(account, "/mpesa/transactionstatus/v1/query", {
      Initiator: account.initiatorName,
      SecurityCredential: account.securityCredential,
      CommandID: "TransactionStatusQuery",
      TransactionID: transId,
      PartyA: account.shortcode,
      IdentifierType: "4",
      ResultURL: callbackUrl("result:status", account),
      QueueTimeOutURL: callbackUrl("timeout:status", account),
      Remarks: String(remarks || "Status check").slice(0, 100),
      Occasion: "",
    });
    return accepted(data, "status check");
  },

  // Sends a payment into the Paybill back to the payer. Answered later at the "reversal" result URL.
  async reversal(account, { transId, amount, remarks }) {
    const data = await authorised(account, "/mpesa/reversal/v1/request", {
      Initiator: account.initiatorName,
      SecurityCredential: account.securityCredential,
      CommandID: "TransactionReversal",
      TransactionID: transId,
      Amount: amount,
      ReceiverParty: account.shortcode,
      RecieverIdentifierType: "11",
      ResultURL: callbackUrl("result:reversal", account),
      QueueTimeOutURL: callbackUrl("timeout:reversal", account),
      Remarks: String(remarks || "Reversal").slice(0, 100),
      Occasion: "",
    });
    return accepted(data, "reversal");
  },
};

module.exports = MpesaClient;
