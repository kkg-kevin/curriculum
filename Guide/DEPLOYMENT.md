# Deployment Guide — Digifunzi Curriculum

## Overview

| Part | Technology | Live URL |
|---|---|---|
| Frontend | React 19 + Vite | https://curriculum.digifunzi.com |
| Backend | Node.js + Express | https://nodeapp.digifunzi.com |

---

## This release (1 Sep 2026) — what changed

**No new schema migration in this release.** No `package.json` change on either side. Deploy order doesn't strictly matter, but deploying **backend first, then frontend** is still the safe habit. Click **Run NPM Install** + **Restart** on the backend as usual (Restart is what reloads the code).

**Backend** (`backend-deploy.zip`):
- **Billing — Customers API.** New admin-only endpoints `GET /api/billing/customers` and `GET /api/billing/customers/:hubId`. A "customer" is derived on the fly (a learning hub the platform bills) — no new table, no migration. Returns per-hub invoice/payment aggregates and, for one hub, its full invoice + payment list.
- **Competencies — duplicate a Performance Band's setup to the next level.** New endpoint `POST /api/curricula/:id/competencies/bands/:bandId/duplicate-to-next`. Copies a configured band's competencies, per-indicator % weights and advancement thresholds onto the next band in the *same* Developmental Stage's ladder (Explorer → Builder), overwriting that band's config. Scoped to one stage only — it never fans out across stages.

**Frontend** (`assets.zip` + `index.html`):
- **Tech Educator portal → Assessments** page rebuilt as a **per-course carousel**: a course selector plus one session slide at a time (prev / next arrows + dots) instead of the old collapsible course-section stack. It pages through **every** session in the course (not only sessions with an assessment attached), so an empty session shows as an empty slide.
- **Billing → Customers.** The admin Billing page is now split into **Customers · Invoices · Payments** tabs. The Customers tab lists every learning hub with its invoiced / outstanding totals; each opens a customer page showing that hub's invoices and payments, with **Add invoice** (jumps to the Invoices tab pre-scoped to that hub) and **View statement** (opens the existing Statement of Account pre-selected to that hub). School and learner billing views are unchanged.
- **Curriculum → Progress Arc → Performance Bands.** Each band card's ⋮ menu has a **"Duplicate to \<next band\>"** action — copies that band's competencies, indicator weights and advancement thresholds onto the next level in the selected stage, with a confirm dialog first.
- **Tech Educator portal → Claims** — new sidebar entry (between Timetable and My Profile) and a placeholder page. The claim submission / approval flow is not built yet; this only adds the navigation and a "coming soon" screen.
- **Learning Hub view (Settings):** an **Activate / Deactivate Hub** button next to Edit/Delete, with a confirmation dialog that spells out the cascade (deactivating a hub deactivates every learner and educator tied to it and its branch hubs; reactivating brings them back; someone still active at another hub keeps their account). Only shows once a hub is live.

### Previous release (31 Aug 2026) — still included here

Shipped in the immediately preceding build, already baked into these same zips — listed for anyone who skipped that deploy:

- **Migration** `20260831100000_add_advancement_min_to_performance_bands.js` — adds `advancementMin` to `performance_bands` (applies on Restart; existing bands get `0`). This is the latest migration; the backend zip includes every migration through it.
- **Diagnostic issuing is strictly one-per-age-bracket.** A learner is issued exactly **one** Learning-Area diagnostic — the area whose `minAge`/`maxAge` range contains the learner's age. A learner with **no date of birth on file gets no auto-issued diagnostic**. Stale diagnostics from a different bracket the learner never started are **pruned automatically**; anything opened (in progress / submitted / graded) is left untouched. (`learner.service.js` only.)
- Curriculum name unique (case/space-insensitive) — duplicate create/rename rejected with 409.
- Account deactivation model — suspended learner / educator / hub can log in but is locked to an "Account Suspended" screen; writes refused server-side. `PATCH /api/teachers/:id/status`. Hub deactivation cascades to its (and its branches') learners and educators.
- Billing documents return `issuedBy` + `learner` (name/photo) on invoices / receipts / statements.
- Frontend: vector-PDF invoices / receipts / statements (selectable text, three logos); learner report Print / Download PDF; multi-hub learners no longer trapped on a diagnostic gate; sidebar collapse reflows immediately; Performance Bands advancement threshold is a min–max range with per-competency % subtotal.
- Dependency `jspdf-autotable` (already in `client/package.json`, baked into the build — only matters if you rebuild the frontend yourself).

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

> The app now migrates its own database schema and creates the first admin login automatically on every restart (see `src/server.js`) — there is no separate manual migration or data-sync step anymore. `backend-deploy.zip` is **code-only**: `src/`, `knexfile.js`, `package.json`, `package-lock.json`. **`knexfile.js` lives at the app root, not inside `src/`** — don't forget it when rebuilding the zip by hand, the app will fail to start without it.

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

7. **Extract** `assets.zip` — right-click → Extract. It creates `curriculum.digifunzi.com/assets/` with all the JS/CSS/font files inside. Confirm `assets/index-SUi4RgEX.js` exists after extracting; if the extractor made a nested `assets/assets/`, move it up one level.

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
| `backend-deploy.zip` | Ready-to-upload backend zip — `src/`, `knexfile.js`, `package.json`, `package-lock.json` (code only; no node_modules, no .env, no uploads). 262 files, includes every migration through `20260831100000`. |
| `assets.zip` | Ready-to-upload frontend assets zip. Zipped as the `assets` **folder**, so it extracts to an `assets/` folder (not loose files). 66 entries (65 asset files + the folder entry). |
| `index.html` | The built frontend entry file (`client/dist/index.html`) — upload alongside `assets.zip`, don't extract. Its `<script src>` hash must match the `index-*.js` inside `assets.zip` — both are **`index-SUi4RgEX.js`** in this build; the CSS is unchanged at `index-CPRP9smp.css`. |
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
