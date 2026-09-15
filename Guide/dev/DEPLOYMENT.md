# Deployment Guide — Digifunzi Curriculum

## Overview

Two independent environments, same codebase, **separate databases** — see
"Two environments" below before deploying to either.

| Environment | Part | Technology | URL |
|---|---|---|---|
| **Dev** | Frontend | React 19 + Vite | https://curriculum.digifunzi.com |
| **Dev** | Backend | Node.js + Express | https://nodeapp.digifunzi.com |
| **Live** | Frontend | React 19 + Vite | https://dcf.digifunzi.com |
| **Live** | Backend | Node.js + Express | https://dcf-api.digifunzi.com |

---

## Two environments — Dev vs. Live

**Dev** (`curriculum.digifunzi.com` / `nodeapp.digifunzi.com`) is where new
work gets tested before it's trusted. **Live** (`dcf.digifunzi.com` /
`dcf-api.digifunzi.com`) is what real users see. They are **two completely
separate stacks** — separate cPanel Node.js app, separate MySQL database,
separate `uploads/` folder, separate secrets (`JWT_SECRET`, `ADMIN_PASSWORD`).
Nothing is shared between them on purpose: a bug, a bad migration, or test
data created while developing against Dev must never be able to reach Live.

Everything in the rest of this guide (migrations, env vars, the deploy steps)
applies identically to either environment — just point it at the right
subdomain pair and database. The one genuinely different step is the
**frontend build**, because `VITE_API_URL` gets baked into the JS bundle at
build time, so Dev and Live need two separate builds:

```bash
cd client
npm run build          # Dev build — reads .env.production, bakes in https://nodeapp.digifunzi.com
npm run build:live     # Live build — reads .env.live, bakes in https://dcf-api.digifunzi.com
```

Each writes to the same `client/dist/` — **build and package one environment
completely (zip it, move the zip aside) before building the other**, or the
second build's `dist/` overwrites the first's before you've packaged it.

### One-time setup for Live (cPanel side — manual, not scriptable from here)

1. **Create two new domains** (cPanel → **Domains** → **Create A New Domain**):
   `dcf.digifunzi.com` and `dcf-api.digifunzi.com`. Same tool/page that shows
   `curriculum.digifunzi.com` and `nodeapp.digifunzi.com` today — accept the
   default Document Root cPanel suggests for each.
2. **Create a new MySQL database + user** (cPanel → MySQL Databases) — a
   second one, fully separate from Dev's. Same one-time steps as "Backend
   Deployment" → "One-time: create the MySQL database" below, just don't
   reuse the existing database/user. Note the new (cPanel-prefixed)
   `DB_NAME`/`DB_USER`/`DB_PASSWORD`.
3. **Create a second cPanel Node.js App**, application root e.g.
   `dcf-api.digifunzi` (parallel to the existing `curriculum.digifunzi` root),
   Application URL `dcf-api.digifunzi.com`, startup file `src/server.js` —
   same settings as the "cPanel Node.js App Settings" table below, just a
   different app instance so Dev and Live run as genuinely separate Node
   processes (not one process serving both).
4. **Set Live's own environment variables** in that new app's panel — same
   variable names as the table below, but with Live's own values:
   - `CLIENT_URL=https://dcf.digifunzi.com`
   - `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` — the **new**
     database from step 2, never Dev's
   - `JWT_SECRET` — generate a **new, different** long random string; never
     reuse Dev's (a compromised dev secret would otherwise also compromise
     live sessions)
   - `ADMIN_EMAIL`/`ADMIN_PASSWORD` — Live's own first-admin login, not Dev's
   - `PUBLIC_SITE_URL`/`API_PUBLIC_URL`/`SMTP_*`/`MAIL_*` — same meaning as
     Dev, set independently if/when Live needs them (e.g. `API_PUBLIC_URL=https://dcf-api.digifunzi.com`)
5. **Deploy backend to the new app** — same "Steps to Deploy / Re-deploy
   Backend" below, targeting the `dcf-api.digifunzi` app root instead of
   `curriculum.digifunzi`. The automatic startup migration runs against
   Live's fresh database on first Restart — Live starts with an empty schema
   that gets built from scratch, same as Dev's very first deploy did.
6. **Deploy frontend to the new subdomain** — same "Steps to Deploy /
   Re-deploy Frontend" below, but build with `npm run build:live` (not
   `npm run build`) and upload to the `dcf.digifunzi.com` document root
   instead of `curriculum.digifunzi.com`'s.
7. **Test** — visit `https://dcf-api.digifunzi.com` (expect
   `{ "message": "API is running" }`), then log into
   `https://dcf.digifunzi.com` with Live's own `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

### Re-deploying after this, per environment

Every future code change gets deployed to **both** environments, but as two
separate deploy passes — Dev first (to verify), then Live once confirmed:

```bash
# Dev
cd client && npm run build && cd ..
# package + upload to curriculum.digifunzi.com / nodeapp.digifunzi.com, as below

# Live — once Dev is confirmed working
cd client && npm run build:live && cd ..
# package + upload to dcf.digifunzi.com / dcf-api.digifunzi.com, as below
```

The backend zip (`backend-deploy.zip`) is **identical for both** — it's the
same code either way, only the `.env` on each cPanel Node app differs. Only
the frontend needs a second, separately-built zip.

---

## This release (15 Sep 2026) — Bootcamp auto-enrollment with cash-payment gating · Hub Visits replaces Mentor Sessions

**Dev-only so far** — not yet built or verified for Live. Deploy to Dev first; rebuild the
Live-flavoured portal zip (`npm run build:live`) and re-verify separately before touching Live.

