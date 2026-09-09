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

## This release (9 Sep 2026, fourth follow-on) — sell Inventory items in the website Store

Additive. **One new migration (auto-applies on Restart), no new dependency, no new env var, no
manual step.** Backend + portal frontend + website all change. Same shape as the "third
follow-on" (for-sale Projects) below — this is the Store equivalent, driven by Inventory.

### What changed

A shared **Inventory** item (Settings → Inventory) can now be marked **"For sale on the
website"**. When it is, it appears in the public **Store** section
(`africa.digifunzi.com/store`) with a price and an "Enquire to buy" button (which posts a lead
— no checkout). This replaces the hardcoded placeholder store items — **the Store is now
driven by Inventory in the curriculum system**.

### Backend (`backend-deploy.zip`)

**One new migration:**

| Migration | Effect |
|---|---|
| `20260909161500_add_sale_fields_to_inventory.js` | Adds 14 nullable/defaulted columns to `inventory`: `saleStatus` (`internal` default \| `for_sale`), `storeCategory` (`kit`\|`bundle`\|`accessory`), `stockStatus` (`available` default \| `preorder` \| `coming_soon`), `tagline`, `badge`, `priceAmount`, `priceCurrency` (default `KES`), `priceUnit`, `priceNote`, `compareAtAmount`, and JSON `highlights` / `includes` / `specs` / `gallery`. Every existing item gets `saleStatus = 'internal'` — behaviour unchanged; Projects still link materials from the same catalog. Idempotent `up`/`down` (`hasColumn` guards). |

**Code:**
- **New `GET /api/public/store[/:idOrSlug]`** — the designated admin's `inventory` rows where
  `saleStatus = 'for_sale'`. Scoped to `PUBLIC_CONTENT_ADMIN_ID` (503 if unset, same as
  Pathways/Projects). Hand-built projection: name/tagline/storeCategory/badge/stockStatus/price/
  image + (detail) description, highlights, includes ("what you get"), specs, gallery. The ops
  `category`/`unit`/stock fields are **never exposed**. See
  `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.10/§3.11.
- **`inventory.validation.js`** — refactored to a plain fields object; defaults on the create
  schema only (a partial update never resets an untouched column); `compareAt > price`
  refinement on both.
- **`inventory.model.js`** — `findForSaleItems(ownerAdminId)` (required scope) + JSON-field
  (de)serialization for the new list columns.
- **`lead.service.js` `_resolveReference`** — a lead's `referenceId` now also resolves against
  the designated admin's for-sale inventory items, so the Enquiries card shows "Enquired from:
  <item name>" (`referenceType: "store_item"`).

**No env change.**

### Portal frontend (`assets.zip` + `index.html`)

- **Settings → Inventory → the item modal → "Selling" section** (collapsed until "For sale on
  the website" is ticked). Store category, availability, tagline, badge, price (+ unit, note,
  compare-at), highlights, "what you get", specs. Image + Description come from the item's
  normal fields.
- **Inventory cards** — a green "IN STORE" pill + a price/category line on `for_sale` items;
  the panel subheading reads "N items defined · M in the website Store".
- **Enquiries list** — the `store_item` reference type is labelled "Store item".

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- `/store` and `/store/:slug` now read `GET /api/public/store` instead of the hardcoded
  `src/content/store.js`. New `StoreItemCard` in the same brand-blue visual language as the
  Pathway / Project cards; a rewritten `StoreItemPage` (highlights, "what you get", specs,
  price + "Enquire to buy" / "Notify me when available").
- Empty state until the curriculum team marks an item for sale (see `Guide/STORE_SETUP.md`).
- A "bundle" is now just a store item with `storeCategory: "bundle"` — the old static
  bundle→projects cross-link is dropped.

### Deploy order

1. Backend zip → Node app → **Run NPM Install** → **Restart** (the migration applies).
2. Portal `assets.zip` + `index.html` → the frontend document root (the Inventory Selling
   section).
3. Website `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root.
4. Flip an Inventory item "For sale", check `/store`. Or run
   `node src/scripts/seedSampleStoreItem.js` on the server for a sample "Quarky Robot Kit".

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

