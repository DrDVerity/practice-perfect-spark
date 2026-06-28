
# Archer Dashboard Rebrand Plan

Tokens-first rebrand of the authenticated app (Dashboard, Admin, Manager, Campaign, Knowledge Base, Schedule, Workspace Settings, Account, Login/Invite). Public Archer marketing site stays on its existing palette (already scoped under `.archer`).

> Note: I'm planning from the summary you pasted (gold #BB9A4F family, steel #5E707E, slate #1B2630/#111A23, IBM Plex Sans/Mono, borders-over-shadows, mono eyebrows). If `Design.md` has additional specifics (exact spacing scale, full status triads, motion timings, the "three configurable tweaks"), share it and I'll fold the exact values into step 1 before building.

---

## 1. Design tokens (foundation)

**`src/index.css` `:root` (light — neutral)**
- `--background` warm neutral (e.g. `40 12% 96%`), `--foreground` slate `210 25% 12%` (#1B2630)
- `--card` `0 0% 100%`, `--card-foreground` slate
- `--primary` gold `42 42% 52%` (#BB9A4F), `--primary-foreground` slate `210 25% 12%`
- `--secondary` steel-tint `210 12% 92%`, `--muted` `210 10% 94%`, `--muted-foreground` steel `210 14% 38%`
- `--accent` pale gold `42 60% 92%`, `--accent-foreground` deep gold `35 50% 28%` (#9B7534)
- `--border` / `--input` steel-tint `210 14% 84%`, `--ring` gold
- `--destructive` keep red but retuned to sit beside gold

**`.dark` (slate)**
- `--background` `210 30% 8%` (#111A23), surfaces `210 26% 13%` (#1B2630)
- `--foreground` warm neutral `40 15% 92%`
- `--primary` gold `42 55% 60%` on slate-foreground
- `--border` `210 14% 24%`, hairline steel

**Brand tokens added/renamed**
- `--archer-gold: 42 42% 52%`, `--archer-gold-deep: 35 50% 28%`, `--archer-gold-light: 45 70% 67%` (#E8C96C)
- `--archer-steel: 210 14% 43%` (#5E707E)
- `--archer-slate: 210 26% 13%`, `--archer-slate-deep: 210 30% 10%`
- Status triads (bg / border / fg) for `success`, `warning`, `danger`, `info`, `neutral` — exposed as `--status-*` CSS vars used by a new `<StatusPill>` component
- Remove teal-era `--brand-teal*`, `--brand-gradient`, `--shadow-glow` (replace shadows with borders per spec)
- `--radius` lowered to `0.5rem` (steel/architectural feel)
- Sidebar tokens re-pointed to slate + gold

**`tailwind.config.ts`**
- Extend `colors.archer = { gold, goldDeep, goldLight, steel, slate, slateDeep }`
- Extend `fontFamily.sans = ['"IBM Plex Sans"', ...]`, `fontFamily.mono = ['"IBM Plex Mono"', ...]`, `fontFamily.display = sans`
- Add `borderColor.hairline` and a `boxShadow.none`-leaning preset; remove pulse-glow animation usage from auth app

**Fonts** — install `@fontsource/ibm-plex-sans` (400/500/600/700) and `@fontsource/ibm-plex-mono` (400/500) via `bun add`, import in `src/main.tsx`.

**Scope guard** — wrap the auth app in a top-level `<div class="app-archer">` (or apply tokens at `:root` since public site is already scoped under `.archer`). I'll put new tokens at `:root` and leave the existing `.archer` block untouched so the marketing site is unaffected.

## 2. Primitive components

- `src/components/ui/button.tsx` — retune variants: `default` = gold on slate-fg, `secondary` = steel-tint, `outline` = hairline steel border, `ghost`, `destructive`. Remove gradient/glow.
- `src/components/ui/card.tsx` — borders over shadows: `border border-border` default, no `shadow-*`; add `.card-elevated` opt-in.
- `src/components/ui/badge.tsx` → new `StatusPill` variants (`success/warning/danger/info/neutral`) reading the status triad tokens.
- `src/components/ui/input.tsx`, `select.tsx`, `textarea.tsx`, `tabs.tsx`, `dialog.tsx`, `dropdown-menu.tsx` — verify they read tokens only (no hardcoded colors), tighten radii to new `--radius`.
- New `src/components/ui/MonoEyebrow.tsx` — small uppercase IBM Plex Mono label used above section headings ("01 / CAMPAIGNS", etc.).

## 3. App chrome sweep

- **Header** in `src/pages/Dashboard.tsx`, `AdminDashboard.tsx`, `ManagerDashboard.tsx`, `CampaignEditNew.tsx`, `KnowledgeBase.tsx`, `Schedule.tsx`, `WorkspaceSettings.tsx`, `AccountProfile.tsx`, `LandingView.tsx`, `Login.tsx`, `AcceptInvite.tsx`: replace `bg-white/50 backdrop-blur-lg` with slate/neutral surface + hairline bottom border. Logo size unchanged (`h-16`).
- Replace hardcoded `text-white`, `text-primary-foreground`, `bg-white/50` in page bodies with semantic tokens. Notable offenders: Dashboard welcome heading (`text-white`), ImpersonationBanner.
- `StatsCard`, `CampaignsTable`, `CampaignCard`, `ResearchReportsBanner`, `CampaignDashboardSection`, `CampaignCalendarView`, `CampaignAgentDialog`, `ChannelCredentialModal`, `EditPostDialog`, `KBDocumentViewer`, onboarding steps: swap teal/gradient accents for gold; replace `shadow-xl`/`shadow-glow` with hairline borders; convert section headings to use `MonoEyebrow`.
- Calendar/Gantt platform color swatches: keep platform brand colors, but recolor neutral chrome (grid, today highlight) to steel + gold.
- Replace any `border-primary text-primary` admin/manager badges to gold-on-slate via `StatusPill`.

## 4. Motion & polish

- Remove `pulse-glow` and shimmer usage in auth app surfaces.
- Standardize transitions to `duration-200 ease-out`, hover = border-color shift to gold + subtle 1px translate (no shadow bloom).
- Tabs/active states: 2px gold underline rather than filled pill.

## 5. QA pass

- Open each route (`/`, `/admin`, `/manager`, `/dashboard`, `/campaign/:id`, `/knowledge-base`, `/schedule`, `/settings/workspace`, `/account`, `/login`, `/accept-invite`) in light + dark via Playwright screenshots; check contrast, hairline borders, gold accents, mono eyebrows.
- Verify `.archer` marketing site (`/`, `/why-archer`, `/features/*`, `/about`, `/privacy`, `/terms`, `/hipaa`) is visually unchanged.
- Run `tsgo` typecheck.

---

## Out of scope
- Public Archer marketing site (untouched).
- Email templates / PDF exports.
- Auth flows behavior — visual only.
- New features; only re-skin existing screens.

## Deliverable order
1. Tokens + fonts + Tailwind config + primitives (Card/Button/Badge/StatusPill/MonoEyebrow).
2. Dashboard + AdminDashboard as reference pages.
3. Sweep remaining authenticated pages and shared dashboard/campaign/channel/kb components.
4. Light/dark QA pass.
