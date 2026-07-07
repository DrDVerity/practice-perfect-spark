## Plan: align social post generation with campaign strategy

### What I found
- The campaign post generator currently derives social posts mostly from `blog_article` and a generic platform prompt.
- If the saved blog article is already wrong or stale, the posts inherit that wrong topic.
- Several prompts still hardcode healthcare/dental framing, including social post generation and image prompt generation, which can pull the model back into patient-facing dental offers like whitening.
- The one-off “Add New” AI post generator also uses profile fields and a dental/healthcare prompt, but does not load the campaign strategic plan, campaign focus, refined target market, or campaign KB context.

### Fix
1. **Make the campaign strategic plan authoritative for social posts**
   - Update the automatic campaign post generation function so the source priority is:
     1. Campaign strategic plan, campaign name, campaign focus, target market, psychological approach
     2. Current campaign article/script, only if aligned
     3. Profile and KB as background only
   - If the blog article conflicts with the campaign strategy, posts should ignore the conflicting article and use the campaign plan/focus instead.

2. **Add an approved social post brief step**
   - Generate a compact internal brief before writing posts:
     - business name/type
     - core offer
     - campaign topic
     - campaign promise
     - target audience
     - must-include angles
     - must-avoid topics
   - Use this same brief for LinkedIn, Facebook, Instagram, X, TikTok, email, and SMS.

3. **Neutralize hardcoded dental/healthcare prompts**
   - Replace “healthcare social media strategist,” “healthcare email copywriter,” and “dental practice marketing image” defaults with business-agnostic prompts.
   - Keep dental context only when the campaign/business brief says the audience is dental practice owners or the topic actually concerns dentistry.
   - Explicitly forbid drift into whitening, Invisalign, implants, smile makeovers, appointments, summer specials, etc. unless the campaign topic/focus names them.

4. **Fix LinkedIn-specific generation**
   - LinkedIn posts should be written for the actual campaign audience and business offer.
   - For the “Best Hiring Decision” example, LinkedIn should talk to practice owners/operators about hiring an AI marketing agent, ROI, efficiency, and cost effectiveness — not patient whitening promotions.

5. **Fix one-off “Add New” AI post generation**
   - Pass the campaign ID into the add-post dialog.
   - Update the post-generation backend function to load the campaign strategic plan, focus, target market, profile, and KB before writing.
   - This prevents manually generated LinkedIn posts from using only generic profile/dental defaults.

6. **Fix social post image prompts**
   - Update automatic post image prompts and manual image generation so they match the campaign brief and do not default to clinical/dental imagery.

7. **Add a safe regenerate path for bad posts**
   - Add or reuse a channel/campaign-level regeneration action that deletes/replaces draft posts for a channel using the corrected strategy-first logic.
   - Preserve accepted/published posts unless the user explicitly edits them manually.

### Validation
- Regenerate LinkedIn posts for the affected campaign and confirm titles/content align with “Best hiring decision of your career,” “more effective,” “better ROI,” and “cost efficient.”
- Confirm the generated copy no longer mentions whitening/summer smile themes unless they appear in the campaign brief.
- Deploy the updated backend functions after the code changes.