// Consolidated Cross-Platform Posting Rules for AI Agent
// These rules guide the AI when generating social media posts

export const CROSS_PLATFORM_RULES = `
# Cross-Platform Posting Rules

## 1. Define goal, KPI, and platform

### 1.1 Identify the primary objective
- Choose one main outcome: clicks to website/landing page, DMs/messages, profile visits, or event/lead form registrations.
- Set a primary KPI for success (click-through rate, number of link clicks, cost per click, number of DMs, or form starts).

### 1.2 Select the platform(s)
- Specify which platform this post is for: Facebook, Instagram, X, or LinkedIn (or a combination for adapted versions).
- For multi-platform campaigns, mark one "source" version (usually LinkedIn or long-form Facebook) and adapt to other platforms.

### 1.3 Define the audience persona
- Describe who the post is for: demographics, location, role/title (if relevant), interests, and primary pain point or desire.
- Write a one-sentence audience summary to speak directly to (e.g., "Busy parents in Salt Lake City who want dental visits to be fast and convenient").

## 2. Clarify offer, destination, and message

### 2.1 Clarify the offer
- Specify exactly what the user gets when they click: article, booking page, discount offer, webinar, quiz, resource, or DM conversation.
- State the primary benefit from the user's perspective (save time, save money, reduce stress, improve appearance, etc.).

### 2.2 Define the destination experience
- Ensure the landing page headline, promise, and imagery closely match what the post will say to avoid click bait and drop-off.

### 2.3 Choose one core message
- Select a single main idea or promise that everything in the post will support.
- Remove or downplay secondary messages that distract from the click or main action.

## 3. Master copy structure (applies to all platforms)

### 3.1 Craft a strong hook
- Write the first line to immediately grab attention using one of: pain point, bold benefit, surprising insight, or specific question.
- Make the hook concrete and specific, not vague or generic; the reader should instantly know why this matters to them.

### 3.2 Provide value and context
- In 2–6 short sentences, explain the situation, highlight the main benefit, and add one piece of proof (data point, mini-story, credential, or simple "how it works").
- Keep language clear and conversational; avoid jargon unless your audience is highly expert.

### 3.3 End with a direct CTA
- Use one clear action command aligned with the objective: "Click to book," "Tap the link to see options," "DM us 'PLAN'," "Register here," etc.
- Avoid multiple competing CTAs in the same post; one main action only.

### 3.4 Ensure clarity and honesty
- Explicitly state what happens after the click (see calendar, see pricing, see step-by-step guide).
- Avoid exaggerated promises; keep claims believable and accurate.

## 4. Visual and formatting rules (all platforms)

### 4.1 Design for mobile first
- Assume the user sees this on a phone: ensure key text is large, faces or focal objects are clear, and no crucial content is cut off.
- Keep visuals simple, with a strong focal point and minimal clutter.

### 4.2 Maintain brand consistency
- Use consistent colors, fonts (or closest equivalents), logo style, and tone of voice across all platforms.
- Make sure posts are recognizable as the same brand even when adapted for different networks.

### 4.3 Optimize media choice
- Use images for simple offers or clear before/after style outcomes.
- Use short video/Reels for demonstrations, transformations, or emotional storytelling.
- Use carousels/documents when explaining steps or multiple options, with the final slide driving the click.
`;

export const FACEBOOK_RULES = `
## Facebook Branch

### 14. Facebook objective and structure
- Focus on: link clicks, conversions, or messages.
- Place the hook in the first 1–2 lines so it appears before "See more."
- Use short paragraphs; avoid large blocks of text.

### 15. Facebook creative and CTA
- Use a strong, clear image or short video that obviously matches the offer.
- End copy with one direct CTA that matches the button label ("Learn more," "Book now," "Send message").

### 16. Facebook engagement support
- When appropriate, include a simple question or prompt to encourage comments and shares after the click-focused CTA.
`;

