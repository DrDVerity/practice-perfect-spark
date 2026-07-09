## Goal
Stop campaign plans, blogs, and social posts from drifting into patient-facing dental services when the campaign is actually promoting Archer / the marketing agent to practice owners.

## Findings
- The blog generator already has stronger guardrails, but it depends on the strategic plan as its source of truth.
- Some bad articles are downstream symptoms of an earlier bad strategic plan that incorrectly adopted stale practice reports from the knowledge base.
- The strategic plan generator still reads broad knowledge base context and can treat older client reports as the promoted business identity.
- Campaign-level focus, target market, and budget are saved and available, but the planner needs to prioritize them more aggressively.

## Plan
1. **Harden strategic plan context loading**
   - Filter out stale reports tied to other campaigns or unrelated practice identities before the planner sees them.
   - Exclude image/video files and unrelated generated reports from strategic-plan context.
   - Keep only campaign-relevant business profile, brand, target market, and campaign-focus material.

2. **Make campaign design fields authoritative**
   - Update the strategic plan prompt so campaign name, focus, target market, budget, dates, and selected channels outrank profile defaults and knowledge base excerpts.
   - Treat generic account names like “Administrator Account” as account labels, not the promoted business.
   - Explicitly distinguish “dental practice as client” from “dental patient as audience.”

3. **Add identity guardrails across downstream content**
   - Mirror the same stale-KB filtering in social post generation, not just blog generation.
   - Ensure blog/social brief generation uses the strategic plan plus campaign design fields as the approved brief.
   - Forbid adopting unrelated practice names, cities, doctors, treatments, or seasonal offers from background reports.

4. **Improve regeneration behavior**
   - Ensure “Regenerate blog” uses the current campaign strategic plan, focus, and target market.
   - If the strategic plan itself is already wrong, make refreshing the plan the required first step before regenerating blog/posts.
   - Preserve accepted assets unless the user explicitly regenerates them.

5. **Deploy and verify**
   - Deploy the changed backend functions.
   - Check recent campaign rows to confirm focus, target market, budget, strategy, blog, and posts align for the Archer marketing-agent campaigns.
   - Report whether any old campaigns need manual “refresh plan → regenerate blog/posts” because their existing strategy was already contaminated.

## Technical details
- Update shared campaign-agent planning logic.
- Update content hub and social generation KB filtering to use the same relevance rules.
- No schema changes are required.
- No changes to Bundle.social publishing are needed for this fix.