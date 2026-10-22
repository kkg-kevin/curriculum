// Runs against a throwaway database, and only when one is named:
//
//   TEST_DB_NAME=digifunzi_nfr_test npm test
//
// The name must end in "_test". The rows this file adds are removed again at the end. Email is
// switched off for the run, and nothing here calls Safaricom — the callbacks are fed in directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const TEST_DB = process.env.TEST_DB_NAME;
const enabled = Boolean(TEST_DB);

if (enabled) {
  if (!/_test$/.test(TEST_DB)) throw new Error("TEST_DB_NAME must end in _test");
  process.env.BREVO_API_KEY = "";
  process.env.SMTP_HOST = "";
  process.env.MAIL_FROM = "";
  require("dotenv").config({ quiet: true });
  process.env.DB_NAME = TEST_DB;
  // Paybill payments that match nothing land in nobody's workspace during the test.
  process.env.MPESA_OWNER_ADMIN_ID = "";
  process.env.PUBLIC_CONTENT_ADMIN_ID = "";
}

test("M-Pesa money is put on invoices once, and only once", { skip: !enabled && "set TEST_DB_NAME to run" }, async (t) => {
  const knex = require("knex");
  const knexConfig = require("../knexfile");
  const admin = knex({ ...knexConfig, connection: { ...knexConfig.connection, database: undefined } });
  await admin.raw("CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4", [TEST_DB]);
  await admin.destroy();

  const env = require("../src/config/env");
  assert.ok(!env.BREVO_API_KEY && !env.SMTP_HOST, "email must be off for this run");
  assert.equal(env.DB_NAME, TEST_DB);

  const db = require("../src/config/db");
  await db.migrate.latest();
  const MpesaService = require("../src/modules/payments/mpesa/mpesa.service");
  const { allocate } = MpesaService._internal;

  const hubId = crypto.randomUUID();
  const invoiceIds = [];
  const seq = Math.floor(Math.random() * 900000) + 100000;
  let n = 0;
  async function makeInvoice(total, { amountPaid = 0, status = "issued" } = {}) {
    const id = crypto.randomUUID();
    const invoiceNumber = `INV-2099-${String(seq + n++).padStart(6, "0")}`;
    const now = new Date();
    await db("billing_invoices").insert({ id, invoiceNumber, issuerType: "learning_hub", hubId, invoiceType: "learner_term", status, currency: "KES", subtotal: total, discount: 0, total, amountPaid, issuedAt: now, createdAt: now, updatedAt: now });
    invoiceIds.push(id);
    return { id, invoiceNumber, code: invoiceNumber.replace(/^INV-(\d{4})-/, "$1") };
  }
  async function makePrompt(invoice, amount) {
    const request = await require("../src/modules/payments/mpesa/mpesa.model").createRequest({
      invoiceId: invoice.id, phone: "254712345678", amount, accountReference: invoice.code, status: "pending",
      merchantRequestId: `m-${crypto.randomUUID()}`, checkoutRequestId: `ws_CO_${crypto.randomUUID()}`,
    });
    return request;
  }
  const stkBody = (request, { receipt, amount = request.amount, code = 0 }) => ({
    Body: { stkCallback: {
      MerchantRequestID: request.merchantRequestId, CheckoutRequestID: request.checkoutRequestId, ResultCode: code, ResultDesc: code ? "Request cancelled by user" : "The service request is processed successfully.",
      ...(code ? {} : { CallbackMetadata: { Item: [{ Name: "Amount", Value: amount }, { Name: "MpesaReceiptNumber", Value: receipt }, { Name: "TransactionDate", Value: 20991021143005 }, { Name: "PhoneNumber", Value: 254712345678 }] } }),
    } },
  });
  const c2bBody = ({ transId, amount, account }) => ({
    TransactionType: "Pay Bill", TransID: transId, TransTime: "20991021143005", TransAmount: String(amount), BusinessShortCode: "600000",
    BillRefNumber: account, InvoiceNumber: "", OrgAccountBalance: "", ThirdPartyTransID: "", MSISDN: "hashed-number-value", FirstName: "Jane", MiddleName: "", LastName: "Doe",
  });
  const receipt = () => `T${crypto.randomBytes(5).toString("hex").toUpperCase()}`;
  const payments = (invoiceId) => db("billing_payments").where({ invoiceId, status: "successful" });
  const invoiceRow = (id) => db("billing_invoices").where({ id }).first();

  t.after(async () => {
    const txIds = await db("mpesa_transactions").whereIn("invoiceId", invoiceIds).orWhere("billRefNumber", "like", "NOPE-%").pluck("id");
    await db("mpesa_transactions").whereIn("id", txIds).del();
    await db("mpesa_stk_requests").whereIn("invoiceId", invoiceIds).del();
    await db("billing_audit_events").whereIn("invoiceId", invoiceIds).del();
    await db("billing_payments").whereIn("invoiceId", invoiceIds).del();
    await db("billing_invoices").whereIn("id", invoiceIds).del();
    await db.destroy();
  });

  await t.test("the same prompt result arriving three times at once pays the invoice once", async () => {
    const invoice = await makeInvoice(1500);
    const request = await makePrompt(invoice, 1500);
    const body = stkBody(request, { receipt: receipt() });
    await Promise.all([MpesaService.handleStkCallback(body), MpesaService.handleStkCallback(body), MpesaService.handleStkCallback(body)]);
    const paid = await payments(invoice.id);
    assert.equal(paid.length, 1);
    assert.equal(Number(paid[0].amount), 1500);
    assert.equal(paid[0].provider, "mpesa");
    assert.equal((await invoiceRow(invoice.id)).status, "paid");
    const updated = await db("mpesa_stk_requests").where({ id: request.id }).first();
    assert.equal(updated.status, "successful");
    const tx = await db("mpesa_transactions").where({ stkRequestId: request.id }).first();
    assert.equal(tx.status, "allocated");
    assert.equal(tx.paymentId, paid[0].id);
  });

  await t.test("a cancelled prompt changes nothing on the invoice", async () => {
    const invoice = await makeInvoice(800);
    const request = await makePrompt(invoice, 800);
    await MpesaService.handleStkCallback(stkBody(request, { code: 1032 }));
    assert.equal((await payments(invoice.id)).length, 0);
    assert.equal((await db("mpesa_stk_requests").where({ id: request.id }).first()).status, "cancelled");
  });

  await t.test("a result for a prompt we never sent is ignored", async () => {
    await MpesaService.handleStkCallback(stkBody({ merchantRequestId: "x", checkoutRequestId: "ws_CO_not_ours", amount: 100 }, { receipt: receipt() }));
    assert.equal(await db("mpesa_transactions").where({ transId: "ws_CO_not_ours" }).first(), undefined);
  });

  await t.test("a result whose amount differs from the prompt waits for staff", async () => {
    const invoice = await makeInvoice(1000);
    const request = await makePrompt(invoice, 1000);
    await MpesaService.handleStkCallback(stkBody(request, { receipt: receipt(), amount: 10 }));
    assert.equal((await payments(invoice.id)).length, 0);
    const tx = await db("mpesa_transactions").where({ stkRequestId: request.id }).first();
    assert.equal(tx.status, "unallocated");
    assert.match(tx.note, /check before matching/);
  });

  await t.test("the Paybill notice of a prompt's payment doesn't pay it again", async () => {
    const invoice = await makeInvoice(2000);
    const request = await makePrompt(invoice, 2000);
    const r = receipt();
    await MpesaService.handleStkCallback(stkBody(request, { receipt: r }));
    await MpesaService.handleC2bConfirmation(c2bBody({ transId: r, amount: 2000, account: invoice.code }));
    assert.equal((await payments(invoice.id)).length, 1);
    assert.equal(await db("mpesa_transactions").where({ transId: r }).count({ c: "*" }).first().then((x) => Number(x.c)), 1);
  });

  await t.test("a prompt settled by a status check gets its receipt from the later Paybill notice", async () => {
    const invoice = await makeInvoice(700);
    const request = await makePrompt(invoice, 700);
    // What checkPrompt does when Safaricom's status check says "paid" (no receipt in that answer).
    await MpesaService._internal.settlePrompt(await db("mpesa_stk_requests").where({ id: request.id }).first(), { amount: 700 });
    const r = receipt();
    await MpesaService.handleC2bConfirmation(c2bBody({ transId: r, amount: 700, account: invoice.code }));
    const paid = await payments(invoice.id);
    assert.equal(paid.length, 1);
    assert.equal(paid[0].providerReference, r);
    assert.equal((await db("mpesa_stk_requests").where({ id: request.id }).first()).mpesaReceiptNumber, r);
  });

  await t.test("a late callback after a status check adds the receipt without paying again", async () => {
    const invoice = await makeInvoice(900);
    const request = await makePrompt(invoice, 900);
    await MpesaService._internal.settlePrompt(await db("mpesa_stk_requests").where({ id: request.id }).first(), { amount: 900 });
    const r = receipt();
    await MpesaService.handleStkCallback(stkBody(request, { receipt: r }));
    const paid = await payments(invoice.id);
    assert.equal(paid.length, 1);
    assert.equal(paid[0].providerReference, r);
    assert.equal((await db("mpesa_transactions").where({ stkRequestId: request.id }).first()).transId, r);
  });

  await t.test("money paid to the Paybill with the invoice's code goes on that invoice", async () => {
    const invoice = await makeInvoice(3000, { amountPaid: 1000, status: "partially_paid" });
    await db("billing_payments").insert({ id: crypto.randomUUID(), invoiceId: invoice.id, provider: "manual", amount: 1000, currency: "KES", status: "successful", paymentMethod: "cash", paidAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
    const r = receipt();
    await MpesaService.handleC2bConfirmation(c2bBody({ transId: r, amount: 2000, account: ` inv-${invoice.invoiceNumber.slice(4)} ` }));
    assert.equal((await invoiceRow(invoice.id)).status, "paid");
    const tx = await db("mpesa_transactions").where({ transId: r }).first();
    assert.equal(tx.status, "allocated");
    assert.equal(tx.payerName, "Jane Doe");
    // The same notice again is ignored.
    await MpesaService.handleC2bConfirmation(c2bBody({ transId: r, amount: 2000, account: invoice.code }));
    assert.equal((await payments(invoice.id)).length, 2);
  });

  await t.test("paying more than is due credits what's due and keeps the rest aside", async () => {
    const invoice = await makeInvoice(500);
    const r = receipt();
    await MpesaService.handleC2bConfirmation(c2bBody({ transId: r, amount: 650, account: invoice.code }));
    const paid = await payments(invoice.id);
    assert.equal(paid.length, 1);
    assert.equal(Number(paid[0].amount), 500);
    const tx = await db("mpesa_transactions").where({ transId: r }).first();
    assert.equal(tx.status, "partially_allocated");
    assert.equal(Number(tx.unallocatedAmount), 150);
  });

  await t.test("an unknown account waits unmatched, and staff can put it on an invoice later", async () => {
    const r = receipt();
    await MpesaService.handleC2bConfirmation(c2bBody({ transId: r, amount: 400, account: "NOPE-school fees" }));
    let tx = await db("mpesa_transactions").where({ transId: r }).first();
    assert.equal(tx.status, "unallocated");
    assert.match(tx.note, /No invoice matches/);

    const invoice = await makeInvoice(400);
    // Two staff pressing Match at the same moment still pay it once.
    await Promise.all([allocate(tx, invoice.id, { quiet: true }), allocate(tx, invoice.id, { quiet: true })]);
    assert.equal((await payments(invoice.id)).length, 1);
    tx = await db("mpesa_transactions").where({ transId: r }).first();
    assert.equal(tx.status, "allocated");
    assert.equal(Number(tx.unallocatedAmount), 0);
  });

  await t.test("money for an invoice that's already paid is kept aside, not refused", async () => {
    const invoice = await makeInvoice(300, { amountPaid: 300, status: "paid" });
    const r = receipt();
    await MpesaService.handleC2bConfirmation(c2bBody({ transId: r, amount: 300, account: invoice.code }));
    const tx = await db("mpesa_transactions").where({ transId: r }).first();
    assert.equal(tx.status, "unallocated");
    assert.match(tx.note, /is paid/);
    assert.equal((await payments(invoice.id)).length, 0);
  });
});
