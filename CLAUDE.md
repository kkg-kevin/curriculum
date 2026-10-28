# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Run everything (dev mode):**
```bash
npm run dev          # from repo root — starts both client and server concurrently
```

**Run individually:**
```bash
cd client && npm run dev   # Vite dev server (default: http://localhost:5173)
cd server && npm run dev   # nodemon (default: http://localhost:5000)
```

**Install dependencies** (run from each directory separately — there is no root-level install script):
```bash
npm install            # root
cd client && npm install
cd server && npm install
```

**Tests (server):**
```bash
cd server && npm test                                  # no database needed
cd server && TEST_DB_NAME=digifunzi_nfr_test npm test   # also the database tests, against a throwaway database (name must end in _test)
```

**Lint / format (client):**
```bash
cd client && npx eslint src
cd client && npx prettier --write src
```

## Architecture

This is a **feature-based monorepo** with no shared code between `client/` and `server/`. Each side mirrors the same domain boundaries (schools, learners, teachers, classes, curriculum, assessments, reports, settings).

### Client (`client/` — React 19 + Vite + MUI)

Entry: `client/src/main.jsx` → wraps `<App>` in `BrowserRouter`.  
Routing: `client/src/routes/AppRoutes.jsx` — all routes nest under `MainLayout` (authenticated shell with Sidebar + Header + Footer + `<Outlet />`). `AuthLayout` is a stub for login/register pages.  
API: a single Axios instance in `client/src/services/api.js` reads `VITE_API_URL` from the client `.env`. All feature-level API files (`modules/<feature>/services/<feature>Api.js`) import from this shared instance.  
State: React Context for auth (`client/src/context/AuthContext.jsx`). Redux Toolkit + TanStack Query are installed but not yet wired up — use Redux for global UI state and React Query for server state as features are built.  
Forms: react-hook-form + Zod resolvers.  
Charts: Recharts. Rich text: TipTap.

**Planned module structure** (not yet scaffolded — stub pages exist only in `AppRoutes.jsx`):
```
client/src/modules/<feature>/
  pages/         # route-level components
  components/    # feature-specific components
  services/      # <feature>Api.js — calls shared axios instance
```

### Server (`server/` — Node/Express, CommonJS)

Entry: `server/src/server.js` — loads `.env`, starts the HTTP server.  
App: `server/src/app.js` — mounts CORS, JSON body parser, Morgan logger. Routes will be registered here.  
Config: `server/src/config/db.js` exports a Knex singleton connection pool (reads `server/knexfile.js`, MySQL via `mysql2`). `server/src/config/env.js` exports env vars incl. `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`.

### Database (MySQL via Knex)

Every `*.model.js` is a thin Knex query-builder wrapper (no ORM) exposing the same `create/findAll/findById/update/delete` + custom-finder shape regardless of module — services/controllers call these and `await` them like any other async function. JSON-shaped fields (nested arrays/objects like `assessments.items[]` or `course-sessions.mainConcepts[]`) are stored as MySQL `JSON` columns; write them through `stringifyJsonFields`/`toJson` from `server/src/shared/utils/model.utils.js` (mysql2 does not auto-serialize a raw JS object/array on insert, but does auto-parse JSON columns back on read). No DB-level `FOREIGN KEY` constraints — referential integrity is enforced at the application layer, same as the old JSON-file era.

Migrations live in `server/src/db/migrations/` (`npm run db:migrate` / `db:migrate:rollback` / `db:migrate:status`, from `server/`). The one-time JSON→MySQL loaders and the `server/data/*.json` files they read from have been removed now that the migration is complete and MySQL is the sole source of truth.

**Planned module structure** (not yet scaffolded):
```
server/src/modules/<feature>/
  <feature>.routes.js
  <feature>.controller.js   # request/response only, no business logic
  <feature>.service.js      # all business logic lives here
  <feature>.model.js        # DB schema
  <feature>.validation.js   # Zod schemas
```

