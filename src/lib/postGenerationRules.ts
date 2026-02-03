// Facebook Posting Rules for AI Agent
// These rules guide the AI when generating social media posts

export const FACEBOOK_POSTING_RULES = `
Posting Rules for Facebook

1. Identify the post goal and KPI
- Define a single, primary objective for the post (e.g., drive link clicks, generate lead form submissions, get messages).
- Set one main performance metric (e.g., click-through rate, cost per click, number of messages) to guide all creative decisions.

2. Define the target audience
- Specify who the post is for using concrete traits: location, age range, interests, problems, and stage of awareness.
- Summarize the audience in one sentence you can write to directly (e.g., "Adults in Chicago who are nervous about going to the dentist").

3. Clarify the offer and destination
- Describe exactly what the user gets by clicking (article, booking page, quiz, discount, webinar, etc.).
- Confirm that the landing page headline, promise, and imagery closely match what the post will say to avoid click bait and drop-off.

4. Craft a single, strong hook line
- Write the first line to immediately grab attention using one of these angles: pain point, bold benefit, curiosity, or time-limited offer.
- Make the hook specific and concrete, avoiding vague language; the reader should know in one second why this matters to them.

5. Speak directly to the audience
- Use "you" language and, when appropriate, explicitly call out the audience (e.g., "Chicago parents," "busy professionals," "implant-curious patients").
- Mirror the audience's own words for their problem or desire, based on real phrases they would naturally use.

6. Focus on one core message
- Choose one main idea or promise for the post and remove secondary ideas that compete for attention.
- Ensure every sentence in the copy supports this single message and leads the user closer to the click.

7. Structure the primary text clearly
- Place the hook in the first 1–2 lines so it appears before the "See more" cutoff.
- Use short sentences and line breaks to create a visually scannable structure, especially on mobile.
- Keep the text concise but complete: enough detail to build trust and curiosity without overwhelming the reader.

8. Highlight a specific benefit and proof
- State the most important outcome or benefit the user cares about (e.g., "save 30 minutes," "no-interest financing," "same-day results").
- Add one clear piece of proof: a number, short testimonial snippet, qualification, or mini-explanation of how it works.

9. Add urgency or relevance without deception
- If appropriate, specify a time or quantity limit (e.g., "This week only," "Only 5 spots available").
- Ensure all urgency or scarcity claims are accurate and can be honored.

10. Use a direct, explicit call to action
- Choose one action verb that matches the goal and destination (e.g., "Click to book your visit," "Tap to see before-and-after photos," "Message us to claim your spot").
- Place the call to action near the end of the primary text and align it with the button label (e.g., "Learn more," "Sign up," "Send message").

11. Design a thumb-stopping visual
- Select or generate an image or short video that clearly reflects the offer and audience (no generic stock unless it feels authentic).
- Use a clear focal point and high contrast so the visual stands out in the feed and is legible on a small phone screen.
- Avoid clutter or too much on-image text; limit on-image words to the core promise or key benefit.

12. Optimize for mobile viewing
- Assume the user is on a small screen; ensure text is readable, faces or key objects are large, and important elements are centered.
- Check that no essential information is cut off by cropping or overlays in typical Facebook placements.

13. Maintain brand consistency and compliance
- Use brand-consistent colors, fonts (or approximations), tone of voice, and logos where appropriate.
- Avoid prohibited content types (e.g., misleading claims, before/after that violate policy, overly personal attributes) and respect Facebook's ad and content policies.

14. Match tone to objective and audience
- Choose a tone (friendly, expert, urgent, empathetic) that fits both the brand and the audience's emotional state.
- Keep the tone confident but not exaggerated; prioritize clarity over cleverness.

15. Avoid common friction and spam triggers
- Do not use clickbait phrases that overpromise results or hide the true destination.
- Avoid excessive punctuation, all caps, or emoji overload; use emphasis sparingly and intentionally.

16. Ensure clarity of context and next step
- Clearly state what will happen after the click (e.g., "You'll see available times and can confirm in under 60 seconds").
- Remove ambiguity about cost, location, or requirements when those are critical to the user's decision to click.

17. Adapt format to the story
- For multiple items or benefits, consider a carousel format with one focused point per card.
- For demonstrations, transformations, or explanations, consider a short video with captions and a clear opening frame.

18. Localize when relevant
- Mention city, neighborhood, or local landmarks when the offer is location-specific to increase perceived relevance.
- Adjust language, time references, and cultural cues to the user's geography and context.

19. Provide multiple variations for testing
- Generate at least 3 variants of hooks, 2–3 variants of primary text length, and 2–3 distinct visuals for the same offer.
- Change only one major element at a time (hook, image, or call to action) between variants so performance differences are interpretable.

20. Perform a final quality and alignment check
- Verify that the hook, body text, visual, and landing page all communicate the same core promise and audience.
- Check spelling, grammar, and formatting; ensure no information is missing for a new user to understand and act.
`;

// Platform-specific rules map (add more as they become available)
export const PLATFORM_POSTING_RULES: Record<string, string> = {
  facebook: FACEBOOK_POSTING_RULES,
  instagram: FACEBOOK_POSTING_RULES, // Use Facebook rules for now, can be customized later
  linkedin: FACEBOOK_POSTING_RULES,  // Use Facebook rules for now, can be customized later
  twitter: FACEBOOK_POSTING_RULES,   // Use Facebook rules for now, can be customized later
};

export const getPostingRulesForPlatform = (platform: string): string => {
  return PLATFORM_POSTING_RULES[platform] || FACEBOOK_POSTING_RULES;
};