**One new migration:**

| Migration | Effect |
|---|---|
| `20260909144200_add_sale_fields_to_assessments.js` | Adds 9 nullable/defaulted columns to `assessments`: `saleStatus` (`internal` default \| `for_sale`), `coverImage`, `priceAmount`, `priceCurrency` (default `KES`), `priceNote`, `saleLevel`, `saleTagline`, `ageMin`, `ageMax`. Every existing assessment gets `saleStatus = 'internal'` and NULLs — behaviour is unchanged for internal use. Idempotent `up`/`down` (`hasColumn` guards). |

**Code:**
- **New `GET /api/public/projects[/:idOrSlug]`** — the designated admin's `type: "project"`
  assessments where `saleStatus = 'for_sale'`. Scoped to `PUBLIC_CONTENT_ADMIN_ID` (503 if unset,
  same as Pathways). Hand-built projection: name/tagline/level/age/price/coverImage + (detail)
  description + overview (HTML→text), deliverables, ordered milestones, linked-inventory names.
  **Never exposes grading content** (`items`/`rubric`/`indicators`/answers). See
  `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.3/§3.4. (This is a *different* feature from the
  course-catalog `/api/public/projects` removed 4 Sep — that read `courses`; this reads
  `assessments`.)
- **`assessment.service.js` guard** — `saleStatus: 'for_sale'` is only allowed on `type:
  'project'` (400 otherwise). Price/image/level are all optional.
- **`lead.service.js` `_resolveReference`** — a lead's `referenceId` now also resolves against
  the designated admin's for-sale projects, so the Enquiries card shows "Enquired from: <project
  name>".
- Refactor: `requirePublicContentAdminId` + `htmlToText` moved to
  `server/src/shared/utils/public-content.js` (shared by the pathways and projects services).

**No env change.**

### Portal frontend (`assets.zip` + `index.html`)

- **Assessment Builder → Assessment Information tab → "Selling" panel** (Project type only). A
  "For sale on the website" toggle; when on, reveals cover image, tagline, price, level, age
  range. The buyer-facing Description / Overview / Deliverables / Milestones come from the
  assessment's own tabs.
- **Assessments list** — a green "FOR SALE" pill on a project row that's `for_sale`.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- `/projects` and `/projects/:slug` now read `GET /api/public/projects` instead of the hardcoded
  `src/content/projects.js`. New `ProjectCard` in the same brand-blue visual language as the
  Pathway cards; a dedicated `ProjectDetailPage` (build steps, "what you'll build", "what you'll
  need", price + "Enquire to buy").
- Empty state until the curriculum team marks a project for sale (see
  `Guide/PROJECT_SALE_SETUP.md`).
- The Store (`/store`, physical goods) is unchanged — still hardcoded content.

### Deploy order

1. Backend zip → Node app → **Run NPM Install** → **Restart** (the migration applies).
2. Portal `assets.zip` + `index.html` → the frontend document root (the builder Selling panel).
3. Website `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root.
4. In the portal: author a Project and flip it "For sale" (`Guide/PROJECT_SALE_SETUP.md`), then
   check `/projects` on the site.

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