Shared backend utilities live in `server/src/shared/`:
- `middleware/auth.middleware.js` — JWT verification + role/permission checks (stub)
- `middleware/error.middleware.js` — global error handler (stub)
- `utils/` — `helpers.js`, `logger.js`
- `validators/common.validator.js` — Zod schemas shared across modules

### Curriculum domain model

The curriculum hierarchy is the core data structure:
```
Curriculum → Grade → Subject → Module → Topic → Session
```

## Environment variables

Copy and fill in before running:

**`client/.env`**
```
VITE_API_URL=http://localhost:5000
```

**`server/.env`**
```
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=
DB_PASSWORD=
DB_NAME=digifunzi
DB_POOL_MAX=          # default 8 — keep it under the host's max_user_connections for DB_USER
TRUST_PROXY=          # optional — how many proxies sit in front of the app (usually 1 on cPanel), so rate limits see each real address; check on the host before setting
PASSWORD_WORKERS=     # default 2 — threads that hash and check passwords off the main thread
JWT_SECRET=
CLIENT_URL=http://localhost:5173   # also the base of every link in an email
# Outbound email — all optional. Unset, nothing is sent (locally the email is printed to the server log).
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
BREVO_API_KEY=        # when set, email is sent through Brevo's HTTP API instead of SMTP (hosts that block SMTP ports)
MAIL_FROM=            # e.g. Digifunzi <hello@digifunzi.com>
MAIL_REPLY_TO=
MAIL_BRAND_NAME=      # default "Digifunzi"
MAIL_LOGO_URL=        # optional — the email header logo is served by this API (/email-assets) once API_PUBLIC_URL is set; this points at a different image
MAIL_WEBSITE_URL=     # optional — footer link; default is the first https PUBLIC_SITE_URL
MAIL_SOCIAL_LINKS=    # optional — footer links, e.g. Facebook=https://…,Instagram=https://…
PASSWORD_RESET_MINUTES=   # default 60
# M-Pesa (Daraja, one Paybill per installation) — all optional. Unset, every M-Pesa button is hidden.
MPESA_ENV=sandbox         # or production
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=          # the Paybill number
MPESA_PASSKEY=            # Lipa na M-Pesa Online (M-Pesa Express) passkey
MPESA_CALLBACK_TOKEN=     # long random string (24+ chars) — part of the callback URLs
MPESA_CALLBACK_BASE_URL=  # optional — default API_PUBLIC_URL; must be public https (a tunnel locally)
MPESA_ACCOUNT_LABEL=      # optional — the name payers see
MPESA_OWNER_ADMIN_ID=     # optional — workspace for Paybill payments matching no invoice (default PUBLIC_CONTENT_ADMIN_ID)
```

### M-Pesa

`server/src/modules/payments/mpesa/`. Money reaches an invoice only through `BillingService.applyPayment` (staff "Record payment" goes through it too); an invoice becoming fully paid runs `billing.paid-hooks.js`, which switches on Home Learning / Tech Club / Bootcamp website sign-ups. Safaricom calls `/api/public/pay-hooks/<MPESA_CALLBACK_TOKEN>/…`. Every payment received is one `mpesa_transactions` row (UNIQUE M-Pesa receipt), so repeated callbacks can't pay twice; ones that match no invoice wait in Billing → M-Pesa. An invoice's Paybill account number is its number without prefix/dashes (`INV-2026-000123` → `2026000123`). Cron: `npm run mpesa:reconcile` every 5 minutes; once per Paybill: `npm run mpesa:register-urls -- --yes`. Plan and status: `Guide/MPESA_INTEGRATION_PLAN.md`.

### Payment step after a website sign-up

