# Deployment Guide — Digifunzi Curriculum — Capable environment

**Status: backend and portal rebuilt (2 Oct 2026) — ready to upload; take a database backup first if the 1 Oct second follow-on isn't deployed yet.** Release notes: `Guide/live/DEPLOYMENT.md` → "This release (2 Oct 2026)" — bootcamp games (Events → Games, and a Games & play card on the bootcamp form), sharing between admins, the People & sharing tab in Settings, staff use of Settings data, and the fix for partial saves blanking other fields. Two new, additive migrations; no new environment variable; backend and portal must be uploaded together (portal `index-Cdok_5cD.js`). The website parts of those notes don't apply here. Below it, "This release (1 Oct 2026, third follow-on)" — email: password reset links, invoices and receipts emailed to the payer, selected notifications by email. One new, additive migration; backend and portal must be uploaded together. **Nothing is emailed until `BREVO_API_KEY` is set** (outbound SMTP is blocked on this server, so the `SMTP_*` variables are not used) — use the Capable column of that release's Environment table (`BREVO_API_KEY`, `MAIL_BRAND_NAME=Capable`, `MAIL_FROM=Capable <no-reply@digifunzi.com>`, and check `CLIENT_URL=https://lms.capable.co.ke`), then add the cron job. Below it, "This release (1 Oct 2026, second follow-on)" is included too — Items (Goods & Services), 30-minute idle sign-out and sign-out when the last tab closes, Home Learning packages moved to Billing → Packages, child vs parent logins, parents adding children from My Family. Two new migrations (the first restructures the `inventory`/`billing_items` tables into `items`), everyone signs in again once, and the backend and portal must be uploaded together. The website parts of those notes don't apply here. Optional new env var `SESSION_IDLE_MINUTES` (default 30); `JWT_EXPIRES_IN` recommended `12h`. Earlier releases below it are included.

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
| `backend-deploy.zip` | 1 Oct 2026 third follow-on, from HEAD (`87793ce`, sends through Brevo's HTTP API) — byte-identical to `Guide/dev/` and `Guide/live/`; code only, nothing environment-specific baked in. Carries all migrations up to `20261003090000_create_email_outbox_and_password_resets.js` (incl. the Items merge), applied on Restart | **Yes** — after a database backup |
| `assets.zip` + `index.html` | 1 Oct 2026 third follow-on, `npm run build:capable` (`client/`) — bakes in `https://lms-api.capable.co.ke` and the Capable branding. Entry **`index-BpaauK1h.js`** / CSS `index-CPRP9smp.css` | **Yes** — upload to the `lms.capable.co.ke` document root, together with the backend |

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
