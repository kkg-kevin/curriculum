# Digifunzi Landing Page — Project Specification

> Give this file to Claude in a **new, separate project/repo**. It is not part of the `curriculum` monorepo — it is a standalone site that talks to the existing Digifunzi backend (`server/`) over a new public REST API layer.

---

> **STATUS UPDATE (2 Sep 2026):** The `/api/public/*` endpoints this spec describes as "not built yet" **are now live** in the main system, deployed with the 2 Sep 2026 release:
> - `POST /api/public/leads` — Enroll form (fields: `parentName`, `parentEmail`, `parentPhone?`, `learnerName?`, `learnerAge?`, `interestedIn?` = `bootcamp|project|quarky|general`, `referenceId?`, `note?`). Rate-limited 20 req / 15 min / IP. Returns `201 { success, message, data }`.
> - `POST /api/public/contact` — Contact form (fields: `name`, `email`, `phone?`, `message`). Same rate limit and response shape.
> - `GET /api/public/bootcamps` · `GET /api/public/bootcamps/:idOrSlug` · `GET /api/public/projects` · `GET /api/public/projects/:idOrSlug` — content is authored admin-side via `/api/site/*` (API only, no admin UI yet), so these return `[]` until content is entered.
>
> Server-side validation mirrors §4.5 exactly (Zod). Both `POST`s persist to a `leads` table **and** notify every admin in-app; staff triage them at the main system's admin **Enquiries** page. The landing site must be added to the main server's `PUBLIC_SITE_URL` env var (its exact origin) for browser CORS to allow the form POSTs. **§4 below is now a description of what exists, not a build request** — build the site against it directly.

---

## 1. What this project is

A public marketing/landing website for Digifunzi — the site a new visitor (parent, school administrator, or learner) sees when they search for or land on Digifunzi for the first time. Its job is to explain what Digifunzi offers, rank well on Google, and convert visitors into leads or enrollments.

It is **not** the existing learner/teacher/admin portal (`client/` in the main repo). That system stays exactly as-is, running on its own domain, for authenticated users. This new project is unauthenticated, public, and SEO-first.

### Sections required
1. **Home** — hero, value proposition, summary of all four sections below, testimonials/social proof, primary CTAs.
2. **Bootcamps** — intensive, dated programs (maps to `isProgram: true` Curricula in the main system).
3. **Competitions** — no equivalent exists in the main system yet (see §4.3) — content will be manually authored/static initially.
4. **Projects** — the courses Digifunzi teaches (maps to `Course` in the main system).
5. **Quarky** — the physical robot used across Digifunzi's courses and sold as a product. **Does not exist in the main system's database at all today** (confirmed: zero references anywhere in `server/` or `client/`). This section is net-new — see §4.4 for what the main system needs to gain before this section can be data-driven.

