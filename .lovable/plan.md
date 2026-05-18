# Hookle vs Archer — Analysis and Action Plan

## What Hookle does well

Hookle's homepage is built end-to-end around the **customer's emotional journey**, not the product's feature list. Every section answers a question the small business owner is already asking.

1. **Pain-first hook.** "2 out of 3 small business owners struggle with social media marketing." Big stat, instant empathy.
2. **Named villains.** Two clear "enemies": complex pro tools (frustration) and expensive agencies (empty wallet). Each gets a photo + emoji reactions.
3. **"Thankfully, there is Hookle" reveal.** A relief moment — the brand arrives as the rescue.
4. **A scrolling "who uses it" reel** of plain-language personas (Realtor, Restaurant, Photographer, Coffee bar, Brewery, Airbnb host…) — 130+ countries. Reader instantly self-identifies.
5. **Phone-in-hand product shots** that show the *actual* in-app experience (Social Score, Recent Posts, planner), not abstract dashboards.
6. **"With Hookle vs Without Hookle"** side-by-side checklist — concrete, scannable, emotional.
7. **Feature walkthrough as alternating image+text strips** — one job at a time, screenshot beside it.
8. **Star-rating + customer quotes** woven throughout (not bunched in one testimonial section).
9. **Single repeated CTA** ("Get Started Free") that appears after every emotional beat.
10. **Warm, confident, plain-English voice** — zero jargon, written *to* the owner.

## What Archer has today

- Strong B2B/agency-replacement positioning, ROI math, and enterprise credibility.
- Hero, Solution (4 tiles), WhyNow, Pricing teaser, big CTA.
- Voice is sharper / more "operator" than Hookle's warm/relief tone.
- **Missing:** the emotional customer-journey arc, the "day in the life" walkthrough, persona self-identification, product UI screenshots, and a dedicated "what your week looks like with Archer" page.

## What we'll change to feel more like Hookle

### A. Add a new page: `/experience` ("A Week With Archer")

A dedicated **client-experience page** that walks a dentist through what their actual experience feels like — Monday through Friday, 20 minutes total. This is the Hookle-style narrative Archer is currently missing.

Structure of the page:

```text
Hero            : "What your week looks like with Archer."
Persona strip   : "Solo practice · Group · DSO · Pediatric · Ortho · Cosmetic"
Day 1 (Mon)     : "Open the dashboard. Approve this week's campaign." + UI shot
Day 2 (Tue)     : "Archer posts to FB / IG / GMB / TikTok." + phone shot
Day 3 (Wed)     : "Review replies Archer drafted in your voice." + chat shot
Day 4 (Thu)     : "New patient leads land in your inbox." + lead shot
Day 5 (Fri)     : "Read the 1-page weekly report." + PDF shot
With/Without    : "With Archer vs Without Archer" comparison checklist
Voices          : 2–3 dentist quotes with star ratings
CTA             : "See Archer build your week — free."
```

Add a **"Client Experience"** menu item to the header (between Features and Pricing) that links here.

### B. Refresh the Home page with Hookle-style beats

Insert two new sections into `src/pages/archer/Home.tsx` without removing existing content:

1. **"Why most practices struggle"** — after the Hero, before the Problem/Promise block. Big stat ("4 out of 5 independent practices say marketing is their #1 frustration"), two villain cards (Agencies / DIY) with photo + emoji reaction, then the "Thankfully, there's Archer" relief line.
2. **Persona marquee** — scrolling row of practice types ("Family dentistry · Pediatric · Ortho · Cosmetic · Implants · Endo · Perio · Group · DSO · Mobile · Concierge") so visitors instantly self-identify, mirroring Hookle's 130+ countries reel.
3. **"With Archer / Without Archer" comparison** — two-column checklist styled like Hookle's. Replaces or augments the current Problem/Promise block with a more visual, scannable layout.
4. **Product-shot strip** — three or four real Archer screenshots (dashboard, campaign card, landing page preview) framed in a phone/laptop mockup, anchoring the abstract claims to a concrete UI.

### C. Tone & copy adjustments

- Add a warmer, relief-driven second voice alongside the existing operator tone. Hookle: "Thankfully, there is Hookle." Archer equivalent: "Finally — marketing that runs itself."
- Repeat the primary CTA after each emotional beat (Hookle pattern), not just at the top and bottom.
- Add small star-rating badges next to quotes wherever testimonials appear.

### D. Header nav update

```text
Features ▾   Client Experience   Pricing   Why Archer   About   FAQ
```

New entry **"Client Experience"** → `/experience`. Mobile menu mirrors it.

## Technical details

- New route: `src/pages/archer/Experience.tsx`, registered in `src/App.tsx` as `/experience`.
- New components in `src/components/archer/`:
  - `WeekWithArcher.tsx` — 5-day timeline with alternating image/text rows.
  - `PersonaMarquee.tsx` — auto-scrolling horizontal strip (CSS animation, no library).
  - `WithWithoutArcher.tsx` — two-column comparison (reuse on Home and Experience).
  - `ProductShotStrip.tsx` — phone/laptop framed screenshots.
  - `PainReveal.tsx` — "villains + relief" section for Home.
- Update `src/components/archer/Header.tsx` to add the "Client Experience" link (desktop nav + mobile sheet).
- Reuse existing tokens (`primary`, `accent`, `text-gradient`, `mesh-bg`, `archer-blue-gradient`). No new color tokens needed.
- Screenshots: use existing product UI captures if available; otherwise placeholders sized for phone (285×576) and laptop (1280×800) matching Hookle's framing.

## Out of scope

- No backend, auth, or data-model changes.
- No pricing changes.
- No removal of existing pages or sections — this is additive.