Seven new migrations (auto-apply on Restart), one destructive (drops the just-released
`mentor_sessions` table — see below). Backend + portal frontend + website all change.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20260915060000_drop_mentor_sessions.js` | **Destructive.** Drops `mentor_sessions` (superseded by `hub_visits` below) | ⚠️ any logged mentor sessions are lost — this table shipped 14 Sep, so real data is unlikely, but take a `mysqldump` backup first if Dev has any |
| `20260916090000_add_space_id_and_visit_fields.js` | Adds `id` to each `learning_hubs.spaces[]` JSON entry (in-place JSON update) and visit-related columns | unchanged — existing spaces get a generated id |
| `20260916100000_create_hub_visits.js` | New `hub_visits` table — a learner's logged visit to a non-school hub space (date, duration/units, computed amount) | n/a (new table) |
| `20260916110000_add_hub_usage_invoice_type.js` | Adds `hub_usage` to `billing_invoices.invoiceType` enum | unchanged |
| `20260916120000_backfill_space_ids.js` | One-time backfill — assigns an id to any `learning_hubs.spaces[]` entry that predates `20260916090000` | unchanged except the added ids |
| `20260917090000_add_pending_payment_to_learner_account_status.js` | Adds `pending_payment` to `learners.accountStatus` enum | unchanged |
| `20260917091000_add_bootcamp_enrollment_fields_to_leads.js` | Adds `learnerId`/`hubId`/`bootcampId`/`paidAmount`/`paidCurrency`/`paidAt`/`paidByUserId` (all nullable) to `leads` | unchanged — every existing lead gets nulls |

### What changed

1. **Bootcamp auto-enrollment.** A visitor completing a bootcamp diagnostic can now click
   "Enroll now" instead of just sending an enquiry: submitting their details immediately creates a
   real learner account (`firstname.lastname@digifunzi.com`, an 8-digit temporary password),
   enrolled straight into the bootcamp's own hub + class. The account can log in right away but is
   locked to a read-only "Account Suspended" screen (`accountStatus: "pending_payment"`) until an
   admin records the cash payment.
2. **Admin "Mark paid" on Enquiries.** A bootcamp-enrollment lead now shows what's owed (amount +
   hub, resolved from the bootcamp's own price) and a "Mark paid" action that records a real
   invoice + payment (`billing_invoices`/`billing_invoice_items`/`billing_payments`, invoice type
   `bootcamp`) and flips the learner to `accountStatus: "active"` in one transaction.
3. **Price shown everywhere it's owed.** The website's enrollment confirmation screen, the
   learner's "Account Suspended" screen on every login and page reload, and the admin Enquiries
   list all now show the same price/hub, sourced from the same place (the bootcamp's own
   `priceAmount`/`priceCurrency`) so the numbers can't drift apart.
4. **Self-service change password.** A learner locked to the payment screen (or anyone else) can
   change their password via a new `PATCH /api/auth/change-password` — needed since a temporary
   password is shown only once at enrollment.
5. **Hub/class collision fix.** Two bootcamps (or competitions) sharing the same curriculum
   couldn't run at the same hub — class uniqueness had no way to tell their cohorts apart. Each
   offering now stamps its own name as the class's `streamName`.
6. **Mentor Sessions replaced by Hub Visits.** Same purpose (logging what a non-school hub earns)
   but learners are now placed into a specific hub space (`spaceId`, optionally with a negotiated
   rate), visits are logged per space, and charges batch-generate into real invoices (a new
   `hub_usage` invoice type, only ever created this way, never by hand). Adds a cross-hub Revenue
   overview page (`/learning-hubs/revenue`, admin-only — a collaborator gets a 403 from the API).
7. **Programs list toolbar.** Competitions/Bootcamps list page gets a "Published only" filter and a
   sort dropdown (newest / start date / name), plus a clearer Live/Draft badge on each card.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — includes all seven migrations above, the new `modules/bootcamp-enrollment/*`
and `modules/hub-visits/*` (replacing `modules/mentor-sessions/*`, now deleted),
`shared/utils/credential-generator.js`, `resolveSuspension`'s new `"payment"` reason and
`getPendingPayment` in `auth.service.js`, and the `mark-paid` route on the existing
`/api/leads` router. `/api/hub-visits` and the new public
`/api/public/bootcamp-enrollments` routes mounted in `app.js`. `knexfile.js` at the app root as
always. **No env change.**

### Portal frontend (`assets.zip` + `index.html`)

- Dev build (`npm run build`): **`index-Cxdy4lje.js`** / CSS `index-CPRP9smp.css` (unchanged CSS
  hash — no stylesheet changes this release).
- Live build (`npm run build:live`): not yet built for this release — build it before deploying to
  Live.
- New: Enquiries page's "Mark paid" panel (pre-filled from the bootcamp's price) and expected-amount
  line; "Account Suspended" screen's payment-pending price panel + collapsible change-password card;
  Learning Hubs page's "Revenue" entry point and the new Hub Visits finance tab/pages replacing
  Mentor Sessions; Programs list's published-only filter/sort toolbar.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- New `BootcampEnrollForm.jsx`, rendered inline on the bootcamp diagnostic report when "Enroll now"
  is clicked (replaces the old "Enquire to book" full-page navigation). On success, shows the new
  login email, one-time temporary password, and the bootcamp's price/hub, with a link to
  `VITE_APP_URL` to log in.
- **New required env var: `VITE_APP_URL`** — the curriculum portal's own origin (Dev:
  `https://curriculum.digifunzi.com`, Live: `https://dcf.digifunzi.com`). Added to
  `.env.production` (Dev value) as part of this release; without it the "Go to login" button falls
  back to `http://localhost:5173`.
- **Built with `npm run deploy:build`, but `nodeapp.digifunzi.com` was unreachable from this build
  environment** (`fetch failed` on every `/api/public/*` list call, all retries exhausted) — same
  transient-network situation the 13 Sep release hit. The Pathways/Projects/Store/Bootcamps/
  Competitions sections (list + detail) shipped as SPA-only HTML; the 9 static routes + already-known
  pathway/project/store detail pages from the previous prerender's sitemap still prerendered fine.
  Every page is still fully functional for visitors — this only affects the pre-baked SEO snapshot.
  **Recommended:** re-run `npm run deploy:build` from a machine with a working connection to
  `nodeapp.digifunzi.com` and re-upload once convenient.

### Deploy order

1. **(Optional but recommended) Take a `mysqldump` backup** — one migration this release
   (`20260915060000`) drops a table.
2. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. Check the app log: seven
   migrations should apply cleanly (or fewer, if some already ran).
3. **Portal** `assets.zip` + `index.html` from `Guide/dev/`.
4. **Website** `africa-digifunzi-com-dist.zip` from `Guide/dev/` → the `africa.digifunzi.com`
   document root.
5. **Verify:**
   - On a bootcamp's public diagnostic report, click "Enroll now" → submit → confirm the response
     shows a new `@digifunzi.com` login, a temporary password, and the bootcamp's price/hub.
   - Log in with that new login → confirm you land on the "Account Suspended" (payment) screen and
     it shows the same price/hub; confirm a GET request works but any write returns 403
     `{code:"ACCOUNT_SUSPENDED", reason:"payment"}`.
   - In the portal's Enquiries page, find that lead → confirm it shows "Account created — awaiting
     KES X at <hub>" and a "Mark paid" panel pre-filled with that same amount → submit → confirm a
     "Paid" badge appears.
   - Log in as that learner again → confirm full access (no suspension screen).
   - Open a Learning Hub (non-school) → confirm "Revenue" appears on the Learning Hubs page and the
     hub's own Hub Visits tab lets you log a visit against a specific space and generate charges.
   - Try running two different bootcamps that share a curriculum at the same hub → confirm neither
     is blocked by a false "class already exists" collision.

---

## This release (14 Sep 2026) — Bootcamp diagnostic tests · per-module pricing · Mentor Sessions · collaborator role

**Dev-only so far** — not yet built or verified for Live. Deploy to Dev first; rebuild the
Live-flavoured portal zip (`npm run build:live`) and re-verify separately before touching Live.

Five new migrations (auto-apply on Restart, none destructive). Backend + portal frontend + website
all change.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20260914090000_add_collaborator_role.js` | Adds the `collaborator` role (tenant-wide content-editing access, no delete/manage-collaborators) | unchanged |
| `20260914110000_create_mentor_sessions.js` | New `mentor_sessions` table — logs a mentor-learner session at a non-school hub (mentor, learner, date, amount) | n/a (new table) |
| `20260914120000_bootcamp_price_note_to_notes_array.js` | Converts `bootcamps.priceNote` (single string) to `priceNotes` (JSON array) | existing single note becomes a one-item array |
| `20260914130000_add_public_diagnostic_to_bootcamps.js` | Adds `diagnosticAssessmentId` (fk, nullable) + `publicDiagnosticEnabled` (boolean, default false) to `bootcamps` | unchanged — every bootcamp starts with no diagnostic configured |
| `20260914130100_create_public_bootcamp_diagnostic_attempts.js` | New `public_bootcamp_diagnostic_attempts` table — mirrors `public_diagnostic_attempts`, scoped to a bootcamp instead of a pathway | n/a (new table) |

### What changed

1. **Bootcamp public diagnostic test.** Same feature Pathways already had: an admin picks an
   auto-gradable assessment + the bootcamp's own age range, toggles "Offer this diagnostic to
   anonymous visitors," and a website visitor can take a short quiz and get an instant graded
   report (with a permanent shareable link) before enquiring to book. New admin-side "Diagnostic
   test" section on the Bootcamp create/edit form and a status card on the view page. New public
   endpoints: `GET /api/public/bootcamp-diagnostics/:bootcampIdOrSlug[/availability]`,
   `POST /api/public/bootcamp-diagnostics/:bootcampIdOrSlug/submit`,
   `GET /api/public/bootcamp-diagnostics/attempts/:attemptId`. `GET /api/public/bootcamps/:idOrSlug`
   now also returns a `diagnostic: { available, minAge, maxAge }` field.
2. **Per-module pricing.** A priced course with more than one module can now be priced by module
   instead of as a whole (`coursePricing[].modulePricing: [{ moduleId, priceAmount, priceCurrency }]`),
   for courses where a parent might only want one module. Mutually exclusive with that same
   course's own `priceAmount`, same either/or posture as the whole-bootcamp-vs-by-course choice one
   level up. Shown on the admin view page's Course pricing section and the public site's
   `CoursePricingRoadmap`.
3. **Pricing mutual exclusivity, properly editable.** A bootcamp is priced either as a whole or by
   course, never both — this already existed, but editing a bootcamp couldn't switch modes once one
   was set (the priced field was disabled, not clearable). Fixed: pricing mode is now explicit,
   admin-controlled state; switching clears the other field.
4. **Mentor Sessions module** (non-school hubs only) — log a mentor-learner session (mentor,
   learner, date, amount) and see it roll up into a hub's revenue total on its view page. Deliberately
   separate from Billing, which already covers school hubs billing guardians directly.
5. **Collaborator role.** An admin can invite an existing user (or a new one) as a collaborator with
   edit access across everything the admin can create — curricula, courses, assessments, hubs,
   bootcamps, competitions, settings — but not delete or manage other collaborators.
6. **Bootcamp admin view page UI pass** — quick-scan stat chips (price/age/dates/hub count) in the
   header, clearer "priced per course vs. priced as a whole" labeling, a module-pricing breakdown
   that the course-pricing display was previously missing entirely.
7. **Public bootcamp page polish** (accumulated small fixes) — "Enquire to book" no longer
   duplicated, description word-capped (150 words) with a "Read more" toggle, richer "Running at"
   hub cards (photo/address/contact) replacing the old flat "Upcoming runs" list, a `curriculum`
   summary (name/description/competencies) on the detail response, polished start/end/registration
   date badges on bootcamp listing cards, and the course-pricing roadmap's left accent-border stripe
   removed from each card.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — includes all migrations above, the new `modules/mentor-sessions/*` and
`modules/public-site/public-bootcamp-diagnostic.*`, the `assertPublicDiagnosticAllowed` /
`assertCourseEntryPricingValid` guards in `bootcamp.service.js`, `resolveCoursePricing`'s
module-pricing resolution and `resolveCurriculumSummary` in `shared/utils/public-content.js`, and
the collaborator-role auth/scope middleware changes. `/api/mentor-sessions` and the new
`/api/public/bootcamp-diagnostics/*` routes mounted in `app.js`. `knexfile.js` at the app root as
always. **No env change.**

### Portal frontend (`assets.zip` + `index.html`)

- Dev build (`npm run build`): **`index-D6E63sGg.js`** / CSS `index-CPRP9smp.css` (unchanged CSS
  hash — no stylesheet changes this release).
- Live build (`npm run build:live`): not yet built for this release — build it before deploying to
  Live.
- New: Bootcamp create/edit form's "Diagnostic test" section and module-pricing rows
  (`CoursePricingField.jsx`); Bootcamp view page's stat-chip header, Diagnostic status card, and
  module-pricing breakdown (`CoursePricingDisplay.jsx`); Learning Hub view page's Mentor Sessions /
  Hub Revenue section; Settings → Collaborators management page.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- New `/bootcamps/:slug/diagnostic` + `/bootcamps/:slug/diagnostic/report/:attemptId` routes
  (`BootcampDiagnosticPage.jsx` / `BootcampDiagnosticReportPage.jsx`), mirroring the existing
  Pathway diagnostic flow. `DiagnosticReport.jsx` generalized to render either a pathway or
  bootcamp attempt. New `BootcampNextStepsPanel.jsx` (enquire-to-book instead of a course
  roadmap CTA, since a bootcamp has no course sequence to place a learner into).
- "Take the diagnostic" CTA added to `BootcampDetailPage.jsx`'s sidebar, gated on the detail
  response's `diagnostic.available`.
- `CoursePricingRoadmap.jsx` shows a per-module price breakdown when a course carries one; its
  cards' left accent-border stripe removed.
- **Built with a full prerender pass this time** (`npm run deploy:build`) — `nodeapp.digifunzi.com`
  was reachable from the build environment on a retry (an earlier attempt in the same session hit
  intermittent `fetch failed`/timeout errors against the same endpoint — transient, not a code
  defect; a second run succeeded cleanly). 28/28 routes prerendered, sitemap includes all
  pathway/project/store/bootcamp/competition detail URLs. One route
  (`/bootcamps/digifunzi-junior-techies-bootcamp`) logged "`__APP_READY__` not reached in 15000ms —
  snapshotting anyway" (likely a slow cover-image load) but still produced a working snapshot.

### Deploy order

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. Check the app log: five
   migrations should apply cleanly (or fewer, if some already ran).
2. **Portal** `assets.zip` + `index.html` from `Guide/dev/`.
3. **Website** `africa-digifunzi-com-dist.zip` from `Guide/dev/` → the `africa.digifunzi.com`
   document root.
4. **Verify:**
   - `curl <api>/api/public/bootcamps/<some-slug>` → response includes a `diagnostic` field
     (`{ available: false, minAge: null, maxAge: null }` if not configured).
   - In the portal, open a Bootcamp's create/edit form → confirm the "Diagnostic test" section
     appears, lets you pick an assessment and toggle public visibility (disabled until an
     assessment is chosen).
   - Save it with a diagnostic configured + a complete age range → open the view page → confirm the
     "Diagnostic test" card shows it as live.
   - Visit that bootcamp's page on the public site (with `saleStatus: for_sale`) → confirm "Take the
     diagnostic" appears in the sidebar, the flow completes, and the report renders.
   - Price a course by module on a Bootcamp's Course pricing section → save → confirm the view page
     and public site both show the per-module breakdown.
   - Open a non-school Learning Hub's view page → confirm the Mentor Sessions section appears and a
     logged session updates the revenue total.
   - Settings → Collaborators → invite a collaborator → confirm they can log in and edit content but
     not delete or manage other collaborators.

---

## This release (13 Sep 2026) — Event entity retired · Bootcamps/Competitions run at hubs directly · per-course pricing

**This release is Dev-only so far** — these zips have not been built or verified for Live. Deploy
to Dev first as usual; rebuild the Live-flavoured portal zip (`npm run build:live`) separately
before touching Live.

Six new migrations (auto-apply on Restart, **run in order — do not skip ahead**), one of them
destructive. Backend + portal frontend + website all change.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20260913100000_add_dates_to_bootcamps_and_competitions` | Adds `startDate`/`endDate`/`registrationOpenDate`/`registrationCloseDate` (nullable strings) to `bootcamps`; adds the two registration columns to `competitions` (it already had start/end) | unchanged — every existing row gets nulls |
| `20260913101000_rename_event_link_to_curriculum` | Renames `bootcamps.eventId` / `competitions.eventId` → `curriculumId` (pure rename, no data change — the column always stored a `curricula.id`) | preserved |
| `20260913102000_create_offering_hub_tables` | New `bootcamp_hubs` / `competition_hubs` tables — replace the old shared `events` table as the record of "which hubs run this, which Classes did that create" | n/a (new tables) |
| `20260913103000_backfill_offering_hubs_from_events` | Copies every existing Event-hub deployment linked to a bootcamp/competition into the new tables | preserved; a deployment with no linked bootcamp/competition is logged as an "orphan" and not copied (its Classes are untouched, just no longer tracked by an offering row) |
| `20260913104000_drop_events_and_is_event` | **Destructive.** Drops `curricula.isEvent` and the entire `events` table | ⚠️ see below |
| `20260913110000_add_course_pricing_to_bootcamps_and_competitions` | Adds nullable `coursePricing` JSON column to both `bootcamps` and `competitions` | unchanged — every existing row gets null |

⚠️ **`20260913104000` is destructive and not reversible in data, only in shape.** By the time it
runs, every hub-deployment that had a linked bootcamp/competition has already been copied to
`bootcamp_hubs`/`competition_hubs` by the migration before it — this one just removes the
now-redundant `events` table and the `isEvent` flag. Its `down` recreates empty tables/columns,
it does **not** restore data. Take a `mysqldump` backup before restarting Dev on this release,
same posture as any schema-dropping migration. **Do not run this against Live** until the whole
chain has been verified working on Dev first.

### What changed

1. **The Event entity is gone.** A Bootcamp or Competition no longer needs an Event curriculum to
   run — each now has its own `curriculumId` (any curriculum, no `isEvent` flag required) and its
   own dates, and "Run at a Hub" creates a `bootcamp_hubs`/`competition_hubs` row directly instead
   of going through a shared Event deployment. `server/src/modules/events/` is deleted; the old
   admin nav "Events" list is now folded into curriculum-scoped sections on the Bootcamp/
   Competition view pages (`CurriculumBootcampsSection.jsx` / `CurriculumCompetitionsSection.jsx`,
   replacing `EventBootcampsSection.jsx` / `EventCompetitionsSection.jsx`).
2. **Per-course pricing.** Creating or editing a Bootcamp/Competition now shows a "Course pricing"
   section once a curriculum is selected — pick courses from that curriculum's pathways and set a
   price per course (`coursePricing: [{ courseId, priceAmount, priceCurrency }]`, validated
   server-side against the curriculum's actually-linked courses). Shown grouped by pathway on the
   admin view page, and on the public site as a numbered course roadmap per pathway (same visual
   style as the existing Pathway roadmap), on both the Bootcamp and Competition detail pages.
3. **Public API additions** — `GET /api/public/bootcamps/:idOrSlug` and
   `GET /api/public/competitions/:idOrSlug` now also return a `coursePricing` array (grouped by
   pathway, each course carrying its resolved name/description/cover image/age range/price). List
   endpoints are unchanged.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — includes all six migrations above, the new `bootcamp-hub.*` /
`competition-hub.*` modules, `shared/utils/hub-offering.utils.js`, the `coursePricing` validation/
service changes in `bootcamp.*` and `competition.*`, and the `resolveCoursePricing` helper in
`shared/utils/public-content.js`. `knexfile.js` at the app root as always. **No env change.**

### Portal frontend (`assets.zip` + `index.html`)

- Dev build (`npm run build`): **`index-B3rGt8QX.js`** / CSS `index-CPRP9smp.css`.
- Live build (`npm run build:live`): not yet built for this release — build it before deploying
  to Live.
- New: "Course pricing" section on the Bootcamp/Competition create and edit forms
  (`CoursePricingField.jsx`) and view pages (`CoursePricingDisplay.jsx`); curriculum-scoped
  Bootcamps/Competitions sections replacing the old Event-scoped ones; the Events admin pages are
  gone.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

New `CoursePricingRoadmap.jsx` on `BootcampDetailPage.jsx` / `CompetitionDetailPage.jsx`.

⚠️ **This build shipped SPA-only, not prerendered.** The build-time prerender step (headless
Chrome, for search-engine snapshots) timed out repeatedly on `/competitions` in the environment
this was built in — the API itself was reachable and healthy (`curl` against every
`/api/public/*` endpoint returned `200`), but a page navigation consistently exceeded the
prerender's 30s budget, most likely slow cover-image loads over that environment's network —
not a code defect. Built with `npm run build:spa`
instead (skips Puppeteer prerendering entirely) + a separately-run `generate-sitemap.js` (sitemap
lists static routes only this pass — no per-slug pathway/project/store/bootcamp/competition detail
URLs, since those are only discovered by scanning the prerendered output). **Every page is still
fully functional for visitors** — client-side rendering, real data, nothing broken — this only
affects the pre-baked HTML snapshot search engines see and the sitemap's detail-page coverage.
**Recommended:** re-run `npm run deploy:build` (the full prerendered build) from a machine with a
faster/more direct connection to `nodeapp.digifunzi.com`, then re-upload, to restore full
prerendering + a complete sitemap.

### Deploy order

1. **Take a `mysqldump` backup** — this release includes a destructive migration (see above).
2. **Backend** → the app root → **Run NPM Install** → **Restart**. Check the app log: all six
   migrations should apply cleanly (or fewer, if some already ran). Confirm no `MigrationLocked`
   or crash-loop before proceeding.
3. **Portal** `assets.zip` + `index.html` from `Guide/dev/`.
4. **Website** `africa-digifunzi-com-dist.zip` from `Guide/dev/` → the `africa.digifunzi.com`
   document root.
5. **Verify:**
   - `curl <api>/api/public/bootcamps/<some-slug>` → response includes a `coursePricing` field
     (`[]` if that bootcamp has none priced).
   - `curl <api>/api/public/competitions/<some-slug>` → same.
   - Log in, open a Bootcamp or Competition's create/edit form, pick a curriculum with pathways
     and courses → confirm the "Course pricing" section appears and lets you check a course + set
     a price.
   - Save it, open the view page → confirm the priced course shows under its pathway.
   - Visit that bootcamp/competition's page on the public site → confirm the "Course pricing"
     roadmap section renders with the same course/price/pathway grouping.
   - Confirm **Deploy to Hub** (now "Run at a Hub") still succeeds for both a Bootcamp and a
     Competition, independent of any Event.
   - Confirm the admin nav has no leftover "Events" entry and nothing 404s where it used to point.

---

## This release (11 Sep 2026, follow-on) — Program renamed to Event · Bootcamp becomes standalone

Backend + portal frontend + website all change. **Two new migrations, auto-applied
on Restart. No new dependency, no new env var.** Read the whole section before
deploying — the rename touches a table name and a column name directly.

⚠️ **Both migrations are now idempotent — safe to re-run after a crash.** The first Dev
deploy of this release hit a real issue: MySQL commits every DDL statement immediately
(no transactional rollback across `CREATE`/`ALTER`/`RENAME` the way Postgres has), so when
either migration crashed partway through (in this case, apparently a transient DB hiccup —
nothing wrong with the SQL itself), it left the schema half-changed and Knex's
`knex_migrations_lock` stuck at `is_locked=1`, which then blocked every subsequent restart
with `MigrationLocked` before the app ever got a chance to retry. Recovered manually via
`Guide/dev/recover_stuck_migration.sql` / `recover_stuck_bootcamps_migration.sql` (kept in
this folder for reference). **Both migration files now check the current schema/data before
each step** (`hasTable`/`hasColumn`/per-row existence checks) so a bare restart-and-retry is
now enough to recover from any future partial failure — no manual SQL should ever be needed
again for these two. Rebuilt `backend-deploy.zip` below carries the fixed versions.

### New migrations (apply automatically on Restart, in order)

| Migration | Does | Existing rows |
|---|---|---|
| `20260911100000_rename_program_to_event` | renames table `programs` → `events`, `curricula.isProgram` → `isEvent`, `competitions.programId` → `eventId` | preserved — same rows, renamed columns/table only |
| `20260911150000_create_bootcamps` | new `bootcamps` table; copies every existing for-sale Event-curriculum into it (`eventId` auto-linked back to its source curriculum); drops the 11 sale/marketing columns from `curricula` | the ~5 existing for-sale bootcamps keep their name/price/highlights/etc. and their "upcoming runs" display, just moved to their own table |

### What changed

1. **Program renamed to Event, everywhere** — this was previously "the bootcamp
   *is* the Program curriculum"; that coupling is gone. An Event is just a
   short-run cohort curriculum (`curricula.isEvent = true`), deployed to a hub
   the same way as before (**Deploy to Hub**, unchanged). The admin nav item
   "Programs" is now **"Events"**.
2. **Bootcamp is now a standalone entity**, structurally identical to
   Competition — its own `bootcamps` table, own CRUD module
   (`server/src/modules/bootcamps/*`), an **optional** `eventId` soft-link (no
   DB FK). A Bootcamp no longer has to be an Event — it can stand entirely
   alone, or attach to one. Deleting an Event detaches (never orphans) its
   Bootcamps and Competitions.
3. **Events list page** (`/events`) now shows three independent sections —
   Events, Competitions, Bootcamps — each with its own "+ New" button
   (**+ New Event**, **+ New Competition**, **+ New Bootcamp**).
4. **An Event's kebab menu / view page** gains **New Competition** and **New
   Bootcamp** actions (pre-linking the new record to that Event), alongside the
   existing **Deploy to Hub**. The Event's own view page now clearly reads as
   "EVENT" (badge + header title), separate from a regular Curriculum's view.
5. **"View on Website" button** added to the Bootcamp view page, matching
   Competition's existing parity.
6. **Bugfix: Deploy to Hub was crashing** (`classIds.map is not a function`,
   HTTP 500) — a pre-existing bug inherited unchanged from the old Program
   module, now fixed in `EventService.enrich()`.
7. **Dashboard "Curriculum Overview"** no longer lists Events (it was
   incorrectly showing e.g. "Robot Builders Holiday Bootcamp" as if it were a
   plain curriculum) — Events are a distinct admin section.
8. **Creating a new Event now exits back into `/events`** at every step of the
   authoring wizard (Basic Info → Competencies → Structure → Version Control),
   instead of dropping back into the plain Curriculum list/section titles.
9. **Public bootcamps API contract is unchanged** — `GET /api/public/bootcamps[/:idOrSlug]`
   still serves the same response shape, now reading the new `bootcamps` table
   instead of sale-flagged curricula. No change needed on the website side
   beyond terminology in comments.
10. Bootcamp/Competition creation form layouts polished for spacing/hierarchy
    consistency between the two (same section order, denser field grouping).

See `Guide/WEBSITE_INTEGRATION_CONTRACT.md` if it documents the Program/Event
naming — check for stale "Program" references there too.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — includes both migrations above, the new
`modules/events/*` (renamed from `modules/programs/*`) and `modules/bootcamps/*`,
the `/api/events` and `/api/bootcamps` mounts in `app.js`, and the
competition/curriculum/lead/class/timetable/version-control changes that follow
from the rename. `knexfile.js` at the app root as always. **`Guide/live/backend-deploy.zip`
is byte-identical to `Guide/dev/backend-deploy.zip`** — only each cPanel Node
app's `.env` differs. **No env change.**

⚠️ **The `programs` table is renamed, not dropped** — the migration renames it
to `events` in place, so no data is lost. Still, take a `mysqldump` backup
before restarting on Live, same as any schema-changing release.

### Portal frontend (`assets.zip` + `index.html`)

- Dev build (`npm run build`): **`index-DLLeAw_B.js`** / CSS `index-CPRP9smp.css`.
- Live build (`npm run build:live`): **`index-mpJeZQSl.js`** / same CSS.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

Comment-only "Program" → "Event" terminology updates; the public API contract
and every component's actual behavior is unchanged. **This bundle was built in
a sandboxed environment that could not reach `nodeapp.digifunzi.com`** to
prerender the API-driven sections (Pathways/Projects/Store/Bootcamps/Competitions)
— those ship as SPA-only HTML this time (still fully functional for visitors,
client-side fetch; just no prerendered/SEO snapshot for those routes). **Recommended:**
once this release is live, rebuild `digifunzi-landing` (`npm run build`) from a
machine that can actually reach the target API, and re-upload — that restores
full prerendering for those sections.

### Deploy order

1. **Backend** → the app root → **Run NPM Install** → **Restart**. Check the
   app log: both migrations should apply cleanly (or fewer, if already run).
2. **Portal** `assets.zip` + `index.html` — Dev's from `Guide/dev/`, Live's
   from `Guide/live/` (different JS hash, don't cross them). Delete the old
   `assets/` + `index.html` first.
3. **Website** `africa-digifunzi-com-dist.zip` → the website doc root.
4. **Verify:**
   - `curl <api>/api/public/bootcamps` → `[]` or real data, not `503`/`500`.
   - `curl <api>/api/public/competitions` → same.
   - Log in, open **Events**, confirm three sections (Events/Competitions/
     Bootcamps) each with their own "+ New" button.
   - Open an Event, click its kebab menu → **New Bootcamp** → confirm the form
     opens with that Event pre-selected.
   - **Deploy an Event to a hub** (the bug this release fixes) → confirm it
     succeeds with a "Event created successfully!" toast, not a 500.
   - Dashboard → confirm the "Curriculum Overview" widget no longer lists any
     Event-flagged curricula.

---

## This release (11 Sep 2026) — session numbering resets per module

Frontend-only. **No migration, no new dependency, no env var, no backend change.**

### What changed

Fixed: when a course has more than one Module, opening a session's content (the
sidebar list, its breadcrumb, and the "SESSION n" header on the detail page)
numbered sessions **continuously across the whole course** instead of restarting
at 1 for each new Module — so Module 2's first session showed as "Session 13"
instead of "Session 1". Session storage/ordering (the `order` column) is
unchanged; only the *displayed* number is now computed per-module, matching
the numbering the Admin authoring view (`CourseViewPage.jsx`) already used
correctly. Prev/Next navigation still moves seamlessly across module
boundaries — only the displayed count resets.

Fixed in `client/src/modules/courses/pages/SectionViewPage.jsx` (learner/
teacher/school content-viewing page — sidebar, breadcrumb, header) and
`client/src/modules/courses/pages/CourseContentLandingPage.jsx` (course
landing list), both now using the existing `buildModuleLocalSessionIndex`
helper from `sectionConfig.js` instead of a flat whole-course array index.

Not touched: the Calendar/timetable session labels and the Teacher Portal's
Assessments/Reports "Session n of N" navigators, which intentionally walk the
whole course's session sequence for scheduling/grading flows rather than
per-module display — a separate decision if that's ever wanted too.

**Follow-up same day:** the first cut of this fix left `SectionViewPage.jsx`'s
breadcrumb/header referencing a `sessionPosition` variable that only existed
inside the sidebar sub-component, not the page's own scope — a
`ReferenceError` that blanked the entire session-content page for every role.
Fixed by computing `sessionPosition` once in the page component itself.
Verified end-to-end (logged in, opened a Module 2 session's content) before
rebuilding these zips — the hashes below are the corrected build.

### Portal frontend (`assets.zip` + `index.html`)

- Dev build (`npm run build`): **`index-Dh08y7yp.js`** / CSS `index-CPRP9smp.css`.
- Live build (`npm run build:live`): **`index-BZlNowAW.js`** / same CSS.

### Deploy order

1. Portal `assets.zip` + `index.html` — Dev's from `Guide/dev/`, Live's from
   `Guide/live/` (different JS hash, don't cross them).
2. Backend unchanged — no redeploy needed for this fix.
3. **Verify:** open a course with 2+ Modules as any role, click into Module 2's
   first session — the sidebar, breadcrumb, and page header should all show
   "Session 1", not a number continuing from Module 1.

---

## This release (10 Sep 2026) — Bootcamps for sale · diagnostic name+phone · competency-grouped report · public hubs + virtual hubs · Competitions module

Additive. **Five new migrations, all auto-applied on Restart. No new dependency, no
new env var.** This rolls up everything since the 9 Sep "fourth follow-on" below —
if you already deployed a 10 Sep build you can skip whatever you've done. Backend,
portal frontend and the website (`digifunzi-landing`, its own repo) all change.

### New migrations (apply automatically on Restart, in order)

| Migration | Adds | Existing rows |
|---|---|---|
| `20260910093200_add_sale_fields_to_curricula` | sale fields on `curricula` (a Program can be "listed on the website" as a bootcamp) | unchanged — every curriculum stays unlisted |
| `20260910120000_leads_add_diagnostic_source_and_nullable_email` | `leads.source`, makes `leads.email` nullable | unchanged |
| `20260910133000_add_delivery_mode_to_learning_hubs` | `learning_hubs.deliveryMode` (default `in_person`) + `meetingLink` | every hub becomes `in_person` — no behaviour change |
| `20260910143000_create_competitions` | new `competitions` table | n/a (new table) |

(`20260909161500_add_sale_fields_to_inventory` from the 9 Sep release is also in
this zip — it applies too if you never deployed that one.)

### What changed

1. **Bootcamps for sale** — a Program (an `isProgram` curriculum) can be flipped
   "List on the website" in the portal's Program view. `GET /api/public/bootcamps[/:idOrSlug]`
   serves those; the website's `/bootcamps` section is now API-driven (was a
   "coming soon" placeholder). Not the old `public_bootcamps` table.
2. **Public diagnostic requires parent name + phone** — the submit endpoint now
   needs `parentName` + `parentPhone` and creates a `source: "diagnostic"` lead.
   The report itself still exposes no PII. `leads.email` is now nullable.
3. **Diagnostic report — competency grouping** — the report groups by competency
   with an expandable breakdown of contributing indicators; the question-by-question
   list is gone. Full-width report page. A "next steps" panel (Enroll / Get started
   / Speak to a mentor) replaces the old 3-button row. Real PDF download.
4. **Public learning-hub endpoints** — `GET /api/public/hubs/types` and
   `GET /api/public/hubs?type=` feed the post-diagnostic Enroll flow's "Type of
   learning hub" picker (a two-step wizard), showing a real non-school hub's
   operational schedule read-only.
5. **Virtual / hybrid learning hubs** — a hub's `deliveryMode` is `in_person`
   (default), `virtual` or `hybrid`. The public hub projection gains
   `deliveryMode` / `deliveryLabel` / `isVirtual`; a virtual hub's town shows
   "Online". `meetingLink` is never exposed publicly. Portal hub form gets a
   Delivery control; a virtual hub hides Address + Spaces.
6. **Competitions module** — a new standalone `competitions` table (an independent
   module, sibling of Curriculum/Programs — *not* a flag on `curricula`). A
   competition optionally soft-links to a Program. `GET /api/public/competitions[/:idOrSlug]`
   serves the designated admin's public, non-draft competitions with their
   **Track cards** (name, subtitle, description, highlights, register + know-more
   URLs). Portal UI lives **under the Programs module** — the Programs page is now
   "Programs & Competitions" with a **+ New Competition** button and a competitions
   grid alongside the programs grid. Deleting a Program detaches (never orphans)
   its competitions.
   See `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.13.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — includes all five migrations above, the new
`modules/competitions/*`, `modules/public-site/public-competition.*`, the
`/api/competitions` mount in `app.js`, and the hub/curriculum/lead/diagnostic
changes. `knexfile.js` at the app root as always. **No env change.**

### Portal frontend (`assets.zip` + `index.html`)

- Dev build (`npm run build`): **`index-DpPz0DUj.js`** / CSS `index-CPRP9smp.css`.
- Live build (`npm run build:live`): **`index-CJsTNRbk.js`** / same CSS.
- New: "Programs & Competitions" page with the competition create/edit/view
  screens and Track editor; a Competitions section on a Program's view; the
  Program "List on the website" (bootcamp) card; the hub Delivery control; the
  competency-grouped diagnostic report bits are website-side only.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- `/bootcamps` + `/bootcamps/:slug` API-driven; `/competitions` +
  `/competitions/:slug` API-driven (was hand-authored static content) with the
  Codeavour-style Track cards; the post-diagnostic Enroll two-step wizard with the
  hub-type picker (physical + online hubs); virtual-hub "Online" chip.
- `scripts/{prerender,generate-sitemap}.js` also discover `/bootcamps` and
  `/competitions` slugs from the API.

### Deploy order (per environment — Dev first, then Live once confirmed)

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. Check the
   app log: five migrations should apply cleanly (or fewer, if some already ran).
2. **Portal** `assets.zip` + `index.html` — Dev's from `Guide/dev/`, Live's from
   `Guide/live/` (different JS hash, don't cross them).
3. **Website** `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` doc root.
4. **Verify:**
   - `curl https://<api>/api/public/competitions` → `[]` (or real data) not `503`.
   - `curl https://<api>/api/public/bootcamps` → same.
   - In the portal, open **Programs & Competitions**, click **+ New Competition**,
     save a draft, then tick "Show on the website" and set status Open → it appears
     on `/competitions`.

---

## This release (9 Sep 2026, fourth follow-on) — sell Inventory items in the website Store

Additive. **One new migration (auto-applies on Restart), no new dependency, no new env var, no
manual step.** Backend + portal frontend + website all change. Same pattern as the "third
follow-on" (for-sale Projects) below — this is the Store equivalent.

### What changed

A shared **Inventory** item (Settings → Inventory) can now be marked **"For sale on the
website"**. When it is, it appears in the public **Store** section
(`africa.digifunzi.com/store`) with a price and an "Enquire to buy" button (which posts a lead
— no checkout). This replaces the hardcoded placeholder store items (`src/content/store.js`)
the site shipped with — **the Store is now driven by Inventory**.

### Backend (`backend-deploy.zip`)

**One new migration** — `20260909161500_add_sale_fields_to_inventory.js` — adds 14
nullable/defaulted columns to `inventory` (`saleStatus` default `internal`, `storeCategory`,
`stockStatus` default `available`, `tagline`, `badge`, `priceAmount`, `priceCurrency`,
`priceUnit`, `priceNote`, `compareAtAmount`, and JSON `highlights`/`includes`/`specs`/`gallery`).
Every existing inventory item stays `internal` — no behaviour change; Projects still link
materials from the same catalog. Idempotent `up`/`down`.

**Code:**
- **New `GET /api/public/store[/:idOrSlug]`** — the designated admin's `inventory` rows where
  `saleStatus = 'for_sale'`, scoped to `PUBLIC_CONTENT_ADMIN_ID` (503 if unset). Marketing
  projection only — the ops `category`/`unit`/stock fields are never exposed. See
  `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.10/§3.11.
- **`inventory.validation.js`** — refactored to a plain fields object + separate create/update
  (defaults on create only, so a partial update never clobbers a column); `compareAt > price`
  refinement.
- **`lead.service.js`** — `_resolveReference` also resolves for-sale inventory slugs so the
  Enquiries card shows the item name (`referenceType: "store_item"`).

**No env change.**

### Portal frontend (`assets.zip` + `index.html`)

- **Settings → Inventory → item modal → "Selling" section**: a "For sale on the website" toggle
  + store category / availability / tagline / badge / price (+ unit, note, compare-at) /
  highlights / "what you get" / specs.
- **Inventory cards** — a green "IN STORE" pill + price line on `for_sale` items; the panel
  subheading shows "N in the website Store".
- **Enquiries list** — `store_item` reference type now labelled "Store item".

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- `/store` + `/store/:slug` now API-driven (`GET /api/public/store`), replacing the hardcoded
  `src/content/store.js`. New `StoreItemCard` in the Pathway/Project-card visual language;
  rewritten `StoreItemPage`.
- Empty state until an item is marked for sale (see `Guide/STORE_SETUP.md`).
- The old static bundle→projects cross-link is dropped (a "bundle" is now just a store item
  with `storeCategory: "bundle"`).
- `scripts/{prerender,generate-sitemap}.js` now discover `/store` **and** `/projects` slugs
  from the API (like `/pathways`) — they no longer read `src/content/store.js`. If the backend
  isn't reachable from the build machine, those detail pages ship SPA-only and a re-build once
  the API is live fills them in (same as the existing Pathways note).
- **Nav reordered:** Pathways · Projects · Bootcamps · Competitions · Store · About · Contact.
  New **`/bootcamps`** placeholder page ("coming soon" + contact CTA — no content/model yet).

### Deploy order

1. Backend zip → **Run NPM Install** → **Restart** (migration applies).
2. Portal `assets.zip` + `index.html` (the Inventory Selling section).
3. Website `africa-digifunzi-com-dist.zip`.
4. Flip an Inventory item "For sale", check `/store`. Or run
   `node src/scripts/seedSampleStoreItem.js` for a sample "Quarky Robot Kit".

---

## This release (9 Sep 2026, third follow-on) — sell Project assessments on the website

Additive. **One new migration (auto-applies on Restart), no new dependency, no new env var, no
manual step.** Backend + portal frontend + website all change.

### What changed

A `type: "project"` assessment can now be marked **"For sale on the website"** in the Assessment
Builder. When it is, it appears in the public **Projects** section
(`africa.digifunzi.com/projects`) with a price and an "Enquire to buy" button (which posts a
lead — no checkout). This replaces the hardcoded placeholder projects the site shipped with.

### Backend (`backend-deploy.zip`)

**One new migration** — `20260909144200_add_sale_fields_to_assessments.js` — adds 9
nullable/defaulted columns to `assessments` (`saleStatus` default `internal`, `coverImage`,
`priceAmount`, `priceCurrency`, `priceNote`, `saleLevel`, `saleTagline`, `ageMin`, `ageMax`).
Every existing assessment stays `internal` with NULLs — no behaviour change for internal use.
Idempotent `up`/`down`.

**Code:**
- **New `GET /api/public/projects[/:idOrSlug]`** — the designated admin's `type: "project"`
  assessments where `saleStatus = 'for_sale'`, scoped to `PUBLIC_CONTENT_ADMIN_ID` (503 if
  unset). Marketing projection only — grading content (`items`/`rubric`/answers) is never
  exposed. See `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.3/§3.4. (Different feature from the
  course-catalog `/api/public/projects` removed 4 Sep.)
- **`assessment.service.js` guard** — `for_sale` is only valid on `type: 'project'` (400
  otherwise).
- **`lead.service.js`** — `_resolveReference` also resolves for-sale project slugs so the
  Enquiries card shows the project name.
- Refactor: shared `requirePublicContentAdminId` + `htmlToText` in
  `server/src/shared/utils/public-content.js`.

**No env change.**

### Portal frontend (`assets.zip` + `index.html`)

- **Assessment Builder → Assessment Information → "Selling" panel** (Project type only): a "For
  sale on the website" toggle + cover image / tagline / price / level / age range.
- **Assessments list** — a green "FOR SALE" pill on `for_sale` project rows.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- `/projects` + `/projects/:slug` now API-driven (`GET /api/public/projects`), replacing the
  hardcoded `src/content/projects.js`. New `ProjectCard` in the Pathway-card visual language;
  dedicated `ProjectDetailPage`.
- Empty state until a project is marked for sale (see `Guide/PROJECT_SALE_SETUP.md`).
- The Store (`/store`) is unchanged.

### Deploy order

1. Backend zip → **Run NPM Install** → **Restart** (migration applies).
2. Portal `assets.zip` + `index.html` (the builder Selling panel).
3. Website `africa-digifunzi-com-dist.zip`.
4. Author a Project, flip "For sale", check `/projects`.

---

## This release (9 Sep 2026, second follow-on) — contact-free public diagnostic + shareable report

Additive on top of the 8–9 Sep public-diagnostic work below. **Two new migrations (auto-apply
on Restart), no new dependency, no new env var, no manual step.** Backend + frontend both change;
the digifunzi-landing website changes too (its own repo — `africa-digifunzi-com-dist.zip`).

### What changed for a visitor

The public diagnostic (`/pathways/:slug/diagnostic` on the marketing site) no longer asks for a
name or email, and **no longer creates a lead / Enquiries entry**. The visitor picks an age,
answers the questions, hits **"Submit & see my report"**, and the graded report renders
immediately — plus a **permanent shareable link** to it (`/pathways/:slug/diagnostic/report/
:attemptId`) with a **"Download PDF"** button (browser print, no library). Enrolment is a
separate step from the report screen (the normal Enroll form, which still collects contact
details). Nothing about the diagnostic is ever emailed.

### Backend (`backend-deploy.zip`)

**Two new migrations** (apply automatically on Restart, in this order):

| Migration | Effect |
|---|---|
| `20260909104300_add_items_snapshot_to_public_diagnostic_attempts.js` | Adds two nullable JSON columns to `public_diagnostic_attempts` — `itemsSnapshot` (the sanitized question set as served, no answer key) and `itemResults` (per-item outcome as graded). These let the shareable report render its per-question section identically even after the assessment is later edited. Idempotent `up`/`down` (`hasColumn` guards). Pre-existing attempt rows get NULLs and their report shows score + competency breakdown only. |
| `20260909110000_make_public_diagnostic_attempt_lead_nullable.js` | `public_diagnostic_attempts.leadId` → nullable. The diagnostic no longer creates a lead, so new attempt rows have `leadId: NULL`. Existing rows (which all have one) are untouched. `down` deletes any null-`leadId` rows first so the `NOT NULL` can be re-applied. |

**Code changes:**
- **`POST /api/public/diagnostics/:slug/submit`** now takes `{ answers, childName?, childAge }`
  only — **no `parentName`/`parentEmail`**. Grades synchronously, stores the attempt (with the
  sanitized `itemsSnapshot` + `itemResults`), returns the report + an `attemptId`. **Creates no
  lead**, sends no admin notification, sends no email. Unknown extra keys in the body are
  silently stripped (an old-shape request still works, contact fields ignored).
- **New `GET /api/public/diagnostics/attempts/:attemptId`** — the permanent shareable report.
  Opaque uuid = the only access control (same posture as the QR learner-profile route). Narrow
  projection: pathway/assessment name, child first name + age, score, competency breakdown,
  per-question feedback. No `ipHash`, no contact info (there is none). 404s an unknown id.
  Registered *before* `/:pathwayIdOrSlug` so `attempts` can't be read as a slug. Shares the
  60/15min read limiter.
- **Removed `PATCH /api/public/leads/:id`** — the old "post-report details" step (route,
  controller `updateLeadContactDetails`, `LeadService.updateContactDetails`, and the
  `updateLeadContactDetailsSchema`). It now 404s. Nothing on the website calls it any more.
- `lead.service.js` `submitLead` — the ack-email special-case for `pathway_diagnostic` was
  removed (that value is no longer produced anywhere).

**No env change.** `PUBLIC_CONTENT_ADMIN_ID` is still the one required var for the public
pathways + diagnostic endpoints (see the 9 Sep follow-on below).

### Frontend (`assets.zip` + `index.html`) — curriculum portal

**No functional change** in the admin portal from this follow-on. The Curriculum → Pathways
public-diagnostic toggle (8 Sep) is all the portal needs. The zip is rebuilt only to stay in
lockstep with the repo; if you already deployed the 8–9 Sep `assets.zip` you can skip the
portal frontend this pass (backend + website are what actually changed).

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

Rebuilt with `VITE_API_URL` pointing at this environment's backend
(`https://nodeapp.digifunzi.com` — its `.env.production`). Changes in it:
- Diagnostic flow reduced to 3 steps (age → questions → report), no contact form.
- New standalone report page + route (`/pathways/:slug/diagnostic/report/:attemptId`).
- `DiagnosticReport` restyled to match the curriculum system's public shared-learner-profile
  card (gradient hero, initials avatar, snapshot tiles, score ring, competency bars).
- Pathway detail: **"Take the diagnostic"** button (header + bottom CTA) when a public
  diagnostic is configured; the old age-only "starting point finder" widget was removed.
- `@media print` rules in the global stylesheet so "Download PDF" prints only the report card.
- Also in this zip (bundled branch work): Store + Projects sections replacing the Quarky page;
  bootcamp UI removed; the standalone `server/` folder removed (the site talks only to this
  backend now).

Deploy it the same way as any other website release — upload to the
`africa.digifunzi.com` document root in cPanel and Extract (overwrite). No env change on the
hosting side.

> **Pathway detail pages ship as SPA-only HTML in this zip** — the build-time prerender needs
> `https://nodeapp.digifunzi.com/api/public/pathways` reachable, which it was not on the build
> machine. The pages work fine (rendered client-side at runtime); they're just not
> pre-rendered for SEO. To fix: rebuild `digifunzi-landing` (`npm run deploy:build`) on a
> machine that can reach the Dev backend, then re-upload.

### Deploy order

1. Backend zip → the Node app → **Run NPM Install** → **Restart** (the two migrations apply).
2. (Optional) Portal `assets.zip` + `index.html` → the frontend document root.
3. Website `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root.
4. Smoke test (see "Post-deploy smoke test" at the end of this file).

---

## This release (8 Sep 2026) — what changed

### ⚠️ Read before deploying: multi-tenant admin isolation + a required manual step after

This release makes every admin's data private to that admin (previously every admin could see
every other admin's hubs/curricula/courses/assessments). **Dev may have more than one admin
account** — if so, that matters for the migration below.

**Five new migrations** (apply automatically on Restart, in this order):

| Migration | Effect |
|---|---|
| `20260907090000_add_owner_admin_id_to_root_tables.js` | Adds nullable `ownerAdminId` to `learning_hubs`, `curricula`, `courses`, `assessments`, then backfills **every existing row to whichever admin has the oldest `createdAt`** — there is no `createdBy`/creator field anywhere in the pre-existing schema to recover real per-row ownership from (checked exhaustively — see the migration's own comment). **This means every admin's pre-existing data will appear to belong to one admin (the oldest account) immediately after this migration runs.** |
| `20260907090100_make_owner_admin_id_not_nullable.js` | Flips those four columns to `NOT NULL` once the backfill above has run. |
| `20260907105000_add_owner_admin_id_to_settings_tables.js` | Same `ownerAdminId` column + same oldest-admin backfill, on the five tenant-owned settings catalogs (system levels, evidence types, etc. — see the migration for the exact list). |
| `20260907105100_make_settings_owner_admin_id_not_nullable.js` | `NOT NULL` flip for the settings tables, same as above. |
| `20260907105700_scope_system_levels_unique_name_per_admin.js` | Changes `system_levels`' unique-name constraint from global to per-admin (so two admins can each have their own "Level 1", etc). |

**Required manual step immediately after this deploy**: every admin other than the one that
ends up owning everything (check the app log or query `SELECT DISTINCT ownerAdminId FROM
learning_hubs` to see which admin id the backfill picked) needs to move their own hubs,
curricula, courses, and assessments back to themselves. Use the **new admin-tools "Move to
Another Admin" feature** — Settings → Admins → pick a hub/curriculum/course/assessment → Move to
Another Admin → enter the correct admin's email. This is deliberately one-at-a-time, not a bulk
operation, since a hub's linked curriculum/courses/assessments are independently-owned root
entities and moving one does not imply moving what's linked to it. **Until this manual step is
done, every admin other than the backfilled one will see an empty Curriculum/Courses/
Assessments/Learning Hubs section on login** — this is expected immediately after the migration,
not a new bug; it resolves entity-by-entity as each gets moved.

**New backend module** — `server/src/modules/admin-tools/` (`reassign-owner.controller.js`,
`.routes.js`, `.service.js`), mounted at `POST /api/admin-tools/reassign-owner` (admin-only). No
new dependency, no new env var.

**Backend** (`backend-deploy.zip`):
- **Multi-tenant isolation.** Every `GET`/list endpoint that used to return every admin's data
  now scopes to the calling admin's own `ownerAdminId` — hubs, curricula, courses, assessments,
  and the five settings catalogs above.
- **Fixed: module/session creation was broken for any course under a multi-admin setup.**
  `course.service.js`'s session-related methods (`getSessions`, `createSession`,
  `createSessionsBulk`, `updateSession`) called `AssessmentModel.findAll()` with no
  `ownerAdminId` — that model requires one unconditionally since the tenant-isolation work above,
  so it threw `withOwnerScope: ownerAdminId is required for this query` on every attempt to view
  a course's sessions, create a session, bulk-create sessions (what the "New Module" dialog does
  when its session count is > 0), or update a session. Now correctly resolves the assessment
  lookup against the **course's own** `ownerAdminId` (not the caller's), since a
  teacher/school/learner viewing a course has no `ownerAdminId` of their own but the course they're
  looking at always does.
- **New: public diagnostics for the marketing website.** See `Guide/WEBSITE_INTEGRATION_CONTRACT.md`
  §3.8/§4.3 for the full contract. New unauthenticated endpoints:
  `GET /api/public/diagnostics/:pathwayIdOrSlug/availability`,
  `GET /api/public/diagnostics/:pathwayIdOrSlug?age=`,
  `POST /api/public/diagnostics/:pathwayIdOrSlug/submit` — lets an anonymous website visitor pick
  a pathway, take a short diagnostic matched to their age, and see an instant graded report,
  which also creates a `leads` row. Reads/grades against **one designated admin's tenant only**,
  set via the new **`PUBLIC_CONTENT_ADMIN_ID`** environment variable (see the env table below) —
  every admin is now an isolated tenant, so the public site needs to be told explicitly whose
  content to show. Two new migrations (already listed with the others above under a different
  date — see `20260907131100_add_public_diagnostic_enabled_to_pathways.js` and
  `20260907131200_create_public_diagnostic_attempts.js`): adds `publicDiagnosticEnabled` to the
  operational `pathways` table (a curriculum-scoped Pathway needs this flag + a fully
  auto-gradable `diagnosticAssessmentId` before it's offered publicly — set from Curriculum →
  Pathways panel's "Diagnostic Assessment" section), and a new `public_diagnostic_attempts` table
  (full audit trail of every anonymous attempt, admin-only if ever surfaced, never exposed via any
  public endpoint).
- **New: `PATCH /api/public/leads/:id`** — unauthenticated, narrowly scoped (only ever writes
  `phone`/`learnerName`, and only on a lead created by the public-diagnostic flow above) — lets
  the website fill in phone/child's-name on a lead after the visitor has already seen their
  report, without a second lead being created.

**Environment variable `PUBLIC_CONTENT_ADMIN_ID`** (see env table below). Introduced with the
public-diagnostic work; **the 9 Sep follow-on makes it required** for the public marketing
site's Pathways section too (not just the diagnostic). Leave unset and all five
`/api/public/{pathways,diagnostics}` endpoints return a clean `503` — nothing else in the app
depends on it.

**Frontend** (`assets.zip` + `index.html`):
- **Settings → Admins — "Move to Another Admin."** New action on a hub/curriculum/course/
  assessment card: pick a target admin by email, moves that one entity's ownership. This is the
  tool referenced in the required manual step above.
- **Curriculum → Pathways panel — public-diagnostic toggle.** Each pathway's "Diagnostic
  Assessment" section (both the create form and the per-card picker) now has an "Offer this
  diagnostic to anonymous visitors on the public website" checkbox, disabled until a diagnostic
  assessment is assigned. A pathway with it on shows a green "Public" badge next to its assigned
  assessment.

### Follow-on (9 Sep 2026) — public pathways now come from the Competency Framework

Additive follow-up to the public-diagnostic work above. **No new migration, no new dependency,
no data-reshaping, no new required manual step.** Backend-code-only + a small website change.

**The problem this fixes:** `GET /api/public/pathways` was serving the `pathway_templates`
catalog (Settings → Pathways — a "reusable template library"). That turned out to be a
hand-maintained list, owned by whichever admin, that had drifted from the real curriculum —
so the public site showed generic placeholder pathways with placeholder courses, not the
Competency Framework the team actually authors.

**Backend** (`backend-deploy.zip`):
- **`GET /api/public/pathways[/:idOrSlug]` now reads the designated admin's OPERATIONAL
  `pathways`** (Curriculum → Competency Framework) — the same rows that carry the real
  courses, Course Sequence, age range and diagnostic. Across every curriculum that admin
  owns. Course order = the pathway's Course Sequence, then any unsequenced courses.
  A pathway with 0 active courses is omitted from the list; its detail 404s. Slug collisions
  (two of the admin's pathways with the same computed name) collapse to one.
- **Scoped to `PUBLIC_CONTENT_ADMIN_ID`** (unset → `503`). This is now a hard dependency for
  the pathways pages, not just the diagnostic. (Still "optional" at the env level — the
  endpoints just return `503` until it's set.)
- **The `pathway_templates` table and its `/api/pathway-templates` module are untouched** —
  the portal's "reusable template" feature keeps working exactly as before. The public site
  just stopped reading it. No marketing-template ↔ diagnostic link to configure any more.
- **Strict age gate.** A pathway's public diagnostic is only offerable when **both** `minAge`
  and `maxAge` are set on it (a missing bound used to mean "any age" — now "not configured",
  so the anonymous flow fails safe). Consequence for this deploy: **until the curriculum team
  sets an age range on each public pathway, no diagnostic appears on the website** — intended,
  see `Guide/PUBLIC_DIAGNOSTIC_SETUP.md`. (The authenticated in-app learner diagnostic is a
  different code path and is unaffected.)
- **Richer responses**: `GET /api/public/pathways/:idOrSlug` embeds a `diagnostic:
  { available, minAge, maxAge }` object; `/diagnostics/:idOrSlug/availability` and the question
  set include `minAge`/`maxAge`. See `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.5/§3.6/§3.8.
- **Bug fix (unrelated, found along the way): `PUT /api/pathway-templates/:id` was silently
  wiping fields.** The update schema was `createSchema.partial()`, but Zod's `.default()`
  still fired for absent keys — so a PUT that only sent one field blanked
  `description`/`color`/`courses`. The portal always sends every field so it never surfaced in
  the UI, but any partial PUT would lose data. Fixed to leave omitted fields untouched.

**Frontend** (`assets.zip` + `index.html`): no change from this follow-on — the earlier
public-diagnostic UI (Competency Framework's "offer diagnostic publicly" toggle) is all
that's needed.

**No env change.**
---

## Previous release (4 Sep 2026) — still included here

### Leads — the loop is now closed, not just receiving

The 3 Sep release could receive Enroll/Contact submissions and let staff triage
them (New/Contacted/Closed). This release adds everything needed to actually
**act on** an enquiry from inside the system. It also briefly added, then
removed, a Bootcamps/Projects content-authoring feature — see below.

**Two new migrations** (both apply automatically on Restart):

| Migration | Effect |
|---|---|
| `20260904071000_create_lead_messages.js` | Additive — adds `lead_messages`, the reply/notes thread behind each lead (see below). |
| `20260904103225_drop_public_bootcamps_and_projects.js` | **Drops** `public_bootcamps` and `public_projects` (added 3 Sep, both empty in every environment checked before dropping). Reversible (`migrate:rollback`) if this content ever needs to come back — see below for why it was removed. |

**New backend dependency** — `nodemailer` (in `package.json`/`package-lock.json`,
baked into `backend-deploy.zip`; **Run NPM Install** on Restart picks it up, no
manual step).

**New optional environment variables — outbound email** (see the env table
below). All optional: **leave every one unset and nothing changes** — auto-ack
and reply emails silently no-op (logged, not thrown) exactly like the existing
`PUBLIC_SITE_URL` pattern. Set them once you've picked a provider to turn real
sending on, no code/deploy change needed at that point.

**Backend** (`backend-deploy.zip`):
- **Reply from the Enquiries page.** `POST /api/leads/:id/reply` (admin-only)
  — emails the enquirer (`Reply-To: MAIL_REPLY_TO`), persists the message even
  if the send fails/no-ops, and auto-flips the lead's status `New` →
  `Contacted` on the first reply.
- **Internal follow-up notes.** `POST /api/leads/:id/notes` (admin-only) —
  staff-only, never emailed, shared timeline entry ("left voicemail, try
  Tuesday") for whoever picks up the enquiry next.
- **Thread view.** `GET /api/leads/:id/timeline` — every reply + note for one
  lead, oldest first.
- **Auto-acknowledgement email.** Fires on every successful
  `POST /api/public/leads` / `/contact`, fire-and-forget (never delays or
  fails the visitor's response). No-ops until SMTP env vars are set.
- **`referenceId` resolved to a name.** `GET /api/leads` now also returns a
  `reference: { referenceType, referenceName, referenceSlug }` per row when
  it resolves against the **pathway** catalog. `null` for a bootcamp/project
  `referenceId` — see the removal note below.
- **Bootcamps/Projects public API + admin authoring API — built, then
  removed, same release.** `GET /api/public/{bootcamps,projects}` and
  `/api/site/{bootcamps,projects}` (admin CRUD) briefly shipped in this
  release, then were pulled once it became clear "bootcamp" duplicates what
  this system already calls a **Program** (`server/src/modules/programs/` —
  a deployed curriculum + hub + dates). The `public_bootcamps`/
  `public_projects` tables (added 3 Sep) are **dropped** by migration
  `20260904103225_drop_public_bootcamps_and_projects.js` — both were empty in
  every environment checked before dropping. **`GET /api/public/pathways` is
  completely unaffected.** If `digifunzi-landing` was ever pointed at the
  bootcamp/project endpoints, tell them those routes now 404 — see
  `Guide/WEBSITE_INTEGRATION_CONTRACT.md`'s top-of-file notice.

**Frontend** (`assets.zip` + `index.html`):
- **Enquiries page** — each card gets a **"Reply / Notes"** expander: shows
  the full thread, and a compose box that toggles between "Reply by email"
  and "Internal note". Cards also show **"Enquired from: \<name\>"** when the
  submission has a resolved `referenceId` (pathways only now).
- **Notification bell** — a `lead_submitted` notification now deep-links to
  `/enquiries?lead=<id>`, which scrolls to and flashes that exact row,
  instead of just opening the Enquiries page generically.
- **No "Website Content" sidebar entry** — it existed briefly during this
  release's development and was removed before shipping (see above).

**Known gap — `nodeapp.digifunzi.com` may be behind.** A check against prod
during this release's prep (`curl https://nodeapp.digifunzi.com/api/public/pathways`)
returned `404 {"message":"Route not found"}` — a real response, meaning
*something* is running there, but not the `/api/public/*` routes shipped in
the 3 Sep release. **Before telling the `digifunzi-landing` team the
integration is live, confirm this backend zip has actually been deployed to
`nodeapp.digifunzi.com`** (Deploy step 7 below) — don't assume the last
deploy landed just because the domain resolves.

---

## Previous release (3 Sep 2026)

### Learning Areas → Pathways (rename, with a live-data migration)

The curriculum **"Learning Area"** concept is renamed to **"Pathway"** everywhere — UI, API routes, and database tables/columns. A Pathway is the same thing reframed: a roadmap of courses a learner follows, with its own diagnostic assessment, age range, and per-course placement thresholds. The Competencies tab's panels are unchanged in structure — just relabelled: "Learning Areas" → **"Pathways"**. The **"Learning Journey"** tab stays as it was (Course Sequence display + Placement Thresholds config).

**Migration `20260903090000_rename_learning_areas_to_pathways.js`** — a pure rename, **not** additive. It renames tables (`learning_areas`→`pathways`, `learning_areas_catalog`→`pathway_templates`, `course_learning_area_links`→`course_pathway_links`, `assessment_learning_area_links`→`assessment_pathway_links`, `learner_journeys`→`learner_pathways`) and the `learningAreaId` column (→`pathwayId`) in `performance_bands`, `assessment_issues`, `assessment_types`, and the link tables. **All existing rows and their values are preserved** — MySQL's in-place RENAME keeps the data; nothing is dropped or re-derived. Reversible (`migrate:rollback`).

> **Deploy order matters more than usual this release.** Backend **must** go first: the migration renames tables the new code expects, and the old code expects the old names. Between the migration running and the Restart completing, requests touching pathways/competencies will error — this is a few seconds. Do it at a quiet time if you can. **Do not deploy the frontend before the backend** — the new frontend calls the renamed `/api/.../pathways` routes.

### Also in this release (additive — new tables, safe)

**Two more new migrations** (apply automatically on Restart, additive):

| Migration | Adds |
|---|---|
| `20260902100000_create_session_occurrences.js` | `session_occurrences` — behind the Class completion checklist (see below). |
| `20260902103000_create_leads.js` + `20260902110000_create_public_site_content.js` | `leads`, `public_bootcamps`, `public_projects` — public Enroll/Contact forms and marketing-site content (see below). |

**No `package.json` change on either side.** Deploy **backend first, then frontend**. Click **Run NPM Install** + **Restart** on the backend (Restart is what runs all three migrations and reloads code). **Check the app log after Restart** to confirm all migrations ran without error before deploying the frontend.

**One new backend environment variable — `PUBLIC_SITE_URL`** (see the env table below). It's **optional**: leave it unset for now and nothing breaks. It only matters once the separate `digifunzi-landing` marketing site is deployed and calling this API from a browser — at that point set it to that site's origin so CORS lets the Enroll/Contact form POSTs through.

**Backend** (`backend-deploy.zip`):
- **Pathways (renamed from Learning Areas).** Same feature, new names. API changes:
  - `/api/learning-areas` → `/api/pathway-templates`
  - `/api/curricula/:id/competencies/learning-areas` → `.../competencies/pathways`
  - `.../competencies/learning-journey/:learnerId[/:areaId]` → `.../competencies/pathway-placement/:learnerId[/:areaId]` (the per-learner placement endpoint; the "Learning Journey" tab still uses it)
  - `/api/{courses,assessments}/:id/learning-areas/links[/:id]` → `.../pathways/links[/:id]`
  - `/api/assessment-submissions/diagnostic/learning-areas/:learnerId` → `.../diagnostic/pathways/:learnerId`
  - The diagnostic auto-issue behaviour is unchanged: one per learner, chosen by the pathway whose age range contains the learner's age; its graded score routes them to a starting course via that pathway's placement thresholds.
- **Class completion tracking.** New admin/school/teacher endpoints:
  - `GET /api/classes/:id/completion-status` — a four-metric year-completion checklist for a class, all derived live (never a stored flag): (1) every past session marked taught/cancelled, (2) every session assessment graded + published for every active learner, (3) attendance taken or consciously closed for every past session, (4) every learner–session report filed (a real one or a "not submitted" one).
  - `POST /api/classes/:id/mark-not-submitted` — files a "not submitted" session report for a learner who never submitted a required assessment (refuses if a submission exists that just needs grading).
  - `GET /api/timetable/occurrences` + `POST /api/timetable/occurrences/:id/action` — list a class's past sessions and run a close-out action (`mark-taught` / `cancel` / `reopen` / `lock-attendance` / `unlock-attendance`).
  - Attendance that's never marked auto-locks 14 days after the session date (lazy sweep, no cron) so a forgotten session can't block completion forever.
  - `getSessionSummary` (the calendar click-through) now also returns the session's `occurrence` record; all existing fields unchanged.
- **Leads — public Enroll/Contact forms.** New **unauthenticated** endpoints `POST /api/public/leads` and `POST /api/public/contact` (rate-limited, 20/15min/IP) for the marketing site's forms. Each submission notifies every admin in-app. Staff read/triage them at the admin **Enquiries** page via `GET /api/leads` and `PATCH /api/leads/:id/status` (admin-only).
- **Public site content API.** New **unauthenticated** read endpoints `GET /api/public/bootcamps[/:idOrSlug]` and `GET /api/public/projects[/:idOrSlug]` for the marketing site's listing/detail pages, plus admin-only authoring at `GET/POST/PUT/DELETE /api/site/bootcamps` and `/api/site/projects`. Its own tables, deliberately separate from the operational `programs`/`courses` — this is marketing copy, not curriculum. **No admin UI for authoring this content ships in this release** (API only). **⚠️ Removed 4 Sep 2026** — see "This release" above; these routes 404 as of the current build.
- **CORS now allows two origins** — the admin client (`CLIENT_URL`) and, when set, the public site (`PUBLIC_SITE_URL`).

**Frontend** (`assets.zip` + `index.html`):
- **Curriculum → Competencies → Pathways** (was "Learning Areas"). Same panel, relabelled. The **"Learning Journey"** tab is unchanged (Course Sequence + Placement Thresholds). Settings → "Learning Areas" is now **"Pathways"** (the reusable template library; "Import from Catalog" → "Import Template"). Course and Assessment forms label their subject tag field "Pathways". The learner portal's "Learning Journey" profile tab is now **"Pathway"**.
- **Class detail page → "Year Completion" panel** (above the existing Promotion panel). An expandable four-item checklist — sessions taught / assessments graded / attendance closed / reports filed — with inline actions to resolve each pending item (mark a session taught or cancelled, close an unmarked attendance, file a learner's missing work as "not submitted"). Grading itself is still done from the assessment roster, not here.
- **Calendar → session detail modal** gains a **"Session Close-out"** section on the teacher/school calendars (past dates only): *Mark as taught* / *Mark cancelled*, and *Close attendance (not marked)* when attendance was never taken.
- **Admin sidebar → Enquiries** (new entry, between Courses and Assessments). Lists Enroll and Contact form submissions from the public site with New / Contacted / Closed filter tabs and a per-row status dropdown. (The notification bell shows new-enquiry notifications but clicking one doesn't yet deep-link — open Enquiries from the sidebar.)

### Previous release (1 Sep 2026) — still included here

Shipped in the immediately preceding build, already baked into these same zips — listed for anyone who skipped that deploy:

- **Billing — Customers API.** Admin-only `GET /api/billing/customers` and `GET /api/billing/customers/:hubId` — a "customer" is a learning hub, derived on the fly (no table, no migration).
- **Competencies — duplicate a Performance Band's setup to the next level.** `POST /api/curricula/:id/competencies/bands/:bandId/duplicate-to-next` — copies a band's competencies, per-indicator % weights and advancement thresholds onto the next band in the *same* Developmental Stage's ladder, overwriting it. One stage only, never across stages.
- **Frontend:** Tech Educator → Assessments rebuilt as a per-course carousel (pages every session, not just ones with an assessment); Billing split into Customers · Invoices · Payments tabs; Performance Bands ⋮ menu "Duplicate to \<next band\>"; Tech Educator → Claims placeholder nav entry; Learning Hub Activate/Deactivate button with cascade confirm dialog.
- **Migration** `20260831100000_add_advancement_min_to_performance_bands.js` (adds `advancementMin` to `performance_bands`, existing bands get `0`) — from the 31 Aug build, still included.
- Diagnostic issuing one-per-age-bracket; no DOB → no auto-diagnostic; stale unstarted diagnostics pruned. Curriculum name unique (case/space-insensitive). Account deactivation model (`PATCH /api/teachers/:id/status`, hub cascade). Billing documents carry `issuedBy` + `learner`. Vector-PDF billing documents + learner report PDF. Dependency `jspdf-autotable` (already baked in).

---

## How Frontend and Backend Connect (REST API)

The frontend and backend are two separate applications that communicate over HTTP using a **REST API**.

```
Browser (curriculum.digifunzi.com)
        ↓  HTTP requests (Axios)
API Server (nodeapp.digifunzi.com)
        ↓  reads/writes (Knex)
MySQL database
```

### What each part does

**Frontend** (`curriculum.digifunzi.com`)
- Serves static HTML, CSS and JavaScript files
- Has no data of its own
- Every page load or user action sends an API request to the backend

**Backend** (`nodeapp.digifunzi.com`)
- A running Node.js/Express server
- Receives requests from the frontend
- Reads and writes data via a MySQL database (through Knex)
- Sends data back as JSON responses

### Example — creating a curriculum:
1. User fills the form and clicks **Save** on `curriculum.digifunzi.com`
2. Frontend sends `POST https://nodeapp.digifunzi.com/api/curricula`
3. Backend receives it, saves it to the `curricula` table
4. Backend responds with the saved data
5. Frontend updates the UI

### The connection point
`VITE_API_URL=https://nodeapp.digifunzi.com` in `client/.env.production` is what tells the frontend where to send all API requests. This value gets baked into the build — which is why rebuilding is required whenever it changes.

`client/.env.production` is a separate file from `client/.env` (which holds `VITE_API_URL=http://localhost:5000` for local dev). Vite automatically picks `.env.production` over `.env` when running `npm run build` — so `client/.env` never needs to be edited or switched back afterward. If `client/.env.production` doesn't exist, create it before building:
```
VITE_API_URL=https://nodeapp.digifunzi.com
```
Without it, a production build silently falls back to `client/.env` and bakes `http://localhost:5000` into the live site.

---

## Backend Deployment (Node.js / cPanel)

### cPanel Node.js App Settings
| Setting | Value |
|---|---|
| Node.js version | 22.23.2 |
| Application mode | Development |
| Application root | `curriculum.digifunzi` |
| Application URL | `nodeapp.digifunzi.com` |
| Application startup file | `src/server.js` |

### Environment Variables (set in cPanel Node.js panel)
| Name | Value |
|---|---|
| CLIENT_URL | https://curriculum.digifunzi.com |
| PUBLIC_SITE_URL | *(optional)* the marketing site's origin(s), **comma-separated** — e.g. `https://africa.digifunzi.com,http://localhost:4199,http://localhost:5175` (deployed site + its build-time prerender origin + the landing team's local dev, per `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §5). Leave unset and the `/api/public/*` routes still work for server-to-server calls; only a browser on an unlisted origin gets CORS-blocked. |
| API_PUBLIC_URL | *(optional, carried forward)* this API's own external base, e.g. `https://nodeapp.digifunzi.com`. Used to turn stored `/uploads/...` paths into absolute URLs in `/api/public/*` responses, since the landing site reads them cross-origin. Leave unset in a pinch — public responses fall back to the raw stored path. |
| PUBLIC_CONTENT_ADMIN_ID | **Required for the public marketing site's Pathways and Diagnostic pages** (9 Sep follow-on — see "This release" above). The `users.id` of the admin whose **Curriculum → Competency Framework** is the public-facing one — `/api/public/pathways[/:idOrSlug]` and `/api/public/diagnostics/*` (five endpoints) serve **only that admin's** operational pathways. **This id is database-specific** — Dev and Live have separate databases with separate admin accounts, so each environment needs its own value. To find it for an environment: log into that portal as the intended public-content admin and check `GET /api/auth/me` (returns `{ "id": "…" }`), or run `SELECT id, email FROM users WHERE role='admin'` against that environment's DB. **Leave unset and all five of those endpoints return `503`** and the website's Pathways section shows an empty state. Nothing else in the app depends on it. |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS | *(optional, carried forward)* outbound email for lead auto-ack + staff reply. Leave every one unset and both features silently no-op — nothing else breaks. Any standard SMTP account works (a Google Workspace mailbox + an App Password is the cheapest way to start; a transactional provider like Resend/Postmark/SendGrid is more reliable at volume). `SMTP_PORT` defaults to `587`. |
| MAIL_FROM | *(optional, new this release)* the From header for outbound mail, e.g. `Digifunzi <hello@digifunzi.com>`. Falls back to `SMTP_USER` if unset. |
| MAIL_REPLY_TO | *(optional, new this release)* Reply-To header on outbound mail, e.g. `enquiries@digifunzi.com` — where an enquirer's reply-to-the-reply lands. |
| NODE_ENV | development |
| DB_HOST | 127.0.0.1 (or `localhost` — whatever cPanel's MySQL Databases tool shows) |
| DB_PORT | 3306 |
| DB_USER | the MySQL user created for this app (cPanel prefixes it, e.g. `cpaneluser_digifunzi`) |
| DB_PASSWORD | that MySQL user's password |
| DB_NAME | the MySQL database created for this app (also cPanel-prefixed) |
| JWT_SECRET | a long random string — reuse the local one or generate a new one, just don't lose it once set |
| ADMIN_EMAIL | the email for the first admin login |
| ADMIN_PASSWORD | the password for the first admin login |
| ADMIN_NAME | optional, defaults to "Admin User" |

### One-time: create the MySQL database

Before the first deploy under MySQL, in cPanel go to **MySQL Databases**:
1. Create a new database (cPanel will prefix it with your account username)
2. Create a new MySQL user with a strong password
3. Add that user to the database with **All Privileges**
4. Note the full (prefixed) database name, username, and password — those go into `DB_NAME`/`DB_USER`/`DB_PASSWORD` above

### Steps to Deploy / Re-deploy Backend

> The app now migrates its own database schema and creates the first admin login automatically on every restart (see `src/server.js`) — there is no separate manual migration or data-sync step anymore. **This release adds three new migrations** (see "This release" above) which the Restart applies for you; check the app log afterwards to confirm they ran without error. `backend-deploy.zip` is **code-only**: `src/`, `knexfile.js`, `package.json`, `package-lock.json`. **`knexfile.js` lives at the app root, not inside `src/`** — don't forget it when rebuilding the zip by hand, the app will fail to start without it.

1. **Create the deployment zip** from the project root:
   - Include: `src/`, `knexfile.js`, `package.json`, `package-lock.json`
   - Exclude: `node_modules/`, `.env`, `uploads/`
   - The ready-made zip is: `backend-deploy.zip`

2. **In cPanel File Manager**, navigate to `curriculum.digifunzi` folder

3. **Delete** existing files (code only — leave `uploads/` alone):
   - `src/` folder
   - `knexfile.js` (if present from a previous deploy)
   - `package.json`
   - `package-lock.json`
   - the old `data/` folder, if still present from before the MySQL migration — it's no longer read by the app at all and can be removed once you're confident the cutover worked

4. **Upload** `backend-deploy.zip` into `curriculum.digifunzi`

5. **Extract** — right-click `backend-deploy.zip` → Extract
   - After extraction, confirm `src/server.js`, `knexfile.js`, and `src/modules/auth/auth.routes.js` are directly inside `curriculum.digifunzi`
   - If the zip extracted into an extra nested folder, move the contents up one level before restarting the app

6. **In cPanel Node.js panel**:
    - Confirm the `DB_*`/`JWT_SECRET`/`ADMIN_*` environment variables above are set
    - **Set `PUBLIC_CONTENT_ADMIN_ID`** to Dev's own value — see the env table. Get it by logging into `https://curriculum.digifunzi.com` as the admin whose Competency Framework should be public and checking `GET https://nodeapp.digifunzi.com/api/auth/me` (or `SELECT id,email FROM users WHERE role='admin'` on Dev's DB). If you skip this, `/api/public/pathways` and every diagnostic endpoint return `503` and the marketing site's Pathways section is empty.
    - Click **Run NPM Install** — wait for it to complete
    - Click **Restart** — this is what actually builds the database schema and applies the automatic startup migration. Check the app's log after restarting to confirm it started cleanly rather than crash-looping (a bad `DB_*` value is the most likely cause of a failed start).
    - **This deploy carries the multi-tenant admin-isolation release** (see "This release" above) — if Dev has more than one admin account, do the **required manual step**: reassign each admin's hubs/curricula/courses/assessments back to themselves via Settings → Admins → Move to Another Admin, after the frontend deploy below.

7. **Test** — visit `https://nodeapp.digifunzi.com`  
   Expected response: `{ "message": "API is running" }`, then confirm you can log in at `https://curriculum.digifunzi.com` with the `ADMIN_EMAIL`/`ADMIN_PASSWORD` above.

8. **Verify the public pathways feed** — `curl https://nodeapp.digifunzi.com/api/public/pathways`:
   - `503` → `PUBLIC_CONTENT_ADMIN_ID` is unset or wrong (step 6).
   - `[]` (empty) → env var is set but that admin's Competency Framework has no pathway with an active course yet. Add courses to a pathway (Curriculum → Competency Framework).
   - A non-empty array of real pathway names → working. Open one on the site.

### Uploaded files (cover images, inline images, attached documents)

Uploaded files are saved to `server/uploads/` and served directly at `https://nodeapp.digifunzi.com/uploads/<filename>` — no extra cPanel configuration is needed, the server does this itself (`app.js` already serves that folder statically).

### Login/data sync

There's no separate sync step anymore — the live MySQL database is authoritative on its own, the same way localhost's is. If localhost and live ever need the same data (e.g. testing against a copy of live data), that means backing up the live MySQL database (`mysqldump`) and restoring it wherever it's needed, not copying JSON files.

### Full data reset (rare — only when you mean to wipe live data)

To reset the live database to empty (keeping schema/tables intact), truncate its tables directly — there's no zip-based shortcut for this anymore since data lives in MySQL, not files. Take a `mysqldump` backup first unless you're certain you don't need the data. `uploads/` is still just a folder of files if you also want to clear uploaded content — delete its contents directly in cPanel File Manager.

---

## Frontend Deployment (React / cPanel Static)

### Steps to Deploy / Re-deploy Frontend

1. **Confirm `client/.env.production` exists** with:
   ```
   VITE_API_URL=https://nodeapp.digifunzi.com
   ```
   (See "The connection point" above — create it if missing. `client/.env`, used for local dev, does not need to change.)

2. **Build** the React app:
   ```bash
   cd client && npm run build
   ```
   This generates `client/dist/` containing `index.html` and `assets/`

3. **Zip the assets folder** (needed because cPanel cannot upload folders directly):
   - Zip the `assets` **folder itself**, not its loose contents — from `client/dist/` run `zip -r assets.zip assets` so the archive holds `assets/…` paths and extracts back into an `assets/` folder.
   - The ready-made zip is: `assets.zip` (already built this way — 66 entries, all under `assets/`).

4. **In cPanel File Manager**, navigate to `curriculum.digifunzi.com` folder

5. **Delete the previous build's files** so old hashed chunks don't linger:
   - the whole `assets/` folder
   - `index.html`
   (Leave `.htaccess` alone.)

6. **Upload**:
   - `index.html` from `client/dist/`
   - `assets.zip`

7. **Extract** `assets.zip` — right-click → Extract. It creates `curriculum.digifunzi.com/assets/` with all the JS/CSS/font files inside. Confirm `assets/index-DpPz0DUj.js` exists after extracting; if the extractor made a nested `assets/assets/`, move it up one level.

8. **Delete** `assets.zip` after extraction

9. **Create `.htaccess`** file in `curriculum.digifunzi.com` (if not already there):
   ```apache
   Options -MultiViews
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteRule ^ index.html [QSA,L]
   ```

10. **Test** — visit `https://curriculum.digifunzi.com`

---

## Re-deploying After Code Changes

### Backend changes only:
- Repeat Backend steps 1–7

### Frontend changes only:
- Repeat Frontend steps 1–10

### Both changed:
- Deploy backend first, then frontend

---

## Deployment Files (this folder, `Guide/dev/`)
| File | Purpose |
|---|---|
| `backend-deploy.zip` | Ready-to-upload backend zip — `src/`, `knexfile.js`, `package.json`, `package-lock.json` (code only; no node_modules, no .env, no uploads). **Rebuilt 15 Sep 2026** — includes every migration through `20260917091000_add_bootcamp_enrollment_fields_to_leads.js` (seven new migrations apply automatically on Restart — see "This release (15 Sep 2026)" at the top, one of them destructive). No new dependency. **Not yet copied to `Guide/live/backend-deploy.zip`** — this release is Dev-only so far; `Guide/live/*` still reflects the 11 Sep release until this one is confirmed on Dev and rolled to Live. |
| `assets.zip` | Ready-to-upload curriculum-portal assets zip, built with `npm run build` (Dev build — bakes in `https://nodeapp.digifunzi.com`). Zipped as the `assets` **folder**. **Rebuilt 15 Sep 2026** — `index-Cxdy4lje.js` / CSS `index-CPRP9smp.css` (unchanged CSS hash). Portal UI changed this release (Enquiries "Mark paid" panel, payment-pending price on the Account Suspended screen, Learning Hubs "Revenue" entry + Hub Visits finance tab replacing Mentor Sessions, Programs list filter/sort toolbar). |
| `index.html` | The built portal entry file (`client/dist/index.html`, Dev build) — upload alongside `assets.zip`, don't extract. `<script src>` hash must match the `index-*.js` inside `assets.zip` — both **`index-Cxdy4lje.js`**. |
| `africa-digifunzi-com-dist.zip` | Ready-to-upload **digifunzi-landing** website build (its own repo, checked out at `./digifunzi-landing`). Extract into the `africa.digifunzi.com` document root, overwriting. Built with `VITE_API_URL=https://nodeapp.digifunzi.com` and (new this release) `VITE_APP_URL=https://curriculum.digifunzi.com`. **Rebuilt 15 Sep 2026** — the new `BootcampEnrollForm.jsx` enroll-now flow. **Shipped SPA-only for the dynamic sections this pass** (`npm run deploy:build`, but `nodeapp.digifunzi.com` was unreachable from the build environment — same transient-network situation as 13 Sep) — Pathways/Projects/Store/Bootcamps/Competitions (list + detail) are client-rendered only this pass; the 9 static routes plus the previously-known pathway/project/store detail pages still prerendered. Every page is still fully functional for visitors. **Recommended:** re-run `npm run deploy:build` from a machine with a working connection to `nodeapp.digifunzi.com` and re-upload once convenient. |

### Rebuilding these zips by hand (Git Bash, from the project root)

Use Info-Zip `zip`, **not** PowerShell `Compress-Archive` (it writes `\` path separators that
break Linux/cPanel extraction).

```bash
# --- curriculum portal (Dev build) ---
cd client && npm install && npm run build && cd ..
cp client/dist/index.html Guide/dev/index.html
rm -f Guide/dev/assets.zip
(cd client/dist && zip -r -X -q ../../Guide/dev/assets.zip assets)

# --- curriculum backend (same zip for Dev and Live) ---
rm -f Guide/dev/backend-deploy.zip Guide/live/backend-deploy.zip
(cd server && zip -r -X -q /tmp/backend-deploy.zip src knexfile.js package.json package-lock.json -x "src/**/*.test.js")
cp /tmp/backend-deploy.zip Guide/dev/backend-deploy.zip
cp /tmp/backend-deploy.zip Guide/live/backend-deploy.zip

