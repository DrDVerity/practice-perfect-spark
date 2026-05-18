# Hero Refresh + Archer vs. Hookle Capability Match

## 1. Hero background — darker & more transparent

In `src/components/archer/Hero.tsx` the hero currently layers:

- A background image (`hero.jpg`)
- A solid navy overlay: `bg-[#001f5b]/50`
- A `mesh-bg` at `opacity-60`
- A top accent gradient

Change:

- Replace the navy overlay with a **darker, more transparent** treatment — a vertical gradient from deep navy to near-black, lower opacity at the top so the photo still breathes through, denser at the bottom for text legibility:
  - `bg-gradient-to-b from-[#001028]/65 via-[#000814]/75 to-[#000814]/90`
- Drop `mesh-bg` opacity from `60` to `30` so the photo dominates instead of pastel mesh.
- Keep the white headline and gold accent — contrast improves automatically against the darker base.

Net effect: feels like Hookle's hero — a real photographic scene visible through a rich, moody overlay, not a washed-out pastel.

## 2. Headline — 3 alternatives to consider

The current headline *"Your practice's marketing department, running itself."* is operator-clever but reads as a product description. Hookle's hero voice is shorter, warmer, benefit-first, and speaks **to** the owner ("Social media made easy for small business owners"). Three options in that voice — pick one:

1. **"Dental practice marketing, finally made easy."**
   *Direct Hookle echo. Names the audience, names the relief. Safe and instantly clear.*

2. **"Grow your practice in 20 minutes a week."**
   *Outcome + the time promise that already lives in the subhead. Concrete and ownable.*

3. **"Marketing your practice will actually love doing."**
   *Warmest, most emotional. Reframes marketing from chore to delight — closest to Hookle's "love using it" tone.*

(Subhead and CTAs stay as-is regardless of choice.)

## 3. Archer vs. Hookle — capability match

### Hookle's value proposition (as positioned today)

- **Audience:** small business owners with no marketing team, no time, no budget.
- **Promise:** an "AI social media manager in your pocket" — one app that plans, creates, schedules, and publishes social content across every major channel.
- **Tone:** empathetic, plain-English, mobile-first, "your sidekick."

### Hookle's core capabilities (and Archer's current equivalent)

| # | Hookle capability | Archer today | Gap / action |
|---|---|---|---|
| 1 | **One-tap multi-channel publishing** (FB, IG, X, LinkedIn, GMB, TikTok, Pinterest, Threads, YouTube Shorts) | Ayrshare-backed publishing across FB/IG/GMB/TikTok/LinkedIn | Add Pinterest, Threads, YouTube Shorts to the surfaced channel list; mirror Hookle's "post to all your channels at once" wording. |
| 2 | **AI post generator** — caption + hashtags from a prompt or topic | `generate-post` + variations + KB-aware copy | Already strong. Surface it on the public site as a named feature: "AI Post Writer." |
| 3 | **AI image generator** baked into the post flow | `generate-post-image` / `generate-image` | Parity. Show a one-screen "type idea → get image + caption" demo on the public site. |
| 4 | **Content calendar + scheduler** with drag-and-drop | Schedule page with queue + drag-and-drop | Parity. Add a calendar-view screenshot to the public site. |
| 5 | **Smart suggestions / "what should I post today?"** | `suggest-campaign-topics`, content-hub topic engine | Parity but hidden from marketing site. Add a "Daily Post Ideas" tile. |
| 6 | **Reposting / evergreen recycling** | Not explicit | **Gap.** Add a recycle/evergreen toggle on the Schedule page (re-queue best-performing posts on a cadence). |
| 7 | **Performance analytics per channel** | Ayrshare metrics partially wired; not a first-class UI | **Gap.** Promote analytics to a dedicated tab with per-channel engagement, reach, follower growth. |
| 8 | **Inbox / unified replies** (comments + DMs in one place) | Engagement messaging surface exists for manager↔client | **Gap.** Add a true social inbox: comments + DMs from all connected channels in one view with AI-drafted replies (we already draft replies for reviews — extend). |
| 9 | **Mobile-first / on-the-go UX** | Web app, responsive | **Gap (long-term).** Note on roadmap; near-term, ensure the dashboard + schedule are truly thumb-friendly on phone. |
| 10 | **Free tier / try-before-buy** | Free preview campaign | Parity. Lead with it more loudly in the hero (already partial). |
| 11 | **Plain-English onboarding wizard** | Multi-step onboarding with KB capture | Parity. Trim copy to Hookle-level brevity on the first two steps. |

### Where Archer already **beats** Hookle (lean into these on the site)

- **Vertical depth for dentistry:** practice-trained KB, HIPAA-aware copy, dental-specific topic engine, review-driven campaigns, branded landing pages per campaign.
- **Full campaign object** (not just single posts): strategy → channels → platforms → posts → landing pages → reports, with budget and Gantt-style oversight.
- **Manager-assisted mode:** real humans can review/assist via the manager dashboard — Hookle has none of this.
- **Reviews & reputation engine + AI reply drafting** tied to marketing — Hookle is post-centric only.
- **Multi-location controls** for dentist-owned groups (≥60% ownership) with role-based approvals.

### Recommended near-term additions to reach feature parity perception

1. **Social Inbox** — unified comments+DMs view with AI-drafted replies. (Highest-impact gap.)
2. **Evergreen Recycler** — toggle on top-performing posts to re-queue automatically.
3. **Analytics tab** — per-channel reach, engagement, follower growth, best-time-to-post.
4. **Calendar view** on the Schedule page (we have queue; add month grid).
5. **Public-site feature renames** to mirror Hookle's plain-English labels: "AI Post Writer," "AI Image Maker," "Content Calendar," "Smart Post Ideas," "Social Inbox," "Performance."

### Out of scope for this plan

- Building the four new product features above (Inbox, Recycler, Analytics tab, Calendar view) — those should each be their own approved plan.
- Pricing changes.
- Any DSO/corporate framing — independent dental practices only (solo, partner-owned, dentist-owned multi-location ≥60%).

## What this plan changes right now

Only the hero overlay in `src/components/archer/Hero.tsx`. Headline change waits for your pick (1, 2, or 3). The capability-match section above is for your review — no code changes implied until you say which gaps to build next.
