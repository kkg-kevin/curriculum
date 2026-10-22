# Deployment Guide — Digifunzi Curriculum — Capable environment

**Status: backend and portal rebuilt (22 Oct 2026) — ready to upload, together; take a database backup first.** Release notes: `Guide/live/DEPLOYMENT.md` → "This release (22 Oct 2026)":
- **Assessment folders** on the Assessments page, the same way as course folders.
- **Performance Bands list every indicator** a competency has in Settings, not only the ones assessments tag.
- **The arrows on a pathway's courses reorder them**; before, they saved nothing.
- **The M-Pesa code is included but off:** no `MPESA_*` keys are needed, and none should be set on Capable. With none set, no M-Pesa button or Paybill number appears. What does change: a Billing → M-Pesa tab and an owner-only Settings → Payments tab appear (both saying M-Pesa isn't set up); recording a full payment on a website sign-up's first invoice switches the sign-up on by itself; and a website bootcamp enrolment raises its invoice at sign-up (Capable has no website yet, so no such sign-ups arrive).

Four new migrations, applied on Restart. Three add tables or columns (M-Pesa twice, `assessment_folders`); the fourth only lines each pathway's course order up with what the tab already shows. Check `SHOW TABLES LIKE 'assessment_folders';` and `SHOW TABLES LIKE 'mpesa_accounts';`, and run Run JS script → `db:migrate` if either is missing. No new npm package; backend and portal uploaded together (portal `index-CpageW8Y.js`). Not yet clicked through in a browser or tried on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here.

Below it, "This release (19 Oct 2026, afternoon)" — a non-school hub's form has a new **Club details for parents** section (ages, children per class, session times, a description for parents, FAQs); it feeds a website club page, so **on Capable (no website yet) nothing visible changes beyond the form**. One new, additive migration (`20261019120000_add_club_details_to_learning_hubs.js` — `learning_hubs.clubDetails`), applied on Restart — check `SHOW COLUMNS FROM learning_hubs LIKE 'clubDetails';` and run Run JS script → `db:migrate` if it's missing. No environment variable; no new npm package; backend and portal uploaded together (portal `index-Cizzw49C.js`). The website parts of those notes don't apply here. Below it, "This release (19 Oct 2026)" — course folders on the Courses page (New Folder with a name, description, image and colour; folder cards the size of a course card showing their colour on hover; Add courses, Edit folder, Delete folder keeping its courses; Add to / Move to folder on each course; search looks through every course); assessment points and indicator marks rounded to one decimal place as typed and on save, even splits adding up exactly; and the Tech Clubs page with Billing → Tech Club packages — families join a club from a website, so **on Capable (no website yet) no sign-ups arrive** and the page stays empty, but it does no harm (a new "Tech Clubs" staff permission appears, off until ticked). Three new, additive migrations (`20261019090000_create_tech_club_memberships.js` — three club tables, `clubMembershipId` on invoices and enquiries, a `tech_club` invoice type; `20261019100000_create_course_folders.js`; `20261019110000_add_description_and_image_to_course_folders.js`), applied on Restart — check `SHOW TABLES LIKE 'course_folders';` and `SHOW COLUMNS FROM course_folders LIKE 'coverImage';`, and run Run JS script → `db:migrate` if either is missing. No environment variable; no new npm package; backend and portal uploaded together (portal `index-CRMt_1rI.js`). Not yet clicked through in a browser or tried on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (16 Oct 2026, afternoon)" — educator pay: rates set once in Settings → Educator pay (per session, hourly, daily and the advance %; an empty rate isn't offered; the old per-educator rates and Billing's "Session rates" are gone); educators tagged Full time (can't claim) or Part time with the ways they can be paid, picking one per claim; every claim carries the generated claim invoice and a required eTIMS PDF; Request payment is one screen; a rate change only affects claims sent afterwards. The educator portal has one Payments item (Claims | Invoices) that follows the hub picker, with invoices opening beside the list; supervisors and the admin open a claim as a page with its invoices beside it; supervisors narrow down by school on My Educators and Claims; the admin has Billing → Educator Claims → Claim invoices (Pending payment / Paid); Billing → Invoices shows where each invoice came from (source tabs, a school filter, a From line linking to the bootcamp, household, hub, customer or learner). One new migration (`20261016110000_add_educator_pay_types.js`: hourly and daily rates, left empty, so only per-session claims until they're set; `teachers.payRateTypes`; the figures each claim was worked out on), applied on Restart — check `SHOW COLUMNS FROM teachers LIKE 'payRateTypes';` and run Run JS script → `db:migrate` if it's missing. **Before uploading, list who is tagged full time** (`SELECT firstName, lastName, email FROM teachers WHERE employmentType = 'full_time';`) — they can no longer claim; switch any who should to Part time. No environment variable; no new npm package; backend and portal uploaded together (portal `index-BumvquxU.js`). Not yet tried on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (16 Oct 2026)" — unsaved work in the assessment builder, Add Course, Edit Course and the session editor is saved as a draft in the workspace as it is typed (not in one browser, since many people use one account); drafts show as amber "UNSAVED DRAFT" cards at the front of the Assessments and Courses grids with Continue and Delete, and an "Unsaved drafts" filter; on a course page a session with a draft has an amber row; reopening something with a draft offers Restore / Discard / Not now; saving deletes the draft. Also up to 3 extra images per bootcamp, hub photos limited to 3 (check first: `SELECT name, JSON_LENGTH(photos) AS photos FROM learning_hubs WHERE JSON_LENGTH(photos) > 3;` — a hub listed can't be saved until trimmed to 3), a crop step when uploading bootcamp and hub images, and exact map pins for a website (Capable has none yet). Three new migrations (`bootcamps.images`; the `assessment_drafts` table, then `drafts`, which takes its rows and drops it), applied on Restart — check `SHOW TABLES LIKE 'drafts';` and run Run JS script → `db:migrate` if it's missing; no environment variable; no new npm package; backend and portal uploaded together (portal `index-qtbSkMdV.js`). Not yet tried in a browser or on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (15 Oct 2026)" — the Enquiries page shows how each family found the website ("Found us: Google search → /bootcamps/"), for enquiries sent from a website built from `curriculum-web` `ce26f35` or later; Capable has no website yet, so in practice nothing visible changes here until it does. One new, additive migration (`leads.visitSource`, JSON, nullable), applied on Restart — check with `SHOW COLUMNS FROM leads LIKE 'visitSource';` and run Run JS script → `db:migrate` if it's missing; no environment variable; no new npm package; backend and portal uploaded together (portal `index-D1P6e-en.js`). The website parts of those notes don't apply here. Below it, "This release (14 Oct 2026)" — all admins of an installation can share one pool of data (every admin sees, adds, changes and deletes the same content); Add Admin now puts the new admin in your organisation instead of giving them an empty workspace; admins who already have separate workspaces are joined only by running the merge (Setup Node.js App → Run JS script → `org:merge:report`, then `org:merge:apply`, with `ORG_BASE_EMAIL` set to the admin whose data stays as it is); inviting an email whose educator, hub or learner was deleted no longer fails with "already registered"; the sidebar opens on hover. One new, additive migration (`users.organisationId`, `curricula.mergedFromAdminId`) — **on Dev it did not apply on Restart: run Run JS script → `db:migrate` after uploading and check the column exists**; one optional environment variable (`ORG_BASE_EMAIL`, only for the merge); no new npm package; backend and portal uploaded together (portal `index-CO2HB_2k.js`). **Before any merge on Capable, count its admins** (`SELECT email FROM users WHERE role = 'admin';`): with one admin there is nothing to merge and the merge can be skipped; with several, run the report first and read it — every admin it lists will see everything. The merge was rehearsed on Dev; not yet on Capable. The website parts of those notes don't apply here. Below it, "This release (13 Oct 2026)" — pathways now run across developmental stages (a pathway dropdown, then each stage with its own courses, advancement rules and diagnostic; pathways from before this release show under "No stage yet" until moved); Duplicate on a curriculum's card menu makes an independent "<name> (Copy)" with a green Copy pill, sharing the same courses and assessments; a hub's classes are listed in the curriculum's grade order; Set Up Year no longer reports "no published academic year" when the published year's name has no four-digit year; the hub page shows its description as formatted text instead of raw tags; the curriculum code accepts any characters; and Settings → People & sharing has a new Users section listing every login in the workspace with its account type, role, last activity and status, where the owner can deactivate an account (signed out at once, can't sign in until activated again, nothing deleted). Two new, additive migrations (`curricula.copiedFromId`, `users.deactivatedAt`), applied on Restart; no environment variable; no new npm package; backend and portal must be uploaded together (portal `index-BlRbG6Sp.js`). Not yet tried in a browser or on the hosting — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (12 Oct 2026, hardening)" — nothing changes in how the system is used: passwords are checked on background threads so a class signing in together no longer slows everyone down; the request limit is counted per signed-in account instead of per internet address; a second Submit of the same assessment (double tap, retry, second tab) is refused instead of being marked twice; uploaded `.html`/`.svg`/`.xml` files download instead of opening as a page; lesson content is cleaned of scripts before display; `https://lms-api.capable.co.ke/health` reports whether the API can reach its database; package security updates. No migration, no required environment variable (`TRUST_PROXY` is optional — leave it unset); backend and portal uploaded together (portal `index-BAlmUjG5.js`). Not yet tried on the hosting, and the submission fixes were checked by reading the code, not under real simultaneous requests — follow "Verify" in those notes on Dev first. The website parts of those notes don't apply here. Below it, "This release (12 Oct 2026)" — large uploads go up in pieces: any file over 5 MB (a course or assessment video) is sent as a series of 5 MB requests, so it no longer has to finish inside one request's time limit; a failed piece is retried, a dropped upload carries on when the same file is chosen again, and the upload fields show a progress bar with Cancel. No migration, no new environment variable, no new npm package; backend and portal must be uploaded together (portal `index-B4g_Z5zW.js`). Not yet tried in a browser or on the hosting — upload a video of 100 MB or more as the first check, following "Verify" in those notes. The website parts of those notes don't apply here. Below it, "This release (9 Oct 2026)" — the portal fits a phone screen: page headers put their buttons under the title, columns, forms and card grids stack, list rows put figures under the name, dialogs scroll, fields no longer make iPhone Safari zoom in, Settings tabs and the timetable week scroll sideways, and the top bar shows the section name. No migration, no new environment variable, no new npm package; portal only. Checked in a phone-sized browser with no records in it — check pages with real records on a phone before relying on it. The website parts of those notes don't apply here. Below it, "This release (8 Oct 2026)" — certificates of completion (a learner earns one when their final course report is published; pathway and bootcamp certificates follow from course ones; each has a number and a public verification page reached from its QR code), "My achievements" on the learner profile, Reports → Certificates issued with revoke and reinstate, Settings → Certificates for the signatory, a "Certificate earned" notification and email, and image uploads raised to 10 MB with large photos resized in the browser. One new, additive migration (two new tables); no new environment variable; no new npm package; backend and portal must be uploaded together (portal `index-j1lzLUJy.js`). Certificates for final reports already published are created the first time certificates are viewed, with no email. The certificate carries the Capable logo; numbers are prefixed `DF-` in every environment. The website parts of those notes don't apply here. Below it, "This release (7 Oct 2026)" — the shared learner profile as a full page with a section per hub, and the designed email layout. Below it, "This release (5 Oct 2026)" — educator claims (an educator requests an advance or full payment for a course with a PDF invoice; their supervisor approves or declines; the admin pays), supervisor accounts and the supervisor portal, Educator Claims as a tab in Billing, and the activity log. Three new migrations (one alters `users.role` to allow the new "supervisor" sign-in role — hence the backup); no new environment variable; backend and portal must be uploaded together (portal `index-D-3a-a11.js`). The website parts of those notes don't apply here. Claim amounts show as "KSh" and the default session rate is KSh 904.666 — change it under Billing → Educator Claims → Session rates if Capable pays differently. Below it, "This release (2 Oct 2026)" — bootcamp games (Events → Games, and a Games & play card on the bootcamp form), sharing between admins, the People & sharing tab in Settings, staff use of Settings data, and the fix for partial saves blanking other fields. Two new, additive migrations; no new environment variable; backend and portal must be uploaded together (portal `index-Cdok_5cD.js`). The website parts of those notes don't apply here. Below it, "This release (1 Oct 2026, third follow-on)" — email: password reset links, invoices and receipts emailed to the payer, selected notifications by email. One new, additive migration; backend and portal must be uploaded together. **Nothing is emailed until `BREVO_API_KEY` is set** (outbound SMTP is blocked on this server, so the `SMTP_*` variables are not used) — use the Capable column of that release's Environment table (`BREVO_API_KEY`, `MAIL_BRAND_NAME=Capable`, `MAIL_FROM=Capable <no-reply@digifunzi.com>`, and check `CLIENT_URL=https://lms.capable.co.ke`), then add the cron job. Below it, "This release (1 Oct 2026, second follow-on)" is included too — Items (Goods & Services), 30-minute idle sign-out and sign-out when the last tab closes, Home Learning packages moved to Billing → Packages, child vs parent logins, parents adding children from My Family. Two new migrations (the first restructures the `inventory`/`billing_items` tables into `items`), everyone signs in again once, and the backend and portal must be uploaded together. The website parts of those notes don't apply here. Optional new env var `SESSION_IDLE_MINUTES` (default 30); `JWT_EXPIRES_IN` recommended `12h`. Earlier releases below it are included.

