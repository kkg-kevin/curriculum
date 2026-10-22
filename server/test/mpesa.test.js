const test = require("node:test");
const assert = require("node:assert/strict");

// env.js refuses to load without these; the values are only used inside this test.
process.env.JWT_SECRET ||= "test-secret";
process.env.CLIENT_URL ||= "http://localhost:5173";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ||= "test";
process.env.DB_NAME ||= "test";

const {
  normalisePhone, maskPhone, darajaTimestamp, parseDarajaTimestamp, stkPassword, paymentCodeFor,
  invoiceNumberFromAccount, callbackItem, describeStkResult, wholeShillings,
} = require("../src/modules/payments/mpesa/mpesa.utils");
const { readConfig, isConfigured, callbackUrl } = require("../src/modules/payments/mpesa/mpesa.config");

test("phone numbers are put in the form Daraja wants", () => {
  for (const input of ["0712345678", "0712 345 678", "+254712345678", "254712345678", "712345678", "254-712-345678"]) {
    assert.equal(normalisePhone(input), "254712345678", input);
  }
  assert.equal(normalisePhone("0110345678"), "254110345678");
  assert.equal(normalisePhone("110345678"), "254110345678");
  for (const bad of ["", null, "12345", "0212345678", "+255712345678", "07123456789", "abc"]) {
    assert.equal(normalisePhone(bad), null, String(bad));
  }
});

test("phone numbers are masked for staff lists", () => {
  assert.equal(maskPhone("254712345678"), "2547****5678");
  assert.equal(maskPhone("a3f1c9d2e4b5a6f7c8d9e0f1a2b3c4d5"), "a3f1c9…");
  assert.equal(maskPhone(null), null);
});

test("Daraja timestamps are Kenyan time whatever the server's zone", () => {
  // 21 Oct 2026 23:30:05 UTC is 22 Oct 02:30:05 in Nairobi.
  assert.equal(darajaTimestamp(new Date(Date.UTC(2026, 9, 21, 23, 30, 5))), "20261022023005");
  assert.equal(parseDarajaTimestamp("20261022023005").toISOString(), "2026-10-21T23:30:05.000Z");
  assert.equal(parseDarajaTimestamp(20261022023005).toISOString(), "2026-10-21T23:30:05.000Z");
  assert.equal(parseDarajaTimestamp("not a date"), null);
});

test("the STK password is base64 of shortcode + passkey + timestamp", () => {
  // Safaricom's public sandbox values.
  const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";
  const expected = Buffer.from(`174379${passkey}20260101120000`).toString("base64");
  assert.equal(stkPassword("174379", passkey, "20260101120000"), expected);
});

test("an invoice's payment code fits STK's 12-character account reference", () => {
  assert.equal(paymentCodeFor("INV-2026-000123"), "2026000123");
  assert.ok(paymentCodeFor("INV-2026-000123").length <= 12);
  assert.equal(paymentCodeFor("DRAFT-0f3c9a"), null);
  assert.equal(paymentCodeFor(null), null);
});

test("what a payer types as the account finds the invoice, forgivingly", () => {
  for (const typed of ["2026000123", "inv-2026-000123", "INV2026000123", "2026 000123", "2026123", " Inv 2026-123 "]) {
    assert.equal(invoiceNumberFromAccount(typed), "INV-2026-000123", typed);
  }
  for (const typed of ["", null, "John", "123", "2026", "20260", "1999000123"]) {
    assert.equal(invoiceNumberFromAccount(typed), null, String(typed));
  }
});

test("STK callback items are read by name", () => {
  const items = [{ Name: "Amount", Value: 150 }, { Name: "MpesaReceiptNumber", Value: "SJK4H7XY2Q" }, { Name: "Balance" }];
  assert.equal(callbackItem(items, "Amount"), 150);
  assert.equal(callbackItem(items, "MpesaReceiptNumber"), "SJK4H7XY2Q");
  assert.equal(callbackItem(items, "PhoneNumber"), undefined);
  assert.equal(callbackItem(undefined, "Amount"), undefined);
});

test("STK result codes become a status and a message for the payer", () => {
  assert.equal(describeStkResult(0).status, "successful");
  assert.equal(describeStkResult("0").status, "successful");
  assert.equal(describeStkResult(1032).status, "cancelled");
  assert.equal(describeStkResult("1037").status, "timeout");
  assert.equal(describeStkResult(1).status, "failed");
  assert.equal(describeStkResult(2001).status, "failed");
  assert.equal(describeStkResult(424242).status, "failed");
  assert.match(describeStkResult(1).message, /enough money/);
});

