# Selling a Bootcamp on the website — content setup checklist

**Audience:** whoever authors Programs in the portal.
**Goal:** get a **Bootcamp** (a short-run Program) showing on the public marketing
site (`africa.digifunzi.com/bootcamps`) with a price and an "Enquire to book"
button.

The plumbing (API, website) is **done**. What's left is authoring the Program and
flipping one switch.

> **The public site reads ONE designated admin's content** — the admin whose
> `users.id` is in the backend's `PUBLIC_CONTENT_ADMIN_ID` env var. Everything
> below is done **logged in as that admin**. If that var is unset, the whole
> `/bootcamps` section (and Projects, Store and Pathways) shows an empty state.

---

## What a "bootcamp" is, here

A bootcamp is a **Program curriculum** — a `curricula` row flagged **"This is a
Program"** on its Structure step. It's authored through the exact same flow as any
curriculum (Basic Info → Structure → Competencies → Version Control); the Program
flag just lists it under **Programs** instead of the main Curriculum list and lets
it be deployed to a hub for a fixed date range.

Selling it on the website is a for-sale flag on that same Program — the direct
parallel to "sell a Project" (a flag on an assessment) and "sell an Inventory
item" (a flag on an inventory row). **The Program still runs and deploys exactly
as before whether or not it's listed** — the flag only controls website
visibility.

---

## What the website shows, exactly

`GET /api/public/bootcamps` returns that admin's `curricula` rows where
**`isProgram = 1` AND `saleStatus = "for_sale"`**. For each one the website
renders a card (name, tagline, format, duration, age, price) and, on the detail
page:

- the Program's **Description** (from Basic Info — flattened to plain text)
- the **"What you'll build"** highlights you add in the Selling card
- the **Upcoming runs** — every hub this Program is currently deployed to whose
  end date hasn't passed, with the dates (finished runs are hidden)
- the price, or "Enquire for pricing" if no amount is set
- an **"Enquire to book"** button → the enrolment form, pre-filled

**Never shown:** the Program's structure, grades/cohorts, competency framework,
course list or version content — only the marketing-facing fields above.

---

## 1. Author the Program  *(Curriculum → New, then Structure → "This is a Program")*

Author it like any curriculum. For the public page to be useful, fill in:

| Step | What to add |
|---|---|
| **Basic Info** | **Name** (becomes the URL slug), **Description** (the "About this bootcamp" copy) |
| **Structure** | Tick **"This is a Program"**. Add the cohort(s) so it can be deployed. |
| *(later)* **Deploy to Hub** | From the Program view — pick a hub and set the run's start/end dates. Each deployment shows on the website as an "upcoming run" until its end date passes. |

## 2. Flip it "List on the website"  *(Program view → Selling card)*

Open the Program (Programs → the bootcamp). The **Selling** card is near the
bottom. It only exists on a Program view — a regular curriculum can't be listed
(the backend refuses `saleStatus: "for_sale"` on a non-Program).

| Field | Notes |
|---|---|
| **List on the website** | ✅ tick this — the one switch that makes it public. Saves immediately. |
| **Cover image** | optional — an upload. No image → the card shows a brand-blue band with the name. |
| **Short tagline** | one line under the name, e.g. "A full robot build, coded and driven, in one week" |
| **Format** | Holiday / Weekend / After school / Online — the `/bootcamps` list filters by this |
| **Duration** | free text, e.g. "1 week", "4 Saturdays" |
| **Price** | currency + amount (whole units, e.g. `KES` `12000`). **Leave the amount blank** to show "Enquire for pricing". Add a price note. |
| **Age range** | optional min–max, e.g. `9` to `14` |
| **What you'll build / learn** | selling-point bullets (type each, press Enter) |

Press **Save selling details** for the fields below the switch. It's live
immediately — no publish step, no deploy.

---

## 3. Verify

```bash
BASE=https://nodeapp.digifunzi.com        # or dcf-api for Live
SLUG=<the-bootcamp-slug>                   # slugify(program name)

curl -s "$BASE/api/public/bootcamps" | jq '.[].slug'          # is it listed?
curl -s "$BASE/api/public/bootcamps/$SLUG" | jq '{name, price, highlights: (.highlights|length), runs: (.upcomingRuns|length)}'
```

On the live site: `/bootcamps` shows the card; `/bootcamps/<slug>` shows the
highlights, price and upcoming runs; "Enquire to book" lands a **lead** in the
portal's Enquiries page (`interestedIn: "bootcamp"`, the bootcamp name resolved on
the card, `referenceType: "bootcamp"`).

### A sample bootcamp

`node server/src/scripts/seedSampleForSaleBootcamp.js` creates a "Robot Builders
Holiday Bootcamp" Program marked for sale (idempotent) so the section isn't empty
on first load. Deploy it to a hub afterward to give it a real "upcoming run".

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| The whole `/bootcamps` section is empty | No Program is listed for sale, **OR** `PUBLIC_CONTENT_ADMIN_ID` isn't set on the backend (also breaks Projects / Store / Pathways). |
| A bootcamp you listed isn't showing | It's under a different admin than `PUBLIC_CONTENT_ADMIN_ID`; or it isn't flagged "This is a Program"; or `saleStatus` didn't save (re-open, re-tick, Save). |
| "The Selling card isn't there" | You're on a regular Curriculum view, not a Program view. Only Programs have it. |
| Card shows "Enquire for pricing" | No price amount is set — add one in the Selling card, or leave it if that's intended. |
| Detail page has no "Upcoming runs" | The Program isn't deployed to any hub yet, or every deployment's end date has passed. Deploy it (Program view → Deploy to Hub). The bootcamp still lists and sells without one. |
| The card has no format chip / doesn't filter | No **Format** is set on any for-sale bootcamp. The `/bootcamps` filter chips only appear when 2+ formats are present. |
| Enquiries card shows a bare slug, not the bootcamp name | The Program was renamed or un-listed after the lead came in. Label-only; the lead itself is fine. |

See `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.1 / §3.2 for the exact API shapes,
and `Guide/PROJECT_SALE_SETUP.md` / `Guide/STORE_SETUP.md` for the sibling
"sell a Project" and "sell an Inventory item" features.