### Primary calls-to-action
- **Enroll / sign up** — send visitors into an enrollment flow (see §4.5 — this requires a new endpoint that doesn't exist yet).
- **Contact / inquiry form** — lead capture for schools/parents, routed to a team inbox (no automatic system record required).
- **Browse content** — the site must stand on its own as an informative catalog even for a visitor who never converts.

There is intentionally **no "login" link back into the main portal** in the current scope — this site is for people who are not yet Digifunzi users.

---

## 2. Relationship to the main system

Two entirely separate codebases/deployments, connected only by HTTP:

```
Landing page (new project)              Main system (existing, THIS repo)
  curriculum-info.digifunzi.com   --->    nodeapp.digifunzi.com
  (or similar — TBD domain)               (Express + MySQL, already live)
        |                                        |
        |--- GET /api/public/bootcamps --------->|
        |--- GET /api/public/projects ---------->|
        |--- GET /api/public/projects/:id ------>|
        |--- POST /api/public/leads ------------>|
        |--- POST /api/public/enroll ----------->|  (NEW endpoint, see §4.5)
```

**The landing page never talks to MySQL directly and never receives a JWT.** All data comes from a small set of new **public, read-only (mostly)** endpoints added to the existing `server/` codebase under a `/api/public/*` namespace — mirroring the one public precedent that already exists in this codebase (`server/src/modules/learners/public-profile.routes.js`, mounted outside the `protect` JWT middleware).

**Important — work required on the main-system side, not this new project.** The endpoints in §4 below do not exist yet. Building this landing page is a two-sided task: someone (you, or a Claude session working in the `curriculum` repo) needs to add these endpoints to `server/` first or in parallel. This spec assumes that work happens separately — the landing-page project should be built against a documented contract (§4) and a mock/stub data layer until the real API is live, so the two efforts aren't blocked on each other.

---

## 3. Tech stack

Matches the existing `client/` app's stack for team familiarity (React 19 + Vite + MUI), with SEO gaps deliberately closed rather than switching to a server-rendered framework:

| Concern | Choice | Why |
|---|---|---|
| Framework | React 19 + Vite | Same as `client/` — no new patterns for the team to learn |
| UI library | MUI (Material UI) | Same as `client/` |
| Routing | React Router | Same as `client/` |
| **SEO — meta tags** | `react-helmet-async` | Per-page `<title>`, `<meta description>`, Open Graph, Twitter Card tags — Vite/React don't do this out of the box |
| **SEO — crawlable HTML** | A prerendering step (`vite-plugin-ssr`, or a simple `puppeteer`/`vite-plugin-prerender-spa`-style post-build script) | Plain Vite SPAs ship an empty `<div id="root">` — crawlers that don't execute JS see nothing. Prerendering writes real HTML per route at build time. |
| **SEO — sitemap/robots** | Generated at build time (`sitemap.xml`, `robots.txt`) | Static files written into `dist/` by a small build script, listing every static + dynamically-fetched route (see §7) |
| **SEO — structured data** | JSON-LD (`Organization`, `Course`, `Event` for bootcamp dates, `Product` for Quarky) | Injected via `react-helmet-async` per page — improves rich-result eligibility in Google |
| Data fetching | TanStack Query (React Query) | Same library as `client/`, good fit for caching public API responses |
| Forms | react-hook-form + Zod | Same as `client/`, for the Contact/Enroll forms |
| Styling | Inline `style={{}}`, no CSS-in-JS library | Matches `client/`'s established convention — see the main repo's `CLAUDE.md` |
| Images | Optimized/responsive (`<picture>` + `loading="lazy"`, or a Vite image-optimization plugin) | Landing pages are image-heavy (hero shots, Quarky product photos) — page speed is an SEO ranking factor |
| Hosting | Static hosting (same cPanel pattern as `client/`, or Vercel/Netlify if prerendering output is simple static files) | Reuse the deployment muscle memory already documented in this repo's `Guide/DEPLOYMENT.md` |

Do **not** introduce Next.js, Redux, or any state-management library beyond React Query — this is a mostly-static marketing site, not an app.

---

## 4. API contract (new `/api/public/*` namespace on the existing server)

All endpoints below are **new work on the main-system (`server/`) side**. None of them exist yet. They should live in a new module `server/src/modules/public-site/` (or similar), mounted in `server/src/app.js` **before/outside** the `protect` middleware, the same way `public-profile.routes.js` already is. CORS on the main server must be opened to the landing page's domain specifically (not `*`), alongside the existing `CLIENT_URL` allowance.

Every list endpoint returns **only fields safe for public display** — never internal IDs used for admin linking beyond what's needed to fetch a detail page, never guardian/learner personal data, never pricing/business-internal fields unless explicitly meant to be public.

### 4.1 Bootcamps

```
GET /api/public/bootcamps
GET /api/public/bootcamps/:id
```
Backed by `Curriculum` rows where `isProgram = true`, joined through the `programs` deployment table for dates/status (see research: `program.service.js`'s existing `enrich()` logic already computes `status: upcoming|active|completed` from `startDate`/`endDate` — reuse that logic, don't duplicate it).

**Gap to flag to the backend builder:** `Curriculum` has no cover-image field today. Add `coverImage` (nullable string URL, same pattern as `Course.coverImage`) via a migration before this endpoint ships, or the Bootcamps section will have no imagery.

Response shape (list item):
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "coverImage": "string | null",
  "status": "upcoming | active | completed",
  "startDate": "date | null",
  "endDate": "date | null",
  "educationLevel": "string",
  "gradeFrom": "string",
  "gradeTo": "string"
}
```
Detail endpoint adds: full `description`, `classes[]` (names only, no learner PII), any linked `Course`s taught during the bootcamp if that link exists (check — may not).

### 4.2 Projects (Courses)

```
GET /api/public/projects
GET /api/public/projects/:id
```
Backed by `Course` (`status = "active"` only — never expose `draft`/`archived`).

**Gap to flag:** Course has no stored lesson/session count or duration field. The endpoint must compute `sessionCount` server-side via `COUNT(course_sessions WHERE courseId = ...)` at read time (cheap, fine for a public catalog with low write frequency) rather than exposing it as a stored field the landing page would have to trust is kept in sync.

Response shape (list item):
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "coverImage": "string | null",
  "ageMin": "number | null",
  "ageMax": "number | null",
  "sessionCount": "number",
  "requirements": ["string"]
}
```
Detail endpoint adds: module titles (`course_modules.name`, ordered) as a syllabus outline — not full session content (that stays behind the authenticated portal as a product decision, not a technical limitation).

### 4.3 Competitions

**No backing data model exists in the main system** (confirmed — nothing resembling a competition anywhere in `assessments` or elsewhere). Two options, pick one before implementation:

- **Option A (recommended to start):** Competitions content is **manually authored directly in the landing-page project** (a local JSON/MDX content file, or hardcoded components) — no API call at all for this section initially. Fastest to ship; revisit once there's a real recurring competitions program worth modeling in the main system.
- **Option B:** Add a genuinely new `competitions` table + admin CRUD to the main system (a real feature-build, not a spec-writing exercise) before this section can be data-driven.

This spec assumes **Option A** unless you decide otherwise — flag this explicitly to Claude when you hand off the doc so it doesn't wait on an API that was never planned to exist yet.

### 4.4 Quarky

**No backing data model exists in the main system at all** — not even a stub. Same two-option choice as Competitions:

- **Option A (recommended to start):** Static content in the landing-page project (product photos, spec sheet, "used in these course types" copy written by hand) — no API dependency.
- **Option B:** Model Quarky as a row in the existing `billing_items` catalog (`server/src/modules/settings/items/` — already has `name`, `description`, `defaultPrice`, `unit`; closest existing fit for "a sellable thing" per the research above) or as a new dedicated `products` table if it needs images/specs/variants beyond what `billing_items` offers. Either way this is new backend work, not something to expose from data that exists today.

This spec assumes **Option A** to start, same reasoning as Competitions.

### 4.5 Enroll (lead-to-signup)

```
POST /api/public/leads
```
The one endpoint this spec recommends building for real (not deferred), because "Enroll" was explicitly named as a primary CTA. Rather than trying to replicate the full authenticated `POST /api/learners` flow (admin/school-only, requires fields like `guardianPhone`, `dateOfBirth`, hub assignment — not appropriate to expose publicly or to ask a first-time visitor to fill in blind), this should be a **lead-capture endpoint**, not a direct account-creation endpoint:

```json
// Request
{
  "parentName": "string",
  "parentEmail": "string",
  "parentPhone": "string",
  "learnerName": "string",
  "learnerAge": "number",
  "interestedIn": "bootcamp | project | quarky | general",
  "referenceId": "string | null"   // e.g. the bootcamp/course id they enrolled from, if any
}
```
Stores to a new, simple `leads` table (or reuses email notification only, no storage, if you'd rather keep this fully outside the database — decide during backend implementation) and **emails/notifies the Digifunzi team**, who then follow up and create the real `Learner`+`Guardian` record through the existing admin flow once qualified. This matches how the "Contact / inquiry form" CTA should work too — the two CTAs can share this one endpoint, differentiated only by `interestedIn`.

```
POST /api/public/contact
```
Simpler general-inquiry variant if you'd rather keep Contact and Enroll fully separate: `{ name, email, phone, message }`, notify-only, no DB table needed.

### 4.6 Rate limiting & abuse protection

Both `POST` endpoints are unauthenticated and publicly reachable — apply the same rate-limiting pattern already used on `/api/auth/signup` and `/api/auth/login` (per the research: those routes are explicitly "rate-limited, not JWT-gated by design" — reuse that middleware rather than inventing a new one).

---

## 5. Site structure

```
/                          Home
/bootcamps                 Bootcamps listing
/bootcamps/:slug           Bootcamp detail
/projects                  Projects (courses) listing
/projects/:slug            Project detail
/competitions              Competitions (static content initially)
/quarky                    Quarky product page (static content initially)
/enroll                    Enroll form (posts to /api/public/leads)
/contact                   Contact form (posts to /api/public/leads or /api/public/contact)
/about                     Company story, mission — good for SEO + trust signals
/sitemap.xml               Generated at build time
/robots.txt                Generated at build time
```

Use human-readable slugs in URLs (`/projects/intro-to-robotics`, not `/projects/9f2a...`) for SEO — this means the public API list/detail endpoints in §4 should include a `slug` field (derived server-side from `name`, e.g. via a slugify utility), which is another small addition needed on the backend side beyond what's listed above.

---

## 6. Project structure (for Claude to scaffold)

```
digifunzi-landing/
├── public/
│   ├── favicon.ico
│   └── robots.txt                 (static fallback; build script may overwrite)
├── src/
│   ├── main.jsx                   Entry — wraps <App> in HelmetProvider + BrowserRouter + QueryClientProvider
│   ├── App.jsx                    Route table
│   ├── routes/
│   │   └── routes.jsx
│   ├── layouts/
│   │   ├── MainLayout.jsx         Header + Footer + <Outlet />
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── BootcampsListPage.jsx
│   │   ├── BootcampDetailPage.jsx
│   │   ├── ProjectsListPage.jsx
│   │   ├── ProjectDetailPage.jsx
│   │   ├── CompetitionsPage.jsx   Static content
│   │   ├── QuarkyPage.jsx         Static content
│   │   ├── EnrollPage.jsx
│   │   ├── ContactPage.jsx
│   │   └── AboutPage.jsx
│   ├── components/
│   │   ├── layout/                Header, Footer, Nav, MobileMenu
│   │   ├── home/                  Hero, ValueProps, TestimonialCarousel, CTABanner
│   │   ├── cards/                 BootcampCard, ProjectCard
│   │   ├── forms/                 EnrollForm, ContactForm
│   │   └── seo/                   SeoHead.jsx (wraps react-helmet-async), JsonLd.jsx
│   ├── services/
│   │   └── api.js                 Single axios instance, reads VITE_API_URL — mirrors client/src/services/api.js's pattern
│   ├── modules/                   (only if content grows enough to warrant per-section folders later — start flat under pages/ + components/)
│   ├── content/                   Static content for Competitions/Quarky (until/unless §4.3-4.4 Option B is chosen)
│   │   ├── competitions.js
│   │   └── quarky.js
│   ├── hooks/
│   │   ├── useBootcamps.js        React Query wrapper around GET /api/public/bootcamps
│   │   └── useProjects.js
│   └── styles/
│       └── global.css             Resets, print rules if any, font-face — mirrors client/src/styles/global.css
├── scripts/
│   ├── prerender.js                Post-`vite build` step: crawls route list, writes static HTML per route into dist/
│   └── generate-sitemap.js         Fetches /api/public/bootcamps + /api/public/projects at build time, writes dist/sitemap.xml
├── .env                             VITE_API_URL=http://localhost:5000 (local dev, points at the main repo's dev server)
├── .env.production                  VITE_API_URL=https://nodeapp.digifunzi.com
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## 7. SEO checklist (for Claude to action, not just note)

- [ ] Unique `<title>` and `<meta name="description">` per route via `react-helmet-async`, written for humans first (not keyword-stuffed) but including natural terms like "robotics for kids", "STEM bootcamp Kenya" (adjust to actual target region/market — ask if unclear).
- [ ] Open Graph + Twitter Card tags per page (`og:title`, `og:description`, `og:image`, `og:url`) — critical for link previews when the site is shared.
- [ ] `JSON-LD` structured data: `Organization` on every page (name, logo, sameAs social links), `Course` schema on Project detail pages, `Event` schema on Bootcamp detail pages (has real start/end dates), `Product` schema on the Quarky page.
- [ ] Prerendered/static HTML per route so crawlers see real content without executing JS (see §3 stack table).
- [ ] `sitemap.xml` generated at build time, including dynamic Bootcamp/Project detail URLs fetched from the public API (see `scripts/generate-sitemap.js` above).
- [ ] `robots.txt` allowing all crawl, pointing at the sitemap.
- [ ] Semantic HTML (`<h1>` once per page, proper heading hierarchy, `<nav>`, `<main>`, `<footer>`, alt text on every image — especially Quarky product photos).
- [ ] Core Web Vitals: lazy-load below-the-fold images, avoid render-blocking fonts (font-display: swap, matches the existing font loading pattern already in this repo's client build per the Guide build output), keep the JS bundle lean (this is a marketing site — avoid pulling in heavy libraries like the main app's `jspdf`/`html2canvas`, which have no reason to exist here).
- [ ] Mobile-first responsive design — Google indexes mobile rendering primarily.
- [ ] HTTPS only, canonical URLs (`<link rel="canonical">`) to avoid duplicate-content penalties from any trailing-slash/query-param variants.

---

## 8. Explicitly out of scope (for now)

- No authenticated area, no login, no session/cookie handling of any kind.
- No direct database access from the landing page — API only.
- No CMS/admin UI for editing landing-page content in this first version — content changes are code changes (static sections) or come live from the main system (Bootcamps/Projects). Revisit a CMS layer only if non-technical staff need to edit copy frequently.
- Competitions and Quarky data-modeling on the backend (§4.3/§4.4 Option B) — deferred until there's a concrete reason to make them dynamic.
- Payment processing for Quarky purchases — the Quarky page is informational/lead-gen only in this version, not an e-commerce checkout.
- Multi-language/i18n — single language (assume English) unless you tell Claude otherwise.

---

## 9. Open items for you to resolve before or during the build

These aren't blocking the landing-page project's own build (it can proceed against the documented contract with a mocked API layer), but need a decision at some point, ideally before real launch:

1. Final domain name for the landing page.
2. Target market/region for SEO keyword focus (affects copy tone, structured-data `Organization.address`, language).
3. Whether Competitions/Quarky should move to backend-modeled Option B, and when.
4. Who receives `/api/public/leads` / `/api/public/contact` notifications (email address/Slack webhook) and whether a `leads` table should persist submissions or the endpoint should be notify-only.
5. Brand assets (logo, color palette, font) — reuse whatever exists for the main product (`client/src/assets/` likely has a logo already, per the build output showing `Logo-image-*.png`) or is a fresh brand identity intended for the public-facing site specifically?