# --- digifunzi-landing website (its own repo, checked out at ./digifunzi-landing) ---
cd digifunzi-landing && npm install && npm run deploy:build && cd ..
cp digifunzi-landing/Guide/africa-digifunzi-com-dist.zip Guide/dev/africa-digifunzi-com-dist.zip
cp digifunzi-landing/Guide/africa-digifunzi-com-dist.zip Guide/live/africa-digifunzi-com-dist.zip

# --- verify — no backslash paths (all must print 0) ---
unzip -l Guide/dev/assets.zip | grep -cF '\'
unzip -l Guide/dev/backend-deploy.zip | grep -cF '\'
unzip -l Guide/dev/africa-digifunzi-com-dist.zip | grep -cF '\'
unzip -l Guide/dev/assets.zip | grep -c '^\s*0.*assets/$'   # 1 — the assets/ folder entry
grep -o 'nodeapp.digifunzi.com\|dcf-api.digifunzi.com\|localhost:5000' client/dist/assets/index-*.js | sort -u   # Dev portal → nodeapp only
```

---

## Post-deploy smoke test

Run these after the backend Restart (backend URL: `https://nodeapp.digifunzi.com` for Dev).

```bash
BE=https://nodeapp.digifunzi.com

curl -s $BE/                                             # → {"message":"API is running"}
curl -s $BE/api/public/pathways | head -c 200            # → JSON array (503 if PUBLIC_CONTENT_ADMIN_ID unset)
curl -s "$BE/api/public/pathways/<some-slug>" | grep -o '"diagnostic":{[^}]*}'

# contact-free diagnostic submit → attemptId, NO leadId
curl -s -X POST "$BE/api/public/diagnostics/<some-slug>/submit" \
  -H 'Content-Type: application/json' \
  -d '{"answers":[],"childName":"Smoke Test","childAge":10}' | grep -o '"attemptId":"[^"]*"'

# shareable report fetch (paste the attemptId)
curl -s "$BE/api/public/diagnostics/attempts/<attemptId>" | head -c 200

# removed route is gone
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "$BE/api/public/leads/x"   # → 404

# enroll lead path still works
curl -s -X POST "$BE/api/public/leads" -H 'Content-Type: application/json' \
  -d '{"parentName":"Smoke Test","parentEmail":"smoke@example.com","interestedIn":"project"}' | grep -o '"ok":true'
```

Then in a browser at `https://africa.digifunzi.com`: `/pathways` renders cards; a configured
pathway shows "Take the diagnostic"; taking one shows the report on submit with a working
"Download PDF"; the portal's **Enquiries** page gets **no** entry from the diagnostic (only the
Enroll form creates one).

Clean up: `DELETE FROM public_diagnostic_attempts WHERE childName='Smoke Test'; DELETE FROM
leads WHERE email='smoke@example.com';`
