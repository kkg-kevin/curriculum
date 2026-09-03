# Deployment Guide — Digifunzi Curriculum

## Overview

| Part | Technology | Live URL |
|---|---|---|
| Frontend | React 19 + Vite | https://curriculum.digifunzi.com |
| Backend | Node.js + Express | https://nodeapp.digifunzi.com |

---

## This release (3 Sep 2026) — what changed

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
- **Public site content API.** New **unauthenticated** read endpoints `GET /api/public/bootcamps[/:idOrSlug]` and `GET /api/public/projects[/:idOrSlug]` for the marketing site's listing/detail pages, plus admin-only authoring at `GET/POST/PUT/DELETE /api/site/bootcamps` and `/api/site/projects`. Its own tables, deliberately separate from the operational `programs`/`courses` — this is marketing copy, not curriculum. **No admin UI for authoring this content ships in this release** (API only).
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
| Node.js version | 22.22.3 |
| Application mode | Development |
| Application root | `curriculum.digifunzi` |
| Application URL | `nodeapp.digifunzi.com` |
| Application startup file | `src/server.js` |

### Environment Variables (set in cPanel Node.js panel)
| Name | Value |
|---|---|
| CLIENT_URL | https://curriculum.digifunzi.com |
| PUBLIC_SITE_URL | *(optional — new this release)* the marketing site's origin, e.g. `https://digifunzi.com`. Leave unset until that site is deployed; when unset the Enroll/Contact API routes still work, they just can't be called from a browser on another origin yet. |
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
    - Click **Run NPM Install** — wait for it to complete
    - Click **Restart** — this is what actually builds the database schema and creates the admin login (via the automatic startup migration). Check the app's log after restarting to confirm it started cleanly rather than crash-looping (a bad `DB_*` value is the most likely cause of a failed start).

7. **Test** — visit `https://nodeapp.digifunzi.com`  
   Expected response: `{ "message": "API is running" }`, then confirm you can log in at `https://curriculum.digifunzi.com` with the `ADMIN_EMAIL`/`ADMIN_PASSWORD` above.

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

7. **Extract** `assets.zip` — right-click → Extract. It creates `curriculum.digifunzi.com/assets/` with all the JS/CSS/font files inside. Confirm `assets/index-LSzeJgmb.js` exists after extracting; if the extractor made a nested `assets/assets/`, move it up one level.

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

## Deployment Files
| File | Purpose |
|---|---|
| `backend-deploy.zip` | Ready-to-upload backend zip — `src/`, `knexfile.js`, `package.json`, `package-lock.json` (code only; no node_modules, no .env, no uploads). 284 files, includes every migration through `20260903090000_rename_learning_areas_to_pathways.js`. |
| `assets.zip` | Ready-to-upload frontend assets zip. Zipped as the `assets` **folder**, so it extracts to an `assets/` folder (not loose files). 66 entries (65 asset files + the folder entry). |
| `index.html` | The built frontend entry file (`client/dist/index.html`) — upload alongside `assets.zip`, don't extract. Its `<script src>` hash must match the `index-*.js` inside `assets.zip` — both are **`index-LSzeJgmb.js`** in this build; the CSS is unchanged at `index-CPRP9smp.css`. |
| `login-users.zip` | Obsolete — was for syncing the old JSON-based `data/users.json`. No longer applicable now that auth lives in MySQL; safe to delete. |

### Rebuilding these zips by hand (Git Bash, from the project root)

Use Info-Zip `zip`, **not** PowerShell `Compress-Archive` (it writes `\` path separators that break Linux/cPanel extraction — you'd get a single file literally named `assets\index-….js`).

```bash
# frontend
cd client && npm install && npm run build && cd ..
cp client/dist/index.html Guide/index.html
rm -f Guide/assets.zip
# zip the "assets" directory itself (not its contents) so it extracts back into an assets/ folder
(cd client/dist && zip -r -X -q ../../Guide/assets.zip assets)

# backend
rm -f Guide/backend-deploy.zip
(cd server && zip -r -X -q ../Guide/backend-deploy.zip src knexfile.js package.json package-lock.json)

# verify — no backslash paths (both must print 0), and assets.zip must hold assets/… paths
unzip -l Guide/assets.zip | grep -cF '\'          # must be 0
unzip -l Guide/backend-deploy.zip | grep -cF '\'  # must be 0
unzip -l Guide/assets.zip | grep -c '^\s*0.*assets/$'   # must be 1 (the folder entry)
```