export const INSTAGRAM_RULES = `
## Instagram Branch

### 17. Instagram objective and format
- Choose the main action: bio link click, Story/Reel link tap, or DM.
- Pick a format: Feed post (single or carousel) or Reel; use Stories for reminder and support.

### 18. Instagram visual-first hook
- Make the first frame/slide visually bold with a clear promise or strong visual outcome.
- Ensure any on-image text is extremely short (3–7 words) and legible on a small screen.

### 19. Instagram caption and CTA
- Use a compelling first 2–3 lines in the caption to hook before the "…more" cut.
- Write a concise caption (short paragraphs or bullets) that leads to one specific CTA: "Tap our bio link," "DM us 'OFFER'," or "Swipe through, then tap the link."

### 20. Instagram discoverability
- Add 5–10 relevant hashtags (niche and local), location tag when useful, and tag partners or featured people sparingly and intentionally.
`;

export const TWITTER_RULES = `
## X (Twitter) Branch

### 21. X objective and copy length
- Decide if the primary goal is link clicks, replies, or reposts that lead to clicks.
- Aim for concise posts (~70–120 characters for single posts) unless using a thread.

### 22. X hook and value
- Lead with a bold statement, clear result, or sharp question that stops scroll.
- Give a short, concrete reason to click the link (what they'll learn or gain) before or around the link.

### 23. X link and threads
- Include only one primary link per post.
- For deeper explanations, create a short thread: first post = hook, middle posts = key insights/steps, final post = CTA and link.

### 24. X hashtags and media
- Use 0–2 targeted hashtags maximum.
- Add a simple, relevant image or graphic when it clarifies or strengthens the offer.
`;

export const LINKEDIN_RULES = `
## LinkedIn Branch

### 25. LinkedIn objective and persona
- Focus on professional outcomes: website visits, event registrations, lead form clicks, or profile visits.
- Anchor messaging in the role, responsibilities, and pain points of the specific professional persona.

### 26. LinkedIn content style
- Open with a concrete result, contrarian insight, or direct problem statement in the first 2 lines.
- Provide real value in-feed (insight, mini-framework, short story, or bullet list) before or alongside any link.

### 27. LinkedIn structure and CTA
- Use short paragraphs and light bullets for readability.
- End with a clear CTA: "Read the full guide here," "Register at this link," or "Comment 'PLAYBOOK' and I'll send the link."

### 28. LinkedIn media and professionalism
- Choose plain text, image, document/carousel, or video based on how much explanation is needed.
- Keep tone professional but human; align with your positioning (expert, mentor, challenger).
`;

export const TESTING_AND_QUALITY_RULES = `
## 6. Variations, testing, and final checks

### 29. Create test variations
- For each campaign, generate at least 2-3 variations.
- Change only one major element per variation when possible (hook, visual, or CTA).

### 30. Run final quality and alignment checks
- Confirm that hook, body, visual, and destination all communicate the same core promise and target the same audience.
- Check spelling, grammar, and formatting for each platform's norms.
- Verify compliance with platform policies and any brand or industry guidelines before publishing.
`;

// Platform-specific rules map
export const PLATFORM_POSTING_RULES: Record<string, string> = {
  facebook: `${CROSS_PLATFORM_RULES}\n${FACEBOOK_RULES}\n${TESTING_AND_QUALITY_RULES}`,
  instagram: `${CROSS_PLATFORM_RULES}\n${INSTAGRAM_RULES}\n${TESTING_AND_QUALITY_RULES}`,
  linkedin: `${CROSS_PLATFORM_RULES}\n${LINKEDIN_RULES}\n${TESTING_AND_QUALITY_RULES}`,
  twitter: `${CROSS_PLATFORM_RULES}\n${TWITTER_RULES}\n${TESTING_AND_QUALITY_RULES}`,
};

export const getPostingRulesForPlatform = (platform: string): string => {
  const normalizedPlatform = platform.toLowerCase();
  return PLATFORM_POSTING_RULES[normalizedPlatform] || 
    `${CROSS_PLATFORM_RULES}\n${TESTING_AND_QUALITY_RULES}`;
};

// For backwards compatibility
export const FACEBOOK_POSTING_RULES = PLATFORM_POSTING_RULES.facebook;
