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

## This release (8 Oct 2026) — Certificates of completion; image uploads to 10 MB with resizing; website redesign, privacy and terms pages

**Rebuilt for Dev, Live and Capable this pass** — backend and portal from commit `06964f4`
(curriculum, branch `modules`). The website was rebuilt from `681b86e` (digifunzi-landing, branch
`new`) and, unlike the last few releases, **its code has changed a great deal** — see "Website"
below. Cumulative: this carries the 7 Oct, 6 Oct and 5 Oct releases below, so if those aren't
deployed yet their steps (database backup, environment variables, deploy backend and portal
together) still apply. Verify on Dev first as usual.

**Deploy the backend and the portal together** — the portal calls the new `/api/certificates`
routes and the new image-upload limit; an old portal against the new backend simply doesn't show
certificates, but a new portal against the old backend shows errors on the learner profile, the
Reports page's certificates list and Settings → Certificates. The website can be uploaded at any
point; it does not depend on this release.

No new environment variable. No new npm package, so **Run NPM Install can be skipped** if the app
already has its modules.

### New migration (auto-applies on Restart)

| Migration | What it does |
|---|---|
| `20261010090000_create_certificates.js` | Creates two new tables: `certificates` and `certificate_settings`. Additive — it changes no existing table |

Take the usual database backup before the Restart.

### What changed — portal and backend

1. **Certificates of completion.** A learner earns a certificate when their **final course
   report is published**. Nobody marks a course as finished by hand; publishing the final report
   is the moment. Withdrawing the report revokes the certificate, and publishing it again brings
   back the same one, with the same number and link.
2. **Pathway and bootcamp certificates.** A pathway certificate is issued once the learner holds
   a certificate for every course in the pathway; a bootcamp certificate once they hold one for
   every course their bootcamp class runs. Adding a course to a pathway later does not take away
   certificates already earned.
3. **Each certificate has a number and a public check.** Numbers look like `DF-2026-000123`. The
   QR code on the certificate opens `/certificates/verify/<token>` on the portal, with no
   sign-in: it says whether the certificate is genuine or has been withdrawn, and shows only what
   is printed on it.
4. **Learner profile: "My achievements".** The latest certificate shown large, the rest as a
   collection, milestones (first certificate, 3, 5, 10, 20), and what they can earn next with
   real progress (sessions done in a course, courses done in a pathway). Clicking a certificate
   opens a preview with **Download PDF** (one landscape A4 page) and the verification link.
5. **Staff.** A learner's page lists their certificates. **Reports → Certificates issued**
   (admin and school) lists every certificate with search and filters, and lets staff **Revoke**
   one by hand (a reason is required, kept on record, never shown publicly) or **Reinstate** it.
   Uses the Reports permission for staff roles; revoking needs Reports → Edit.
6. **Settings → Certificates** (owner only). The signatory's name, title and signature image,
   with a live preview. A certificate keeps the signatory it was issued with. Left empty,
   certificates carry the QR code alone.
7. **"Certificate earned" notification and email** to the learner and parent. It is a new entry
   under Settings → Emails, on by default, and each person can switch it off for themselves.