test("amounts are whole shillings, rounded up", () => {
  assert.equal(wholeShillings(1500), 1500);
  assert.equal(wholeShillings(1500.4), 1501);
  assert.equal(wholeShillings("99.99"), 100);
  assert.equal(wholeShillings(0), 0);
});

test("M-Pesa stays off until everything it needs is set", () => {
  const full = {
    MPESA_CONSUMER_KEY: "k", MPESA_CONSUMER_SECRET: "s", MPESA_SHORTCODE: "174379", MPESA_PASSKEY: "p",
    MPESA_CALLBACK_TOKEN: "x".repeat(32), API_PUBLIC_URL: "https://api.example.com/",
  };
  assert.equal(isConfigured(readConfig(full)), true);
  assert.equal(isConfigured(readConfig({ ...full, MPESA_PASSKEY: "" })), false);
  assert.equal(isConfigured(readConfig({ ...full, MPESA_CALLBACK_TOKEN: "short" })), false);
  assert.equal(isConfigured(readConfig({ ...full, API_PUBLIC_URL: "http://localhost:5000" })), false);
  assert.equal(isConfigured(readConfig({ ...full, MPESA_CALLBACK_BASE_URL: "https://tunnel.example.com" , API_PUBLIC_URL: "" })), true);
  assert.equal(readConfig(full).baseUrl, "https://sandbox.safaricom.co.ke");
  assert.equal(readConfig({ ...full, MPESA_ENV: "production" }).baseUrl, "https://api.safaricom.co.ke");
});

test("callback URLs carry the token and avoid words Daraja refuses", () => {
  const c = readConfig({ MPESA_CALLBACK_TOKEN: "t".repeat(32), API_PUBLIC_URL: "https://api.example.com/" });
  const url = callbackUrl("confirm", c);
  assert.equal(url, `https://api.example.com/api/public/pay-hooks/${"t".repeat(32)}/c2b/confirm`);
  for (const kind of ["stk", "confirm", "validate"]) {
    assert.doesNotMatch(callbackUrl(kind, c), /mpesa|safaricom|sql|exec|cmd/i);
  }
});

test("a prompt asks for what's due, or a whole-shilling part of it", () => {
  const { promptAmount } = require("../src/modules/payments/mpesa/mpesa.service")._internal;
  const invoice = { total: "1500.50", amountPaid: "500.00" };
  assert.equal(promptAmount(invoice, undefined, 250000), 1001);
  assert.equal(promptAmount(invoice, 400, 250000), 400);
  assert.throws(() => promptAmount(invoice, 1002, 250000), /more than/);
  assert.throws(() => promptAmount(invoice, 10.5, 250000), /whole shillings/);
  assert.throws(() => promptAmount(invoice, 0, 250000), /at least/);
  assert.throws(() => promptAmount({ total: 100, amountPaid: 100 }, undefined, 250000), /nothing left/);
  assert.throws(() => promptAmount(invoice, undefined, 500), /at most KES 500/);
});

// ---- Phases 4–5 ----

test("result and timeout URLs for payouts, checks and reversals avoid words Daraja refuses", () => {
  const c = readConfig({ MPESA_CALLBACK_TOKEN: "t".repeat(32), API_PUBLIC_URL: "https://api.example.com" });
  assert.equal(callbackUrl("result:payout", c), `https://api.example.com/api/public/pay-hooks/${"t".repeat(32)}/result/payout`);
  assert.equal(callbackUrl("timeout:reversal", c), `https://api.example.com/api/public/pay-hooks/${"t".repeat(32)}/timeout/reversal`);
  for (const kind of ["result:payout", "timeout:payout", "result:status", "timeout:status", "result:reversal", "timeout:reversal"]) {
    assert.doesNotMatch(callbackUrl(kind, c), /mpesa|safaricom|sql|exec|cmd/i);
  }
});

