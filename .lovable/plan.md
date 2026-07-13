
# Campaign Refactor Plan

Five coordinated changes. Each is scoped so accepted work is never destroyed and every asset gets an explicit accept action at every level.

---

## 1. Preserve Accepted Assets on Regeneration

Add a single source of truth: `campaigns.assets_accepted` (jsonb) with keys `strategy`, `plan`, `blog`, `funnel`, plus per-post accepts in `channel_posts.accepted` and per-email accepts in `campaign_email_funnel.accepted`.

- `refresh-strategic-plan` and `run-campaign-agent`: before overwriting `strategy`, `blog_article`, or budget allocations, check the matching `assets_accepted.*` flag. If true, skip that section and pass the frozen text into the prompt as an "immutable input, build around it" context block.
- `parse-strategy-allocations` and budget seeding: if `campaign_budgets.accepted = true`, do not overwrite allocations — only fill missing rows.
- UI: add an **Accepted** badge on the Strategic Plan card (`CampaignEditNew.tsx`, ~line 470 area), styled to match the existing green Budget "✓ ACCEPTED" pill. Wire it to `assets_accepted.plan`. Accepting the plan is a separate action from accepting the strategy narrative.
- Blog panel and funnel panel already respect `assets_accepted`; verify their accept toggles disable the "Regenerate" button when true.

## 2. Email & SMS Drip Campaigns

New table `campaign_drip_series` (id, campaign_id, channel_id, channel_type ['email'|'sms'], recipient_mode ['existing'|'new_group'|'custom_sql'], recipient_config jsonb, series_length int default 3) and `campaign_drip_messages` (id, series_id, sequence_no, subject, body, status ['draft'|'accepted'|'deleted'], accepted bool).

- New Edge Function `generate-drip-series`: takes campaign context + series_length, produces N drafts one at a time (email or SMS variant), stores rows.
- New panel `CampaignDripPanel.tsx` shown when an Email or SMS channel is opened:
  - Recipient list dropdown (Select existing / New group / Custom SQL). Custom SQL stores the query text; execution deferred to send-time.
  - Series length numeric input (default 3).
  - List of generated messages; each row has **Edit**, **Accept**, **Delete/Regenerate**.
  - "Series complete" flag flips only when every message is accepted or deleted-and-regenerated-then-accepted. Preflight blocks publish until complete.

## 3. Landing Page Template (Client-Branded)

- Extend `generate-landing-page` to produce a structured template with these sections: Hero (logo, headline, sub-headline, primary CTA), Highlights (3–5 pulled from the blog article's H2s), Offer/Benefits/Features, Social proof, Repeating CTA bands (top, mid, footer) with **Schedule Appointment**, **Call for Pricing**, **Request Consultation** buttons.
- Grounding: pull brand voice + logo URL from KB brand guidelines doc; if missing, call `generate-brand-guidelines` first.
- Persist the rendered template as a KB document `Landing Page Template: {campaign}` (docType `custom`, scope `location`) via `upsertKBDoc`, so the agent or client can edit it in the Knowledge Base and future regenerations pick up the edits.
- `CampaignEditNew.tsx` Landing Page card: show KB doc link + "Open in KB" + "Regenerate" (regeneration respects `assets_accepted.landing_page`).

## 4. Manager Notifications: Link + PDF

- `notify-manager-vector` and `notify-manager-strategy`: after composing the message, call `generate-strategy-pdf` to render the plan + budget table + allocations, upload to a private storage bucket `campaign-reports/`, create a signed URL (7-day), and include both a deep link `${SITE_URL}/campaign/{id}` and the PDF signed URL in the message body and message metadata.
- Add `attachments jsonb` to `campaign_messages` if not present; SendGrid sender includes it as a link (not a MIME attachment) to avoid deliverability issues.

## 5. Multi-Level Post Acceptance

- Add `channel_posts.accepted` (bool default false) if not already present.
- `ChannelEdit.tsx` posts list:
  - New **Accept** icon (checkmark) placed **left of the "Regenerate posts" bulk button** — accepts every listed post as-is.
  - Each post row gets an **Accept** icon **left of the "Post Now" icon** — accepts that single post.
- `EditPostDialog.tsx`: rename **Save changes** button to **Accept**; on click, save edits AND set `accepted = true`.
- Acceptance hierarchy: bulk-accept → row-accept → edit-accept. Any higher-level accept satisfies lower-level accept requirements; preflight only checks the post-level `accepted` flag (which all three paths set).
- Preflight update: `publish-campaign-preflight` reports unaccepted posts count.

---

## Migration Order

1. `campaigns.assets_accepted` keys expanded, add `landing_page`, `plan` if missing.
2. Create `campaign_drip_series`, `campaign_drip_messages` with RLS + GRANTs (authenticated for owner/manager, service_role all).
3. Add `channel_posts.accepted`, `campaign_messages.attachments` if missing.
4. Deploy new/updated edge functions: `generate-drip-series`, updated `generate-landing-page`, `refresh-strategic-plan`, `run-campaign-agent`, `notify-manager-*`, `publish-campaign-preflight`.

## Out of Scope (this pass)

- Actual sending of drip emails/SMS on schedule (queue exists; wire-up is a follow-up).
- Custom SQL query builder UI — free-text SQL input only for now, validated at send time.
- BizBrain / Promethian iframe wiring.

Confirm and I'll implement in the order above.