Home Learning, Tech Club and Bootcamp sign-ups end with a Payment step (website `components/payments/PaymentStep.jsx`). The sign-up has already created the accounts and invoice; `PaymentLinks.forWebsite` hands back a link token plus the methods switched on in Settings → Payments → How families can pay (`payments/payment-options.js`, one `payment_options` JSON row per workspace: Paybill, Send Money, bank, cheque, cash). The family says "I've paid" → a `payment_notices` row (M-Pesa codes UNIQUE via `dedupeKey`) → staff Confirm/Reject in Billing → To confirm (`payments/payment-notices.service.js`); Confirm goes through `BillingService.applyPayment`, and an invoice paid any other way closes its pending notices (paid hook). Until Daraja is live the Paybill is manual (code typed in, "phone prompt coming soon"); once live it is automatic and needs no notice.

### Email

Account emails (password reset, invoice issued, payment receipt, emailed notifications) go through `server/src/shared/mail/mail.service.js`'s `queueMail`, never straight to `shared/utils/mailer.js`: each is written to `email_outbox`, sent in-process one at a time, and retried on failure. `npm run mail:process` (from `server/`) sends anything still due — run it from a cron job. Build bodies with `shared/mail/mail.layout.js`'s `renderEmail` (HTML + plain text from one data shape; `tone`/`icon`/`eyebrow` give each kind of email its look, `highlight` its key figure, `person` the learner it is about, `sender` a hub's own name and logo). Each module keeps its own `<feature>.emails.js`. Lead emails use the same layout but still call `mailer.js` directly.

Who gets what is decided in two layers, both in `server/src/modules/notifications/`: the workspace (`email_settings`, Settings → Emails, owner only — a type switched off there is sent to nobody in that workspace, including automatic invoice/receipt emails) and then the person (`users.emailPreferences` — the bell, profile pages, or the no-sign-in link in every notification email's footer, `/email-preferences?token=…`). A new emailed notification type goes in `notification.emails.js`'s `EMAIL_TYPES`; pass `ownerAdminId` to `_notify` when the recipient's workspace can't be worked out from their account (educators). Password emails ignore both layers.

### One login, several roles

`server/src/modules/auth/account-roles.js`. `users.role` is the account's own role; `users.extraRoles` (JSON) lists educator / learning hub / parent roles (`teacher`, `school`, `learner`) it may also sign in as. They are added when the same email is saved as an educator, hub or parent (`AuthService.setOrCreatePassword` / `linkExistingLogin`), never changing that login's password; staff, supervisors and admins still need an email of their own. One more extra role, `hubLead` (Account Manager / Training Lead), comes from being named on a learning hub, not from an email (`CheckinService.syncHubLeadRole`): that session runs as `school` with `req.user.hubLead` in the hub portal — every hub of the workspace, view only (`blockHubLeadWrites` lets only check-in reports, their pictures (`/api/uploads/image`), auth and notifications through). A session runs as ONE role: it is in the token, `protect` sets `req.user.role` from it, so nothing downstream sees more than one. Login returns `roles`; with more than one the login page asks which (`RoleChooser`), and the header's `RoleSwitcher` moves the session (`POST /api/auth/switch-role` — the old session ends, a new cookie replaces it). An extra role whose record is deleted drops out of `roles`.

### Hub check-ins

`server/src/modules/checkins/` + `client/src/modules/checkins/` (sidebar "Hub Check-ins", `/checkins`). Kept deliberately simple (26 Oct 2026): notification → check-in → report. Each hub names its Account Manager and Training Lead on the hub form (`learning_hubs.accountManagerId` / `trainingLeadId`) — an educator with a login, or an admin; no staff roles. An educator named there gets the `hubLead` sign-in (see One login, several roles) and does check-ins in the hub portal (`/school-portal/checkins`); the pop-up also shows in the teacher portal and switches them there. The admin sets up a schedule per hub — how often (weekly / monthly / every 6 months / yearly), the first date, online or in person — and its people come from the hub (`applyHubPeople` moves upcoming check-ins when the hub's change). How or where it's held isn't recorded. Staff only take part as managers (`checkins-manage`). `checkins-manage` (or being an admin) is schedules and every hub's check-ins. Account Managers / Training Lead see only hubs they're assigned to (`checkin.access.js`) — enforce that per record in the service, not just by route. Schedules generate `checkin_sessions` ahead (90 days) from `generateFrom`, keyed UNIQUE (scheduleId, occurrenceDate), so generation is always safe to repeat; editing a schedule only rewrites unreported upcoming ones. A check-in is upcoming, then due from its day (a `checkin_due` notification, and the sign-in pop-up `CheckinsDuePopup` from `GET /api/checkins/due` until its report is in), then reported (`status` open | reported). The report is `{ highs, lows, resolutions }`, all three required, correctable afterwards — each rich text (HTML from the assessments `RichTextEditor`, shown through `RichContent`; reports from before 27 Oct 2026 are plain text, read via `reportHtml` in `checkins/shared.jsx`). The hub's own login reads its own check-ins and their reports in the hub portal (sidebar "Check-ins", read only — `isHub` in `checkin.access.js`). Tasks from the resolutions (`checkin_tasks`, 27 Oct 2026, kept light — open | done): whoever can write the report sets them from the check-in's day — title, assignee (the check-in's Account Manager, its Training Lead, or a workspace admin), deadline; the assignee (or a writer) ticks them off. Notified on assignment (`checkin_task_assigned`, straight to that person via `_deliver`) and once per deadline (`checkin_task_due`, `remindedFor`). Listed under the report and in Check-ins → My tasks / All tasks (managers); the hub sees them read only. Dates are Kenyan calendar dates (`todayInKenya`). Cron: `npm run checkins:process` hourly (generation and the due notices, dedupe-keyed); pages do the same for their workspace at most every 5 minutes.

### Deleting something still in use

There are no DB foreign keys, so every delete of something others depend on (curricula, hubs, courses + their modules/sessions, assessments, classes, class groups, educators, learners, competencies, a curriculum's adopted competencies/indicators/pathways/stages/bands, system levels, items, rooms, access roles, bootcamps, games, supervisors, Home Learning + Tech Club packages) calls `UsageService.guardDelete(req, res, type, id, "This X")` (`server/src/modules/usage/usage.service.js`) after its own permission checks: in use → 409 `IN_USE` with what uses it; nothing is unlinked. `?check=1` on the same DELETE only answers `{ inUse, usages, alternative }` (no delete, no audit row). Client: each api module has a `check…` twin (`checkDelete` in `services/api.js`); pass it as `ConfirmDialog`'s `usageCheck`, plus `onAlternative` where the record can be deactivated/archived instead. `InUseNotice` (App.jsx) shows any refused delete. A new deletable record type: add it to `CHECKS` + `OWNER`, guard the route, wire the dialog.

### Parent portal

A parent login (role `learner`, an email, no username — `isParent` in `server/src/modules/parent/parent.access.js`, `isParentUser` on the client) has its own portal at `/parent` (`ParentPortalLayout`); a child's own username login keeps `/learner-portal`, which sends a parent to the same place in `/parent` (`parentPathFor`). Family home + joint timetable + child logins come from `/api/parent` (`parent.service.js`, every child in `req.ownLearners`). A child's page (`/parent/children/:id`, `ParentChildLayout`) reuses the learner-portal pages scoped by `X-Active-Learner-Id`, with `viewOnly` + `portalBase` in the outlet (use `usePortalNavigate` for links in shared learner pages). Parents watch, children do: `notAsParent` refuses a parent starting/saving/submitting work. Billing for a learner-role login is the whole family's (`familyInvoices`).

### B2B and B2C in billing

Every invoice is B2B (billed to an organisation — `payerHubId`: hubs/schools) or B2C (billed to a person — parents, households, website buyers). `billing.service.js`'s `customerKindOf` sends it as `customerKind` on invoices and receipts; `listCustomers` returns hubs (`kind: b2b`) plus families (`kind: b2c`, grouped by billed email, else login/phone/name — `familyCustomers`). Admin billing's Customers / Invoices / Payments tabs share an All / Business / Families switch (`?kind=`, `components/customerKind.jsx`). No stored column — derived from the payer.

### Staff learner page

One page per learner for staff: `client/src/modules/learners/pages/LearnerPage.jsx` at `/learners/:id` (hub portal: `/school-portal/learners/:id/view`, since `/school-portal/learners/:id` is the hub's list; the old `/view` and `/profile` addresses redirect). It is the learner portal's own profile (same cards) plus the staff tools: the top bar (`components/staff/LearnerStaffBar.jsx`: activate/deactivate, full Edit form, remove, "Preview as learner"), in-place edits through the learner portal's `EditProfileModal` / `EditGuardianProfileModal`, hub enrollments in the side rail, stage/pathways/diagnostics/placement on the Pathway tab, activity log on a History tab. The staff cards live in `modules/learners/components/staff/`. Link to it with `learnerPath(role, id, "view")`.

### Part payments

Any invoice can be paid in parts (`BillingService.applyPayment` → `partially_paid`). On top of that (28 Oct 2026): an invoice may have a payment schedule (`billing_invoice_instalments`, rules in `billing/billing.instalments.js` — payments count towards the earliest part first; each part's state is worked out, never stored). Staff set one on the invoice page (`PUT /api/billing/:id/instalments`: a plan, parts typed by hand, or none); families choose one of the workspace's plans on the website Payment step / `/pay/:token` before anything is paid (`POST /api/public/payments/:token/plan`). Rules per workspace are `payment_options.options.partPayments` (Settings → Payments → Part payments): plans, `minimumPercent` that switches a sign-up on (0 = any payment — `billing.paid-hooks.js`'s `runInvoiceActivationHooks`; Store orders and closing notices still wait for full payment), reminder days, grace days, `pauseAccess`. Cron: `npm run billing:process` hourly (`billing.process.js`) — overdue status, reminder emails (`payment_reminder`, switchable in Settings → Emails) and bell notices, and pausing a family's learners (accountStatus `pending_payment`, tracked in `billing_access_pauses` by `billing.access.js`) after the grace days; paying switches them back on. Hubs are reminded, never paused.

### Online hubs (Join buttons)

A hub with `deliveryMode` `virtual` or `hybrid` and a `meetingLink` (Google Meet, Zoom…, set on the hub form) teaches online. `TimetableService.resolveCalendar` puts that link on each of its classes' calendar events (`onlineLinkForClass`), so every calendar (educator, learner, parent, hub) carries it — never the public site. Client: `modules/timetable/components/OnlineClass.jsx` — Join on timetable cards and the session pop-up, a "Next online class" card on the educator / learner dashboards, an "Online class" strip on My Courses, each course page, Course Content class cards and My Class, a Join under the parent's "Next session", an Online tag in hub lists; green ("live") from 15 minutes before a session until it ends. Meet opens in a new tab (it can't be embedded). A Google Meet link must carry a meeting code (`abc-defg-hij`) — the hub form refuses one without. One link per hub (no per-class link yet); no Google API — meetings are made by hand from a (preferably Workspace) account.

### Enquiry housekeeping

`server/src/modules/leads/lead.housekeeping.js`, run daily by `npm run enquiries:process` (cron, mornings); rules in Settings → Enquiries (owner only; one `enquiry_settings` row for the installation — every admin sees every website enquiry). No enquiry is ever deleted: a daily `enquiries_waiting` reminder (to `PUBLIC_CONTENT_ADMIN_ID`'s admins, else every admin; deduped per day) about enquiries still New after N days; New/Contacted enquiries with no change, reply or note for N days are Closed (`leads.autoClosedAt`, a note on the thread) unless a sign-up, invoice, learner or payment came of them; and, off by default, Closed ones untouched for N months lose their personal details (`leads.anonymisedAt` — name, email, phone, child's name, message, the replies/notes). Website enquiry notifications go to the enquiry's workspace's admins once each (`lead_submitted:<id>` dedupe); personal notifications use `NotificationService.notifyPerson` (never fanned out to an organisation's admins like `_notify`).
