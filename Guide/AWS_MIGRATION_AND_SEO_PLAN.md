# Digifunzi: moving to AWS, then SEO

25 Nov 2026 · Shared version: https://claude.ai/artifact/Bhu1gEoMcP76q3SckvutD1

## Summary

Move to AWS first, and start the SEO work that doesn't depend on hosting right away. Speed and uptime count towards Google ranking and come from the host, so tuning them on cPanel would be done twice. Content, Google Business Profile and links from other sites take 3–6 months to pay off, so they start now.

1. **Now:** Google Search Console, Google Business Profile, a record of where we stand today, and the first content pages.
2. **Migration step 1 — the websites:** digifunzi.co.ke and africa.digifunzi.com onto AWS file storage behind AWS's content-delivery network (S3 + CloudFront). Low risk, and the quickest speed gain.
3. **Migration step 2 — the systems:** the portal, its API, database, uploaded files and scheduled jobs onto AWS. The harder part; cPanel stays running until AWS is proven.
4. **After the move:** technical SEO on the new host (page speed scores, images, caching), then content and links for good.

The one rule through all of it: **every page address and the domain stay exactly the same.** A migration that changes addresses can undo months of SEO.

## Where we are today

Everything runs on one Truehost cPanel server (102.212.246.83), so one fault there takes every site down. On 19 Nov 2026 the whole server was unreachable, every domain at once.

| What | Live | Dev | On cPanel as |
| --- | --- | --- | --- |
| Public website | digifunzi.co.ke | africa.digifunzi.com | Pre-built files + `.htaccess` |
| Portal (staff, educators, parents, learners) | dcf.digifunzi.com | curriculum.digifunzi.com | Pre-built files + `.htaccess` |
| API | dcf-api.digifunzi.com | nodeapp.digifunzi.com | cPanel Node.js app (Node 22) |
| Database | its own MySQL database | its own MySQL database | cPanel MySQL |
| Uploaded files | `uploads/` beside the API | `uploads/` beside the API | Folder, incl. private `.expenses` and `.connect` |
| Scheduled jobs | 10 cron jobs | same | cPanel Cron Jobs |

The Capable installation is separate again, with its own database. Email goes out through Brevo and doesn't depend on the host. The digifunzi.com DNS is edited in cPanel today.

**SEO already done (15 Oct 2026):** pages are pre-rendered so Google reads real content, a sitemap is built with each release, the dev website tells Google not to index it, the home page heading names what we do ("Robotics, AI & coding for kids in Kenya"), and the site carries Google's business details (EducationalOrganization + LocalBusiness). Enquiries record where each family came from.

**Still open from then:** Google Search Console and Google Business Profile (not set up), a lighter hero image, a proper 1200×630 share image, the business's map position and opening hours, letting hub pages be indexed, and what to do with digifunzi.com (send it to digifunzi.co.ke, or not).

## Part 1 — SEO to start now

None of this depends on the host, so it carries over to AWS untouched as long as the domain and page addresses stay the same.

**Measure first (week 1)**

- [ ] Add digifunzi.co.ke to Google Search Console (verify with a DNS TXT record) and submit `https://digifunzi.co.ke/sitemap.xml`.
- [ ] Add Bing Webmaster Tools (it can import from Search Console in one step).
- [ ] Set up Google Analytics 4, or confirm it's already on the site, so enquiries and sign-ups can be counted as goals.
- [ ] Record a baseline before anything moves: pages indexed, the 20 search phrases we want to rank for and our position on each, and PageSpeed Insights scores for the home page and one programme page (phone and computer). Without it, nobody can tell whether the migration hurt or helped.

**Be found locally (weeks 1–2)** — for "coding classes near me" searches, the map listing matters more than the website.

- [ ] Claim a Google Business Profile for each physical hub: exact address, phone, opening hours, photos, the programmes run there, and a link to that hub's page.
- [ ] Keep the name, address and phone identical everywhere (website, profile, Facebook, directories).
- [ ] Ask parents who are happy for a Google review after a course ends; reply to every review.
- [ ] Fill the map position and opening hours in the website's business details (still empty).

**Pages people search for (ongoing, from week 2)**

