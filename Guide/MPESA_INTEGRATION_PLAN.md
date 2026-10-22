# M-Pesa integration — analysis and plan

Status (22 Oct 2026): **phases 1–3 built**, and **phases 4–5 mostly built, then paused**:

- Website "Pay now" after a sign-up (`payment_links`, `/api/public/payments`).
- Statement CSV import.
- Callback hardening: STK results confirmed by STK Query; optional `MPESA_CALLBACK_IPS`.
- B2C claim payouts, transaction status checks and reversals (`mpesa_operations`).
- A workspace's own Paybill (Settings → Payments, `mpesa_accounts`, secrets under `MPESA_SECRETS_KEY`).

None of it has been tested against Safaricom yet; that waits on Daraja credentials. Not done:

- The database tests for the phase 4–5 paths aren't written.
- `test/mpesa.db.test.js` has never run (the local MySQL user can't create the `_test` database).
- This document's sections below still describe the phase 1–3 design.

## 0. What's built, and what's left to do

**Built:**

- **`applyPayment`.** `BillingService.applyPayment` is now the one place a payment is written. "Record payment" is a thin wrapper around it.
- **Invoice-paid hook.** `billing.paid-hooks.js` runs when an invoice becomes fully paid. Home Learning, Tech Club and Bootcamp website sign-ups now switch on as soon as they're fully paid, whether by M-Pesa or by staff. The admin is notified when M-Pesa paid it.
- **Bootcamp invoices at sign-up.** A bootcamp enrolment now raises its invoice at sign-up and emails it to the parent. The bootcamp's "Mark paid" button records cash against that invoice.
- **M-Pesa server module.** `server/src/modules/payments/mpesa/` contains:
  - the config, and a Daraja client (OAuth token, STK Push, STK Query, C2B URL registration);
  - the two tables (migration `20261021090000_create_mpesa_tables.js`, which also adds `leads.invoiceId`);
  - STK Push with its callback, and STK Query for prompts that never call back;
  - C2B confirmation and validation;
  - staff matching.
- **Endpoints:**
  - `POST /api/billing/:id/mpesa`: "Pay with M-Pesa" for a parent, "Request payment" for staff.
  - `POST /api/auth/pending-payment/mpesa`: "Pay now" on the payment-pending screen. It still works while the account is locked.
  - `GET /api/billing/mpesa/requests/:id`: the payer's screen polls this.
  - `GET /api/billing/mpesa/status`.
  - `GET /api/billing/mpesa/transactions` and `/failed-requests`.
  - `POST /api/billing/mpesa/transactions/:id/allocate` and `/ignore`.
  - Callbacks: `/api/public/pay-hooks/<token>/stk`, `/c2b/confirm` and `/c2b/validate`.
- **Scripts:** `npm run mpesa:reconcile` (cron) and `npm run mpesa:register-urls`.
- **Screens:**
  - The invoice page has a "Pay by M-Pesa" card with the Paybill and account number, plus "Pay with M-Pesa" or "Request payment".
  - The Paybill details also appear on the invoice PDF and in the invoice email. The receipt email shows the M-Pesa receipt.
  - The payment-pending screen has a "Pay now with M-Pesa" button.
  - Billing → M-Pesa tab: payments waiting to be matched, matched ones, ones set aside, and prompts that didn't go through.
- **Tests:**
  - `test/mpesa.test.js`: the pure helpers.
  - `test/mpesa.db.test.js`: double and late callbacks, C2B matching, overpayment and staff matching. It runs only with `TEST_DB_NAME`, which needs a MySQL user that can create a `_test` database. The local `digifunzi_app` user can't, so it hasn't run yet.

**Decisions taken as recommended** (change any of them and tell me): D2 one Paybill per installation, D3 auto-activate sign-ups once fully paid, D4 partial STK payments allowed, D5 STK amounts rounded up to whole shillings (invoice totals left as they are; any cents over go to "to match"), D6 B2C later.

**Your side, in order:**

1. **Daraja test app.** Create an app on developer.safaricom.co.ke with **M-Pesa Express** and **M-Pesa Sandbox**. Put its Consumer Key and Secret on **dev**, with the sandbox Paybill `174379`, the public sandbox passkey (it's in the Daraja simulator), `MPESA_ENV=sandbox`, and a long random `MPESA_CALLBACK_TOKEN`. Restart the app; the migration runs on restart.
2. **Test on dev.** Pay an invoice from the invoice page, then from a test sign-up's payment-pending screen. The sandbox sends the prompt to a real Safaricom phone, so test with KES 1.
3. **Cron.** On each installation, add a cPanel cron job every 5 minutes: `npm run mpesa:reconcile`, from the server's application root.
4. **Go Live.** The Paybill's M-Pesa org-portal **Business Administrator** does "Go Live" on Daraja, approving it with an OTP. Then put the production Consumer Key/Secret and the emailed passkey on **live**, with `MPESA_ENV=production`, `MPESA_SHORTCODE=<Paybill>` and a new `MPESA_CALLBACK_TOKEN`.
5. **Register the C2B URLs once on live.** Run `npm run mpesa:register-urls` first to check the URLs, then `npm run mpesa:register-urls -- --yes`. Safaricom keeps the first URLs registered, so check them before confirming. The production app needs the C2B product.

## 1. Where things stand today

**Billing is already shaped for a payment gateway.** The schema in `20260824110000_create_billing_tables.js` and later migrations has:

- `billing_payments.provider` (always `"manual"` today), `providerReference` (**UNIQUE**), `status` (`pending|successful|failed|refunded|reversed`), `metadata` JSON, `idempotencyKey` (UNIQUE), `receiptNumber` (`RCT-YYYY-000001`).
- `billing_invoices` with `total`, `amountPaid`, and status moving `issued → partially_paid → paid`. Amounts are `DECIMAL(12,2)`, currency `KES`.
- `billing_audit_events` for every money event.
- Receipt emails go through the outbox (`sendPaymentReceiptEmail`, deduplicated per payment).

**All money is entered by hand.** "M-Pesa" exists only as the `mpesa_manual` payment method, a dropdown option where staff type the transaction code.

| Where money comes in | How it's recorded now | Code |
|---|---|---|
| Any invoice (Billing → invoice → Record payment) | `BillingService.recordPayment` — needs a signed-in `req`, runs `assertAccess`, locks the invoice row, rejects overpayment | `billing.service.js:483` |
| Home Learning website sign-up | Admin "Approve" → `recordPayment` + activates household and children (`pending_payment → active`) | `home-learning-signup.service.js` `approveSignup` |
| Tech Club website sign-up | Same pattern | `club-signup.service.js` |
| Bootcamp website enrolment | Admin "Mark paid" on the lead **creates the invoice at that moment** (there is no invoice while unpaid), then activates the learner | `bootcamp-enrollment.service.js` `markLeadPaid` |
| Educator claims (money going **out**) | Admin types a reference into "Mark paid" | `claim.service.js` `markPaid` |

**Where a parent sees what they owe:**

- The "payment pending" screen (`AccountSuspendedScreen.jsx` → `PendingPaymentPanel`, fed by `auth.service.js getPendingPayment`). Today it says "Pay by cash at your hub".
- Learner-portal invoices (`/learner-portal/invoices/:id` → `InvoiceDetailPage.jsx`). Parents (guardian logins) see household and club invoices through `withGuardianInvoices`.

**Infrastructure facts that matter:**

- Node 22, so the built-in `fetch` is enough; no M-Pesa SDK is needed.
- `API_PUBLIC_URL` is set, and Safaricom's callbacks will call it. It must be public HTTPS with a valid certificate (cPanel AutoSSL).
- There's no in-process scheduler. Background work runs as `npm run …` scripts from cron (see `mail:process`), and the reconcile job follows that pattern.
- All `/api` traffic passes the rate limiter (3000 per 15 minutes) and `auditTrail`. Public routes already work unauthenticated under `/api/public`.
- `TRUST_PROXY` is still unresolved on the hosts (see the NFR notes). An IP allowlist for Safaricom callbacks depends on it.
- Phone numbers are already stored: `learners.guardianPhone`, `home_learning_households.guardianPhone` and `club_memberships.guardianPhone`. They're free text and will need normalising.

## 2. What we're building (Daraja APIs)

| Capability | Daraja API | Use here | Phase |
|---|---|---|---|
| Prompt the payer's phone for their PIN | STK Push (`/mpesa/stkpush/v1/processrequest`) + callback | "Pay with M-Pesa" on invoices and the pending-payment screen; staff "Request payment" | 1–2 |
| Check an STK request that never called back | STK Query (`/mpesa/stkpushquery/v1/query`) | Reconcile job and status polling | 1–2 |
| Pay manually to Paybill with an account number | C2B register URLs (validation + confirmation) | Auto-match "Paybill X, Account INV…" payments to invoices | 3 |
| Pay educators | B2C | Claims "Pay via M-Pesa" (needs a separate B2C/disbursement shortcode) | 5 (optional) |
| Confirm or reverse a transaction | Transaction Status / Reversal (initiator + security credential) | Ops tools | 5 (optional) |

## 3. Design

### 3.1 One way to apply money to an invoice (refactor first)

Split the transactional core out of `recordPayment` into an internal function:

```
BillingService.applyPayment(invoiceId, {
  amount, provider, paymentMethod, providerReference, paidAt, payerUserId,
  recordedBy /* null for system */, idempotencyKey, metadata, notes
}, trx?) → { invoice, payment, excess }
```

- No `req` and no `assertAccess`. The callers (the manual route, M-Pesa callbacks, the reconcile job) do their own checks.
- It keeps the row lock, the idempotency check and the `sumSuccessfulPayments` recomputation exactly as they are today.
- **Overpayment works differently for real money.** A manual entry above the amount due is still rejected. A confirmed M-Pesa payment can't be refused because the money has already arrived. It credits up to the amount due and returns `excess`, which stays as unallocated on the M-Pesa transaction (see 3.3) for staff to deal with.
- **One "invoice paid" hook.** After the transaction commits, `applyPayment` calls registered handlers when an invoice becomes `paid`:
  - Home Learning: if the invoice is a household's `signupInvoiceId`, activate the household and children (the work `approveSignup` does after recording the payment).
  - Tech Clubs: the same for a membership's sign-up invoice.
  - Bootcamp enrolment: activate the learner and stamp the lead `paidAt` (needs 3.6).

  This replaces "an admin must click Approve or Mark paid" when the payer pays by M-Pesa. The manual buttons keep working and go through the same hook.

`recordPayment` becomes a thin wrapper: `assertAccess`, then `applyPayment(... provider: "manual" ...)`.

### 3.2 New module `server/src/modules/payments/mpesa/`

```
mpesa.config.js       env → config; isConfigured(); sandbox vs production base URL
mpesa.client.js       OAuth token (cached until shortly before expiry), stkPush, stkQuery, registerC2bUrls
mpesa.utils.js        normalisePhone (07…/01…/+254… → 2547…/2541…), EAT timestamp, STK password,
                      invoice ↔ account-reference mapping
mpesa.model.js        mpesa_stk_requests + mpesa_transactions
mpesa.service.js      initiateStk, handleStkCallback, handleC2bConfirmation, validateC2b, reconcilePending,
                      allocate (staff matching)
mpesa.routes.js       signed-in routes (initiate, status, transactions, allocate)
mpesa-callback.routes.js   public callback routes (see 3.4)
mpesa.validation.js
```

Plus `src/scripts/reconcileMpesa.js` → `npm run mpesa:reconcile` for cron.

### 3.3 Tables (one migration)

**`mpesa_stk_requests`** records each attempt to prompt a phone. Failed attempts never touch `billing_payments`, so receipts stay clean.

- `id`, `ownerAdminId`, `invoiceId`, `initiatedBy` (user id, nullable for website sign-ups), `phone`, `amount` (whole KES), `accountReference`
- `merchantRequestId`, `checkoutRequestId` (UNIQUE)
- `status`: `pending | successful | failed | cancelled | timeout | error`
- `resultCode`, `resultDesc`, `mpesaReceiptNumber`, `paymentId`, `callbackPayload` JSON, `lastQueriedAt`, timestamps
- Indexes on `(invoiceId, status)` and `(status, createdAt)` for the reconcile job.

**`mpesa_transactions`** is the ledger of money actually received, from both STK and C2B. This is what staff reconcile against M-Pesa statements.

- `id`, `ownerAdminId`, `shortcode`, `transId` (the M-Pesa receipt, **UNIQUE**, which deduplicates repeat callbacks), `transTime`, `amount`, `msisdn` (as sent, often masked), `payerName`, `billRefNumber`, `source` (`stk | c2b | statement_import`)
- `status`: `allocated | partially_allocated | unallocated | ignored`
- `invoiceId`, `paymentId`, `unallocatedAmount`, `allocatedBy`, `allocatedAt`, `rawPayload` JSON, timestamps

`billing_payments` rows created from M-Pesa use `provider: "mpesa"`, `paymentMethod: "mpesa"` (a new enum value beside `mpesa_manual`), `providerReference: <M-Pesa receipt>`, `idempotencyKey: "mpesa:<receipt>"` and `recordedBy: null`. The existing UNIQUE constraints make double-crediting impossible even if a callback and the reconcile job race.

### 3.4 Callbacks (public, unauthenticated, hostile input)

- Mount at `/api/public/pay-hooks/<MPESA_CALLBACK_TOKEN>/stk` and `/…/c2b/confirm` and `/…/c2b/validate`. Daraja's docs ask that registered URLs **not contain** words like "mpesa", "safaricom", "sql", "exec" or "cmd", so the path is neutral. The long random token in the path is the shared secret: a request with the wrong token gets a 404.
- **Save, answer, then process.** Insert or update the row first, reply `{ ResultCode: 0, ResultDesc: "Accepted" }` within a few seconds, and do the invoice work after. Safaricom does not wait long.
- **Never trust the payload alone.**
  - STK: the `CheckoutRequestID` must match a `pending` row of ours, and the amount must equal what we asked for.
  - C2B: deduplicate on `TransID`.
  - Optional hardening: call STK Query to confirm before crediting, plus a Safaricom IP allowlist once `TRUST_PROXY` is settled.
- `auditTrail` and the rate limiter already let public routes through. Log the outcome in `billing_audit_events` with `eventType: "mpesa_payment"`.

### 3.5 STK flow end to end

1. A parent, school or admin clicks **Pay with M-Pesa** on an invoice. A dialog opens with the phone number prefilled from the guardian phone and the amount set to the amount due. Partial amounts are allowed if decision D4 says so.
2. `POST /api/billing/:id/mpesa/stk`. The server checks:
   - access, using the same `assertAccess`;
   - the invoice is payable;
   - the amount is between 1 and the amount due, rounded to whole shillings (D5);
   - **no other pending request for this invoice in the last ~2 minutes**, and per-invoice and per-user limits so nobody can spam a phone with prompts.

   It then calls STK Push and returns `{ requestId }`.
3. The client polls `GET /api/billing/mpesa/requests/:requestId` every ~3 seconds for up to ~2 minutes and shows "Check your phone…", then paid, cancelled, wrong PIN, timed out or insufficient funds. The friendly copy is mapped from `ResultCode`, for example 1032 = cancelled and 1037 = phone unreachable.
4. The callback arrives, then `applyPayment`, then the receipt email (existing), the "invoice paid" hook and an admin notification.
5. **If no callback arrives** (it happens), the status endpoint runs STK Query on any request older than ~60 seconds. `npm run mpesa:reconcile` (cron, every 5 minutes) does the same for everything still `pending`, and marks requests older than ~15 minutes `timeout`.

**Staff variant:** a **Request payment** button on an invoice (admin/school) sends the prompt to the guardian's phone. It's the same endpoint, and the request records who started it.

### 3.6 Bootcamp enrolment needs an invoice up front

Today the bootcamp invoice is created only when an admin marks the lead paid. To pay by M-Pesa, `submitBootcampEnrollment` must issue a normal `bootcamp` invoice at sign-up time, as Home Learning and Tech Clubs already do. `markLeadPaid` then records a payment against that invoice instead of creating one. `getPendingPayment` should return `invoiceId` for all three kinds, so the pending screen can show a **Pay now** button.

### 3.7 Paybill account numbers (C2B, phase 3)

- STK's `AccountReference` is limited to 12 characters, and `INV-2026-000123` has 15. Give every invoice a **payment code**: its number without the prefix and dashes, `2026000123`. Matching ignores case, spaces, dashes and an `INV` prefix, so `inv-2026-000123` still matches.
- Confirmation then allocates through `applyPayment`:

  | What the payer entered | What happens |
  |---|---|
  | A code matching a payable invoice | Allocate the payment |
  | The code of a paid or cancelled invoice | Leave it `unallocated` |
  | No match | Leave it `unallocated` |
  | More than the amount due | Credit the amount due; the rest stays `unallocated` |

- Validation URL (optional, and Safaricom must enable it): accept everything. Rejecting a parent's money because of a typo is worse than reconciling it by hand.
- Show **"Pay via M-Pesa: Paybill 123456, Account 2026000123"** on the invoice page, the invoice PDF and the invoice email. This helps even before C2B auto-matching exists.

### 3.8 Staff screens

- **Billing → M-Pesa tab:**
  - every transaction, filterable by status and date, with phone numbers masked;
  - the **Unallocated** queue with "Allocate to invoice" (search by number, payer or learner) and "Mark ignored";
  - STK requests that failed or timed out.
- Invoice detail: the M-Pesa receipt number on each payment row, and the "Request payment" button.
- Register the new routes in `access.registry.js` under Billing, plus Sidebar and `StaffAccessGate`, so staff roles see what they're allowed to.
- Statement import (phase 4, optional): upload the M-Pesa org-portal CSV to backfill anything the callbacks missed. Rows are deduplicated by `transId`.

### 3.9 Configuration (per installation first)

```
MPESA_ENV=sandbox|production
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=            # Paybill number, or Head Office/store number for a till
MPESA_PASSKEY=              # Lipa na M-Pesa Online passkey
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline   # or CustomerBuyGoodsOnline
MPESA_PARTY_B=              # = shortcode for Paybill; the till number for Buy Goods
MPESA_CALLBACK_TOKEN=       # long random string, part of the callback path
MPESA_ACCOUNT_LABEL=        # e.g. "Digifunzi" — shown in the payment instructions
```

If these are unset, every M-Pesa button is hidden and nothing changes, as with email when SMTP is unset. Dev and the africa site use the sandbox; live and digifunzi.co.ke use production; Capable gets its own credentials or none.

If several workspaces or schools on one installation each need their own Paybill (D2), add an `mpesa_accounts` table later:

- one row per `ownerAdminId`, optionally per hub;
- secrets encrypted with AES-256-GCM under `MPESA_SECRETS_KEY`;
- a Settings → Payments screen, owner only, like Settings → Emails.

The service resolves the account from the invoice's hub owner, so the code above barely changes.

## 4. Phases

| # | Scope | Ships when |
|---|---|---|
| **0** | Business setup, not code: decide Paybill or Till; create a Daraja app (sandbox now); for production, "Go Live" with the shortcode's M-Pesa org-portal **business administrator** (OTP) to get the production passkey; confirm `API_PUBLIC_URL` is public HTTPS; a tunnel for local callbacks (cloudflared or ngrok) | Credentials in `.env` on dev |
| **1** | `applyPayment` refactor + invoice-paid hook (manual flows behave the same), M-Pesa config/client/utils, the two tables, STK initiate + callback + query + reconcile script, unit tests (phone normalising, password and timestamp, callback parsing, ResultCode mapping, idempotent double callback) | Sandbox STK pays an invoice end to end on dev |
| **2** | UI: Pay with M-Pesa (invoice detail for parents and staff), Request payment (staff), pending-payment screen Pay now; bootcamp invoice at enrolment; auto-activation for Home Learning, Tech Clubs and Bootcamps; admin "payment received" notification | Parent can self-activate a sign-up |
| **3** | C2B: register URLs, confirmation/validation handlers, payment codes, Paybill instructions on invoice page, PDF and email; the M-Pesa tab with the unallocated queue | Manual Paybill payments land on the right invoice |
| **4** | Website: pay at the end of the Home Learning / Tech Club / Bootcamp sign-up on digifunzi-landing (public STK endpoint scoped to the just-created sign-up's invoice by a one-time token); statement CSV import | Pay without logging in |
| **5** (optional) | B2C payouts for approved educator claims (separate shortcode, initiator + security credential, result/timeout URLs, an extra confirmation step); Transaction Status; per-workspace accounts | — |

## 5. Risks and how they're handled

| Risk | Handling |
|---|---|
| Callback never arrives | STK Query from the status endpoint + reconcile cron; statement import as a last resort |
| Duplicate callbacks or races | UNIQUE `checkoutRequestId`, `transId`, `providerReference`, `idempotencyKey`; `applyPayment` locks the invoice row |
| Forged callbacks | Secret path token, match against our own pending request, amount check, optional STK Query re-check and IP allowlist |
| Phone spam via repeated prompts | One pending request per invoice; per-user and per-invoice rate limits; only people with invoice access (or a one-time sign-up token) can start one |
| Cents on invoices | M-Pesa takes whole shillings only (D5) |
| Above M-Pesa's per-transaction cap (commonly cited as KES 250,000; confirm with Safaricom) | Block in the dialog; suggest a partial payment or bank transfer |
| Server clock in UTC | Build Daraja timestamps explicitly in EAT (UTC+3) |
| Local testing sends real email | The local `.env` has a live Brevo key, so receipt emails from local tests are real. Use dev or the sandbox with the mailer unset |
| Personal data (Kenya DPA) | Store phone numbers, but mask them in lists and limit them to billing-permitted staff |

## 6. Decisions needed

- **D1 — Paybill or Till?** **Decided 21 Oct 2026: Paybill.** `MPESA_TRANSACTION_TYPE=CustomerPayBillOnline`, `MPESA_PARTY_B` = the Paybill number, and C2B (phase 3) is in scope.
- **D2 — Whose account receives the money?** Recommended: **one account per installation** (env) for now. Schools issuing their own invoices would be collecting into Digifunzi's account, so confirm that's acceptable or make per-workspace accounts part of phase 3.
- **D3 — Auto-activate sign-ups once fully paid by M-Pesa?** Recommended: **yes**, for access only. Placement (curriculum, grade, educator) stays the admin's job, as today.
- **D4 — Allow partial STK payments?** Recommended: **yes**. Invoices already support `partially_paid`.
- **D5 — Cents:** round the STK amount **up** to the next shilling and credit only the amount due, or keep all invoice totals in whole shillings? Recommended: whole-shilling totals for KES invoices.
- **D6 — Educator payouts by B2C:** in scope, or later?
