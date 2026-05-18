# Archer — Customer-Experience Refresh Plan

## What's missing on Archer today (gap analysis)

Archer's site is sharp and operator-focused, but the homepage reads as a feature list rather than a story told from the dentist's chair. The gaps we'll close:

1. **Pain-first emotional hook.** A big, empathetic stat that names the frustration before pitching the fix.
2. **Named villains, not just bullet points.** Two clear "enemies" (overpriced agencies, time-eating DIY) with imagery and human reaction — not just text rows.
3. **A relief moment.** A warm, brand-led pivot like *"Thankfully, Archer is designed for you and fits easily into any busy practice."*
4. **Self-identification reel.** A scrolling row of practice types so visitors instantly think *"that's me."*
5. **Real product shots** in phone/laptop frames — the actual Archer UI, not abstract dashboards.
6. **With/Without Archer** side-by-side checklist — scannable and concrete.
7. **Feature walkthrough as alternating image+text strips** — one job at a time, screenshot beside it.
8. **Star-rated micro-quotes** woven through the page, not bunched into one block.
9. **Repeated primary CTA** after every emotional beat.
10. **Warm, plain-English voice** alongside the existing operator tone — written *to* the dentist, not about them.

## What we'll add

### A. New page: `/experience` ("A Week With Archer")

A dedicated **client-experience page** that walks a dentist through what their actual week feels like — 20 minutes total, Monday through Friday. This is the empathetic, narrative arc Archer is currently missing.

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
