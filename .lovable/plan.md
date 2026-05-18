# Hero Refresh + Near-Term Parity Pass

## 1. Hero — darker overlay + new headline

File: `src/components/archer/Hero.tsx`

- Replace the flat `bg-[#001f5b]/50` overlay with a richer, more transparent gradient so the photo reads through but text contrast holds:
  - `bg-gradient-to-b from-[#001028]/65 via-[#000814]/75 to-[#000814]/90`
- Drop `mesh-bg` from `opacity-60` → `opacity-30`.
- Replace the H1 with the user-selected line:
  > **"Dental practice marketing, made just for your practice — easy results."**
- Keep the gold accent treatment on "easy results."
- Subhead and CTAs unchanged.

## 2. Public-site feature renames (Hookle-style plain English)

Rename feature tiles and section labels site-wide so capabilities read clearly to a non-technical dentist. No backend changes.

| Old label | New label |
|---|---|
| Campaigns & Creative | AI Post Writer + Campaigns |
| Reviews & Reputation | Reviews & Replies |
| Patient Engagement | Social Inbox (coming soon) |
| Enterprise & Multi-Location | Dentist-Owned Multi-Location |

Touchpoints to update:
- `src/pages/archer/Home.tsx` (tiles array)
- `src/components/archer/Header.tsx` (Features dropdown labels if present)
- `src/components/archer/Footer.tsx` (feature links)
- `src/components/archer/Pricing.tsx` (tier name "Multi-Location" copy: emphasize "dentist-owned")

## 3. Expand the channel list (parity perception)

Where Archer lists supported channels, add Pinterest, Threads, and YouTube Shorts alongside FB / IG / GMB / TikTok / LinkedIn. Files:
- `src/components/archer/Hero.tsx` subhead / trust strip if relevant
- Any feature/Engagement components that enumerate channels
- `src/components/archer/Comparison.tsx` if it lists channels

## 4. Add "What Archer does for you" plain-English feature strip on Home

Insert a new section on `src/pages/archer/Home.tsx` (between `ProductShotStrip` and `WithWithoutArcher`) titled **"Everything you need, nothing you don't."** with six small tiles using Hookle-style names:

1. **AI Post Writer** — captions + hashtags in your voice.
2. **AI Image Maker** — on-brand visuals for every post.
3. **Content Calendar** — see your whole month at a glance.
4. **Smart Post Ideas** — daily prompts tailored to your practice.
5. **Social Inbox** *(coming soon)* — comments + DMs in one place.
6. **Performance** *(coming soon)* — what's working, what's not.

New component: `src/components/archer/EverythingYouNeed.tsx`.

## 5. Provider note (Bundle.social)

- Replace any user-facing mention of Ayrshare with Bundle.social. Most public copy says "Archer publishes to all your channels" — keep that. Only mention Bundle.social if a provider name is required.
- Files to scan for stray "Ayrshare" mentions in marketing copy: `src/components/archer/*`, `src/pages/archer/*`.
- Internal hook `useAyrshare` and `ayrshare-*` edge functions are NOT changed in this plan — they're a separate migration plan.

## 6. Memory updates (already saved)

- New: `mem://integrations/social-publishing` — Bundle.social is the active provider.
- Updated: `mem://index.md` Core line for Social Publishing.

## Reminder — build next (separate plans)

These four are queued and intentionally **not** built in this plan. Bring them up next:

1. **Social Inbox** — unified comments + DMs from all connected channels, with AI-drafted replies.
2. **Evergreen Recycler** — toggle on top-performing posts to auto re-queue on a cadence.
3. **Analytics tab** — per-channel reach, engagement, follower growth, best-time-to-post.
4. **Calendar view** on Schedule page — month grid alongside existing queue.

## Out of scope

- Ayrshare → Bundle.social code migration (separate plan).
- Building the four queued features above.
- Pricing or backend changes.
- Any DSO/corporate framing.

## Technical summary

- Edits: `Hero.tsx`, `Home.tsx`, `Header.tsx`, `Footer.tsx`, `Pricing.tsx`, `Comparison.tsx` (channel list), and any Ayrshare strings in marketing files.
- New file: `src/components/archer/EverythingYouNeed.tsx`.
- No new dependencies. No DB or edge function changes.