Rebuilt with `VITE_API_URL` still pointing at this backend (`https://nodeapp.digifunzi.com` in
its `.env.production` — Dev's backend; confirm before a Live-backend build). Changes in it:
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

### Deploy order

1. Backend zip → the Node app → **Run NPM Install** → **Restart** (the two migrations apply).
2. (Optional) Portal `assets.zip` + `index.html` → the frontend document root.
3. Website `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root.
4. Smoke test (see "Post-deploy smoke test" at the end of this file).

---

## This release (8 Sep 2026) — what changed

### ⚠️ Read before deploying: multi-tenant admin isolation + a required manual step after

This release makes every admin's data private to that admin (previously every admin could see
every other admin's hubs/curricula/courses/assessments). **Live has more than one admin
account** — that matters for the migration below.

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

### What each part does — **this file is the Live copy** (`dcf.digifunzi.com` / `dcf-api.digifunzi.com`)

> This `Guide/live/DEPLOYMENT.md` and `Guide/dev/DEPLOYMENT.md` started as the same file — the
> steps are identical either way (see "Two environments" above), only the domains/zips differ.
> Every domain below is Live's own; the Dev copy under `Guide/dev/` uses
> `curriculum.digifunzi.com` / `nodeapp.digifunzi.com` instead.

**Frontend** (`dcf.digifunzi.com`)
- Serves static HTML, CSS and JavaScript files
- Has no data of its own
- Every page load or user action sends an API request to the backend

**Backend** (`dcf-api.digifunzi.com`)
- A running Node.js/Express server
- Receives requests from the frontend
- Reads and writes data via a MySQL database (through Knex)
- Sends data back as JSON responses

### Example — creating a curriculum:
1. User fills the form and clicks **Save** on `dcf.digifunzi.com`
2. Frontend sends `POST https://dcf-api.digifunzi.com/api/curricula`
3. Backend receives it, saves it to the `curricula` table
4. Backend responds with the saved data
5. Frontend updates the UI

### The connection point
`VITE_API_URL=https://dcf-api.digifunzi.com` in `client/.env.live` is what tells the Live frontend build where to send all API requests (`npm run build:live` reads this file — see "Two environments" above; plain `npm run build` reads `client/.env.production`, Dev's own URL, instead). This value gets baked into the build — which is why rebuilding is required whenever it changes.

`client/.env.live` is a separate file from `client/.env` (local dev, `http://localhost:5000`) and `client/.env.production` (Dev deploy, `https://nodeapp.digifunzi.com`). If `client/.env.live` doesn't exist, create it before building:
```
VITE_API_URL=https://dcf-api.digifunzi.com
```
Without it, `npm run build:live` falls back to the next env file Vite finds and bakes in the wrong backend URL.

---

## Backend Deployment (Node.js / cPanel)

### cPanel Node.js App Settings
| Setting | Value |
|---|---|
| Node.js version | 22.23.2 |
| Application mode | Development |
| Application root | `dcf-api.digifunzi` |
| Application URL | `dcf-api.digifunzi.com` |
| Application startup file | `src/server.js` |

### Environment Variables (set in cPanel Node.js panel)
| Name | Value |
|---|---|
| CLIENT_URL | https://dcf.digifunzi.com |
| PUBLIC_SITE_URL | *(optional)* the marketing site's origin(s), **comma-separated** — e.g. `https://africa.digifunzi.com,http://localhost:4199,http://localhost:5175` (deployed site + its build-time prerender origin + the landing team's local dev, per `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §5). Leave unset and the `/api/public/*` routes still work for server-to-server calls; only a browser on an unlisted origin gets CORS-blocked. |
| API_PUBLIC_URL | *(optional, carried forward)* this API's own external base, e.g. `https://dcf-api.digifunzi.com`. Used to turn stored `/uploads/...` paths into absolute URLs in `/api/public/*` responses, since the landing site reads them cross-origin. Leave unset in a pinch — public responses fall back to the raw stored path. |
| PUBLIC_CONTENT_ADMIN_ID | **Required for the public marketing site's Pathways and Diagnostic pages** (as of the 9 Sep follow-on — see "This release" above). The `users.id` of the admin whose **Curriculum → Competency Framework** is the public-facing one — `/api/public/pathways[/:idOrSlug]` and `/api/public/diagnostics/*` (five endpoints) serve **only that admin's** operational pathways. **This id is database-specific** — Dev and Live have separate databases with separate admin accounts, so each environment needs its own value (do **not** copy Dev's into Live). To find it for an environment: log into that environment's portal as the intended public-content admin and `GET /api/auth/me` (or check the URL / a network response — it returns `{ "id": "…" }`); or run `SELECT id, email FROM users WHERE role='admin'` against that environment's DB. **Leave unset and all five of those endpoints return `503`** and the website's Pathways section shows an empty state. Nothing else in the app depends on it. |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS | *(optional, carried forward)* outbound email for lead auto-ack + staff reply. Leave every one unset and both features silently no-op — nothing else breaks. Any standard SMTP account works (a Google Workspace mailbox + an App Password is the cheapest way to start; a transactional provider like Resend/Postmark/SendGrid is more reliable at volume). `SMTP_PORT` defaults to `587`. |
| MAIL_FROM | *(optional, carried forward)* the From header for outbound mail, e.g. `Digifunzi <hello@digifunzi.com>`. Falls back to `SMTP_USER` if unset. |
| MAIL_REPLY_TO | *(optional, carried forward)* Reply-To header on outbound mail, e.g. `enquiries@digifunzi.com` — where an enquirer's reply-to-the-reply lands. |
| NODE_ENV | development |
| DB_HOST | 127.0.0.1 (or `localhost` — whatever cPanel's MySQL Databases tool shows) |
| DB_PORT | 3306 |
| DB_USER | the MySQL user created for **Live's own** database (cPanel-prefixed, e.g. `cpaneluser_dcf`) — never Dev's user |
| DB_PASSWORD | that MySQL user's password |
| DB_NAME | the MySQL database created for **Live** (also cPanel-prefixed) — never Dev's database |
| JWT_SECRET | a long random string, **different from Dev's** — a compromised dev secret must not also compromise live sessions |
| ADMIN_EMAIL | Live's own first-admin login email — not Dev's |
| ADMIN_PASSWORD | Live's own first-admin login password — not Dev's |
| ADMIN_NAME | optional, defaults to "Admin User" |

### One-time: create the MySQL database

Before the first deploy under MySQL, in cPanel go to **MySQL Databases**:
1. Create a new database (cPanel will prefix it with your account username)
2. Create a new MySQL user with a strong password
3. Add that user to the database with **All Privileges**
4. Note the full (prefixed) database name, username, and password — those go into `DB_NAME`/`DB_USER`/`DB_PASSWORD` above

### Steps to Deploy / Re-deploy Backend

> The app now migrates its own database schema and creates the first admin login automatically on every restart (see `src/server.js`) — there is no separate manual migration or data-sync step anymore. **This release adds five new migrations** (see "This release" above — read the ⚠️ note before restarting) which the Restart applies for you; check the app log afterwards to confirm they ran without error. `backend-deploy.zip` is **code-only**: `src/`, `knexfile.js`, `package.json`, `package-lock.json`. **`knexfile.js` lives at the app root, not inside `src/`** — don't forget it when rebuilding the zip by hand, the app will fail to start without it.

1. **Create the deployment zip** from the project root:
   - Include: `src/`, `knexfile.js`, `package.json`, `package-lock.json`
   - Exclude: `node_modules/`, `.env`, `uploads/`
   - The ready-made zip is: `backend-deploy.zip` (this one, under `Guide/live/`)

2. **In cPanel File Manager**, navigate to the `dcf-api.digifunzi` folder — **not** `curriculum.digifunzi` (that's Dev's app root; Live is a completely separate cPanel Node.js app, see "Two environments" above)

3. **Delete** existing files (code only — leave `uploads/` alone):
   - `src/` folder
   - `knexfile.js` (if present from a previous deploy)
   - `package.json`
   - `package-lock.json`
   - the old `data/` folder, if still present from before the MySQL migration — it's no longer read by the app at all and can be removed once you're confident the cutover worked

4. **Upload** `backend-deploy.zip` into `dcf-api.digifunzi`

5. **Extract** — right-click `backend-deploy.zip` → Extract
   - After extraction, confirm `src/server.js`, `knexfile.js`, and `src/modules/auth/auth.routes.js` are directly inside `dcf-api.digifunzi`
   - If the zip extracted into an extra nested folder, move the contents up one level before restarting the app

6. **In cPanel Node.js panel** (the `dcf-api.digifunzi` app, not Dev's):
    - Confirm the `DB_*`/`JWT_SECRET`/`ADMIN_*` environment variables above are set to **Live's own values**
    - **Set `PUBLIC_CONTENT_ADMIN_ID`** to Live's own value — see the env table. Get it by logging into `https://dcf.digifunzi.com` as the admin whose Competency Framework should be public and checking `GET https://dcf-api.digifunzi.com/api/auth/me` (or `SELECT id,email FROM users WHERE role='admin'` on Live's DB). **This is different from Dev's value — do not reuse it.** If you skip this, `/api/public/pathways` and every diagnostic endpoint return `503` and the marketing site's Pathways section is empty.
    - Click **Run NPM Install** — wait for it to complete
    - Click **Restart** — this is what actually builds the database schema and creates the admin login (via the automatic startup migration). Check the app's log after restarting to confirm it started cleanly rather than crash-looping (a bad `DB_*` value is the most likely cause of a failed start).
    - **Then do the required manual step from "This release" above** — reassign each admin's hubs/curricula/courses/assessments back to themselves via Settings → Admins → Move to Another Admin, once the frontend deploy below is also done (that UI ships in this same release).

7. **Test** — visit `https://dcf-api.digifunzi.com`  
   Expected response: `{ "message": "API is running" }`, then confirm you can log in at `https://dcf.digifunzi.com` with Live's own `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

8. **Verify the public pathways feed** — `curl https://dcf-api.digifunzi.com/api/public/pathways`:
   - `503` → `PUBLIC_CONTENT_ADMIN_ID` is unset or wrong (step 6).
   - `[]` (empty array) → the env var is set, but that admin's Competency Framework has **no pathway with an active course** yet. Add courses to at least one pathway (portal → Curriculum → Competency Framework). The marketing site only shows pathways that have courses.
   - A non-empty array of real pathway names → working. Open one on the site to confirm its courses render.

### Uploaded files (cover images, inline images, attached documents)

Uploaded files are saved to `server/uploads/` and served directly at `https://dcf-api.digifunzi.com/uploads/<filename>` — no extra cPanel configuration is needed, the server does this itself (`app.js` already serves that folder statically).

### Login/data sync

There's no separate sync step anymore — the live MySQL database is authoritative on its own, the same way localhost's is. If localhost and live ever need the same data (e.g. testing against a copy of live data), that means backing up the live MySQL database (`mysqldump`) and restoring it wherever it's needed, not copying JSON files.

### Full data reset (rare — only when you mean to wipe live data)

To reset the live database to empty (keeping schema/tables intact), truncate its tables directly — there's no zip-based shortcut for this anymore since data lives in MySQL, not files. Take a `mysqldump` backup first unless you're certain you don't need the data. `uploads/` is still just a folder of files if you also want to clear uploaded content — delete its contents directly in cPanel File Manager.

---

## Frontend Deployment (React / cPanel Static)

### Steps to Deploy / Re-deploy Frontend

1. **Confirm `client/.env.live` exists** with:
   ```
   VITE_API_URL=https://dcf-api.digifunzi.com
   ```
   (See "The connection point" above — create it if missing. `client/.env` and
   `client/.env.production`, used for local dev and Dev's own deploy, do not need to change.)

2. **Build** the React app **for Live specifically** — not plain `npm run build`, which bakes in
   Dev's API URL instead:
   ```bash
   cd client && npm run build:live
   ```
   This generates `client/dist/` containing `index.html` and `assets/`

3. **Zip the assets folder** (needed because cPanel cannot upload folders directly):
   - Zip the `assets` **folder itself**, not its loose contents — from `client/dist/` run `zip -r assets.zip assets` so the archive holds `assets/…` paths and extracts back into an `assets/` folder.
   - The ready-made zip is: `assets.zip` (under `Guide/live/`, already built this way — 66 entries, all under `assets/`).

4. **In cPanel File Manager**, navigate to the `dcf.digifunzi.com` document root — **not**
   `curriculum.digifunzi.com` (Dev's own static site root)

5. **Delete the previous build's files** so old hashed chunks don't linger:
   - the whole `assets/` folder
   - `index.html`
   (Leave `.htaccess` alone.)

6. **Upload**:
   - `index.html` from `Guide/live/` (or `client/dist/`, same file)
   - `assets.zip` from `Guide/live/`

7. **Extract** `assets.zip` — right-click → Extract. It creates `dcf.digifunzi.com/assets/` with all the JS/CSS/font files inside. Confirm `assets/index-DpzXMqtJ.js` exists after extracting; if the extractor made a nested `assets/assets/`, move it up one level.

8. **Delete** `assets.zip` after extraction

9. **Create `.htaccess`** file in `dcf.digifunzi.com` (if not already there):
   ```apache
   Options -MultiViews
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteRule ^ index.html [QSA,L]
   ```

10. **Test** — visit `https://dcf.digifunzi.com`

---

## Re-deploying After Code Changes

### Backend changes only:
- Repeat Backend steps 1–7

### Frontend changes only:
- Repeat Frontend steps 1–10

### Both changed:
- Deploy backend first, then frontend — **and do the required manual reassignment step
  ("This release" above) only after both are deployed**, since the "Move to Another Admin" UI is
  itself part of this frontend deploy.

---

## Deployment Files (this folder, `Guide/live/`)
| File | Purpose |
|---|---|
| `backend-deploy.zip` | Ready-to-upload backend zip — `src/`, `knexfile.js`, `package.json`, `package-lock.json` (code only; no node_modules, no .env, no uploads). **Rebuilt 9 Sep 2026** — includes every migration through `20260909110000_make_public_diagnostic_attempt_lead_nullable.js` (the two new ones this release apply automatically on Restart — see the top "This release" section). `nodemailer` (added 4 Sep) is already in `package.json`; no new dependency this release, so **Run NPM Install** on Restart is safe either way. |
| `assets.zip` | Ready-to-upload curriculum-portal assets zip, built with `npm run build:live` (bakes in `https://dcf-api.digifunzi.com`, **not** Dev's URL). Zipped as the `assets` **folder**, so it extracts to an `assets/` folder. **Rebuilt 9 Sep 2026** — `index-DpzXMqtJ.js` / CSS `index-CPRP9smp.css`. No portal-UI change this release; deploying it is optional if the 8 Sep portal build is already live. |
| `index.html` | The built portal entry file (`client/dist/index.html`, Live build) — upload alongside `assets.zip`, don't extract. Its `<script src>` hash must match the `index-*.js` inside `assets.zip` — both **`index-DpzXMqtJ.js`** in this build. |
| `africa-digifunzi-com-dist.zip` | Ready-to-upload **digifunzi-landing** website build (its own repo — `github.com/kkg-kevin/curriculum-web`). Extract into the `africa.digifunzi.com` document root, overwriting. Built with `VITE_API_URL=https://nodeapp.digifunzi.com` (Dev's backend — the same value the site's `.env.production` carries; confirm before a Live-backend build). **Pathway detail pages ship as SPA-only HTML** (the build-time prerender needs the API reachable, which it wasn't on the build machine) — the pages work at runtime, they're just not pre-rendered for SEO. Re-run `npm run deploy:build` in that repo from a machine that can reach the backend, then re-upload, to fix that. |

### Rebuilding these zips by hand (Git Bash, from the project root)

Use Info-Zip `zip`, **not** PowerShell `Compress-Archive` (it writes `\` path separators that
break Linux/cPanel extraction).

```bash
# --- curriculum portal (Live build) ---
cd client && npm install && npm run build:live && cd ..
cp client/dist/index.html Guide/live/index.html
rm -f Guide/live/assets.zip
(cd client/dist && zip -r -X -q ../../Guide/live/assets.zip assets)

# --- curriculum backend (same zip for Dev and Live) ---
rm -f Guide/live/backend-deploy.zip Guide/dev/backend-deploy.zip
(cd server && zip -r -X -q /tmp/backend-deploy.zip src knexfile.js package.json package-lock.json -x "src/**/*.test.js")
cp /tmp/backend-deploy.zip Guide/live/backend-deploy.zip
cp /tmp/backend-deploy.zip Guide/dev/backend-deploy.zip

# --- digifunzi-landing website (its own repo, checked out at ./digifunzi-landing) ---
cd digifunzi-landing && npm install && npm run deploy:build && cd ..
cp digifunzi-landing/Guide/africa-digifunzi-com-dist.zip Guide/live/africa-digifunzi-com-dist.zip
cp digifunzi-landing/Guide/africa-digifunzi-com-dist.zip Guide/dev/africa-digifunzi-com-dist.zip

# --- verify — no backslash paths (all must print 0) ---
unzip -l Guide/live/assets.zip | grep -cF '\'
unzip -l Guide/live/backend-deploy.zip | grep -cF '\'
unzip -l Guide/live/africa-digifunzi-com-dist.zip | grep -cF '\'
unzip -l Guide/live/assets.zip | grep -c '^\s*0.*assets/$'   # 1 — the assets/ folder entry
# --- verify the right backend URL is baked in ---
grep -o 'dcf-api.digifunzi.com\|nodeapp.digifunzi.com\|localhost:5000' client/dist/assets/index-*.js | sort -u   # Live portal → dcf-api only
```

---

## Post-deploy smoke test

Run these after the backend Restart (replace `<BE>` with the backend URL —
`https://dcf-api.digifunzi.com` for Live, `https://nodeapp.digifunzi.com` for Dev).

```bash
BE=https://dcf-api.digifunzi.com

# 1. backend up
curl -s $BE/                                             # → {"message":"API is running"}

# 2. public pathways (needs PUBLIC_CONTENT_ADMIN_ID set — else 503)
curl -s $BE/api/public/pathways | head -c 200            # → a JSON array of pathways

# 3. a pathway's diagnostic block
curl -s "$BE/api/public/pathways/<some-slug>" | grep -o '"diagnostic":{[^}]*}'

# 4. contact-free diagnostic submit → returns attemptId, NO leadId
curl -s -X POST "$BE/api/public/diagnostics/<some-slug>/submit" \
  -H 'Content-Type: application/json' \
  -d '{"answers":[],"childName":"Smoke Test","childAge":10}' | grep -o '"attemptId":"[^"]*"'

# 5. shareable report fetch (paste the attemptId from step 4)
curl -s "$BE/api/public/diagnostics/attempts/<attemptId>" | head -c 200

# 6. the removed route is gone
curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "$BE/api/public/leads/x"   # → 404

# 7. the enroll lead path still works
curl -s -X POST "$BE/api/public/leads" -H 'Content-Type: application/json' \
  -d '{"parentName":"Smoke Test","parentEmail":"smoke@example.com","interestedIn":"project"}' | grep -o '"ok":true'
```

Then, in a browser:
- `https://africa.digifunzi.com/pathways` — pathway cards render
- `https://africa.digifunzi.com/pathways/<slug>` — "Take the diagnostic" button shows (if that
  pathway has a public diagnostic configured — see `Guide/PUBLIC_DIAGNOSTIC_SETUP.md`)
- Take a diagnostic → the report renders on submit → "Download PDF" opens the print dialog
- Check the portal's **Enquiries** page — the diagnostic must **not** have created an entry;
  only submitting the Enroll form does.

Clean up the smoke-test rows afterwards: `DELETE FROM public_diagnostic_attempts WHERE
childName='Smoke Test'; DELETE FROM leads WHERE email='smoke@example.com';`
