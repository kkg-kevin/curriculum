# Selling an item in the website Store — content setup checklist

**Audience:** whoever manages inventory in the portal.
**Goal:** get a physical item (the Quarky robot, a kit, an accessory) showing on
the public marketing site (`africa.digifunzi.com/store`) with a price and an
"Enquire to buy" button.

The plumbing (API, website) is **done**. What's left is filling in the selling
details on an inventory item and flipping one switch.

> **The public site reads ONE designated admin's content** — the admin whose
> `users.id` is in the backend's `PUBLIC_CONTENT_ADMIN_ID` env var. Everything
> below is done **logged in as that admin**. If that var is unset, the whole
> `/store` section (and Projects, and Pathways) shows an empty state.

---

## What the website shows, exactly

`GET /api/public/store` returns that admin's `inventory` rows where
**`saleStatus = "for_sale"`**. For each one the website renders a card (name,
tagline, store category, price) and, on the detail page:

- the **Description** (plain text)
- the **Highlights** — selling-point bullets
- **What you get** — the "includes" list
- the **Specifications** table
- the price (or "Enquire for pricing" if no amount is set), with an optional
  strike-through "was" price
- an **"Enquire to buy"** button → the enquiry form, pre-filled
  (or **"Notify me when available"** if the item is pre-order / coming soon)

**Never shown:** the operational category (Robots/Electronics/…), the stock
`unit`, or anything else from the ops side — only the marketing fields below.

---

## 1. Open the item  *(Settings → Inventory → the item, or "+ Add Item")*

Fill in the shared fields as normal:

| Field | Notes |
|---|---|
| **Image** | An upload. No image → the Store card shows a brand-blue band with the name. |
| **Name** | Becomes the URL slug (`/store/<slug>`). |
| **Description** | The "About this item" copy on the detail page. |

## 2. Fill in the Selling section  *(the modal's "Selling" area)*

Tick **"For sale on the website"** to reveal these:

| Field | Notes |
|---|---|
| **Store category** | Robots & kits / Bundle / Accessory — the `/store` list filters by this |
| **Availability** | Available now / Pre-order / Coming soon — drives the button ("Enquire to buy" vs "Notify me") |
| **Short tagline** | one line under the name, e.g. "The hands-on robot at the heart of Digifunzi" |
| **Badge** *(optional)* | a short marketing tag — "Core kit", "Best value" |
| **Price** | currency + amount (whole units, e.g. `KES` `14500`) + unit ("each"). **Leave the amount blank** to show "Enquire for pricing". Add an optional strike-through "was" price and a price note. |
| **Highlights** | selling-point bullets (add each, press Enter) |
| **What you get** | the box contents / what's included |
| **Specifications** | label + value pairs — the spec table |

**Save.** It's live immediately — no publish step, no deploy.

---

## 3. Verify

```bash
BASE=https://nodeapp.digifunzi.com        # or dcf-api for Live
SLUG=<the-item-slug>                       # slugify(item name)

curl -s "$BASE/api/public/store" | jq '.[].slug'          # is it listed?
curl -s "$BASE/api/public/store/$SLUG" | jq '{name, price, highlights: (.highlights|length), specs: (.specs|length)}'
```

On the live site: `/store` shows the card; `/store/<slug>` shows the highlights,
"what you get" and specs; "Enquire to buy" lands a **lead** in the portal's
Enquiries page (`interestedIn: "quarky"` for a kit, `"general"` otherwise; the
item name resolved on the card, `referenceType: "store_item"`).

### A sample item

`node server/src/scripts/seedSampleStoreItem.js` creates a "Quarky Robot Kit"
marked for sale (idempotent) so the Store isn't empty on first load.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| The whole `/store` section is empty | No item is marked for sale, **OR** `PUBLIC_CONTENT_ADMIN_ID` isn't set on the backend (also breaks Projects + Pathways). |
| An item you flipped "for sale" isn't showing | It's under a different admin than `PUBLIC_CONTENT_ADMIN_ID`, or `saleStatus` didn't save (re-open, re-tick, Save). |
| "The Selling section isn't there" | It's collapsed — it only expands once "For sale on the website" is ticked. |
| Card shows "Enquire for pricing" | No price amount is set — add one in the Selling section, or leave it if that's intended. |
| The card has no category chip / doesn't filter | No **Store category** is set on any for-sale item. The `/store` filter chips only appear when 2+ categories are present. |
| Detail page has no highlights / specs | Those lists are empty — add them in the Selling section. |
| Enquiries card shows a bare slug, not the item name | The item was renamed or un-flipped after the lead came in. Label-only; the lead itself is fine. |

See `Guide/WEBSITE_INTEGRATION_CONTRACT.md` §3.10 / §3.11 for the exact API shapes,
and `Guide/PROJECT_SALE_SETUP.md` for the sibling "sell a Project" feature.
