# KB-Wide Report Dedupe & Smart Reuse

## Goal

Stop accumulating near-duplicate AI-generated reports in any client's Knowledge Base. Before generating ANY new report, the system checks the KB for an existing report of the same type + scope + key parameters. If a fresh, parameter-matched copy exists, reuse it. Otherwise, generate and **upsert** (update in place) — never insert a second copy.

## Scope — every AI-generated KB report

All edge functions that write to `knowledge_base` get the same reuse/upsert behavior:

| Function | Doc type | Match key (besides user_id + doc_type) |
|---|---|---|
| `generate-practice-report` | `market_analysis`, `audience_analysis`, `competitive_landscape` | `practice_name`, `source_url`, `campaign_focus`, `target_audience` |
| `campaign-agent` (research) | `custom` (`source: campaign-agent-research`) | `campaign` name, `campaign_focus`, `target_audience` |
| `generate-analysis-reports` | whatever it currently writes | `practice_name`, `campaign_focus`, `target_audience` |
| `generate-kb-document` | `demographics`, `brand_guidelines`, `platform_rules`, etc. | `practice_name`, `doc_type`, normalized `prompt` hash |
| `generate-platform-rules` | `platform_rules` | `platform`, `practice_name` |
| `topic-blog-research` (if it writes KB) | `custom` | `topic`, `campaign_focus` |

User-uploaded files and manually-edited docs are never touched.

## Shared rule

For each generator, before doing real work:

1. Query `knowledge_base` for rows matching `user_id` + `doc_type` + a stable title/match-key derived from the request.
2. If found AND `updated_at` < 30 days old AND the `metadata` match-key fields equal the incoming parameters → **return the cached content**, no generation, no new row.
3. Otherwise → generate fresh content and **upsert into the matched row** (or insert if none existed). The KB ends with exactly one row per (client, doc_type, match-key).
4. All endpoints accept `force: boolean` to bypass the cache (used by the existing "Force regenerate" checkbox + a new one we'll add to the agent dialog).

## Changes

### 1. Shared helper

New file `supabase/functions/_shared/kb-cache.ts` exporting:

- `findCachedKBDoc({ userId, docType, matchKey, maxAgeDays })` — returns the most recent matching row or null.
- `upsertKBDoc({ userId, docType, title, content, metadata, matchKey, accountId, locationId, scope })` — updates the row that matches `matchKey` if one exists, otherwise inserts.

`matchKey` is stored as `metadata.match_key` (a small object) and used for lookup with `.contains()`.

### 2. Apply to each generator

Refactor each function above to call `findCachedKBDoc` first and `upsertKBDoc` instead of `insert`. Titles become stable (no embedded dates).

### 3. Backfill cleanup (one-time)

Run a single SQL pass over `knowledge_base`:

- For every (`user_id`, `doc_type`, normalized title) group of AI-generated docs (metadata indicates AI source OR title matches one of the known patterns), keep the row with the newest `updated_at`, delete the rest.
- Patterns covered: `Campaign Research: %`, `Practice Intelligence Report - %`, `Reputation & Sentiment Analysis - %`, `Competitive Landscape - %`, plus any `metadata.source` starting with `generate-`/`campaign-agent-research`.

The user sees one row per report type per campaign/practice after this runs (e.g. one "Campaign Research: SNS" in DDF instead of five).

### 4. UI

No new pages. The existing "Force regenerate" checkbox on the Practice Intelligence dialog already covers that flow. Add the same checkbox to the Campaign Agent strategy-generation panel so the user can override the cache when they want a fresh research pass.

## Technical notes

- `match_key` is intentionally small and JSON — Postgres can index `metadata->'match_key'` with a GIN index if needed later. For now `.contains()` queries are fast enough at current KB sizes.
- Normalization: trim, lowercase, collapse whitespace before comparing strings in match keys.
- Title drift fix: any function that previously embedded a date in the title (`Campaign Research: SNS (5/20/2026)`) switches to a stable title; the date moves to `metadata.generated_at`.
- RLS is not a problem — all generators run with service role.

## Files touched

- New: `supabase/functions/_shared/kb-cache.ts`
- Edited: `supabase/functions/campaign-agent/index.ts`, `generate-practice-report/index.ts`, `generate-analysis-reports/index.ts`, `generate-kb-document/index.ts`, `generate-platform-rules/index.ts`, `topic-blog-research/index.ts` (only if it writes KB).
- One data cleanup run via the insert tool (DELETE statement) to remove existing duplicates.
- Minor UI: add `forceRegen` checkbox to `CampaignAgentDialog` and pass `force` to the agent invoke.