test("checks, reversals and payouts are only offered when their operator is set", () => {
  const { canQueryTransactions, canPayOut, b2cOf } = require("../src/modules/payments/mpesa/mpesa.config");
  const base = {
    MPESA_CONSUMER_KEY: "k", MPESA_CONSUMER_SECRET: "s", MPESA_SHORTCODE: "600000", MPESA_PASSKEY: "p",
    MPESA_CALLBACK_TOKEN: "x".repeat(32), API_PUBLIC_URL: "https://api.example.com",
  };
  assert.equal(canQueryTransactions(readConfig(base)), false);
  assert.equal(canQueryTransactions(readConfig({ ...base, MPESA_INITIATOR_NAME: "api", MPESA_SECURITY_CREDENTIAL: "cred" })), true);
  assert.equal(canPayOut(readConfig({ ...base, MPESA_INITIATOR_NAME: "api", MPESA_SECURITY_CREDENTIAL: "cred" })), false, "no B2C shortcode");
  // The B2C shortcode on its own borrows the Paybill's app and operator.
  const borrowing = readConfig({ ...base, MPESA_INITIATOR_NAME: "api", MPESA_SECURITY_CREDENTIAL: "cred", MPESA_B2C_SHORTCODE: "600100" });
  assert.equal(canPayOut(borrowing), true);
  assert.deepEqual(b2cOf(borrowing), { shortcode: "600100", consumerKey: "k", consumerSecret: "s", initiatorName: "api", securityCredential: "cred" });
  // Its own app and operator — and an operator without its credential isn't ready.
  const own = readConfig({ ...base, MPESA_B2C_SHORTCODE: "600100", MPESA_B2C_CONSUMER_KEY: "bk", MPESA_B2C_CONSUMER_SECRET: "bs", MPESA_B2C_INITIATOR_NAME: "payer", MPESA_INITIATOR_NAME: "api", MPESA_SECURITY_CREDENTIAL: "cred" });
  assert.equal(b2cOf(own).consumerKey, "bk");
  assert.equal(b2cOf(own).securityCredential, "", "the B2C operator needs its own credential");
  assert.equal(canPayOut(own), false);
  assert.equal(canPayOut({ ...own, b2c: { ...own.b2c, securityCredential: "bcred" } }), true);
});

