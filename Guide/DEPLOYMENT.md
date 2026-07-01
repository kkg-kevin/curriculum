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
`VITE_API_URL=https://nodeapp.digifunzi.com` in `client/.env` is what tells the frontend where to send all API requests. This value gets baked into the build — which is why rebuilding is required whenever it changes.

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

1. **Create the deployment zip** from the project root:
   - Include: `src/`, `data/`, `package.json`, `package-lock.json`
   - Exclude: `node_modules/`, `.env`
   - The ready-made zip is: `backend-deploy.zip`

2. **In cPanel File Manager**, navigate to `curriculum.digifunzi` folder

3. **Delete** existing files:
   - `src/` folder
   - `data/` folder
   - `package.json`
   - `package-lock.json`

4. **Upload** `backend-deploy.zip` into `curriculum.digifunzi`

5. **Extract** — right-click `backend-deploy.zip` → Extract

6. **In cPanel Node.js panel**:
   - Click **Run NPM Install** — wait for it to complete
   - Click **Restart**

7. **Test** — visit `https://nodeapp.digifunzi.com`  
   Expected response: `{ "message": "API is running" }`

---

## Frontend Deployment (React / cPanel Static)

### Steps to Deploy / Re-deploy Frontend

1. **Update** `client/.env`:
   ```
   VITE_API_URL=https://nodeapp.digifunzi.com
   ```

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
| `backend-deploy.zip` | Ready-to-upload backend zip (no node_modules, no .env) |
| `assets.zip` | Ready-to-upload frontend assets zip |