| Part | Repo | URL |
|---|---|---|
| Curriculum frontend (LMS) | `client/` (this repo) | https://lms.capable.co.ke |
| Curriculum backend (API) | `server/` (this repo) | https://lms-api.capable.co.ke |

`capable.co.ke` already has its own separate website — this deploy is the
LMS (portal frontend + API) only, on the `lms.` / `lms-api.` subdomains.
**`digifunzi-landing` (the marketing site) is out of scope for this
environment** and nothing here touches it.

This file is a companion to `Guide/live/DEPLOYMENT.md` (read that one too —
it has the full backend/frontend deploy mechanics, migration/release
history, and env var reference this file doesn't repeat) and follows the
exact same "One-time setup for Live" pattern that file documents, adapted
for Capable's two subdomains.

**The one real difference from how Live was set up:** Live started with an
empty database that built its own schema from the migrations on first
Restart. Capable instead starts from **a real copy of Dev's data** — see
"Cloning Dev's data into Capable" below. Everything else (separate domain,
separate database, separate secrets, separate JS bundle because
`VITE_API_URL` is baked in at build time) is identical in kind to how Live
was set up, just a third instance instead of a second.

---

## What's actually in these zips right now

| File | Built how | Safe to upload as-is? |
|---|---|---|
| `backend-deploy.zip` | 22 Oct 2026, from HEAD (`c12fa9b`) — byte-identical to `Guide/dev/` and `Guide/live/`; code only, nothing environment-specific baked in. Adds assessment folders (`/api/assessments/folders`; migration `20261022100000_create_assessment_folders.js`), pathway course reorder by course (migration `20261022110000_align_pathway_course_order.js`, data only) and the M-Pesa module, off without `MPESA_*` keys (migrations `20261021090000_create_mpesa_tables.js` and `20261022090000_mpesa_accounts_links_operations.js`). 19 Oct (afternoon): club details for parents on learning hubs (migration `20261019120000_add_club_details_to_learning_hubs.js`). 19 Oct (morning): course folders (`/api/courses/folders`; migrations `20261019100000_create_course_folders.js` and `20261019110000_add_description_and_image_to_course_folders.js`), marks rounded to one decimal place on save, and Tech Club memberships (`/api/tech-clubs`, `/api/billing/club-packages`, `/api/public/clubs/*`; migration `20261019090000_create_tech_club_memberships.js`). 16 Oct (afternoon): educator pay types (Settings → Educator pay, `GET/PUT /api/claims/settings` with hourly and daily rates; migration `20261016110000_add_educator_pay_types.js`), full-time educators refused a claim, the pay type and units on each claim, the claims list for one hub (`GET /api/claims/courses?hubId=`), each supervisor educator's schools, the educator's own hub list including hubs where they teach a class, and each billing invoice's `source`. Earlier 16 Oct: workspace drafts (`/api/assessments/drafts`, `/api/courses/drafts`; migrations `20261016090000_create_assessment_drafts.js` and `20261016100000_create_drafts.js`), bootcamp extra images (`20261015100000_add_images_to_bootcamps.js`), the 3-photo limit on hubs and the map pin for a website's club pages. Carries everything from earlier releases (see the previous rows' history in git). All migrations up to `20261019120000_add_club_details_to_learning_hubs.js`, applied on Restart; no new package | **Yes** — after a database backup |
| `assets.zip` + `index.html` | 22 Oct 2026, `npm run build:capable` (`client/`) — bakes in `https://lms-api.capable.co.ke` and the Capable branding. Entry **`index-CpageW8Y.js`** / CSS `index-hXTMed0K.css`. Adds assessment folders, every indicator on Performance Bands, working pathway course arrows, and the M-Pesa screens (Billing → M-Pesa, Settings → Payments), which say M-Pesa isn't set up. 19 Oct (afternoon): the Club details for parents section on the hub form. 19 Oct (morning): course folders, marks to one decimal place in the assessment builder, and the Tech Clubs page with Billing → Tech Club packages. 16 Oct (afternoon): Settings → Educator pay, Full time / Part time and pay types on the educator form, the one-screen Request payment with the claim invoice preview, Payments (Claims | Invoices) in the educator portal following the hub picker, claims as pages for supervisors and the admin with invoices beside them, the supervisor School pickers, Claim invoices, and Billing's source tabs, school filter and From lines. Earlier 16 Oct: draft saving for assessments, courses and sessions, the draft cards, bootcamp extra images, the 3-photo limit on hubs and cropping on upload | **Yes** — upload to the `lms.capable.co.ke` document root, together with the backend |

No website zip here — the marketing site isn't part of this deploy (see above).
(`digifunzi-landing` does have `build:capable` scripts, but its `.env.capable` still points at a
placeholder API, so don't build it for Capable until that's given a real URL.)

**Before the Restart that applies this release's migrations**, set `PUBLIC_CONTENT_ADMIN_ID` if
Capable should seed the three default Home Learning packages for that admin (the seed reads it
at migration time; otherwise create packages by hand in Home Learning → Packages).

Rebuilding the frontend zip later:

```bash
cd client && npm run build:capable && cd ..
# zip must contain the assets/ folder itself (not just its contents), so
# extracting it in cPanel File Manager produces assets/ directly in the
# document root, alongside index.html:
cd client/dist && zip -r ../../Guide/capable/assets.zip assets && cd ../..
cp client/dist/index.html Guide/capable/index.html
```

---|---|---|
| `backend-deploy.zip` | Copied straight from `Guide/dev/backend-deploy.zip` — code is identical across every environment, nothing environment-specific baked in | **Yes** — this one's genuinely correct regardless of domain, same as Dev/Live |
| `assets.zip` + `index.html` | Built with the old `npm run build:capable` (`client/`), before `client/.env.capable` had a real domain — bakes in the placeholder `https://capable-api.TODO-DOMAIN.com` | **No** — every API call from this bundle would hit a domain that doesn't resolve. Rebuild now that `client/.env.capable` points at `https://lms-api.capable.co.ke` (see below), then re-copy into this folder |
| `africa-digifunzi-com-dist.zip` | Leftover from earlier scaffolding, built against the placeholder domain | **Not needed** — the marketing website isn't part of this deploy (see above). Safe to delete from this folder once the frontend/backend zips are rebuilt. |

Rebuilding the frontend zip now that the real domain is in
`client/.env.capable`:

```bash
cd client && npm run build:capable && cd ..
# zip must contain the assets/ folder itself (not just its contents), so
# extracting it in cPanel File Manager produces assets/ directly in the
# document root, alongside index.html:
cd client/dist && zip -r ../../Guide/capable/assets.zip assets && cd ../..
cp client/dist/index.html Guide/capable/index.html
```

---

## One-time setup for Capable (cPanel side — manual, not scriptable from here)

Follow `Guide/live/DEPLOYMENT.md`'s "One-time setup for Live" section
step-for-step, substituting Capable's own values throughout. Concretely:

1. **Create the two new subdomains** (cPanel → **Domains** → **Create A New
   Domain**, under the `capable.co.ke` domain): `lms.capable.co.ke`
   (frontend) and `lms-api.capable.co.ke` (backend).
2. **Create a new MySQL database + user** — fully separate from both Dev's
   and Live's. Same one-time steps as `Guide/live/DEPLOYMENT.md`'s "Backend
   Deployment" → "One-time: create the MySQL database" section. Note the new
   `DB_NAME`/`DB_USER`/`DB_PASSWORD` — you'll need them for both the env
   setup below and the data clone.
3. **Create a new cPanel Node.js App**, application root e.g.
   `lms-api.capable` (parallel to `curriculum.digifunzi` / `dcf-api.digifunzi`),
   Application URL `lms-api.capable.co.ke`, startup file `src/server.js` —
   same settings as `Guide/live/DEPLOYMENT.md`'s "cPanel Node.js App
   Settings" table.
4. **Set Capable's own environment variables** in that new app's panel:
   - `CLIENT_URL=https://lms.capable.co.ke`
   - `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` — the **new**
     database from step 2, never Dev's or Live's
   - `JWT_SECRET` — generate a **new, different** long random string; never
     reuse Dev's or Live's (a compromised secret on one environment must
     never compromise sessions on another)
   - `ADMIN_EMAIL`/`ADMIN_PASSWORD` — used only if the database is empty on
     first Restart (the app auto-creates the first admin then). Since
     Capable's database is being **cloned from Dev**, not started empty
     (see below), Dev's existing admin accounts come along with the clone —
     these two vars only matter as a fallback if the clone hasn't happened
     yet when the app first restarts.
   - `PUBLIC_SITE_URL`/`API_PUBLIC_URL`/`SMTP_*`/`MAIL_*` — same meaning as
     Dev/Live, set independently for Capable (e.g.
     `API_PUBLIC_URL=https://lms-api.capable.co.ke`)
   - `PUBLIC_CONTENT_ADMIN_ID` — **database-specific, do not copy Dev's
     value blindly.** Even though Capable's database starts as a copy of
     Dev's, confirm this admin id still resolves to the intended
     public-content admin post-clone (it should, since the clone preserves
     ids) — see `Guide/live/DEPLOYMENT.md`'s env var reference table for
     what this controls.
5. **Clone Dev's data into Capable's database** — see the dedicated section
   below. Do this **before** the first Restart of the new Node app, so the
   app's automatic startup migration runs against the cloned (not empty)
   schema.
6. **Deploy backend** to the new app — same "Steps to Deploy / Re-deploy
   Backend" as `Guide/live/DEPLOYMENT.md`, targeting the `lms-api.capable`
   app root. Any migrations newer than what Dev's dump captured apply
   automatically on this first Restart, same as any other redeploy.
7. **Deploy frontend** to the new subdomain — same "Steps to Deploy /
   Re-deploy Frontend" as `Guide/live/DEPLOYMENT.md`, but build with
   `npm run build:capable` (not `build` or `build:live`) and upload to the
   `lms.capable.co.ke` document root.
8. **Test:**
   - Visit `https://lms-api.capable.co.ke` → expect
     `{ "message": "API is running" }`.
   - Log into `https://lms.capable.co.ke` with one of Dev's existing
     admin accounts (cloned over) — confirm the cloned curricula/courses/
     learners/etc. are visible.
   - Confirm `JWT_SECRET` is genuinely different from Dev's/Live's (a
     session token minted on Dev must not validate against Capable).

---

## Cloning Dev's data into Capable

This is a real database export/import — it needs direct MySQL access to
both Dev's deployed database (cPanel/SSH on the Dev server) and Capable's
new database, which isn't something runnable from a local dev machine's
`.env` (this repo's local `server/.env` points at a **local** MySQL
instance on `127.0.0.1`, not the deployed Dev server's remote database —
confirm you're connecting to the right host before running any of this).

1. **Back up Capable's database first**, even though it should be empty at
   this point — cheap insurance, same posture as every migration in
   `Guide/live/DEPLOYMENT.md` that touches schema.
2. **On the Dev server** (via cPanel's phpMyAdmin "Export" tab, or SSH +
   `mysqldump` if available), export Dev's full database:
   ```bash
   mysqldump -u <dev_db_user> -p <dev_db_name> > dev-snapshot.sql
   ```
   Use `--single-transaction` if the Dev database is InnoDB throughout (it
   should be — Knex's MySQL migrations default to InnoDB) to get a
   consistent snapshot without locking tables while Dev is in use.
3. **Review before importing** — this is a real copy of live user data
   (real learner names, guardian emails/phones, teacher accounts, whatever
   Dev currently holds). Confirm this is actually intended (test/demo data
   only, or a deliberate full clone including real people's data) before
   moving it to a new environment — if Dev has accumulated real contact
   information from testing, decide whether Capable needs it or whether a
   sanitized subset makes more sense.
4. **Import into Capable's new database**:
   ```bash
   mysql -u <capable_db_user> -p <capable_db_name> < dev-snapshot.sql
   ```
5. **Do not copy `uploads/`** (or do, deliberately) — the database dump
   above does not include the Dev server's `uploads/` folder (course
   materials, cover images, etc.) referenced by stored paths. If Capable
   needs those files too, copy the Dev server's `uploads/` directory
   separately (e.g. via cPanel File Manager download/upload, or `rsync`/
   `scp` if SSH is available) into the same relative location on Capable's
   app root — otherwise every image/file reference in the cloned data will
   404 until the files exist on Capable's own filesystem.
6. **Restart the Capable Node app** — the automatic startup migration
   (`src/server.js`, same as every environment) reconciles the cloned
   schema against whatever migrations exist in this codebase's
   `server/src/db/migrations/` that Dev's dump doesn't yet reflect (i.e.
   anything migrated on Dev after the dump was taken, or genuinely new
   since). Check the app log to confirm it applied cleanly.
7. **Decide what "capable" means for the cloned data going forward** —
   once live, Capable's database diverges from Dev's independently (new
   signups, new content, etc. on either side are NOT synced after this
   one-time clone). If periodic re-syncing from Dev is ever wanted, that's
   a repeat of this same procedure, not an automated process — nothing in
   this codebase keeps two environments' data in sync continuously.

---

## Re-deploying after this, per environment

Once Capable is live, it joins Dev and Live as a third deploy target for
every future code change — same code, three separate deploy passes:

```bash
# Dev
cd client && npm run build && cd ..

# Live — once Dev is confirmed working
cd client && npm run build:live && cd ..

# Capable — once Dev is confirmed working (independent of Live's own rollout)
cd client && npm run build:capable && cd ..
```

`backend-deploy.zip` stays identical across all three — same code, only
each cPanel Node app's own `.env` differs. Only the frontend needs a
separately-built zip per environment.
