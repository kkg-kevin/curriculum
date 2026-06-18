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
Charts: Recharts. Rich text: TipTap. Drag-and-drop: dnd-kit.

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
Config: `server/src/config/db.js` (database connection, not yet implemented) and `server/src/config/env.js` (env var exports, not yet implemented).

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
DATABASE_URL=
JWT_SECRET=
```