test("an initiator password is encrypted with Safaricom's certificate", () => {
  const crypto = require("crypto");
  const { publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = publicKey.export({ type: "spki", format: "pem" });
  const read = [];
  const readFile = (path) => { read.push(path); return pem; };
  const c = readConfig({ MPESA_INITIATOR_PASSWORD: "Safaricom999!", MPESA_CERT_PATH: "/certs/sandbox.cer" }, { readFile });
  // (Node no longer decrypts PKCS#1 v1.5 with a private key, so the shape is what is checked.)
  assert.deepEqual(read, ["/certs/sandbox.cer"]);
  assert.equal(Buffer.from(c.securityCredential, "base64").length, 256, "one RSA-2048 block");
  assert.doesNotMatch(c.securityCredential, /Safaricom999/);
  // A ready-made credential wins; a missing certificate leaves none.
  assert.equal(readConfig({ MPESA_SECURITY_CREDENTIAL: "given", MPESA_INITIATOR_PASSWORD: "x", MPESA_CERT_PATH: "/c" }, { readFile: () => pem }).securityCredential, "given");
  const quiet = console.error;
  console.error = () => {};
  try {
    assert.equal(readConfig({ MPESA_INITIATOR_PASSWORD: "x", MPESA_CERT_PATH: "/missing" }, { readFile: () => { throw new Error("ENOENT"); } }).securityCredential, "");
  } finally {
    console.error = quiet;
  }
});

test("callback hardening switches", () => {
  const { readSettings, SAFARICOM_CALLBACK_IPS } = require("../src/modules/payments/mpesa/mpesa.config");
  assert.equal(readSettings({}).verifyCallbacks, true);
  assert.equal(readSettings({ MPESA_VERIFY_CALLBACKS: "false" }).verifyCallbacks, false);
  assert.equal(readSettings({}).callbackIps, null);
  assert.deepEqual(readSettings({ MPESA_CALLBACK_IPS: "safaricom" }).callbackIps, SAFARICOM_CALLBACK_IPS);
  assert.deepEqual(readSettings({ MPESA_CALLBACK_IPS: " 1.2.3.4, 5.6.7.8 " }).callbackIps, ["1.2.3.4", "5.6.7.8"]);
});

test("workspace secrets are encrypted, and unreadable under another key", () => {
  const { encrypt, decrypt, canEncrypt } = require("../src/modules/payments/mpesa/mpesa.secrets");
  const key = "a-long-random-secrets-key-for-tests";
  assert.equal(canEncrypt(""), false);
  assert.equal(canEncrypt(key), true);
  const stored = encrypt("my-passkey", key);
  assert.match(stored, /^v1:/);
  assert.doesNotMatch(stored, /my-passkey/);
  assert.notEqual(encrypt("my-passkey", key), stored, "a fresh IV each time");
  assert.equal(decrypt(stored, key), "my-passkey");
  assert.equal(decrypt(stored, "a-different-key-of-enough-length"), null);
  assert.equal(decrypt("garbage", key), null);
  assert.equal(encrypt("", key), null);
  assert.throws(() => encrypt("x", ""), /MPESA_SECRETS_KEY/);
});

test("result parameters are read whether Safaricom sends a list or one", () => {
  const { resultParameters } = require("../src/modules/payments/mpesa/mpesa.utils");
  assert.deepEqual(resultParameters({ ResultParameters: { ResultParameter: [{ Key: "TransactionAmount", Value: 10 }, { Key: "TransactionReceipt", Value: "NLJ41HAY6Q" }] } }), { TransactionAmount: 10, TransactionReceipt: "NLJ41HAY6Q" });
  assert.deepEqual(resultParameters({ ResultParameters: { ResultParameter: { Key: "Amount", Value: 5 } } }), { Amount: 5 });
  assert.deepEqual(resultParameters({}), {});
});

test("an M-Pesa statement is read for the money received", () => {
  const { parseStatement, parseStatementTime, parseOtherParty, accountFromDetails } = require("../src/modules/payments/mpesa/mpesa.statement");
  const csv = [
    "﻿Account Holder:,DIGIFUNZI LTD",
    "Short Code:,600000",
    "Time Period:,01-10-2026 - 21-10-2026",
    "",
    "Receipt No.,Completion Time,Initiation Time,Details,Transaction Status,Paid In,Withdrawn,Balance,Balance Confirmed,Reason Type,Other Party Info,Linked Transaction ID,A/C No.",
    'SJK4H7XY2Q,21-10-2026 14:30:05,21-10-2026 14:30:01,"Pay Bill Online from 254712***678 - JANE W DOE Acc. 2026000123",Completed,"2,500.00",,"10,000.00",true,Pay Bill Online,254712***678 - JANE W DOE,,2026000123',
    "SJK4H7XY3R,21-10-2026 15:00:00,21-10-2026 15:00:00,Pay Bill from 254700***111 - JOHN K Acc. inv-2026-000124,Completed,700.00,,10700.00,true,Pay Bill,254700***111 - JOHN K,,",
    "SJK4H7XY4S,21-10-2026 16:00:00,21-10-2026 16:00:00,Business Charge,Completed,,30.00,10670.00,true,Pay Bill Charge,,,",
    "SJK4H7XY5T,21-10-2026 17:00:00,21-10-2026 17:00:00,Pay Bill Online,Failed,100.00,,10670.00,true,Pay Bill Online,254711***222 - A B,,2026000125",
    "SJK4H7XY6U,21-10-2026 18:00:00,21-10-2026 18:00:00,Organization Settlement,Completed,5000.00,,15670.00,true,Organization Settlement,,,",
    "SJK4H7XY2Q,21-10-2026 14:30:05,21-10-2026 14:30:01,Duplicate line,Completed,2500.00,,,true,Pay Bill Online,,,2026000123",
    ",,,,,Total,,,,,,,",
  ].join("\r\n");
  const { rows, skipped, error } = parseStatement(csv);
  assert.equal(error, null);
  assert.deepEqual(rows.map((r) => r.transId), ["SJK4H7XY2Q", "SJK4H7XY3R"]);
  assert.equal(rows[0].amount, 2500);
  assert.equal(rows[0].billRefNumber, "2026000123");
  assert.equal(rows[0].payerName, "JANE W DOE");
  assert.equal(rows[0].msisdn, "254712***678");
  assert.equal(rows[0].transTime.toISOString(), "2026-10-21T11:30:05.000Z", "Kenyan time");
  assert.equal(rows[1].billRefNumber, "inv-2026-000124", "the account number from Details when the column is empty");
  assert.deepEqual(skipped.map((s) => s.receipt), ["SJK4H7XY4S", "SJK4H7XY5T", "SJK4H7XY6U", "SJK4H7XY2Q"]);
  assert.match(skipped[1].reason, /Not completed/);
  assert.match(skipped[2].reason, /Not a customer payment/);
  assert.match(skipped[3].reason, /twice/);

  assert.match(parseStatement("hello,world\n1,2").error, /Receipt No/);
  assert.equal(parseStatementTime("2026-10-21 08:00:00").toISOString(), "2026-10-21T05:00:00.000Z");
  assert.equal(parseStatementTime("21/10/2026 08:00").toISOString(), "2026-10-21T05:00:00.000Z");
  assert.equal(parseStatementTime("yesterday"), null);
  assert.deepEqual(parseOtherParty("JANE DOE"), { msisdn: null, name: "JANE DOE" });
  assert.equal(accountFromDetails("Pay Bill Online from 2547 - X Acc. 2026000123"), "2026000123");
  assert.equal(accountFromDetails("Business Charge"), null);
});