- [ ] One page per programme and town people search for, e.g. "coding classes for kids in Nairobi", "robotics holiday bootcamp Kenya", "home schooling tech curriculum Kenya". Each with its own title, a clear first paragraph, prices or "from" prices, a hub list and an enquiry button.
- [ ] Let hub pages be indexed, one per hub with its address and map.
- [ ] Two to four articles a month answering parents' questions ("What age should a child start coding?", "Scratch vs Python for a 9-year-old", "CBC and digital literacy"), each linking to the programme it relates to.
- [ ] Put the parent comments already on the home page (Testimonials) to work on programme pages too.

**On-page fixes (weeks 1–3)**

- [ ] A unique title (under 60 characters) and description (under 155) on every page; one main heading per page.
- [ ] The hero image as WebP, with width and height set, and a 1200×630 share image for WhatsApp and Facebook previews.
- [ ] Decide digifunzi.com: if it's the same business, redirect it permanently (301) to digifunzi.co.ke so the two don't compete.

**Links from other sites (ongoing)** — schools we work with, partner hubs, competition and event listings, Kenyan parenting and education blogs, local news coverage of bootcamps and competitions. A few relevant Kenyan links beat many unrelated ones.

## Part 2 — Migration step 1: the websites

The websites and the portal's front end are pre-built files, so they move to S3 (file storage) behind CloudFront (AWS's content-delivery network) with no server to run. Visitors are served from an edge location near them instead of one shared server, which is the quickest speed gain of the whole project.

**Do first: move the DNS.** The domains' DNS records live on the cPanel server today. When cPanel is switched off, they go with it, including the email records (MX, SPF, DKIM, the Brevo TXT record that was lost once before).

