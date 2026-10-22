const express = require("express");
const MpesaService = require("./mpesa.service");
const MpesaOperations = require("./mpesa.operations");
const MpesaAccounts = require("./mpesa.accounts");
const { settings, isConfigured } = require("./mpesa.config");

// Safaricom's calls to us — public and unauthenticated, so everything in them is treated as
// untrusted. Mounted at /api/public/pay-hooks/<token>/…: the long random token says whose Paybill
// the call is about (the installation's MPESA_CALLBACK_TOKEN, or a workspace account's own) — a
// wrong one gets a plain 404, as if nothing were here — and each result must still match a
// prompt or request we made, or a real Paybill payment. With MPESA_CALLBACK_IPS set, calls from
// any other address get the same 404.
//
// Safaricom doesn't wait long for an answer, so each call is answered first and the work happens
// straight after.
const router = express.Router();

async function guard(req, res, next) {
  try {
    if (settings.callbackIps && !settings.callbackIps.includes(String(req.ip || "").replace(/^::ffff:/, ""))) {
      console.warn(`[mpesa] callback from ${req.ip}, which isn't on MPESA_CALLBACK_IPS — refused`);
      return res.status(404).json({ success: false, message: "Not found" });
    }
    const account = await MpesaAccounts.byCallbackToken(req.params.token);
    if (!account || !isConfigured(account)) return res.status(404).json({ success: false, message: "Not found" });
    req.mpesaAccount = account;
    next();
  } catch (err) {
    next(err);
  }
}

const ACCEPTED = { ResultCode: 0, ResultDesc: "Accepted" };

function afterReply(label, work) {
  setImmediate(() => {
    work().catch((err) => console.error(`[mpesa] ${label} could not be processed:`, err.message));
  });
}

router.post("/:token/stk", guard, (req, res) => {
  const { body, mpesaAccount } = req;
  res.json(ACCEPTED);
  afterReply("payment prompt result", () => MpesaService.handleStkCallback(body, mpesaAccount));
});

router.post("/:token/c2b/validate", guard, (req, res) => {
  res.json(MpesaService.validateC2b(req.body));
});

router.post("/:token/c2b/confirm", guard, (req, res) => {
  const { body, mpesaAccount } = req;
  res.json(ACCEPTED);
  afterReply("Paybill payment", () => MpesaService.handleC2bConfirmation(body, mpesaAccount));
});

// Answers to payouts, status checks and reversals (mpesa.operations.js).
const OPERATIONS = ["payout", "status", "reversal"];

router.post("/:token/result/:kind", guard, (req, res) => {
  const { body, mpesaAccount } = req;
  const { kind } = req.params;
  res.json(ACCEPTED);
  if (OPERATIONS.includes(kind)) afterReply(`${kind} result`, () => MpesaOperations.handleResult(kind, body, mpesaAccount));
});

router.post("/:token/timeout/:kind", guard, (req, res) => {
  const { body, mpesaAccount } = req;
  const { kind } = req.params;
  res.json(ACCEPTED);
  if (OPERATIONS.includes(kind)) afterReply(`${kind} timeout`, () => MpesaOperations.handleTimeout(kind, body, mpesaAccount));
});

module.exports = router;
