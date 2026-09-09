# Selling a Project on the website — content setup checklist

**Audience:** whoever authors assessments in the portal.
**Goal:** get a build **Project** showing on the public marketing site
(`africa.digifunzi.com/projects`) with a price and an "Enquire to buy" button.

The plumbing (API, website) is **done**. What's left is authoring the project and
flipping one switch.

> **The public site reads ONE designated admin's content** — the admin whose
> `users.id` is in the backend's `PUBLIC_CONTENT_ADMIN_ID` env var. Everything
> below is done **logged in as that admin**. If that var is unset, the whole
> `/projects` section (and Pathways) shows an empty state.

---

## What the website shows, exactly

`GET /api/public/projects` returns that admin's assessments where
**`type = "project"` AND `saleStatus = "for_sale"`**. For each one the website
renders a card (name, tagline, level, age, price, "N steps · N things to build")
and, on the detail page:

- the **Description** and **Project Overview** (flattened to plain text)
- the **Milestones**, in order — shown as the numbered build steps
- the **Deliverables** — shown as "What you'll build"
- the **linked inventory** — shown as "What you'll need"
- the price, or "Enquire for pricing" if no price is set
- an **"Enquire to buy"** button → the enquiry form, pre-filled

**Never shown:** the grading rubric, correct answers, indicator marks, any
scoring — only the marketing-facing content above.

---

## 1. Build the Project  *(Assessments → New → Project)*

Author it like any Project assessment. For the public page to be useful, fill in:

| Tab | What to add |
|---|---|
| **Assessment Information** | **Name** (becomes the URL slug), **Description** (the "About this project" copy), **Project Overview** (a second paragraph — how it's structured) |
| **Deliverables & Milestones** | **Milestones** in the order a learner works through them (these become the numbered steps). **Deliverables** — the finished things they'll have made. |
| **Inventory** *(optional)* | Link the physical kit a buyer needs (e.g. Quarky robot). Shows as "What you'll need". |

## 2. Flip it "For sale"  *(Assessment Information tab → Selling panel)*

The **Selling** card only appears for a **Project** (not quiz / exam / assignment
/ observation — the backend refuses those too).

| Field | Notes |
|---|---|
| **For sale on the website** | ✅ tick this — the one switch that makes it public |
| **Cover Image** | optional — an upload. No image → the card shows a brand-blue band with the name. |
| **Short Tagline** | one line under the name on the card, e.g. "Make a model room that reacts to you" |
| **Price** | currency + amount (whole units, e.g. `KES` `1800`). **Leave the amount blank** to show "Enquire for pricing". Add a price note ("One-time purchase — lifetime access"). |
| **Level** | Beginner / Intermediate / Advanced — the `/projects` list filters by this |
| **Age Range** | optional min–max, e.g. `8` to `12` |

**Save.** It's live immediately — no publish step, no deploy.

---

## 3. Verify

```bash
BASE=https://nodeapp.digifunzi.com        # or dcf-api for Live
SLUG=<the-project-slug>                    # slugify(project name)

curl -s "$BASE/api/public/projects" | jq '.[].slug'          # is it listed?
curl -s "$BASE/api/public/projects/$SLUG" | jq '{name, price, milestones: (.milestones|length), deliverables: (.deliverables|length)}'
```

On the live site: `/projects` shows the card; `/projects/<slug>` shows the build
steps and price; "Enquire to buy" lands a **lead** in the portal's Enquiries page
(`interestedIn: "project"`, the project name resolved on the card).

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| The whole `/projects` section is empty | No project is marked for sale, **OR** `PUBLIC_CONTENT_ADMIN_ID` isn't set on the backend (also breaks Pathways). |
| A project you flipped "for sale" isn't showing | It's under a different admin than `PUBLIC_CONTENT_ADMIN_ID`, or `saleStatus` didn't save (re-open, re-tick, Save). |
| "The Selling panel isn't there" | You're editing a non-Project assessment. Only `type: project` has it. |
| Card shows "Enquire for pricing" | No price amount is set — add one in the Selling panel, or leave it if that's intended. |
| Detail page has no build steps | The project has no **Milestones** — add them in the Deliverables & Milestones tab. |
| Enquiries card shows a bare slug, not the project name | The project was renamed or un-flipped after the lead came in. Label-only; the lead itself is fine. |

See `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.3 / §3.4 for the exact API shapes.