8. **Certificates on the shared public profile** (the page a learner's QR code opens).
9. **Image uploads: 10 MB, resized before upload.** The image limit goes from 5 MB to 10 MB. A
   photo larger than 2000 pixels on its longer side is scaled down in the browser before it is
   sent, so a phone photo of several MB uploads as a few hundred KB. Images with transparency
   stay PNG; GIFs are not altered. Every image field now shows the rules, and an oversized image
   is refused with the right limit (it used to say 500MB).

**What happens to existing learners.** Certificates for final reports that were **already
published** are created the first time certificates are viewed (a learner's profile, a learner's
page, or Reports → Certificates issued). They are dated to when the report was published and
**nobody is notified or emailed** about them. Only certificates earned after this deploy send the
"Certificate earned" notification and email.

**Two things to know.**
- A course whose sessions have no assessments can never have a final report, so it can never
  produce a certificate — and neither can a pathway or bootcamp that contains it. Bootcamps
  advertise "Certificate on completion", so each bootcamp course needs at least one assessed
  session.
- The 10 MB image limit is the application's. If the hosting has its own upload limit below
  that, images near 10 MB will still be refused — worth one test upload after deploying (see
  Verify).

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD `06964f4` (`git archive` of `server/`: `src/`, `knexfile.js`, `package.json`,
`package-lock.json`; **461 entries / 410 files**) — identical in Dev, Live and Capable. New
`src/modules/certificates/` and the migration above.

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-CUbx9Kh8.js`** / CSS `index-CPRP9smp.css` (unchanged CSS).
Live build (`npm run build:live`): **`index-YcMIMvdG.js`** / same CSS.
Capable build (`npm run build:capable`): **`index-j1lzLUJy.js`** / same CSS — in `Guide/capable/`.
Dev's from `Guide/dev/`, Live's from `Guide/live/` — different JS hash (different API), don't
cross them.

### Website (`africa-digifunzi-com-dist.zip`)

`npm run deploy:build` — 35/35 pages prerendered, 33 sitemap URLs (11 pathways, 2 projects, 1
store item, 5 bootcamps, 3 competitions); 201 entries. Same zip in `Guide/dev/` and
`Guide/live/`; still talks to the Dev backend (`nodeapp.digifunzi.com`). Upload the whole zip,
including `.htaccess`, `200.html` and `404.html` — **the `.htaccess` has changed** (it now serves
`/privacy` and `/terms`), so it must be replaced, not kept.

What changed on the website:

1. **Layout.** Content sits in one centred frame while backgrounds run edge to edge. The header
   has the logo on the left, the links centred and Enroll on the right, on one line down to
   1100px wide. Card grids show four across on large screens. Detail pages (pathway, project,
   store item, competition) have a side panel with the price or key facts and the main button
   that stays in view, and end with a "Keep exploring" row.
2. **Home page.** A "Coming up" row of the next bootcamps, an FAQ, and a larger hero. The
   mascot now shows on phones.
3. **Trust fixes.** Bootcamps and competitions past their last day say "Ended" and sort last.
   The placeholder phone number and the "placeholders" note are gone from Contact. The stand-in
   testimonials and the hero's made-up "live" figures are removed.
4. **New pages: `/privacy` and `/terms`**, linked from the footer, with a privacy link under
   every form. **The wording is a draft and has not been reviewed by a lawyer** — read both
   before the site goes live. It names `hello@digifunzi.com` as the contact for privacy requests
   and says the site uses no analytics.
5. **Enroll form** offers "A learning pathway" and "A competition"; those arrive as a general
   enquiry with the choice written in the note.

**Still to supply before this is a finished public site** (none of it blocks the upload): the
real phone number, WhatsApp number, street address and social links in
`digifunzi-landing/src/config/site.js` (phone and WhatsApp links appear on their own once set);
real testimonials; and the test records the Dev backend still serves (the "Sample…" bootcamps,
competition and project).

**Building the website on this machine.** The pre-render step fetches the page list from the
Dev API with Node. On this network Node gave up on the connection too quickly and the first
build shipped only 7 pages. Building with a longer connection window fixes it — if a build ever
reports "API unreachable" while the API opens fine in a browser, run it as:

```bash
NODE_OPTIONS="--network-family-autoselection-attempt-timeout=5000" npm run deploy:build
```

A good build ends with `prerender done — 35/35 routes written` (the number grows with content).

### Deploy order

1. **Database backup.**
2. **Backend** `backend-deploy.zip` → **Restart** (the migration applies on start).
3. **Portal** `assets.zip` + `index.html` — straight after the backend.
4. **Website** `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root,
   replacing `.htaccess` too.
5. **Verify:**
   - Open `<backend address>/api/public/certificates/test` in a browser: a "couldn't find a
     certificate" message (not "route not found") means the new backend is running.
   - As an admin, open **Reports → Certificates issued**: a certificate appears for every final
     course report already published. Open one: the page says "This certificate is genuine".
   - **Settings → Certificates**: enter a name and title, upload a signature, Save. The preview
     shows them.
   - As a teacher, publish a learner's final course report. The learner (or parent) gets a
     "Certificate earned" notification and email; their **Profile** shows it under "My
     achievements"; **Download PDF** gives one landscape page.
   - Unpublish that report: the certificate shows **Revoked** in the list and its link says it
     has been withdrawn. Publish it again: it returns with the same number.
   - Upload a phone photo of 6–9 MB as a profile picture: it is accepted. This is the test that
     shows whether the hosting has a lower upload limit of its own.
   - Website: open `/privacy` and `/terms`; open Bootcamps and check that past ones say
     "Ended"; open a pathway on a wide screen and check the side panel stays in view while
     scrolling.

---

## This release (7 Oct 2026) — Shared learner profile as a full page, per hub; designed emails

**Rebuilt for Dev, Live and Capable this pass** — backend and portal from commit `e653116`
(curriculum, branch `modules`). The website was rebuilt too, from the same `ca9a713`
(digifunzi-landing, branch `new`): its code has not changed, only the pre-rendered pages were
refreshed. Cumulative: this carries the 6 Oct and 5 Oct releases below, so if those aren't
deployed yet their steps (database backup, migrations, deploy backend and portal together) still
apply. Verify on Dev first as usual.

**Deploy the backend and the portal together** — the shared-profile page reads a new response
shape from `/api/public/learners/:token`; an old portal against the new backend (or the reverse)
shows that page empty. The website can be uploaded at any point; it does not depend on this
release.

No new migration. No new npm package, so **Run NPM Install can be skipped** if the app already
has its modules.

### Environment variables

| Variable | Needed? | What it does |
|---|---|---|
| `API_PUBLIC_URL` | **Set it on every backend** (Dev `https://nodeapp.digifunzi.com`, Live `https://dcf-api.digifunzi.com`, Capable `https://lms-api.capable.co.ke`) | Emails load the header logo, hub logos and learner photos from this address. Without it emails still send, with the brand name as text and initials in place of photos |
| `MAIL_BRAND_NAME` | Capable only: `Capable` | Picks the Capable logo and signs emails as Capable. Default is Digifunzi |
| `MAIL_REPLY_TO` | Check the value | Now shown in every email's footer as "Questions? … write to …" — make sure it is the address parents should see |
| `MAIL_WEBSITE_URL` | Optional | Footer link to the website. Default: the first `https` address in `PUBLIC_SITE_URL` |
| `MAIL_SOCIAL_LINKS` | Optional | Footer links, e.g. `Facebook=https://facebook.com/…,Instagram=https://instagram.com/…` |
| `MAIL_LOGO_URL` | Optional | A different header logo image than the built-in one |

### What changed

1. **Shared learner profile is a full page.** The page a learner's QR code opens
   (`/public/learners/<token>`) is no longer a small card. Existing QR codes and links keep
   working.
2. **One section per hub.** A learner enrolled at several hubs gets a tab per hub; each shows
   that hub's class, teachers, level, competencies, pathways, courses and attendance.
   Competency scores and levels are tracked per curriculum, so two hubs on the same curriculum
   show the same scores.
3. **More on the page.** Guardian's name (never phone, email or fees), teachers with their
   photos, attendance rate, the class's courses, and every competency — those not yet assessed
   are shown greyed instead of left out. The Pathways section, which never appeared before, now
   shows each pathway's current course and the learner's place on it.
4. **Download QR / Print badge.** The Share Profile card (learner portal Profile page, and a
   learner's page for admins and schools) can save the QR as an image or print it as a badge with
   the learner's name and registration number.
5. **Emails have a designed layout.** Logo in the header (a hub's own logo and name on invoices
   and receipts it sends), a colour, icon and label per kind of email, the key figure highlighted
   (amount due, amount paid, new level), the learner's photo and name, a preview line beside the
   subject, a fuller footer, and a button that is full-width on phones.
6. **Website enquiry emails use the same layout** — the automatic acknowledgement and staff
   replies from the Enquiries page — and are signed with `MAIL_BRAND_NAME`.

Who receives which email, the email switches (Settings → Emails, each person's preferences) and
the subjects of account emails are unchanged.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD `e653116` (`git archive` of `server/`: `src/`, `knexfile.js`, `package.json`,
`package-lock.json`; **452 entries / 407 files**) — identical in Dev, Live and Capable. New
`src/shared/mail/assets/` (the two email logos, served at `/email-assets/…`).

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-DE-Ug8pb.js`** / CSS `index-CPRP9smp.css` (unchanged CSS).
Live build (`npm run build:live`): **`index-tNFn6mXM.js`** / same CSS.
Capable build (`npm run build:capable`): **`index-06GUWIgJ.js`** / same CSS — in `Guide/capable/`.
Dev's from `Guide/dev/`, Live's from `Guide/live/` — different JS hash (different API), don't
cross them.

### Website (`africa-digifunzi-com-dist.zip`)

`npm run deploy:build` — 33/33 pages prerendered, 31 sitemap URLs (5 bootcamps). Same zip in
`Guide/dev/` and `Guide/live/`; still talks to the Dev backend (`nodeapp.digifunzi.com`). No
website code changed in this release — this is the 2 Oct website with its pages re-rendered from
the Dev API as it is today. Upload the whole zip, including `.htaccess`, `200.html` and
`404.html`.

### Deploy order

1. **Database backup** (only matters if an earlier release with migrations is still undeployed).
2. **Environment variables** — set `API_PUBLIC_URL` (and `MAIL_BRAND_NAME=Capable` on Capable).
3. **Backend** `backend-deploy.zip` → **Restart**.
4. **Portal** `assets.zip` + `index.html` — straight after the backend.
5. **Website** `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root.
6. **Verify:**
   - Open `<backend address>/email-assets/digifunzi-logo.png` (Capable: `capable-logo.png`) in a
     browser: the logo shows.
   - Open a learner → **Share Profile → Show QR** → open the link in a private window: a full
     page with the learner's hubs; switching hub changes the teachers, level and competencies.
     **Download QR** saves an image and **Print badge** opens the print dialog.
   - Use "Forgot password?" for an account you own: the email arrives with the logo, an
     "Account security" label and a working button.
   - On an issued invoice press **Email invoice**: the email shows the hub's name and logo, the
     amount due in a highlighted panel and the learner's photo.

---

## This release (6 Oct 2026, follow-on) — Email preferences (recipient + workspace); Activity tabs; shorter Request payment dialog

**Rebuilt for Dev, Live and Capable this pass** — backend and portal from commit `03cf187`
(curriculum, branch `modules`). The website was rebuilt too, from the same `ca9a713`
(digifunzi-landing, branch `new`): its code has not changed, only the pre-rendered pages were
refreshed. Cumulative: this carries the 6 Oct connection-pool fix and the 5 Oct release below, so
if those aren't deployed yet their steps (database backup, deploy backend and portal together)
still apply. Verify on Dev first as usual.

**Deploy the backend and the portal together** — the portal calls new endpoints
(`/api/email-settings`, `/api/public/email-preferences/…`, `/api/audit/counts`). The website can
be uploaded at any point; it does not depend on this release.

### New migration (auto-applies on Restart)

| Migration | Does | Existing rows |
|---|---|---|
| `20261009090000_create_email_settings.js` | Creates `email_settings` (one row per workspace: which email types the admin has switched off) | none changed — additive only; a workspace with no row sends everything, as before |

No new environment variable. No new npm package, so **Run NPM Install can be skipped** if the app
already has its modules. The link in each email's footer is built from `CLIENT_URL`, as the
password-reset link already is — confirm it is the portal's own address on each environment.

### What changed

1. **Recipients choose their emails without signing in.** Every notification email's footer now
   has a link, "Choose which emails you get, or stop them". It opens a page in the portal
   (`/email-preferences`) with one switch for all notification emails and one per type. The link
   is tied to that one account, opens nothing else, and cannot be used to sign in.
2. **The same switches on profile pages.** Educator, supervisor and learner/parent profile pages
   show an **Email notifications** card, as well as the notifications bell's "Email settings".
3. **Admins choose what the workspace sends.** New **Settings → Emails** tab (workspace owner
   only; staff do not see it). Every email the workspace sends is listed by who receives it, each
   with a switch. A type switched off there is sent to nobody in the workspace, whatever each
   person chose; the person sees it greyed out with "switched off by your organisation".
4. **Invoice and receipt emails can be switched off there too.** The "Email invoice" button on an
   invoice still sends when the automatic one is off. Password emails always send. Website
   enquiry emails are not affected.
5. **Activity page in tabs.** All activity · Sign-ins · Added · Edited · Deleted · Refused &
   failed, each with its count. Search, person, period (Today / Last 7 days / Last 30 days /
   chosen dates) and area narrow whichever tab is open, and the counts follow them. Export
   downloads the open tab. Nothing about what is recorded has changed.
6. **Activity log entries.** Changes to Settings → Emails are logged in plain words; changes made
   from an email's footer link are not logged (the address carries that person's link).
7. **Shorter Request payment dialog** (educator → Claims → a course). One line of figures, the
   two options as single rows, a compact invoice upload, the note behind a link, and the amount
   on the button ("Request KSh 1,900"). What is submitted is unchanged.
8. **Fix:** the notifications bell no longer throws an error when the window is resized while it
   is open.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD `03cf187` (`git archive` of `server/`: `src/`, `knexfile.js`, `package.json`,
`package-lock.json`; **449 entries / 405 files**) — identical in Dev, Live and Capable. New
`src/modules/notifications/email-settings.model.js`, `email-settings.routes.js` and
`email-workspace.js`.

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-BvSRPD6w.js`** / CSS `index-CPRP9smp.css` (unchanged CSS).
Live build (`npm run build:live`): **`index-DYdRdRae.js`** / same CSS.
Capable build (`npm run build:capable`): **`index-CQEa2PW0.js`** / same CSS — in `Guide/capable/`.
Dev's from `Guide/dev/`, Live's from `Guide/live/` — different JS hash (different API), don't
cross them.

### Website (`africa-digifunzi-com-dist.zip`)

`npm run deploy:build` — 33/33 pages prerendered, 31 sitemap URLs (5 bootcamps), no failed
requests. Same zip in `Guide/dev/` and `Guide/live/`; still talks to the Dev backend
(`nodeapp.digifunzi.com`). No website code changed in this release — this is the 2 Oct website
with its pages re-rendered from the Dev API as it is today. Upload the whole zip, including
`.htaccess`, `200.html` and `404.html`.

### Deploy order

1. **Database backup.**
2. **Backend** `backend-deploy.zip` → **Restart**. The app log should show the migration above
   applied (plus any from the releases below not yet deployed).
3. **Portal** `assets.zip` + `index.html` — straight after the backend.
4. **Website** `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root.
5. **Verify:**
   - **Settings → Emails** lists the workspace's emails. Switch "A new level is unlocked" off,
     reload: it is still off.
   - Sign in as a parent → bell → **Email settings**: that type is greyed out with "switched off
     by your organisation". Switch it back on as the admin afterwards.
   - Trigger a notification email (e.g. publish a session report for a learner whose parent has
     an email) → the email's footer link opens the preferences page without signing in; switching
     a type off there shows as off under the bell too.
   - **Activity** shows six tabs with counts; **Sign-ins → Failed attempts** lists only failed
     sign-ins; choosing "Today" changes every tab's count.
   - As an educator: Claims → a course → **Request payment** opens the shorter dialog.

---

## This release (6 Oct 2026) — Fix: pages failing with "max_user_connections" (database connection pool)

**Backend only, rebuilt for Dev, Live and Capable.** The portal (`assets.zip` + `index.html`) and
the website zip are unchanged from the 5 Oct release below — no need to re-upload them.
Cumulative: if the 5 Oct release isn't deployed yet, this backend zip carries it too and its
steps (database backup, migrations, deploy backend and portal together) still apply.

### What was wrong

Pages stopped loading with *"User … already has more than 'max_user_connections' active
connections"*. The backend kept up to 30 database connections open (2 permanently), which is
more than the hosting allows one MySQL user.

### What changed

`knexfile.js`: the pool now holds at most **8** connections and closes idle ones after 30
seconds. A page that needs more at once waits its turn instead of failing. No migration, no new
npm package — **Run NPM Install can be skipped**.

New optional environment variable **`DB_POOL_MAX`** (default 8). Leave it unset unless the
host's limit is known: keep it under `max_user_connections` for the app's MySQL user
(phpMyAdmin → `SHOW VARIABLES LIKE 'max_user_connections';`). If the limit is 10 or less, set
`DB_POOL_MAX` to about half of it.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD `175eec4` plus the uncommitted `knexfile.js` change (`git archive` of
`server/`, same contents as before, **445 entries**) — identical in Dev, Live and Capable.

### Deploy order

1. **Backend** `backend-deploy.zip` → **Restart**. The restart itself drops every connection the
   old code was holding.
2. **Verify:** open several pages in a row, including an educator's Claims → a course. In
   phpMyAdmin, `SHOW PROCESSLIST;` should show no more than 8 connections for the app's user,
   falling away when the app is idle.
3. **Each environment needs its own MySQL user.** If Dev, Live or Capable share one, they share
   one limit — give each its own user, or lower `DB_POOL_MAX` on each.

---

## This release (5 Oct 2026) — Educator claims (mentor → supervisor → admin pays); supervisor portal; activity log

**Rebuilt for Dev, Live and Capable this pass** — backend and portal from commit `175eec4`
(curriculum, branch `modules`). The website was rebuilt too, from the same `ca9a713`
(digifunzi-landing, branch `new`) as last time: its code has not changed, only the pre-rendered
pages were refreshed. Cumulative: if the 2 Oct and 1 Oct releases below aren't deployed yet, these
zips carry them too and their steps (database backup, environment variables, everyone signs in
again once) still apply. Verify on Dev first as usual.

**Deploy the backend and the portal together** — the portal calls new endpoints (`/api/claims`,
`/api/audit`) and the backend must know the new "supervisor" sign-in role before anyone uses it.
The website can be uploaded at any point; it does not depend on this release.

### New migrations (auto-apply on Restart)

| Migration | Does | Existing rows |
|---|---|---|
| `20261006090000_create_audit_log.js` | Creates `audit_log` (the activity log: who did what, to which record, when, and what changed) | none changed — additive only |
| `20261007090000_create_teacher_claims.js` | Creates `teacher_claims` (an educator's payment request for a course) and `claim_settings` (per workspace: session rate, advance %); adds nullable `teachers.sessionRate` | none changed — every educator starts on the workspace rate |
| `20261008090000_add_claim_supervisors.js` | Adds `supervisor` to the allowed values of `users.role`; adds nullable `teachers.supervisorId` | none changed — every educator starts with no supervisor. (It also moves any claim a supervisor had approved under an earlier two-approval flow to "to pay"; a first deploy has no such claims.) |

**Take a database backup before the Restart** — the third migration alters the `users.role`
column. No new environment variable. No new npm package, so **Run NPM Install can be skipped** if
the app already has its modules.

### What changed

1. **Educator claims — how an educator gets paid for a course.** In the educator portal,
   **Claims** lists every course the educator teaches with what it pays (sessions × the session
   rate), sessions delivered, and where its claim stands; filters by status, hub and home/hub,
   search and sort. Opening a course shows each session with every student's attendance, whether
   their assignment was graded and whether their report is done. **Request payment** asks for an
   **advance** (30% of the course's value, once, while the course is running) or the **full
   payment** (the course's value less any advance, once every session is delivered), with the
   educator's invoice attached as a PDF.
2. **Supervisor accounts.** Billing → Educator Claims → **Supervisors** creates accounts that
   exist only to review claims (name, email, password; the email must not already be used by
   another account). An educator is given a supervisor on the educator form's new, optional
   **Claims supervisor** field.
3. **The flow.** An educator's claim goes to their supervisor, who **approves** it — it then goes
   straight to the admin's **To pay** list — or **declines** it with a message the educator sees
   (they can claim again). The admin marks it **paid**, with an optional reference and date. An
   educator with **no supervisor** has their claim go straight to the admin, who approves or
   declines it and then pays. The admin can also decide a claim in a supervisor's place.
   Removing a supervisor unassigns their educators and passes their waiting claims to the admin.
4. **Supervisor portal.** A supervisor signs in on the normal login page and gets their own
   portal (sidebar: Dashboard, Claims, My Educators, My Profile). They see only their own
   educators' claims. The Claims page handles volume: cards or a sortable table, filters (status,
   educator, hub, type, date, waiting 3+ days), paging, CSV export and month-by-month paid totals.
5. **Where the admin finds it.** Educator Claims is a tab in **Billing**, next to Packages: With
   supervisor · Needs your approval · To pay · Paid · Declined. **Session rates** sets the rate
   per session (default KSh 904.666), the advance percentage (default 30) and an optional rate of
   their own for individual educators. Course totals are rounded to the whole shilling.
6. **Staff roles.** Two new permissions under Finance in Settings → Roles & access: **Educator
   claims (review for a supervisor)** and **Claim approvals & payment**. No existing role has
   them, so staff see no change until a role is given one. The Billing menu item also shows for
   staff who have a claims permission but not Billing; it opens straight onto the claims.
7. **Notifications.** In-app (and by email, where email is set up) at each step: the supervisor
   or admin when a claim arrives, the admin when a supervisor approves, the educator when their
   claim is approved, declined or paid.
8. **Activity log.** Every change anyone makes, and every sign-in, is recorded automatically:
   who, what, which record, when, and what changed. New **Activity** page in the sidebar (owner,
   and staff given the new **Activity log** permission) with filters and a CSV export; a
   **History** card on bootcamp, learner and assessment pages; and each staff member's last
   activity under Settings → People & sharing. Entries can't be edited or removed and are kept
   for two years. Request contents and passwords are never stored.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD `175eec4` (`git archive` of `server/`: `src/`, `knexfile.js`, `package.json`,
`package-lock.json`; **445 entries / 396 files**) — identical in Dev, Live and Capable. New
`src/modules/claims/`, `src/modules/audit/` and `src/shared/middleware/audit.middleware.js`.

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-sCMMe9kN.js`** / CSS `index-CPRP9smp.css` (unchanged CSS).
Live build (`npm run build:live`): **`index-CwoGviqO.js`** / same CSS.
Capable build (`npm run build:capable`): **`index-D-3a-a11.js`** / same CSS — in `Guide/capable/`.
Dev's from `Guide/dev/`, Live's from `Guide/live/` — different JS hash (different API), don't
cross them.

### Website (`africa-digifunzi-com-dist.zip`)

`npm run deploy:build` — 33/33 pages prerendered, 31 sitemap URLs (5 bootcamps), no failed
requests. Same zip in `Guide/dev/` and `Guide/live/`; still talks to the Dev backend
(`nodeapp.digifunzi.com`). No website code changed in this release — this is the 2 Oct website
with its pages re-rendered from the Dev API as it is today. Upload the whole zip, including
`.htaccess`, `200.html` and `404.html`.

### Deploy order

1. **Database backup.**
2. **Backend** `backend-deploy.zip` → **Restart**. The app log should show the three migrations
   above applied (plus any from the releases below not yet deployed).
3. **Portal** `assets.zip` + `index.html` — straight after the backend.
4. **Website** `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root.
5. **Verify:**
   - Billing shows a fifth tab, **Educator Claims**. **Supervisors** → create one. **Session
     rates** shows 904.666 and 30.
   - Educators → edit an educator → **Claims supervisor** → pick the supervisor → save.
   - Sign in as that educator → **Claims** → open a course → **Request payment** → attach a PDF →
     submit. The claim shows "With supervisor".
   - Sign in as the supervisor (normal login page) → the portal opens on their dashboard with the
     claim under **Needs your review** → open it → **Approve for payment**.
   - As the admin: Billing → Educator Claims → **To pay** → open the claim → **Mark as paid**. The
     educator's course page shows it as Paid.
   - Remove the supervisor from the educator, submit another claim as the educator: it appears
     under **Needs your approval** for the admin.
   - **Activity** in the sidebar lists the steps above, each with who did it.

---

## This release (2 Oct 2026) — Bootcamp games; sharing between admins; People & sharing tab; staff use of Settings data; partial-update fix

**Rebuilt for Dev, Live and Capable this pass** — backend and portal from commit `fb677c6`
(curriculum, branch `modules`), website from `ca9a713` (digifunzi-landing, branch `new`).
Cumulative: if the 1 Oct releases below aren't deployed yet, these zips carry them too and their
steps (database backup, environment variables, everyone signs in again once) still apply. Verify
on Dev first as usual.

**Deploy the backend and the portal together** — the portal calls new endpoints
(`/api/bootcamps/games`, `/api/sharing`). The website can follow separately: until it is
uploaded the current one keeps working, and it shows no games until the backend is in place.

### New migrations (auto-apply on Restart)

| Migration | Does | Existing rows |
|---|---|---|
| `20261004090000_create_admin_sharing.js` | Creates `admin_connections` (a sharing request between two admins and whether it was accepted) and `shared_imports` (what an admin has already copied from another) | none changed — additive only |
| `20261005090000_add_event_games.js` | Creates `event_games` (the games library); adds nullable `bootcamps.gameIds` (JSON) and `bootcamps.gamesNote` | none changed — every existing bootcamp has no games |

No new environment variable. No new npm package, so **Run NPM Install can be skipped** if the app
already has its modules.

### What changed

1. **Bootcamp games.** Events has a new **Games** section: a library of games and play (chess,
   Monopoly, a treasure hunt…), each with what the children do, what it builds, an icon and
   colour, and an optional photo. One-click chips add well-known games. The bootcamp form has a
   **Games & play** card to pick games, add one inline, order them and note how play fits into the
   day. On the website the bootcamp page gets a **More than lessons** section of cards that flip
   to show what each game builds, the listing cards a "Plus games: …" line, and the booking panel
   "Game time included: …". A bootcamp without games looks exactly as before.
2. **Sharing between admins** (Settings → People & sharing → Sharing). One admin sends another a
   request by email; once accepted, each can browse the other's competencies, pathways, system
   levels, items, courses, assessments and curricula and add any of it to their own workspace. It
   arrives as their own copy with everything it depends on (a course with its sessions and
   assessments; a curriculum with its framework and courses) and is independent of the original.
   Either admin can end the connection; copies already made stay. Nothing learner-related is
   copied, and copies never arrive for sale or public.
3. **People & sharing tab.** Settings → Admins, Staff, Roles & access and Sharing are one tab with
   a card for each. Old links to the separate tabs still open the right section.
4. **Staff can use Settings data.** A staff member whose role covers Assessments, Courses,
   Curriculum or Billing can pick from the workspace's competencies, pathways, system levels and
   items without the Settings permission; changing them still needs Settings. Detaching a
   competency, pathway or material from a course or assessment now counts as Edit. The "create
   new" shortcuts in the builders show only with Settings → Add.
5. **Partial updates no longer blank other fields.** A save that sent only some fields (for
   example **Publish to website / Unpublish** on a bootcamp, which sends the sale status alone)
   reset the fields it left out — description, dates, highlights, pricing. Fixed for bootcamps,
   assessments, competitions, course sessions and modules, Settings competencies and the
   curriculum framework's indicators, progress levels, assessment types and evidence types.
   Records already blanked this way are not restored by the fix.
6. **A permission gap closed.** A request path written with a trailing slash or different letter
   case could reach Home Learning's approve-payment and decline-sign-up with a weaker permission
   than intended. Paths are now normalised before the staff access rules run.
7. **Tab icon and title per environment.** Live showed Capable's tab icon because Dev and Live set
   none of their own. Live is now a navy "d" titled "Digifunzi"; Dev an amber "d" titled
   "DEV · Digifunzi"; Capable is unchanged.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD `fb677c6` (`git archive` of `server/`, same exclusions, **426 entries / 379
files**) — identical in Dev, Live and Capable. New `src/modules/sharing/`,
`src/modules/bootcamps/games/` and `src/shared/validators/common.validator.js`.

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-BqRLWExB.js`** / CSS `index-CPRP9smp.css` (unchanged CSS).
Live build (`npm run build:live`): **`index-CLSWAyO8.js`** / same CSS.
Capable build (`npm run build:capable`): **`index-Cdok_5cD.js`** / same CSS — in `Guide/capable/`.
Dev's from `Guide/dev/`, Live's from `Guide/live/` — different JS hash (different API), don't
cross them.

### Website (`africa-digifunzi-com-dist.zip`)

`npm run deploy:build` — 33/33 pages prerendered, 31 sitemap URLs (5 bootcamps); one projects-feed request timed out and succeeded on the automatic retry. Same zip in `Guide/dev/` and `Guide/live/`; still talks to the Dev backend
(`nodeapp.digifunzi.com`). Upload the whole zip, including `.htaccess`, `200.html` and `404.html`.

The bootcamp pages were pre-rendered from the Dev API as it is today, before this backend is
deployed there, so the snapshots contain no games. Visitors still get them: the page fetches the
bootcamp live in the browser. For search engines to see the games, re-run `npm run deploy:build`
after the Dev backend is deployed and games are added to a bootcamp, then re-upload.

### Deploy order

1. **Database backup** (a good habit; required if the 1 Oct second follow-on isn't deployed yet).
2. **Backend** `backend-deploy.zip` → **Restart**. The app log should show the two migrations
   above applied (plus any from the releases below not yet deployed).
3. **Portal** `assets.zip` + `index.html` — straight after the backend.
4. **Website** `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root.
5. **Verify:**
   - The browser tab shows the right icon and title for the environment (hard-refresh once).
   - Events → **Games**: add a game from the chips; edit a bootcamp → **Games & play** → add it →
     save. The bootcamp's page on the website shows **More than lessons** with the game card.
   - On a bootcamp with a description and highlights, click **Unpublish** then **Publish to
     website** — the description and highlights are still there.
   - Settings → **People & sharing** shows four cards; Staff, Roles & access, Sharing and Admins
     each open underneath.
   - Sharing: send a request to another admin's email; as that admin, accept; **Browse their
     content** → add a course → it appears under Courses with its sessions and assessments, and
     editing it leaves the original unchanged.
   - Sign in as a staff member whose role has Assessments but not Settings → the assessment
     builder lists the workspace's competencies; Settings is not in their sidebar.

---

## This release (1 Oct 2026, third follow-on) — Email: password reset, invoices & receipts, emailed notifications

**Rebuilt for Dev, Live and Capable this pass** — portal from commit `58e60a8`, **backend
rebuilt again from `87793ce`** (curriculum, branch `modules`) to send through Brevo's HTTP API:
the Truehost server redirects/blocks outbound SMTP (port 587 answered by the host's own mail
server — "Hostname/IP does not match certificate's altnames"; port 2525 — `ECONNREFUSED`), so
SMTP can't work there. If you uploaded the earlier backend zip, upload this one over it; the
portal files are unchanged. **Website not rebuilt** — no `digifunzi-landing` changes; the
website zip here is the one from the release below. Cumulative: if the releases below aren't
deployed yet, these zips carry them too and their steps (database backup, everyone signs in
again once) still apply. Verify on Dev first as usual.

**Deploy the backend and the portal together** — the portal's new pages call new endpoints
(`/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/billing/:id/email`,
`/api/notifications/email-preferences`).

**Nothing is emailed until `BREVO_API_KEY` and `MAIL_FROM` are set.** Without them the app
behaves as before, except that "Forgot password?" says "check your email" and nothing arrives.

### New migration (auto-applies on Restart)

| Migration | Does | Existing rows |
|---|---|---|
| `20261003090000_create_email_outbox_and_password_resets.js` | Creates `email_outbox` (every email, its status, attempts and last error) and `password_reset_tokens`; adds nullable `users.emailPreferences` | none changed — additive only |

### Environment (cPanel → Node app → Environment variables)

| Variable | Dev / Live | Capable |
|---|---|---|
| `BREVO_API_KEY` | the key from Brevo → SMTP & API → **API Keys** (starts `xkeysib-`) — not the SMTP key | same |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | **remove** — outbound SMTP is blocked on this server; ignored anyway once `BREVO_API_KEY` is set | same |
| `MAIL_FROM` | `Digifunzi <no-reply@digifunzi.com>` | `Capable <no-reply@digifunzi.com>` |
| `MAIL_REPLY_TO` | *(optional)* an inbox someone reads, e.g. `kevinkihara@digifunzi.com` | same |
| `MAIL_BRAND_NAME` | *(leave unset — defaults to `Digifunzi`)* | `Capable` |
| `PASSWORD_RESET_MINUTES` | *(optional)* how long a reset link is valid, default `60` | same |
| `CLIENT_URL` | **already set — check it.** Dev `https://curriculum.digifunzi.com`, Live `https://dcf.digifunzi.com` | `https://lms.capable.co.ke` |

Brevo → Security → Authorized IPs: blocking is **deactivated** for API keys, so nothing to add
there; if it's ever activated, authorise the server's address `102.212.246.83`.

Values with no quotes, angle-bracket placeholders or trailing spaces. `CLIENT_URL` has no
trailing slash; every link in an email is built from it, so a Live app carrying Dev's value
would email links to Dev.

The sending domain `digifunzi.com` is already authenticated in Brevo (Brevo code + two DKIM
CNAMEs added at the Truehost DNS Manager on 1 Oct 2026) and `no-reply@digifunzi.com` is a
verified sender. **Capable sends from the same `digifunzi.com` address** for now — to send from
a `capable.co.ke` address, add and authenticate that domain in Brevo first, then change
`MAIL_FROM`. Brevo's free plan allows 300 emails a day across all environments combined.

### Cron job (one per environment — cPanel → Cron Jobs)

Retries emails that failed while the mail provider was unavailable. Emails send without it; it
is only the safety net. Every 10 minutes (`*/10 * * * *`):

```
source /home/USER/nodevenv/APP_ROOT/NODE_VERSION/bin/activate && cd /home/USER/APP_ROOT && npm run mail:process >> mail-cron.log 2>&1
```

Copy the first part from the "Enter to the virtual environment" line at the top of that app's
page in Setup Node.js App. A working run writes `Email outbox: handled 0 email(s).` to
`mail-cron.log` in the app root. If it writes `Missing required environment variable(s)`, the
cron shell isn't getting the panel's variables: put a `.env` file in the app root with the same
variables (database, `JWT_SECRET`, `CLIENT_URL`, `BREVO_API_KEY`, `MAIL_*`).

### What changed

1. **Password reset by email.** Login → "Forgot password?" takes an email or username and emails
   a one-time link (valid 60 minutes, 3 requests an hour per account). Setting the new password
   signs that account out on every device. A learner with only a username: the link goes to the
   parent/guardian's email and names the child. No email on file → nothing is sent and the admin
   reset stays the fallback. The page always answers "if that account exists…".
2. **"Your password was changed" notice** after a reset or a change from the profile page.
3. **Invoices by email.** Issuing an invoice (single, bulk, hub visits, Home Learning) emails the
   payer a summary with a "View invoice" link. A hub's invoice arrives as "Hub name via
   Digifunzi" with replies going to the hub. No switch to turn this off: once SMTP is set, every
   payer with an email on file is emailed.
4. **Email invoice button** on an issued invoice (staff) — sends or re-sends, logged in the
   invoice's Activity history.
5. **Payment receipts by email** when a payment is recorded, with the remaining balance.
6. **Notifications by email**: new reports, level-ups, account activation, website enquiries,
   Home Learning sign-ups. Graded assessments are off by default. Each user can change this
   under **Email settings** in the notifications bell.
7. **Outbox.** Every email is stored in `email_outbox` first, sent one at a time, and retried up
   to five times. Enquiry (lead) emails are unchanged and don't use the outbox.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD `87793ce` (`git archive` of `server/`, same exclusions, **413 files**) —
identical in Dev, Live and Capable. No new npm packages, so **Run NPM Install can be skipped** if
the app already has its modules (nothing in `package.json` changed but one script).

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-CUjNiIU7.js`** / CSS `index-CPRP9smp.css` (unchanged CSS).
Live build (`npm run build:live`): **`index-Bsk7j2xz.js`** / same CSS.
Capable build (`npm run build:capable`): **`index-BpaauK1h.js`** / same CSS — in `Guide/capable/`.
Dev's from `Guide/dev/`, Live's from `Guide/live/` — different JS hash (different API), don't
cross them.

### Deploy order

1. **Database backup** (required if the second follow-on below isn't deployed yet; a good habit
   otherwise).
2. **Backend** `backend-deploy.zip` → add `BREVO_API_KEY` (and `MAIL_FROM`), remove the
   `SMTP_*` variables → **Restart**. The app log should show the migration applied (first
   upload of this release only).
3. **Portal** `assets.zip` + `index.html` — straight after the backend.
4. **Cron job** as above.
5. **Verify:**
   - Login → "Forgot password?" → your own email → the email arrives from
     `no-reply@digifunzi.com`; the link opens **this** environment's portal; set a password; the
     old one no longer works; using the link a second time is refused.
   - In Gmail: open the email → ⋮ → Show original → SPF, DKIM and DMARC all PASS.
   - Issue a test invoice to a payer whose email is yours → the invoice email arrives; **Email
     invoice** on that invoice sends it again and adds a line to Activity history. Record a
     payment → the receipt email arrives.
   - Notifications bell → **Email settings** opens and saves.
   - If an email doesn't arrive: phpMyAdmin → `email_outbox` → `status` and `lastError` say what
     Brevo answered (`Brevo API 401` = wrong or deleted `BREVO_API_KEY`; a certificate or
     `ECONNREFUSED` error = the app is still on SMTP — the key isn't set, or the old backend is
     running). An **empty** table = no login matched what was typed: a teacher/learner profile
     only gets a login once a Portal Password is set for them. Then Brevo → Transactional → Logs.

---

## This release (1 Oct 2026, second follow-on) — Items (Goods & Services); 30-minute sign-out; packages in Billing; child logins; parents add children

**Rebuilt for Dev, Live and Capable this pass** — backend and portal from commit `e02962b`
(curriculum, branch `modules`; code as of `ba2af73`), website from `726912b` (digifunzi-landing,
branch `new`, unchanged code, re-rendered with current content). Cumulative: if the two releases
below aren't deployed yet, these zips carry them too and their steps still apply. Verify on Dev
first as usual.

**Deploy the backend and the portal together** — the portal calls new endpoints
(`/api/auth/activity`, `/api/items`, `/api/billing/packages`, `/api/home-learning/family`) and
the old portal's package editor calls routes that no longer exist.

**Everyone is signed out once** when the new backend starts: sign-ins issued before it have no
session record, so they're refused and people sign in again.

### New migrations (auto-apply on Restart)

| Migration | Does | Existing rows |
|---|---|---|
| `20261002090000_merge_inventory_and_billing_items_into_items.js` | Renames `inventory` → `items`, adds `kind` (goods/service), `defaultPrice`, `invoiceType`; copies every `billing_items` row in as a **service** (same id), then **drops `billing_items`** | Inventory rows become goods with the same ids, so course/project material links and the website Store are untouched. Reversible: rolling back copies the services back into a recreated `billing_items` |
| `20261002100000_create_user_sessions.js` | Creates `user_sessions` (one row per sign-in: last activity, expiry) | none |

**Take a database backup before the Restart** — the first migration restructures two tables. It
was rolled back and re-applied cleanly on a local copy, but a backup is the safe baseline.

### Environment (cPanel → Node app → Environment variables)

- `SESSION_IDLE_MINUTES` — **optional**, minutes of inactivity before sign-out (default **30**).
- `JWT_EXPIRES_IN` — if it's already set on the app (e.g. `7d`), that stays the maximum length of
  one sign-in. **Recommended: `12h`** (the new default when unset). Idle sign-out applies either way.

### What changed

1. **Settings → Items (Goods & Services).** The Inventory tab and the billing Items tab are one
   Items tab with a Goods / Services switch. Goods = the old Inventory (course & project
   materials, website Store selling) and can now also carry an invoice price/type; Services =
   the old billing items. Billing → Create invoice lists both, grouped. "Move to Goods /
   Services" on each card (refused for goods used as materials or for sale). The project
   builder's "Inventory" tab is now "Materials".
2. **30-minute idle sign-out; closing the last tab signs out.** A "Are you still there?"
   warning at 28 minutes (Stay signed in / Sign out), sign-out at 30 for every open tab, with a
   notice on the login page. Background refreshes don't count as activity; an open assessment
   does. Closing the last tab — or the browser — means signing in again; refreshing doesn't.
3. **Packages moved to Billing.** Home Learning packages are created and edited in the new
   **Billing → Packages** tab (Billing permission). The Home Learning page keeps Add a household
   + the household list, links to Billing → Packages, and warns when no active package exists.
4. **Child vs parent logins.** A child signing in with their username no longer lands in the
   parent's account: the child's own login is created on first use (same password they used)
   and they see only themselves. The header says **Parent** or **Learner**. Parents still see
   only their own children and switch between them.
5. **Parents add children.** Learner portal → **My Family** (parent login only, when they have
   a Home Learning household): shows the package and free places, and **Add a child** fills a
   free place with the child's details and their own username/password. The child arrives on
   the Home Learning page as **Awaiting placement** ("Added by parent…") and the admin gets a
   notification to place them. Never changes the package or price — full packages say "contact
   us".

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD (`git archive` of `server/`, same exclusions, **403 files**) — identical in
Dev, Live and Capable. The old `src/modules/settings/inventory/` folder is gone (merged into
`settings/items/`); uploading over the old files leaves it behind harmlessly, but it's cleaner to
delete it.

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-BMCYhD7S.js`** / CSS `index-CPRP9smp.css` (unchanged CSS).
Live build (`npm run build:live`): **`index-BlRa6vfG.js`** / same CSS.
Capable build (`npm run build:capable`): **`index-RKLWzSyC.js`** / same CSS — in `Guide/capable/`.
Dev's from `Guide/dev/`, Live's from `Guide/live/` — different JS hash (different API), don't
cross them.

### Website (`africa-digifunzi-com-dist.zip`)

`npm run deploy:build` — 33/33 pages prerendered, 31 sitemap URLs, no API errors this time. Same
code as the release below (SEO), so if that website zip is already live this only refreshes
content; if it isn't, follow that release's website note (upload the whole zip, including
`.htaccess`, `200.html`, `404.html`). Same zip in `Guide/dev/` and `Guide/live/`; still talks to
the Dev backend.

### Deploy order

1. **Database backup.**
2. **Backend** `backend-deploy.zip` → **Run NPM Install** → set/confirm the env vars above →
   **Restart**. The app log should show both migrations applied (plus any from the releases
   below not yet deployed).
3. **Portal** `assets.zip` + `index.html` — straight after the backend.
4. **Website** `africa-digifunzi-com-dist.zip` → `africa.digifunzi.com` document root.
5. **Verify:**
   - Sign in → you're asked to sign in again (expected, once).
   - Settings → **Items**: Goods shows the old inventory, Services the old billing items.
     Billing → Create invoice → "Bill from item" lists Services and Goods.
   - A course's Materials picker lists goods only; the website Store still shows its items.
   - Leave a tab idle 28 min → warning; 30 → signed out with the notice. Close all tabs, open
     the portal again → sign-in required.
   - **Billing → Packages** lists the packages; Home Learning has no packages panel.
   - Sign in with a child's username → only that child, header "Learner". Sign in as the parent
     → "Parent", **My Family** in the menu (if they have a household), switcher lists only
     their children.
   - My Family → Add a child (on a household with a free place) → the child shows on the Home
     Learning page as Awaiting placement, and the admin notification arrives.

---

## This release (1 Oct 2026, follow-on) — "Learner/Teacher not found" after creating one; website SEO

**Rebuilt for Dev, Live and Capable this pass**, from commit `03d51de` (curriculum, branch
`modules`) and `726912b` (digifunzi-landing, branch `new`). Everything is cumulative: if the
1 Oct release below hasn't been deployed yet, these zips carry it too, and its steps (migrations,
verify list) still apply. Verify on Dev first as usual.

Two new migrations (auto-apply on Restart), **none destructive**: one new nullable column plus an
index on each of two tables.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20261001100000_add_created_by_admin_id_to_learners.js` | Adds nullable `learners.createdByAdminId` (+ index) | Learners already linked to a hub are unchanged (they scope through the hub, as before). Learners with **no** hub link are assigned to the admin **only if the database has exactly one admin**; otherwise they stay unowned (see below) |
| `20261001100100_add_created_by_admin_id_to_teachers.js` | Adds nullable `teachers.createdByAdminId` (+ index) | Same rule, for educators with no hub link |

### What changed

1. **"Learner not found" / "Teacher not found" right after creating one.** An admin's access to
   a learner or educator came only from their hub links. So one created from the top-level
   Learners / Educators page, with no hub picked yet, belonged to nobody: the save worked, the
   profile it opened was refused (shown as "not found"), and the record never appeared in the
   list. Learners and educators now record the admin who created them (the inviting admin for a
   staff member), set by the server, and that admin keeps access before any hub is assigned.
   Other admins still can't see them. Covers the profile, hubs, list, learner search and the
   educator's course-assignment list.
2. **Website SEO** (`africa-digifunzi-com-dist.zip`):
   - Canonical URLs, `og:url`, `sitemap.xml` and structured data use the trailing-slash URLs
     the host actually serves (`/pathways/`), so none of them point at a redirect.
   - Link previews (WhatsApp, Facebook, LinkedIn) now have an image: the hero photo by default,
     or the item's own cover on bootcamp, competition, project and store pages. The old default
     `/og-default.png` never existed.
   - Structured data no longer publishes the placeholder phone number or "TODO Street" address.
     They appear automatically once real ones are set in `src/config/site.js`.
   - `.htaccess`: `www.` redirects to the bare host; `/quarky` redirects to `/store/`; missing
     files and unknown URLs return a **real 404** (new prerendered `404.html`); routes not
     prerendered at build time (items added since, diagnostics, sign-up) get the bare app shell
     (new `200.html`) instead of the home page's HTML.
   - Each head tag appears once; `/enroll` (noindex) is out of the sitemap; titles carry the
     brand once; long titles and descriptions shortened.
   - Breadcrumb data on detail pages; each bootcamp run at a hub is published as an event with
     the hub's address; competitions as events (dates only).

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD (`git archive` of `server/`, same exclusions as before, 406 files):
**identical in Dev, Live and Capable**. **No new env var.**

### Portal frontend (`assets.zip` + `index.html`)

**Unchanged**: no `client/` changes since the 1 Oct release, so these are the same files
(Dev `index-B3CBC79_.js`, Live `index-BZrSnBV8.js`, Capable `index-v0JcRti0.js`, CSS
`index-CPRP9smp.css`). No need to re-upload them if the 1 Oct portal is already live.

### Website (`africa-digifunzi-com-dist.zip`, digifunzi-landing, separate repo)

Built with `npm run deploy:build` (33/33 routes prerendered, 31 sitemap URLs). The Dev API's
pathways feed answered HTTP 500 during the build's second prerender pass; the pages it wrote
were checked and all 11 pathways are present. Same zip in `Guide/dev/` and `Guide/live/`. Still
talks to the Dev backend (`nodeapp.digifunzi.com`).

The zip now contains **`.htaccess`, `200.html` and `404.html`, and the server rules need all
three**. Upload the whole zip. Before extracting, remove the previous upload's files and route
folders from the `africa.digifunzi.com` document root (leave `.well-known/` and `cgi-bin/`
alone), so pages for items since removed from the site don't linger.

### Learners / educators created before this fix

On a database with **more than one admin**, records stranded by the old bug stay
unowned: no admin can open or list them. Assign them in phpMyAdmin:

```sql
-- the admin to give them to
SELECT id, email FROM users WHERE role = 'admin';

-- stranded learners (no hub link, no owner)
SELECT l.id, l.firstName, l.lastName, l.createdAt FROM learners l
WHERE l.createdByAdminId IS NULL
  AND NOT EXISTS (SELECT 1 FROM learner_hub_links h WHERE h.learnerId = l.id);
UPDATE learners SET createdByAdminId = '<admin id>' WHERE id IN ('<learner id>', '...');

-- stranded educators
SELECT t.id, t.firstName, t.lastName, t.createdAt FROM teachers t
WHERE t.createdByAdminId IS NULL
  AND NOT EXISTS (SELECT 1 FROM teacher_hub_links h WHERE h.teacherId = t.id);
UPDATE teachers SET createdByAdminId = '<admin id>' WHERE id IN ('<teacher id>', '...');
```

### Deploy order

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. Check the app log: the
   two migrations above should apply cleanly (plus the 1 Oct release's two, if that wasn't
   deployed yet).
2. **Portal**: nothing new. Upload only if the 1 Oct portal isn't live yet (Dev's from
   `Guide/dev/`, Live's from `Guide/live/`; different JS hash, don't cross them).
3. **Website** `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root, per
   the note above.
4. **Verify:**
   - Learners → **Enroll Learner** without choosing a hub → the new profile opens (no "not
     found") and the learner is in the list. Same for Educators → add an educator.
   - Website (these confirm LiteSpeed honours the new rules; `-I` shows just the status line):
     - `curl -I https://africa.digifunzi.com/no-such-page` → **404**
     - `curl -I https://africa.digifunzi.com/og-default.png` → **404**
     - `curl -I https://www.africa.digifunzi.com/` → **301** to `https://africa.digifunzi.com/`
     - `curl -I https://africa.digifunzi.com/quarky` → **301** to `/store/`
     - `curl -I https://africa.digifunzi.com/pathways/` → **200**
     If a 404 check shows a server error page instead, rename `.htaccess` to `.htaccess.off`
     to restore the site and report back. The rules needing a tweak for LiteSpeed is the
     likely cause.
   - Share a pathway or bootcamp link in WhatsApp → the preview shows an image.
   - Google Search Console (once set up): submit `https://africa.digifunzi.com/sitemap.xml`.

---

## This release (1 Oct 2026) — Staff roles & permissions; Home Learning website sign-up; course session visibility; Capable sign-in

**Built and packaged for Dev, Live and Capable this pass**, from commit `b33154d` (curriculum,
branch `modules`) and `3c921df` (digifunzi-landing, branch `new`). Covers everything since the
29 Sep release. Verify on Dev first as usual before treating Live's zips as safe to upload.

Two new migrations (auto-apply on Restart), **none destructive** — one new table, new nullable
columns, and one column made nullable.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20260930090000_create_access_roles.js` | Creates `access_roles`; adds nullable `users.roleId`; gives every admin three starter roles (Editor — all modules, Viewer — read only, Finance); gives **every existing collaborator a role matching their current access exactly** (view/add/edit on their modules, no delete, no billing — "Editor — all modules" for all-module collaborators, a "Custom: …" role otherwise) | `users.allowedModules` kept untouched (a collaborator without a role still resolves the old way, so a rollback loses nothing) |
| `20261001090000_home_learning_website_signups.js` | `home_learning_enrollments.curriculumId` becomes nullable + new `placementNotes`; `home_learning_households` gets `source` (default `admin`) and `signupInvoiceId` | unchanged — existing enrollments keep their curriculum, existing households get `source = admin` |

### What changed

1. **Staff roles & permissions (Settings → Staff / Roles & access).** Collaborators are now
   "staff" whose access comes from a **role** — a named set of permissions (module × View / Add /
   Edit / Delete) the workspace owner defines. Settings → **Staff** (was Collaborators) invites
   and edits by role; Settings → **Roles & access** is the role list and permissions grid. Both
   tabs are owner-only. Enforced server-side at one checkpoint (`scope.middleware.js`); Delete and
   Billing / hub revenue can now be granted (e.g. the Finance starter role). Staff see only the
   modules their role can view, get a "You don't have access to this page" screen elsewhere, and
   the header shows "Staff · <role>". Enquiries and file uploads stay owner-only (as before).
2. **Home Learning website sign-up.** Families sign up on the website (`/home-schooling/signup`)
   instead of only enquiring: the household, the parent's login (email + password), each child's
   login (username + password) and the first month's invoice are created at once. Both logins show
   the existing **"payment pending"** screen until approved. On the Home Learning page a website
   sign-up shows a banner with **Approve payment** (records the cash payment on the sign-up
   invoice and activates the family) and **Decline** (cancels the invoice, removes the accounts).
   Children arrive **"Awaiting placement"** — use **Place child** to choose curriculum, grade and
   educator. Emails already known to the system are refused ("log in instead").
3. **Course sessions.** Learners (and parent logins) receive only the session assessments
   actually **issued** to them. Session **notes are educator-only** — not sent to learner or school
   portal logins, and the learner portal no longer shows a Notes section. Learner progress /
   module unlocking / assessment auto-issue count only the sections a learner can see.
4. **Capable sign-in.** Larger logo (52px), no "Enter your details to access your dashboard." line
   (Capable build only; Digifunzi unchanged).

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD (`git archive`, 404 files) — **identical in Dev, Live and Capable**. New
`server/src/modules/access/` (mounted at `/api/access`, owner-only) and
`home-learning/home-learning-signup.service.js`; new public endpoint
`POST /api/public/home-learning/signups` (rate-limited); new admin endpoints
`POST /api/home-learning/:id/approve-payment` and `/:id/decline-signup`. **No new env var** — the
sign-up uses the existing `PUBLIC_CONTENT_ADMIN_ID` (households belong to that admin; unset → the
sign-up returns 503).

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-B3CBC79_.js`** / CSS `index-CPRP9smp.css` (unchanged CSS hash).
Live build (`npm run build:live`): **`index-BZrSnBV8.js`** / same CSS.
Capable build (`npm run build:capable`): **`index-v0JcRti0.js`** / same CSS — in `Guide/capable/`.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

Built with `npm run deploy:build` (32/32 routes prerendered; the Dev API's pathways feed
answered HTTP 500 a few times and the automatic retries covered it). Same zip in `Guide/dev/` and
`Guide/live/`. New **`/home-schooling/signup`** page; package cards and the price calculator now
lead to **Sign up** ("Ask a question" enquiries stay).

**The website talks to the Dev backend** (`nodeapp.digifunzi.com`, per `.env.production`), so
website sign-ups land in **Dev's** database, under Dev's `PUBLIC_CONTENT_ADMIN_ID`. Deploy the
Dev backend before the website — until then the sign-up and the package cards have no endpoint
(the deployed Dev API still answered 404 for `/api/public/home-learning/packages` at build time,
so re-run `npm run deploy:build` after the backend deploy if you want the prerendered Home
Schooling snapshot to include the packages).

### Deploy order

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. Check the app log: two
   migrations should apply cleanly (or fewer, if any already ran).
2. **Portal** `assets.zip` + `index.html` — Dev's from `Guide/dev/`, Live's from `Guide/live/`
   (different JS hash, don't cross them).
3. **Website** `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root (after the
   Dev backend).
4. **Verify:**
   - Settings → **Staff**: every existing collaborator shows a role (rename any "Custom: …" roles
     as you like). Settings → **Roles & access** lists the starter roles.
   - Log in as a staff member → the sidebar shows only their role's modules; a blocked page shows
     "You don't have access to this page".
   - Website `/home-schooling` → **Sign up** → complete the form → confirmation shows the amount
     and logins. Log in as that parent → "payment pending". Admin → Home Learning → **Approve
     payment** → the parent can now get in; **Place child** each child.
   - A learner opening a course sees no Notes section and only assessments issued to them.
   - Capable: the sign-in page shows the larger logo and no subtitle line.

---

## This release (29 Sep 2026) — Home Learning (home schooling); website Home Schooling page; 500 MB uploads; per-environment branding

**Built and packaged for Dev, Live and Capable this pass**, all from commit `88a79cf`
(curriculum) and `b323bb0` (digifunzi-landing). Covers everything since the 22 Sep release:
per-environment branding (`d8ce34e`), uploads up to 500 MB (`5b01ba0`), and Home Learning
(`707421c`, `88a79cf`). Verify on Dev first as usual before treating Live's zips as safe to upload.

Five new migrations (auto-apply on Restart), **none destructive** — new tables plus nullable
columns on existing ones.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20260928120000_create_home_learning.js` | Creates `home_learning_households` and `home_learning_enrollments` | none touched |
| `20260928130000_link_home_learning_leads.js` | Adds nullable `leads.homeLearningHouseholdId` | unchanged (`NULL`) |
| `20260928140000_home_learning_classes_and_billing.js` | Adds `learning_hubs.isHomeLearning`, `billing_invoices.householdId`, and class/grade columns on enrollments; creates each admin's "Home Learning" hub where they already have households | unchanged — new columns `NULL`/false |
| `20260928150000_create_home_learning_packages.js` | Creates `home_learning_packages`; seeds the three packages the website used to hard-code (slugs `one-child` / `three-children` / `five-children`) for every admin with households **and for `PUBLIC_CONTENT_ADMIN_ID`** | none touched |
| `20260929120000_add_home_location_to_households.js` | Adds nullable `mapUrl` and `locationPhotos` (JSON) to households | unchanged (`NULL`) |

**`PUBLIC_CONTENT_ADMIN_ID` must already be set on the Node app before you Restart** — the
package seed reads it at migration time. If it was unset, that admin simply gets no packages;
create them by hand in Home Learning → Packages (they're what the website's Home Schooling page
lists).

### What changed

1. **Home Learning (admin → Home Learning).** Families learning at home: households with the
   parent's contact, home address, a **Google Maps link and up to two location photos**, a
   monthly package, and status. Each child gets their own class in a per-admin "Home Learning"
   hub (curriculum + grade) with their educator linked, so assessments, attendance, reports and
   the Progress Arc work unchanged. Full-width household cards (contact / home location /
   package / billing tiles, children as cards), search and status filters, and a collapsible
   "Add a household" form.
2. **Packages** are created, priced and published in Home Learning → Packages and served to the
   website at `GET /api/public/home-learning/packages` (+ `/:slug`).
3. **Monthly invoices per household** (invoice type `home_learning`), raised from the Home
   Learning page (one household or "Invoice all active households"), billed to the household's
   parent. Not emailed — **the parent sees them under Invoices when they sign in to the
   portal**. A household can set a **parent portal password** (creates/resets their login), and
   each card shows whether the parent can sign in.
4. **Parent details stay in step with the children's profiles.** "Add a household" can start
   from an existing learner (fills the parent from their profile); the household's parent is
   copied onto children's profiles where missing; a banner flags a child whose profile names a
   different parent, with a one-click "use this parent for the household".
5. **Educators** get a Home Learning page (teacher portal) with each child's class, courses,
   the family's contact details and the home's map link/photos.
6. **Website enquiries** for a package carry its slug; Enquiries → "Create household" uses it.
7. **Uploads up to 500 MB** (was 50 MB) with a 10-minute client timeout and a clear message for
   an over-size file. If the host has its own request-size cap, large uploads still stop there.
8. **Per-environment branding** — name, logos and page title come from the build mode
   (Digifunzi for Dev/Live, Capable for Capable).

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD (`git archive`, 395 files) — **identical in Dev, Live and Capable**. New
`server/src/modules/home-learning/` module (routes, service, models, pricing, validation) mounted
at `/api/home-learning`; billing, leads and public-site modules extended for households;
upload limit raised. **No new env var** (uses the existing `PUBLIC_CONTENT_ADMIN_ID`).

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-kkjHjZTn.js`** / CSS `index-CPRP9smp.css` (unchanged CSS hash).
Live build (`npm run build:live`): **`index-DR6yDpsI.js`** / same CSS.
Capable build (`npm run build:capable`): **`index-Bjd7hJYW.js`** / same CSS — in `Guide/capable/`.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

Built with `npm run deploy:build` (32/32 routes prerendered; one transient HTTP 500 on the
pathways feed, retried cleanly). Same zip in `Guide/dev/` and `Guide/live/`. New **Home
Schooling** page (`/home-schooling`): a price calculator (number of children → best package,
monthly total, cost per child), redesigned package cards, benefits, how-it-works, FAQ; the
enquiry carries the family's child count so "Create household" gets the right number of places.

**The deployed backend didn't have the packages endpoint yet when this was built** (404), so the
prerendered `/home-schooling` snapshot has no packages in it. The page fetches them live in the
browser, so it works once the backend is deployed — but for search engines to see the prices,
re-run `npm run deploy:build` after the backend deploy and re-upload.

### Deploy order

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart** (check
   `PUBLIC_CONTENT_ADMIN_ID` is set first). Check the app log: five migrations should apply
   cleanly (or fewer, if any already ran).
2. **Portal** `assets.zip` + `index.html` — Dev's from `Guide/dev/`, Live's from `Guide/live/`
   (different JS hash, don't cross them).
3. **Website** `africa-digifunzi-com-dist.zip` → the `africa.digifunzi.com` document root
   (after the backend — the Home Schooling page needs its packages endpoint).
4. **Verify:**
   - `curl <api>/api/public/home-learning/packages` → a JSON array of the published packages.
   - Admin → Home Learning → Packages lists the seeded packages; add a household (try "Is one of
     the children already in the system?"), add a Google Maps link and a photo, add a child,
     set a parent portal password, invoice the month.
   - Sign in as that parent (their email + the password) → Invoices shows the household invoice.
   - As the child's educator → teacher portal → Home Learning shows the child and the map link.
   - Website `/home-schooling` → the calculator and package cards show; "Enquire for 3
     children" opens the enquiry with the package and count filled in.
   - Upload a file over 50 MB (e.g. an assessment video) → accepted.

---

## This release (22 Sep 2026) — Rich text descriptions everywhere; per-module collaborator access

**Built and packaged for both Dev and Live this pass** (both portal builds below). **No website
changes this release** — `digifunzi-landing` untouched, its zips in `Guide/dev/` and
`Guide/live/` are unchanged from the 18 Sep release. Verify on Dev first as usual before treating
Live's zips as safe to upload.

Three new migrations (auto-apply on Restart), **none destructive** — two widen existing `varchar`
description columns to `text` (nullable, additive), one adds a nullable JSON column. Backend +
portal frontend change; no website change.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20260922090000_widen_curriculum_framework_descriptions_to_rich_text.js` | Widens `description` on `age_categories`, `assessment_types`, `evidence_types`, `pathways`, `performance_bands` from `varchar` to `text` | unchanged — existing plain-text values carry over as-is |
| `20260922100000_widen_more_descriptions_to_rich_text.js` | Same widening for `curricula.description`, `learning_hubs.description`, `pathway_templates.description` | unchanged |
| `20260922110000_add_allowed_modules_to_users.js` | Adds nullable `allowedModules` JSON column to `users` | unchanged — every existing user (including existing collaborators) gets `NULL`, treated as "full access" everywhere it's read |

### What changed

1. **Rich text (TipTap) for ~16 description fields across the app**, replacing plain `<textarea>`
   inputs end to end (server validation, DB columns, edit forms, read-only displays): curricula,
   pathways, age categories, performance bands, assessment types, evidence types, course modules,
   competencies, pathway templates, learning hubs, inventory items, competitions (including
   per-track descriptions), and bootcamps.
2. **Table and image insertion added to both rich-text editor components** (`RichTextEditor.jsx`
   in the assessments module and the courses module — client can't share code between feature
   folders, so both got the same toolbar additions independently).
3. **Pathways tab decluttered.** `CompetenciesPage.jsx`'s previously-separate "Courses" and
   "Course Thresholds" lists are merged into one list — same information, one place to look
   instead of two redundant ones.
4. **Collaborator access is now per-module, not all-or-nothing.** A collaborator previously got
   full tenant edit access (every module except delete) or nothing. An admin can now grant/revoke
   access to specific modules — curriculum, courses, assessments, learning hubs, classes,
   learners, teachers, competitions/bootcamps, attendance, timetable, settings, reports,
   notifications — at invite time or by editing an existing collaborator afterwards, enforced by
   `scope.middleware.js`'s `attachOwnRecords` ahead of the existing role-aliasing check. Changes
   take effect on that collaborator's very next request — no re-login needed. Delete stays
   blocked for collaborators everywhere, unchanged.
5. **Existing collaborators are not locked out.** `users.allowedModules` is `NULL` for every
   collaborator invited before this release, and `NULL` (as opposed to an empty array) is treated
   as "every module" throughout — both server (`collaborator.service.js`) and the middleware check.
   Only a newly-invited or newly-edited collaborator from here on gets an explicit array.
6. **New `PATCH /admin-tools/collaborators/:id`** to edit an existing collaborator's allowed
   modules, plus the matching edit-access UI in `CollaboratorsPanel.jsx`; the sidebar
   (`Sidebar.jsx`) now hides nav entries for modules a collaborator wasn't granted.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — includes all three migrations above. `curriculum.validation.js`,
`competency.validation.js` (both the competency-framework and settings copies),
`learning-hub.validation.js`, `bootcamp.validation.js`, `competition.validation.js`, and
`pathway-template.validation.js` widen their `description` Zod schemas to accept rich-text HTML.
New `server/src/modules/admin-tools/module-registry.js` (canonical list of valid module keys,
mirrored — not shared — on the client); `user.model.js`, `collaborator.controller.js`,
`collaborator.service.js`, and `collaborator.routes.js` add `allowedModules` read/write and the
new `PATCH .../collaborators/:id` route; `scope.middleware.js`'s `attachOwnRecords` gains the
per-module enforcement check; `auth.middleware.js` touched to thread the allowlist through.
**No env change.**

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-BylTYHVn.js`** / CSS `index-CPRP9smp.css` (unchanged CSS
hash).
Live build (`npm run build:live`): **`index-BMVbLXe4.js`** / same CSS.
Changed: both `RichTextEditor.jsx`/`RichContent.jsx` pairs (assessments module + courses module)
gain table/image insertion; edit forms and read-only display components across curriculum,
courses, competitions, bootcamps, learning hubs, settings/competencies, settings/inventory, and
settings/pathway-templates switch their description field to the rich-text editor/viewer;
`CompetenciesPage.jsx` (merged Courses/Course Thresholds list); `Sidebar.jsx` (module-scoped nav),
`CollaboratorsPanel.jsx` (edit-access UI), `useCollaborators.js` + `collaboratorsApi.js` (PATCH
call), new `moduleRegistry.js` (client-side mirror of the server's module key list).

### Website

No website changes this release — `digifunzi-landing` untouched. `Guide/dev/africa-digifunzi-com-dist.zip`
and `Guide/live/africa-digifunzi-com-dist.zip` are unchanged from the 18 Sep 2026 release; do not
re-upload them as part of this pass.

### Deploy order

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. Check the app log: three
   migrations should apply cleanly (or fewer, if any already ran).
2. **Portal** `assets.zip` + `index.html` — Dev's from `Guide/dev/`, Live's from `Guide/live/`
   (different JS hash, don't cross them).
3. **No website step this release.**
4. **Verify:**
   - Open any of the converted description fields (e.g. a curriculum, a course module, a
     competency, a pathway template, an inventory item) → confirm the rich-text editor loads →
     apply bold, insert a table, and insert an image → save → reload the page → confirm all three
     persisted and render correctly in the read-only view.
   - On the Pathways tab, confirm there's a single merged course list (no separate "Course
     Thresholds" list alongside it).
   - As an admin, invite a new collaborator and grant only 2–3 modules (e.g. curriculum,
     classes) → log in as that collaborator → confirm the sidebar shows only the granted modules'
     nav entries → call an API endpoint for a module **not** granted directly (e.g. `curl` a
     settings or reports endpoint with that collaborator's token) → confirm it 403s.
   - Edit that collaborator's allowed modules (add or remove one) → without logging out, confirm
     the sidebar/API access reflects the change on the very next request.
   - If a collaborator invited before this release exists in the test DB, log in as them → confirm
     they still have full access to every module (not locked out by the new `NULL`-defaults-to-
     full-access rule).
   - Confirm delete actions are still blocked for a collaborator in every module, unchanged from
     before.

---

## This release (18 Sep 2026) — Hub-visit billing auto-invoices; module descriptions; survey assessments

**Built and packaged for both Dev and Live this pass** (both portal builds below), plus the
website. Verify on Dev first as usual before treating Live's zips as safe to upload.

Two new migrations (auto-apply on Restart), neither destructive. Backend + portal frontend
(Dev + Live) + website all change.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20260918090000_add_description_to_course_modules.js` | Adds nullable `description` text column to `course_modules` | unchanged — every existing module gets null |
| `20260918100000_add_survey_assessment_type.js` | Widens `assessments.type` enum to add `"survey"` (raw `ALTER TABLE ... MODIFY`, same technique as `20260916110000`'s invoice-type widening) | unchanged |

### What changed

1. **Hub visits bill automatically, the instant they're logged.** Previously, logging a visit
   left it "unbilled" until a separate "Generate charges" step ran. Now `hub-visit.service.js`'s
   `logVisit` resolves the learner's guardian payer and, when found, creates + issues a
   `hub_usage` invoice for that one visit in the same transaction that creates the visit row —
   no more waiting on a batch step for the common case. A visit still logs successfully and stays
   `unbilled` when no guardian is on file yet (or the space is free); "Generate charges" remains
   as the fallback/catch-up path for those.
2. **Hub visit line items show the learner's class/course context**, not just the space and
   date — e.g. "Desk – 2026-09-18 – Robotics Bootcamp (Code Foundations 2)" — resolved from the
   learner's hub enrollment (`learner_hub_links.classId` → `classes` →
   `class_course_teacher_links` → `courses`). `learner.service.js`'s `getAllLearners` now merges
   `className`/`courses[]` onto every learner it returns, batched per distinct class rather than
   per learner.
3. **HubFinanceTab restyled** to match Billing's own stat-tile/searchable-list conventions
   (icon-boxed stat tiles, search + status filter on the visits list, a real `StatusPill`-style
   badge) instead of its previous plain flat cards.
4. **Admin's embedded hub-finance view is now read-only.** The admin sees the same revenue
   summary and visits log on a hub's own page, but "+ Log a visit," "Generate charges," and
   per-row "Delete" are hidden — those actions belong to the hub operator's own login
   (`HubFinanceTab`'s new `readOnly` prop, passed only from `LearningHubViewPage.jsx`;
   `BillingPage.jsx`'s hub-login view is unchanged, full control).
5. **An invoiced visit row links straight to its invoice.** `listVisits` now resolves each
   visit's `invoiceItemId` to its real `invoiceId` in one batched lookup
   (`BillingModel.findItemsByIds`, the reverse of the existing `findItems`), so clicking an
   "Invoiced" row opens the standard invoice detail page instead of just showing a status pill.
6. **"Select all" in the Log a Visit learner picker**, scoped to whatever the search currently
   shows; toggles to "Clear all" once everything visible is checked.
7. **Course modules can carry a description.** The course builder's module rows get an inline
   expandable textarea (click "+ Description" / "Description" to open, saves on blur) for what
   that module covers; the "New Module" modal gained the same field for a module's initial
   description.
8. **New "survey" assessment type — ungraded self-reflection.** A learner rates their own
   understanding of a concept on a scale; it's a flat list of rating questions (no sections), and
   it never contributes a score: `grading.utils.js`'s `requiresManualGrading`/`computeMaxScore`
   both short-circuit for `type === "survey"`, so a submission releases instantly instead of
   sitting in a grading queue, with `maxScore: 0`. Its questions can still be tagged to competency
   indicators through the existing generic `assessment_competency_links` join table — no
   type-specific wiring needed there. Two learner-facing spots that would otherwise show a
   survey's "0/0" as if it were a failing grade were fixed: the assessment-complete screen (shows
   "Responses recorded · Not graded" instead) and the dashboard's "Recently Graded" list (surveys
   excluded, since they're never actually graded).

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — includes both migrations above. `hub-visit.service.js`'s `logVisit` now
invoices inline (new `HubVisitInternal.invoiceVisitImmediately`/`resolvePayerForLearner`
helpers) and `listVisits` attaches `invoiceId`; `billing.model.js` gains `findItemsByIds`;
`learner.service.js`'s `getAllLearners` merge gains `className`/`courses[]`.
`assessment.validation.js`/`builder.constants.js` add the `"survey"` assessment type + its own
`SURVEY_ITEM_KINDS`/`BUILDER_REGISTRY` entry (flat list, no sections);
`grading.utils.js` never requires manual grading or counts a max score for it.
`course.validation.js`'s module schema gains `description`. **No env change.**

### Portal frontend (`assets.zip` + `index.html`)

Dev build (`npm run build`): **`index-B2JAni57.js`** / CSS `index-CPRP9smp.css` (unchanged CSS
hash).
Live build (`npm run build:live`): **`index-CPgLoQ03.js`** / same CSS.
Changed: `HubFinanceTab.jsx` (restyle + `readOnly` mode), `LogVisitModal.jsx` (select-all,
learner class/course context, post-log summary reflects auto-invoicing instead of asking
"bill now?"), `useHubVisits.js` (invalidates `["billing"]` on log too), `LearningHubViewPage.jsx`
(passes `readOnly`), `AddModuleModal.jsx` + `CourseViewPage.jsx` (module description),
`AssessmentBuilderPage.jsx` + `AssessmentsPage.jsx` + `AssessmentContent.jsx` +
`assessment.schema.js` (survey type throughout the builder/list/detail UI),
`AssessmentDetailPage.jsx` + `DashboardPage.jsx` (survey-aware score display, learner portal).

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- Clicking a "Running at" hub card on a bootcamp's public page now previews that hub in place in
  the sticky sidebar (toggles closed on a second click) instead of navigating to a separate page
  and back. New `HubPreviewCard.jsx`; the old `/bootcamps/:slug/hubs/:hubId` page and route are
  left in place, unused by this entry point but still reachable as a direct link.
- "Take the diagnostic" moved out of the price/booking card to sit next to the expanded
  pathway's own name in "Pathways in this bootcamp," instead of a generic sidebar shortcut.
- **Built with `npm run deploy:build`.** First prerender pass hit the same recurring transient
  network blip earlier releases have logged (`fetch failed` on `/api/public/pathways` and
  `/api/public/store`) and fell back to 19/19 routes with those two detail-URL groups missing;
  the second automatic pass (part of `deploy:build`'s own double build) reached the API cleanly
  and produced a full prerender — **28/28 routes**, sitemap with all 29 URLs (9 static, 10
  pathways, 1 project, 1 store item, 5 bootcamps, 3 competitions). No fallback needed in the end.
- No new env var.

### Deploy order

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. Check the app log: two
   migrations should apply cleanly (or fewer, if either already ran).
2. **Portal** `assets.zip` + `index.html` — Dev's from `Guide/dev/`, Live's from `Guide/live/`
   (different JS hash, don't cross them).
3. **Website** `africa-digifunzi-com-dist.zip` from `Guide/dev/` → the `africa.digifunzi.com`
   document root.
4. **Verify:**
   - Log a visit at a non-school hub for a learner with a guardian email on file → confirm it
     shows "Invoiced" immediately (no separate "Generate charges" step needed) → click that row →
     confirm it opens the real invoice detail page.
   - Log a visit for a learner enrolled in a bootcamp class at that hub → confirm the resulting
     invoice's line item description includes the class/course, not just the space and date.
   - Log a visit for a learner with no guardian email → confirm it still logs, stays "Unbilled",
     and "Generate charges" still picks it up.
   - As admin, open a non-school hub's own page → confirm the Finance section shows stats/visits
     but no "Log a visit"/"Generate charges"/"Delete" controls; log in as that hub's own account →
     confirm all three are present there.
   - In a course's builder, add a description to a module → reload → confirm it persisted; create
     a new module with a description in one step.
   - Create a new assessment → confirm "Survey" appears as a type choice → build one with a
     rating-scale question tagged to a competency indicator → issue it to a learner → take it →
     confirm it submits straight to "graded" with no teacher grading step, and the learner's
     complete screen reads "Responses recorded · Not graded" rather than a score → confirm it does
     **not** appear in the learner dashboard's "Recently Graded" list.
   - On the public site, open a bootcamp with hub offerings → click a "Running at" hub card →
     confirm its details preview in the sidebar in place (no navigation) → click again → confirms
     it closes.
   - Expand a pathway under "Pathways in this bootcamp" that has a diagnostic assigned → confirm
     "Take the diagnostic" appears next to that pathway's name, not in the price/booking card.

---

## This release (16 Sep 2026) — Bootcamp diagnostics rebuilt per-pathway

**Verified on Dev; folded into the 18 Sep 2026 cumulative deploy to Live** — this release shipped to Dev on its own at the time, then rode along with everything since to Live in one combined pass rather than getting its own separate Live deploy.

Two new migrations (auto-apply on Restart), **one destructive** (drops the whole-bootcamp
diagnostic table — see below). Backend + portal frontend (3 files) + website all change.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20260917100000_add_pathway_diagnostics_to_bootcamps.js` | Adds nullable `pathwayDiagnostics` JSON column to `bootcamps` — an array of `{ pathwayId, assessmentId }`, one diagnostic per pathway instead of one for the whole bootcamp | unchanged — every existing bootcamp gets null |
| `20260917110000_drop_public_bootcamp_diagnostic.js` | **Destructive.** Drops `bootcamps.diagnosticAssessmentId` / `bootcamps.publicDiagnosticEnabled` and the entire `public_bootcamp_diagnostic_attempts` table | ⚠️ any logged whole-bootcamp diagnostic attempts are lost — see below |

⚠️ **`20260917110000` is destructive and not reversible in data, only in shape.** Its `down()`
recreates the two columns and the `public_bootcamp_diagnostic_attempts` table empty — it does
**not** restore any attempt rows that existed before the drop. This table never existed on Live (the whole-bootcamp diagnostic never shipped there before being superseded by the per-pathway version), so there is nothing to back up on Live specifically for this one — its own `20260914130100` create migration and this drop both apply in the same cumulative Restart, net effect: the table never persists on Live.

### What changed

1. **Diagnostic assignment moves from the bootcamp to each pathway in it.** A bootcamp bundling
   multiple pathways (e.g. Robotics + Coding) previously offered one diagnostic assessment for
   the whole bootcamp. It now assigns a diagnostic per pathway (`bootcamps.pathwayDiagnostics`),
   so each pathway in the bundle can use its own placement quiz — or none.
2. **The standalone whole-bootcamp public diagnostic is gone.** The entire
   `server/src/modules/public-site/public-bootcamp-diagnostic.*` module (service, controller,
   routes, validation, attempt model) is deleted, along with its route mount in `app.js`. There is
   no longer a `GET /api/public/bootcamps/:idOrSlug` `diagnostic` field — it's replaced by a
   `pathwayDiagnostics[]` array resolved onto the public bootcamp payload.
3. **Website reuses the existing per-pathway diagnostic flow instead of a parallel one.** The
   bootcamp detail page's "Take the diagnostic" entry point now only appears for whichever
   pathway is currently expanded under "Pathways in this bootcamp," and links to the pathway's
   own `/pathways/:slug/diagnostic?bootcamp=:slug` route (passing bootcamp context through) rather
   than a bootcamp-specific diagnostic page.
4. **Bootcamp enrollment survives the move.** Reached from a bootcamp's pathway diagnostic report,
   the report's next-steps panel swaps its generic "enroll in this pathway" CTA for the bootcamp's
   own auto-provisioned-account enrollment (`BootcampEnrollForm` rendered inline), so "take the
   diagnostic → enroll" still works as one flow.
5. **Enrollment success screen now shows the password, not just the username.** Previously only
   the auto-generated login email was shown after enrolling; the password the learner typed at
   signup (captured client-side at submit — the API never returns it) is now shown alongside it,
   since it's typed once and never surfaced again otherwise.
6. **Sidebar "From X" price is now scoped to the expanded pathway.** Previously the bootcamp detail
   page's sidebar always showed the bootcamp's overall cheapest priced item regardless of which
   pathway's roadmap was open; it now shows that pathway's own cheapest item, falling back to the
   bootcamp-wide cheapest when no pathway is expanded.
7. **`CoursePricingRoadmap` restyled** to match the plain pathway roadmap's look (bigger thumbnail,
   unboxed steps, number-bubble rail, "Start here"/"Finish" labels, lighter module-pricing rows)
   instead of its previous bordered-card style. This component is also used by the Competition
   detail page's "Course pricing" section, so that page's look changes too as a side effect.
8. **`BootcampPathwayCard` tolerates a diagnostic-only pathway** (zero priced courses — e.g. a
   whole-bootcamp-priced bootcamp that still assigns a per-pathway diagnostic) — shows a plain card
   without the course-count kicker instead of a misleading "0-course pathway."

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — includes both migrations above; `bootcamp.model.js` reads/writes
`pathwayDiagnostics` through the existing JSON-column helpers; `bootcamp.service.js` validates
each `{ pathwayId, assessmentId }` pair against the bootcamp's own `pathwayIds` and the
assessment's existence; `bootcamp.validation.js` gets the matching Zod shape.
`public-bootcamp.service.js` resolves `pathwayDiagnostics` onto the public payload as
`pathwayDiagnostics[]` and no longer returns a `diagnostic` field. The whole
`modules/public-site/public-bootcamp-diagnostic.*` module and its `app.js` route mount are
deleted. `knexfile.js` at the app root as always. **No env change.**

### Portal frontend (`assets.zip` + `index.html`)

Only three files changed — the bootcamp builder/view pages, updated for per-pathway diagnostic
assignment instead of one bootcamp-wide picker:
- `BootcampViewPage.jsx` — the diagnostic panel now lists one diagnostic per pathway instead of a
  single bootcamp-wide assessment picker.
- `CreateBootcampPage.jsx` — same, in the create/edit form: pick a diagnostic assessment per
  pathway once pathways are selected.
- `bootcamp.schema.js` — Zod shape updated from `diagnosticAssessmentId`/`publicDiagnosticEnabled`
  to `pathwayDiagnostics: [{ pathwayId, assessmentId }]`.

Dev build (`npm run build`): **`index-C5q4K92J.js`** / CSS `index-CPRP9smp.css` (unchanged CSS
hash — no stylesheet changes this release).
Live build (`npm run build:live`): **`index-bPKfcwsb.js`** / same CSS.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- Deleted: `BootcampDiagnosticPage.jsx`, `BootcampDiagnosticReportPage.jsx`,
  `useBootcampDiagnostic.js`, `BootcampNextStepsPanel.jsx`, and their routes in
  `src/routes/routes.jsx` + the matching `publicApi` methods in `src/services/api.js`.
- `BootcampDetailPage.jsx`'s sidebar now shows a diagnostic button only for the pathway currently
  expanded under "Pathways in this bootcamp" (via `?bootcamp=:slug` passthrough), linking to
  `/pathways/:slug/diagnostic?bootcamp=:slug` instead of a bootcamp-specific diagnostic route.
- `DiagnosticPage.jsx` reads that `?bootcamp=` param and passes bootcamp context down to
  `NextStepsPanel.jsx`, which — when it has bootcamp context — renders `BootcampEnrollForm` inline
  in place of its normal generic pathway-enroll CTA.
- `BootcampEnrollForm.jsx`'s success screen now also shows the password the learner typed (captured
  client-side at submit, since the API never returns it) alongside the existing username.
- `BootcampDetailPage.jsx`'s sidebar "From X" price now scopes to whichever pathway is currently
  expanded, falling back to the bootcamp-wide cheapest item when none is selected.
- `CoursePricingRoadmap.jsx` restyled to match the plain pathway roadmap (bigger thumbnail,
  unboxed steps, number-bubble rail, lighter pricing rows) — also affects the Competition detail
  page's "Course pricing" section, which shares this component.
- `BootcampDetailPage.jsx` section headings/spacing lightened generally (smaller `SectionHeading`
  helper, more breathing room between sections) — a minimalism pass, not a functional change.
- `BootcampPathwayCard.jsx` now tolerates a pathway with zero priced courses.
- **Built with `npm run deploy:build`.** The first prerender pass hit a transient network blip
  (`fetch failed` on `/api/public/{projects,pathways,store,bootcamps,competitions}`, matching the
  same recurring pattern earlier releases have hit) and fell back to 10 static/already-known
  routes only; `deploy:build`'s own second `npm run build` (it runs `build` twice — see
  `package.json`) re-ran the same prerender pass immediately after and this time reached the API
  cleanly, producing a full prerender — **29/29 routes written**, sitemap with all 29 URLs (9
  static, 10 pathways, 1 project, 1 store item, 5 bootcamps, 3 competitions). No fallback needed
  in the end; noting the transient failure here only because it's the same known flaky pattern
  documented in earlier releases, in case a future build only gets one pass and needs the
  documented `vite build` + standalone `generate-sitemap.js` fallback.
- No new env var.

### Deploy order

1. **(Recommended) Take a `mysqldump` backup** — `20260917110000` drops a table
   (`public_bootcamp_diagnostic_attempts`) and two columns.
2. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. Check the app log: two
   migrations should apply cleanly (or fewer, if `20260917100000` already ran).
3. **Portal** `assets.zip` + `index.html` — Dev's from `Guide/dev/`, Live's from `Guide/live/`
   (different JS hash, don't cross them).
4. **Website** `africa-digifunzi-com-dist.zip` from `Guide/dev/` → the `africa.digifunzi.com`
   document root.
5. **Verify:**
   - In the portal, create or open a bootcamp that bundles 2+ pathways → in the builder, confirm
     each pathway gets its own diagnostic-assessment picker (not one picker for the whole
     bootcamp) → assign a different diagnostic to each → save → reopen the view page → confirm
     each pathway shows its own assigned diagnostic.
   - Visit that bootcamp's public page → expand one of its pathways under "Pathways in this
     bootcamp" → confirm a "Take the diagnostic" entry appears for that pathway (and disappears
     when you collapse it / expand a different one).
   - Take that pathway's diagnostic from the bootcamp page → confirm the report page still shows
     the bootcamp's own enroll flow (not the generic pathway-enroll CTA) → enroll → confirm the
     success screen shows both a username **and** the password you typed.
   - Confirm the sidebar's "From X" price changes depending on which pathway is expanded, and
     falls back to the bootcamp-wide cheapest price when none is expanded.
   - Open a bootcamp or competition's "Course pricing" section → confirm the roadmap now matches
     the plain Pathway page's unboxed, number-bubble style rather than the old bordered cards.
   - `curl https://nodeapp.digifunzi.com/api/public/bootcamps/<slug>` → confirm the response has a
     `pathwayDiagnostics` array and **no** `diagnostic` field.

---

## This release (15 Sep 2026, fourth follow-on) — bootcamp enrollment hub picker · pathway courses as cards

**Verified on Dev; folded into the 18 Sep 2026 cumulative deploy to Live** — this release shipped to Dev on its own at the time, then rode along with everything since to Live in one combined pass rather than getting its own separate Live deploy.

No new migrations. Backend + website change; portal frontend unchanged (no `assets.zip` rebuild
needed this pass).

### What changed

1. **Bootcamp enrollment: hub picker restored.** A bootcamp that runs at more than one hub
   (`bootcamp_hubs`) previously auto-enrolled every visitor into whichever offering was created
   earliest, with no way to choose. `BootcampEnrollForm.jsx` now shows a "Choose a hub" step
   (same visual pattern as the existing Pathway-enrollment hub wizard) before the login-setup
   step, whenever the bootcamp has more than one hub run; a single-hub or no-hub bootcamp skips
   straight to the existing single-screen form, unchanged. The chosen `hubId` is validated
   server-side against the bootcamp's own offerings before enrolling.
2. **Bootcamp "Pathway courses" section redesigned as clickable cards.** Previously every
   pathway's full course roadmap rendered stacked and always-expanded on the bootcamp detail
   page — including, inconsistently, an "ungrouped" (pathway-less) courses section that showed
   its roadmap by default while grouped pathways got no equivalent treatment. Now every course
   group (named pathway, or "Other courses" for the ungrouped case) shows as a card in a grid,
   matching the public Pathways page's card style; clicking a card reveals just that group's
   roadmap in place with a "Back to pathways" control.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — `bootcamp-enrollment.validation.js` accepts an optional `hubId`;
`bootcamp-enrollment.service.js`'s `resolveBootcampOffering` enrolls into the visitor's chosen
hub when given (400 if it isn't one of the bootcamp's actual offerings), falling back to the
previous earliest-offering auto-pick when omitted. **No env change, no new migration.**

### Portal frontend (`assets.zip` + `index.html`)

**Unchanged this release** — `client/` was not touched. Skip re-uploading if the currently
deployed portal build is already current.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- New `BootcampPathwayCard.jsx` (`src/components/cards/`); `BootcampDetailPage.jsx`'s "Pathway
  courses" section now renders a card grid with in-place reveal instead of an always-expanded
  stack.
- `BootcampEnrollForm.jsx` gets the new hub-choice step (fetches the bootcamp's `upcomingRuns`
  via the existing `usePublicBootcamp` hook — no new endpoint needed).
- **Built with `npm run deploy:build`, but the prerender step failed on `/competitions`
  (Puppeteer navigation timeout) three consecutive attempts** — same transient pattern as
  several earlier releases, confirmed not an API issue (`curl` against every `/api/public/*`
  endpoint returned 200 throughout, in ~20ms). Shipped via the documented fallback: `vite build`
  (already succeeded) + a standalone `node scripts/generate-sitemap.js` run against the partial
  `dist/` (prerendering had already written `/`, `/pathways`, `/projects` before the
  `/competitions` timeout aborted the rest) + `npm run package`. Sitemap has 9 static URLs only
  — no per-slug pathway/project/store/bootcamp/competition detail URLs this pass. Every page is
  still fully functional for visitors (client-side rendering, real data) — this only affects the
  pre-baked SEO snapshot. **Recommended:** re-run `npm run deploy:build` once convenient to
  restore full prerendering + a complete sitemap.

### Deploy order

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. No migrations to check
   this time.
2. **Website** `africa-digifunzi-com-dist.zip` from `Guide/dev/` → the `africa.digifunzi.com`
   document root. (Portal unchanged — no redeploy needed.)
3. **Verify:**
   - Find (or create) a bootcamp with 2+ hub offerings → take its diagnostic → click "Enroll
     now" → confirm a "Choose a hub" step appears before the login fields, listing each hub with
     its dates → pick one → submit → confirm the learner lands in that hub's class (not always
     the earliest-created one).
   - Confirm a single-hub bootcamp's enroll form is unchanged (no hub step, straight to details).
   - Open a bootcamp with priced courses on the public site → confirm "Pathway courses" shows a
     card grid (no roadmap expanded by default) → click a card → confirm only that pathway's
     roadmap appears, with a "Back to pathways" button that returns to the grid.
   - If that bootcamp has any courses not tied to a pathway, confirm they show under an "Other
     courses" card rather than always-visible below the grid.

---

## This release (15 Sep 2026, third follow-on) — "Pathway pricing" renamed to "Pathway courses"

Website-only. **No backend or portal change — `backend-deploy.zip` and `assets.zip`/`index.html`
are unchanged from the previous release.**

### What changed

The bootcamp detail page's course-pricing section heading reads "Pathway courses" instead of
"Pathway pricing" (the previous follow-on's rename). Matching cross-references updated in the
enrollment confirmation's "see the ... section" note and `CoursePricingRoadmap.jsx`'s doc comment.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- **Built with a full prerender pass** (`npm run deploy:build`) — the first `deploy:build` attempt
  and one retry both failed partway through with a Puppeteer navigation timeout on `/competitions`
  (the API itself was healthy throughout — `curl` against every `/api/public/*` endpoint returned
  200 the whole time), same transient pattern earlier releases hit. A third prerender pass
  succeeded cleanly: 29/29 routes, full sitemap.

### Deploy order

1. **Website** `africa-digifunzi-com-dist.zip` from `Guide/dev/` → the `africa.digifunzi.com`
   document root. (Backend/portal unchanged — no redeploy needed for those.)
2. **Verify:** open any bootcamp with priced courses on the public site → confirm the section
   heading reads "Pathway courses".

---

## This release (15 Sep 2026, second follow-on) — Pathway-scoped bootcamps · hub detail page · self-chosen enrollment login

**Verified on Dev; folded into the 18 Sep 2026 cumulative deploy to Live** — this release shipped to Dev on its own at the time, then rode along with everything since to Live in one combined pass rather than getting its own separate Live deploy.

One new migration (auto-applies on Restart, not destructive). Backend + portal frontend +
website all change.

### New migration

| Migration | Does | Existing rows |
|---|---|---|
| `20260915090000_add_pathway_ids_to_bootcamps.js` | Adds nullable `pathwayIds` JSON column to `bootcamps` | unchanged — every existing bootcamp keeps showing every pathway under its curriculum, same as before this column existed |

### What changed

1. **Bootcamps can scope which pathways they run.** A curriculum can carry several pathways and
   not every one is relevant to a given bootcamp (e.g. a robotics camp built on a curriculum that
   also has an unrelated digital-literacy pathway). The bootcamp create/edit form gets a pathway
   checklist under the curriculum picker; leaving all unchecked means "every pathway," the
   pre-existing behaviour. When scoped, the course-pricing picker and the public site's
   "Pathway pricing" section (renamed from "Course pricing") only show the selected pathways'
   courses.
2. **Each "Running at" hub gets its own detail page** instead of a popup —
   `/bootcamps/:slug/hubs/:hubId` (new `GET /api/public/hubs/:id`) shows a photo gallery,
   description, amenities grouped into categories (Connectivity, Workspace, Food, Facilities) as
   icon cards, operating hours, contact info, and bookable spaces with capacity/pricing. The
   "Running at" list is now a responsive 2-column grid.
3. **Bootcamp enrollment: the learner picks their own username + password**, replacing the
   auto-generated `firstname.lastname@digifunzi.com` login and 8-digit temporary password. Uses
   the same learner-own-login mechanism (`setOrCreatePasswordByUsername`) the admin's own
   learner-portal-login field already uses. The enrollment response now returns `learnerUsername`
   instead of a one-time-reveal password — nothing new to show the visitor since they set it
   themselves.
4. **Fixed overlapping sections in the downloaded diagnostic PDF.** Two compounding bugs: native
   `<details>`/`<summary>` collapse isn't reliably respected by html2canvas (it painted every
   closed competency's indicator rows into the capture regardless), and the PDF's page-break
   slicing cut purely by pixel height with no regard for row boundaries. Competency rows are now
   controlled `<div>` + React state instead of `<details>`; every atomic section is marked
   `data-pdf-block` so page breaks land only in the gaps between blocks, never through one.
5. **Admin nav "Programs" renamed to "Events"** — the route (`/events`) and module code were
   already named that; only the displayed label lagged.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — adds the migration above, `pathwayIds` handling in `bootcamp.model.js` /
`bootcamp.service.js` / `bootcamp.validation.js`, `resolveCoursePricing`'s new `pathwayIds`
filter in `shared/utils/public-content.js`, the new `GET /api/public/hubs/:id` route
(`public-bootcamp.controller.js` / `public-bootcamp.service.js`'s `getHub` / `public-site.routes.js`),
and the username/password rewrite of `bootcamp-enrollment.service.js` /
`bootcamp-enrollment.validation.js` (deletes the now-unused `shared/utils/credential-generator.js`).
**No env change.**

### Portal frontend (`assets.zip` + `index.html`)

- Dev build (`npm run build`): **`index-DSxT2Y_L.js`** / CSS `index-CPRP9smp.css` (unchanged CSS
  hash).
- Live build (`npm run build:live`): not yet built for this release — build it before deploying
  to Live.
- Changed: Bootcamp create/edit form's new pathway checklist under the curriculum picker
  (`CreateBootcampPage.jsx`), `CoursePricingField.jsx`'s new `pathwayIds` scoping; sidebar nav
  "Programs" → "Events", plus the matching page title and breadcrumb back-links.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- New `/bootcamps/:slug/hubs/:hubId` hub detail page (`HubDetailPage.jsx`), replacing the old
  hub-detail popup; "Running at" list now a 2-column grid.
- `BootcampDetailPage.jsx`: "Course pricing" → "Pathway pricing", small "Curriculum" label added
  above the curriculum name.
- `BootcampEnrollForm.jsx`: username/password/confirm-password fields replace the old
  auto-generated-credential reveal on success.
- `DiagnosticReport.jsx` / `reportPdf.js`: the PDF overlap fix above.
- **Built with a full prerender pass** (`npm run deploy:build`) — `nodeapp.digifunzi.com` was
  reachable from the build environment this time. 29/29 routes prerendered cleanly, sitemap
  includes all pathway/project/store/bootcamp/competition detail URLs.

### Deploy order

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. Check the app log: one
   migration should apply cleanly (or none, if it already ran).
2. **Portal** `assets.zip` + `index.html` from `Guide/dev/`.
3. **Website** `africa-digifunzi-com-dist.zip` from `Guide/dev/` → the `africa.digifunzi.com`
   document root.
4. **Verify:**
   - `curl <api>/api/public/hubs/<some-hub-id>` → returns a hub profile (description, amenities,
     operatingHours, spaces) or 404 for an unknown/inactive/foreign-tenant id.
   - Open a bootcamp with hub offerings on the public site → click a hub in "Running at" → confirm
     it navigates to its own page (not a popup) with amenities grouped into labeled sections.
   - In the portal, edit a bootcamp linked to a curriculum with 2+ pathways → check one pathway →
     save → confirm the public bootcamp page's "Pathway pricing" section only shows that
     pathway's priced courses.
   - On a bootcamp's public diagnostic report, click "Enroll now" → confirm the form asks for a
     username + password (not just parent/learner details) → submit → confirm login with that
     username/password succeeds.
   - Take a diagnostic with several competencies → download the PDF → confirm no overlapping/
     garbled rows, including when the report spans more than one page.
   - In the portal, confirm the sidebar nav item reads "Events" (not "Programs") and the Events
     list page's title and breadcrumbs match.

---

## This release (15 Sep 2026, follow-on) — Bootcamp price resolves across all three pricing modes

**Verified on Dev; folded into the 18 Sep 2026 cumulative deploy to Live** — this release shipped to Dev on its own at the time, then rode along with everything since to Live in one combined pass rather than getting its own separate Live deploy.

No new migrations. Backend + portal frontend + website all change (small).

### What changed

A bootcamp is priced exactly one of three ways: as a whole (`priceAmount`), by course
(`coursePricing[].priceAmount`), or — one level deeper — by individual module within a course
(`coursePricing[].modulePricing[]`). The bootcamp-enrollment feature shipped earlier today only
ever read `priceAmount`, so a bootcamp priced by course or module showed "Price to be confirmed"
everywhere, even though it was clearly priced.

New `shared/utils/bootcamp-pricing.js`'s `resolveEffectiveBootcampPrice(bootcamp)` picks whichever
mode is actually set and, for by-course/by-module, **sums every priced course or module into one
total** — enrollment always signs a learner into the whole bootcamp's hub+class, never a single
course, so a single total is what's actually owed regardless of pricing mode. Wired into all three
places a price is shown: the enrollment confirmation (website), the learner's "Account Suspended"
payment screen (portal), and the admin Enquiries list + "Mark paid" pre-fill (portal). Each now
also carries a `mode` flag, and the UI shows a small note when the total is a summed price rather
than one flat number.

### Backend (`backend-deploy.zip`)

Rebuilt from HEAD — adds `shared/utils/bootcamp-pricing.js` and its use in
`bootcamp-enrollment.service.js`, `auth.service.js`'s `getPendingPayment`, and
`lead.service.js`'s `_resolveExpectedPayment`. **No env change, no new migration.**

### Portal frontend (`assets.zip` + `index.html`)

- Dev build (`npm run build`): **`index-BBGfr6oe.js`** / CSS `index-CPRP9smp.css` (unchanged CSS
  hash).
- Live build (`npm run build:live`): not yet built for this release — build it before deploying to
  Live.
- Changed: "Account Suspended" payment screen and Enquiries "Mark paid"/expected-amount lines both
  show a "summed from per-course/module pricing" note when applicable.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- `BootcampEnrollForm.jsx`'s confirmation screen shows the same note when the shown total is a
  summed price.
- **Built with `npm run deploy:build`, but `nodeapp.digifunzi.com` was unreachable from this build
  environment again** (same transient-network situation as the last two releases) — Pathways/
  Projects/Store/Bootcamps/Competitions shipped as SPA-only HTML; the 9 static routes plus the
  previously-known pathway/project/store detail pages still prerendered. Every page is still fully
  functional for visitors. **Recommended:** re-run `npm run deploy:build` from a machine with a
  working connection to `nodeapp.digifunzi.com` and re-upload once convenient.

### Deploy order

1. **Backend** `backend-deploy.zip` → **Run NPM Install** → **Restart**. No migrations to check
   this time.
2. **Portal** `assets.zip` + `index.html` from `Guide/dev/`.
3. **Website** `africa-digifunzi-com-dist.zip` from `Guide/dev/` → the `africa.digifunzi.com`
   document root.
4. **Verify:**
   - Find (or create) a bootcamp priced by course or by module (not a whole-bootcamp price) →
     enroll on the website → confirm the confirmation screen shows a real total (the sum of its
     priced courses/modules), not "Price to be confirmed", with the "combines individually priced
     courses/modules" note.
   - Log in as that learner → confirm the "Account Suspended" screen shows the same total and note.
   - In the portal's Enquiries page, find that lead → confirm the expected-amount line and "Mark
     paid" pre-fill both show the same total, with the same note.
   - Spot-check a whole-priced bootcamp still shows its flat price with no note, and a bootcamp
     with no price configured in any mode still shows "Price to be confirmed" / no expected amount.

---

## This release (15 Sep 2026) — Bootcamp auto-enrollment with cash-payment gating · Hub Visits replaces Mentor Sessions

**Verified on Dev; folded into the 18 Sep 2026 cumulative deploy to Live** — this release shipped to Dev on its own at the time, then rode along with everything since to Live in one combined pass rather than getting its own separate Live deploy.

Seven new migrations (auto-apply on Restart), one destructive (drops the just-released
`mentor_sessions` table — see below). Backend + portal frontend + website all change.

### New migrations

| Migration | Does | Existing rows |
|---|---|---|
| `20260915060000_drop_mentor_sessions.js` | **Destructive.** Drops `mentor_sessions` (superseded by `hub_visits` below) | ⚠️ any logged mentor sessions are lost — this table shipped 14 Sep and was superseded by hub_visits before Live ever ran it, so nothing exists on Live to lose |
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

**Verified on Dev; folded into the 18 Sep 2026 cumulative deploy to Live** — this release shipped to Dev on its own at the time, then rode along with everything since to Live in one combined pass rather than getting its own separate Live deploy.

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

**Verified on Dev; folded into the 18 Sep 2026 cumulative deploy to Live** — this release shipped to Dev on its own at the time, then rode along with everything since to Live in one combined pass rather than getting its own separate Live deploy.

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
same posture as any schema-dropping migration. This chain has already been verified on Dev — take that backup before restarting the Live Node app on this cumulative deploy, since Live has never run these migrations before.

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
that folder for reference). **Both migration files now check the current schema/data before
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
changes. `knexfile.js` at the app root as always. **`Guide/live/backend-deploy.zip`
is byte-identical to `Guide/dev/backend-deploy.zip`** — only each cPanel Node
app's `.env` differs. **No env change.**

### Portal frontend (`assets.zip` + `index.html`) — Live build

- Live build (`npm run build:live`, bakes in `https://dcf-api.digifunzi.com`):
  **`index-CJsTNRbk.js`** / CSS `index-CPRP9smp.css`. (Dev's is a different hash —
  `Guide/dev/` — don't cross them.)
- New: "Programs & Competitions" page with the competition create/edit/view
  screens and Track editor; a Competitions section on a Program's view; the
  Program "List on the website" (bootcamp) card; the hub Delivery control.

### Website (`africa-digifunzi-com-dist.zip` — digifunzi-landing, separate repo)

- `/bootcamps` + `/bootcamps/:slug` API-driven; `/competitions` +
  `/competitions/:slug` API-driven (was hand-authored static content) with the
  Codeavour-style Track cards; the post-diagnostic Enroll two-step wizard with the
  hub-type picker (physical + online hubs); virtual-hub "Online" chip.
- The website bundle is built against `https://nodeapp.digifunzi.com` (Dev API).
  If Live's website should read Live's API, rebuild `digifunzi-landing` with
  `VITE_API_URL=https://dcf-api.digifunzi.com` before uploading to Live's doc root.

### Deploy order (Live — only after Dev is confirmed working)

1. **Backend** `Guide/live/backend-deploy.zip` → the `dcf-api.digifunzi` app root
   → **Run NPM Install** → **Restart**. Check the app log: five migrations should
   apply cleanly against Live's database (or fewer, if some already ran).
2. **Portal** `Guide/live/assets.zip` + `Guide/live/index.html` → the
   `dcf.digifunzi.com` doc root. Delete the old `assets/` + `index.html` first.
3. **Website** `Guide/live/africa-digifunzi-com-dist.zip` → the Live website doc root.
4. **Verify:**
   - `curl https://dcf-api.digifunzi.com/api/public/competitions` → `[]` (or real
     data) not `503`.
   - `curl https://dcf-api.digifunzi.com/api/public/bootcamps` → same.
   - Log into `https://dcf.digifunzi.com`, open **Programs & Competitions**, click
     **+ New Competition**, save a draft, then publish it → it appears on the site.

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
- `scripts/{prerender,generate-sitemap}.js` now discover `/store` **and** `/projects` slugs
  from the API (like `/pathways`) — they no longer read `src/content/store.js`. If the backend
  isn't reachable from the build machine, those detail pages ship SPA-only; re-build once the
  API is live to fill them in (same as the existing Pathways note).
- **Nav reordered:** Pathways · Projects · Bootcamps · Competitions · Store · About · Contact.
  New **`/bootcamps`** placeholder page ("coming soon" + contact CTA — no content/model yet).

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
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS | outbound email — password reset, invoices and receipts, emailed notifications, lead auto-ack and staff reply. Brevo: `smtp-relay.brevo.com` / `587` / the SMTP login (`…@smtp-brevo.com`) / the SMTP key (`xsmtpsib-…`). Leave every one unset and nothing is emailed — nothing else breaks. See "This release (1 Oct 2026, third follow-on)" |
| BREVO_API_KEY | Brevo API key (`xkeysib-…`). When set, email is sent through Brevo's HTTP API (port 443) instead of SMTP — **required on this host**, which blocks outbound SMTP. With it set, the `SMTP_*` variables are ignored |
| MAIL_FROM | the From header for outbound mail: `Digifunzi <no-reply@digifunzi.com>`. Must be a sender verified in Brevo on an authenticated domain. Falls back to `SMTP_USER` if unset |
| MAIL_REPLY_TO | *(optional)* Reply-To header on outbound mail — an inbox someone reads. A hub's invoice email replies to that hub instead |
| MAIL_BRAND_NAME | *(optional)* the product name account emails are signed with. Default `Digifunzi`; `Capable` on Capable |
| PASSWORD_RESET_MINUTES | *(optional)* minutes an emailed password-reset link stays valid. Default `60` |
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

7. **Extract** `assets.zip` — right-click → Extract. It creates `dcf.digifunzi.com/assets/` with all the JS/CSS/font files inside. Confirm `assets/index-CJsTNRbk.js` exists after extracting; if the extractor made a nested `assets/assets/`, move it up one level.

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
| `backend-deploy.zip` | Ready-to-upload backend zip — `src/`, `knexfile.js`, `package.json`, `package-lock.json` (code only; no node_modules, no .env, no uploads). **Rebuilt 10 Sep 2026** — includes every migration through `20260910143000_create_competitions.js` (the five 10 Sep migrations apply automatically on Restart — see "This release (10 Sep 2026)" at the top). No new dependency, so **Run NPM Install** on Restart is safe either way. **Byte-identical to `Guide/dev/backend-deploy.zip`** — same code, only each cPanel Node app's `.env` differs. |
| `assets.zip` | Ready-to-upload curriculum-portal assets zip, built with `npm run build:live` (bakes in `https://dcf-api.digifunzi.com`, **not** Dev's URL). Zipped as the `assets` **folder** (66 entries). **Rebuilt 10 Sep 2026** — `index-CJsTNRbk.js` / CSS `index-CPRP9smp.css`. Portal UI changed this release ("Programs & Competitions" page + Track editor, Program bootcamp-sale card, hub Delivery control). |
| `index.html` | The built portal entry file (`client/dist/index.html`, Live build) — upload alongside `assets.zip`, don't extract. Its `<script src>` hash must match the `index-*.js` inside `assets.zip` — both **`index-CJsTNRbk.js`** in this build. |
| `africa-digifunzi-com-dist.zip` | Ready-to-upload **digifunzi-landing** website build (its own repo — `github.com/kkg-kevin/curriculum-web`). Extract into the website document root, overwriting. Built with `VITE_API_URL=https://nodeapp.digifunzi.com` (Dev's backend — the same value the site's `.env.production` carries; confirm/rebuild for a Live-backend site). **Rebuilt 10 Sep 2026.** The list pages (`/bootcamps`, `/competitions`, `/pathways`, `/store`) are pre-rendered; **`/bootcamps/:slug` and `/competitions/:slug` detail pages ship SPA-only** because those endpoints weren't live on the backend yet at build time — the pages work at runtime, just not pre-rendered for SEO. **After the backend is deployed, re-run `npm run deploy:build` in `digifunzi-landing` and re-upload** to pre-render them. |

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
