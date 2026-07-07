# Deployment Guide — Digifunzi Curriculum

## Overview

| Part | Technology | Live URL |
|---|---|---|
| Frontend | React 19 + Vite | https://curriculum.digifunzi.com |
| Backend | Node.js + Express | https://nodeapp.digifunzi.com |

---

## How Frontend and Backend Connect (REST API)

The frontend and backend are two separate applications that communicate over HTTP using a **REST API**.

```
Browser (curriculum.digifunzi.com)
        ↓  HTTP requests (Axios)
API Server (nodeapp.digifunzi.com)
        ↓  reads/writes
JSON files (server/data/*.json)
```

### What each part does

**Frontend** (`curriculum.digifunzi.com`)
- Serves static HTML, CSS and JavaScript files
- Has no data of its own
- Every page load or user action sends an API request to the backend

**Backend** (`nodeapp.digifunzi.com`)
- A running Node.js/Express server
- Receives requests from the frontend
- Reads and writes data to the JSON files in `server/data/`
- Sends data back as JSON responses

### Example — creating a curriculum:
1. User fills the form and clicks **Save** on `curriculum.digifunzi.com`
2. Frontend sends `POST https://nodeapp.digifunzi.com/api/curricula`
3. Backend receives it, saves it to `curricula.json`
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

### Steps to Deploy / Re-deploy Backend

> ⚠️ **`data/` and `uploads/` are no longer part of the redeploy zip by default.** Once real content exists on the live site, wholesale-replacing those folders on every redeploy would erase anything created directly on the live site. `backend-deploy.zip` is now **code-only**: `src/`, `package.json`, `package-lock.json`. Only rebuild it including `data/`/`uploads/` if you specifically intend to overwrite live data with your local copy (see "Full data reset" below).

1. **Create the deployment zip** from the project root:
   - Include: `src/`, `package.json`, `package-lock.json`
   - Exclude: `node_modules/`, `.env`, `data/`, `uploads/`
   - The ready-made zip is: `backend-deploy.zip`

2. **In cPanel File Manager**, navigate to `curriculum.digifunzi` folder

3. **Delete** existing files (code only — leave `data/` and `uploads/` alone):
   - `src/` folder
   - `package.json`
   - `package-lock.json`

4. **Upload** `backend-deploy.zip` into `curriculum.digifunzi`

5. **Extract** — right-click `backend-deploy.zip` → Extract

6. **In cPanel Node.js panel**:
   - Click **Run NPM Install** — wait for it to complete
   - Click **Restart**

7. **Test** — visit `https://nodeapp.digifunzi.com`  
   Expected response: `{ "message": "API is running" }`

### Uploaded files (cover images, inline images, attached documents)

Uploaded files are saved to `server/uploads/` and served directly at `https://nodeapp.digifunzi.com/uploads/<filename>` — no extra cPanel configuration is needed, the server does this itself (`app.js` already serves that folder statically).

### Full data reset (rare — only when you mean to overwrite live data)

If you genuinely want to replace the live `data/` and/or `uploads/` with your local copy (e.g. first-ever deploy, or a deliberate reset), build the zip including them (`src/`, `data/`, `uploads/`, `package.json`, `package-lock.json`), delete the corresponding folders in cPanel before extracting, and be aware this destroys whatever is currently live in those folders.

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
   - Zip `client/dist/assets/` → `assets.zip`
   - The ready-made zip is: `assets.zip`

4. **In cPanel File Manager**, navigate to `curriculum.digifunzi.com` folder

5. **Upload**:
   - `index.html` from `client/dist/`
   - `assets.zip`

6. **Extract** `assets.zip` — right-click → Extract

7. **Delete** `assets.zip` after extraction

8. **Create `.htaccess`** file in `curriculum.digifunzi.com` (if not already there):
   ```apache
   Options -MultiViews
   RewriteEngine On
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteRule ^ index.html [QSA,L]
   ```

9. **Test** — visit `https://curriculum.digifunzi.com`

---

## Re-deploying After Code Changes

### Backend changes only:
- Repeat Backend steps 1–7

### Frontend changes only:
- Repeat Frontend steps 1–9

### Both changed:
- Deploy backend first, then frontend

---

## Deployment Files
| File | Purpose |
|---|---|
| `backend-deploy.zip` | Ready-to-upload backend zip — `src/`, `package.json`, `package-lock.json` (code only; no node_modules, no .env, no data/uploads) |
| `assets.zip` | Ready-to-upload frontend assets zip (`client/dist/assets/`) |
| `index.html` | The built frontend entry file (`client/dist/index.html`) — upload alongside `assets.zip`, don't extract |