1. Export every record of digifunzi.co.ke and digifunzi.com from cPanel → Zone Editor.
2. Recreate them in Route 53 (AWS's DNS) or at the registrar, every record, then check them against the export line by line.
3. Point the domains' name servers at the new DNS. Nothing visible changes: the records still point at cPanel.

**Then the website**

1. Create an S3 bucket per site (private, reached only through CloudFront) and a CloudFront distribution per site, with an HTTPS certificate from AWS Certificate Manager (it must be made in the us-east-1 region for CloudFront).
2. Rebuild what `.htaccess` does today as a CloudFront Function, because AWS doesn't read `.htaccess` (table below).
3. Upload the same build that's live on cPanel, and test it on the CloudFront address before any DNS change: every page in the sitemap, a missing page, a share preview, a sign-up form (the API's `PUBLIC_SITE_URL` already allows the domain, since the domain doesn't change).
4. A day before switching, lower the DNS cache time (TTL) of the site's records to 300 seconds.
5. Switch the site's DNS record to CloudFront. Keep cPanel serving the same files for a week, so anyone still sent there gets the same site.
6. Same day: check Search Console (no new errors), resubmit the sitemap, run PageSpeed Insights and compare with the baseline.
7. Do the dev site (africa.digifunzi.com) first, as the rehearsal; then digifunzi.co.ke; then the two portals.

**What `.htaccess` does today, and its AWS equivalent**

| Rule today | Why it matters | On AWS |
| --- | --- | --- |
| www → no www, http → https (301) | One address per page for Google | CloudFront: redirect HTTP to HTTPS; Function: www → apex |
| /quarky → /store, /projects → /store… (301) | Old links keep their ranking | Function: the same 301s |
| /pathways → /pathways/index.html | Pre-rendered pages reach Google | Function: add `index.html` to folder addresses |
| New pathways, bootcamps, sign-up, cart, pay → 200.html | Pages added since the last build still open | Function: the same route list → `/200.html` |
| Anything else → a real 404 with 404.html | Google doesn't index junk addresses | CloudFront custom error page for 404 |
| Dev site: `X-Robots-Tag: noindex` | Dev never competes with live in Google | Response-headers policy on the dev distribution only |
| Fingerprinted files cached a year, `index.html` never | Fast repeat visits; new releases seen at once | Cache-Control set on upload per file type |
| Portal: page routing, missing `/assets/` file = 404 | An open tab reloads after a release | Function on the portal distributions |

**Releases afterwards:** the build is uploaded with one command (`aws s3 sync`) plus a CloudFront cache refresh of `index.html`, instead of zipping and extracting in cPanel. A simpler alternative is AWS Amplify Hosting, which takes these rules as a settings file; it costs a little more and gives less control over caching.

## Part 3 — Migration step 2: the systems

Move each installation as it is, with no code changes: same Node version, same database engine, files on disk, same cron commands, same addresses. Improvements (files on S3, several servers) come after it's stable on AWS.

**What goes where**

| Part | Today on cPanel | On AWS (first move) |
| --- | --- | --- |
| API | cPanel Node.js app | One EC2 server: Node 22, run by PM2 (restarts it if it stops), nginx in front for HTTPS |
| Database | cPanel MySQL | RDS (managed database) with the same engine and version, daily automatic backups kept 7–14 days |
| Uploaded files | `uploads/` beside the app | The same folder on the EC2 server's disk, with daily disk snapshots; moving to S3 later needs code changes |
| Scheduled jobs | cPanel Cron Jobs | `crontab` on the EC2 server, the same commands and times |
| Email | Brevo | Brevo, unchanged (AWS blocks port 25; Brevo's API or port 587 are fine) |
| HTTPS | AutoSSL | Let's Encrypt on nginx, or a load balancer with an AWS certificate |

**The steps, for each installation (dev first as the rehearsal, then live, then Capable)**

1. **Check the database engine.** Run `SELECT VERSION();` on cPanel. If it says MariaDB, use RDS for MariaDB, not MySQL: the newer tables use a newer collation, and a different engine may not accept it.
2. **Build the server:** EC2 in the chosen region, Node 22, PM2, nginx, the app's folder, `npm install`.
3. **Copy the settings** (`.env`) exactly, only `DB_HOST` / `DB_USER` / `DB_PASSWORD` changing to the RDS ones. Keep `JWT_SECRET` and `PASSWORD_VAULT_KEY` identical: a new `JWT_SECRET` signs everyone out, and makes the kept copies of children's login passwords unreadable. Set `TRUST_PROXY=1` (nginx sits in front).
4. **Rehearse the data copy:** a full dump of the cPanel database restored into RDS, and `uploads/` copied with its hidden `.expenses` and `.connect` folders. Time how long it takes: that's the length of the switch-over window.
5. **Test on AWS with the copy:** sign in as each role, open a report, upload a file, run each cron command once by hand, send a test email.
6. **Switch over** (a quiet evening, announced to families and staff): stop the cPanel app → final database dump and `uploads/` copy → restore on AWS → start the app → point the API's DNS record (e.g. dcf-api.digifunzi.com) at the EC2 server → check `/health` → sign-in, payment notice and enquiry tests → turn the crons on in AWS and off in cPanel.
7. **Keep cPanel for 2–4 weeks**, stopped, untouched, as the way back.

**Rolling back:** point the API's DNS back at cPanel and start the app there. Anything saved on AWS after the switch would be lost, so decide inside the window: once families are using it on AWS, fix forward instead.

**The scheduled jobs to recreate**

| Command | How often |
| --- | --- |
| `npm run mail:process` | every few minutes |
| `npm run billing:process` | hourly |
| `npm run checkins:process` | hourly (events, covers, clashes too) |
| `npm run qa:process` | hourly |
| `npm run enquiries:process` | daily, mornings |
| `npm run educators:stats` | nightly |
| `npm run analytics:weekly` | Monday mornings |
| `npm run rankings:weekly` | Monday mornings |
| `npm run mpesa:reconcile` | every 5 minutes, once M-Pesa is live |

Copy the exact times from cPanel → Cron Jobs before switching; this list is from the release notes.

**M-Pesa:** Safaricom calls the API's address. That address doesn't change, so nothing needs re-registering, but test one payment after the switch.

**Where the data lives:** AWS has no region in Kenya; the nearest is Cape Town (af-south-1). Learners' and parents' personal data would be held outside Kenya, which the Data Protection Act 2019 allows only with safeguards. Check what that requires for children's data before choosing the region, and record the decision.

## Part 4 — Technical SEO after the move

Once the websites are on CloudFront, tune them against Google's page-experience scores (Core Web Vitals), measured on phones, since most Kenyan parents search on a phone.

| Score | Google's "good" | What usually fixes it here |
| --- | --- | --- |
| Largest Contentful Paint (main content shows) | under 2.5 s | Hero image as WebP at the size shown, preloaded; text visible before the font arrives |
| Interaction to Next Paint (page answers a tap) | under 200 ms | Smaller start-up script: load sign-up forms, the store and maps only on the pages that use them |
| Cumulative Layout Shift (page doesn't jump) | under 0.1 | Width and height on every image; space kept for the WhatsApp button and pop-ups |

**After the switch, weekly for the first month**

- [ ] Search Console → Pages: no rise in "Not found" or "Server error"; indexed pages back to the baseline.
- [ ] Search Console → Core Web Vitals and PageSpeed Insights against the baseline.
- [ ] Positions for the 20 tracked phrases against the baseline. A dip in the first 2–3 weeks is normal; a drop that lasts means something was missed.
- [ ] Uptime check on the website and each API (`/health`) with an alert by email or SMS: CloudWatch, or a free external monitor.

**For good**

- [ ] Images through CloudFront with long cache times; course and pathway pictures resized on upload.
- [ ] Every release keeps the sitemap complete: a page that fails to pre-render fails the build (already in place since 15 Oct).
- [ ] Content and links from Part 1 carry on: they are what moves rankings over months, once the site is fast and reliable.

## Timeline, people, costs, risks

About 10 weeks from the start date to switching cPanel off, if nothing slips. The live system moves only once the dev rehearsal has passed end to end.

| Lane | Work | Weeks |
| --- | --- | --- |
| SEO | Search Console, Business Profile | 1–2 |
| SEO | Content: pages and articles | 2–10, then ongoing |
| Websites | Move DNS off cPanel | 2 |
| Websites | Dev website on CloudFront | 2–3 |
| Websites | Live website and portals | 3–4 |
| Systems | Dev system rehearsal | 4–5 |
| **Go / no-go** | **Dev rehearsal passed** | **start of 6** |
| Systems | **Live system switch-over** | 6 |
| Systems | Capable switch-over | 7 |
| Systems | cPanel switched off | 10 |
| After the move | Speed tuning and monitoring | 6–9 |

The weeks are a plan, not a deadline: if the rehearsal finds problems, the live switch moves and everything after it moves with it.

**Who does what**

| Work | Who |
| --- | --- |
| AWS account (owner, billing, two-factor sign-in, a monthly spending alert) | Digifunzi management |
| DNS export, Search Console, Business Profiles, reviews | Digifunzi team |
| Content pages and articles | Digifunzi marketing |
| CloudFront rules, deploy scripts, server and cron setup, the switch-over checklist, speed fixes in code | Claude, with the developer who holds the AWS access |
| Switch-over evening and the tests after it | Developer + one person from operations |

**Costs to expect (approximate, per month)**

| Item | Live | Notes |
| --- | --- | --- |
| EC2 server for the API | US$15–20 | A small instance; grows with traffic |
| RDS database | US$15–25 | Smallest size, 20 GB, daily backups |
| Disk snapshots | US$2–5 | Daily, kept 2 weeks |
| S3 + CloudFront (websites, portal) | US$1–5 | At today's traffic |
| Route 53 DNS | US$1 | About US$0.50 per domain |
| **Total, live** | **about US$35–55** | Cape Town region costs roughly a fifth to a third more |

These are from memory, not a quote: check them in the [AWS Pricing Calculator](https://calculator.aws/) for the chosen region. Dev and Capable could share one server and one database server (separate databases) to keep the total for all three near US$80–120 a month.

**Risks**

| Risk | What happens | Prevented by |
| --- | --- | --- |
| A page address changes | Rankings drop for months | Same domain and paths; every sitemap page tested on CloudFront first |
| A DNS record is missed | Email stops (MX, SPF, DKIM, Brevo) | Export from cPanel, recreate, compare line by line |
| `JWT_SECRET` or `PASSWORD_VAULT_KEY` changes | Everyone signed out; children's kept passwords unreadable | `.env` copied exactly |
| Different database engine or version | Restore fails, or new tables error | `SELECT VERSION();` first; same engine on RDS |
| Hidden upload folders left behind | Expense receipts and Connect files lost | Copy `uploads/` with `.expenses` and `.connect`; compare file counts |
| Cron jobs on both hosts, or neither | Duplicate emails, or invoices not raised | AWS on and cPanel off in the same step |
| One server fails | Portal down until restored | Daily snapshots and a written restore; a second server later |

**Decisions needed before week 1**

- [ ] Which AWS region, given the Data Protection Act (Cape Town is nearest; all are outside Kenya).
- [ ] Who owns the AWS account and pays for it.
- [ ] Are there @digifunzi.co.ke or @digifunzi.com mailboxes on cPanel? If yes, they need a new home (Google Workspace, Zoho Mail or Amazon WorkMail) before cPanel goes.
- [ ] digifunzi.com: redirect permanently to digifunzi.co.ke, or keep it separate.
- [ ] When the Truehost plan renews: the latest date cPanel can be switched off.
- [ ] Whether dev and Capable share one server to save cost.
