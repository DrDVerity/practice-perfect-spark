import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Consolidated Cross-Platform Posting Rules
const CROSS_PLATFORM_RULES = `
# Cross-Platform Posting Rules

## 1. Define goal, KPI, and platform
- Choose one main outcome: clicks to website/landing page, DMs/messages, profile visits, or event/lead form registrations.
- Set a primary KPI for success (click-through rate, number of link clicks, cost per click, number of DMs, or form starts).
- Describe who the post is for: demographics, location, role/title, interests, and primary pain point or desire.

## 2. Clarify offer, destination, and message
- Specify exactly what the user gets when they click: article, booking page, discount offer, webinar, quiz, resource, or DM conversation.
- State the primary benefit from the user's perspective (save time, save money, reduce stress, improve appearance, etc.).
- Select a single main idea or promise that everything in the post will support.

## 3. Master copy structure
- Write the first line to immediately grab attention using: pain point, bold benefit, surprising insight, or specific question.
- In 2–6 short sentences, explain the situation, highlight the main benefit, and add one piece of proof.
- Use one clear action command aligned with the objective: "Click to book," "Tap the link," "DM us," "Register here."
- Explicitly state what happens after the click. Avoid exaggerated promises.

## 4. Visual and formatting rules
- Design for mobile first: ensure key text is large, faces or focal objects are clear.
- Maintain brand consistency across all platforms.
- Use images for simple offers, short video/Reels for demonstrations, carousels for steps or multiple options.
`;

const FACEBOOK_RULES = `
## Facebook Rules
- Focus on: link clicks, conversions, or messages.
- Place the hook in the first 1–2 lines so it appears before "See more."
- Use short paragraphs; avoid large blocks of text.
- End copy with one direct CTA that matches the button label.
- When appropriate, include a simple question to encourage comments.
`;

const INSTAGRAM_RULES = `
## Instagram Rules
- Choose the main action: bio link click, Story/Reel link tap, or DM.
- Make the first frame/slide visually bold with a clear promise.
- Ensure on-image text is extremely short (3–7 words) and legible on small screen.
- Use a compelling first 2–3 lines in the caption to hook before the "…more" cut.
- Add 5–10 relevant hashtags (niche and local), location tag when useful.
`;

const TWITTER_RULES = `
## X (Twitter) Rules
- Aim for concise posts (~70–120 characters for single posts) unless using a thread.
- Lead with a bold statement, clear result, or sharp question that stops scroll.
- Include only one primary link per post.
- Use 0–2 targeted hashtags maximum.
- Add a simple, relevant image or graphic when it clarifies the offer.
`;

const LINKEDIN_RULES = `
## LinkedIn Rules
- Focus on professional outcomes: website visits, event registrations, lead form clicks.
- Anchor messaging in the role, responsibilities, and pain points of the professional persona.
- Open with a concrete result, contrarian insight, or direct problem statement.
- Provide real value in-feed (insight, mini-framework, short story) before any link.
- Use short paragraphs and light bullets for readability.
- Keep tone professional but human.
`;

// Platform-specific rules map
const PLATFORM_RULES: Record<string, string> = {
  facebook: FACEBOOK_RULES,
  instagram: INSTAGRAM_RULES,
  linkedin: LINKEDIN_RULES,
  twitter: TWITTER_RULES,
};

const getPostingRulesForPlatform = (platform: string): string => {
  const normalizedPlatform = platform?.toLowerCase() || 'facebook';
  const platformRules = PLATFORM_RULES[normalizedPlatform] || FACEBOOK_RULES;
  return `${CROSS_PLATFORM_RULES}\n${platformRules}`;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      platform,
      practiceName,
      practiceEmail,
      websiteUrl,
      targetAudience,
      postFocus,
      landingPage,
      startDate,
      endDate,
      campaignName,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Get platform-specific rules
    const platformRules = getPostingRulesForPlatform(platform);

    // Build the prompt
    const systemPrompt = `You are an expert social media marketing specialist for dental practices. 
You create highly engaging, compliant, and effective social media posts that drive patient engagement and bookings.

Follow these platform-specific posting rules:
${platformRules}

Always generate content that is:
- Professional yet approachable
- HIPAA compliant (no patient information)
- Focused on benefits and outcomes
- Clear with a strong call to action`;

    const userPrompt = `Create a social media post for ${platform} with the following details:

**Practice Information:**
- Practice Name: ${practiceName}
- Website: ${websiteUrl || 'Not provided'}
- Email: ${practiceEmail || 'Not provided'}

**Campaign Details:**
- Campaign: ${campaignName || 'General Campaign'}
- Post Focus: ${postFocus}
- Target Audience: ${targetAudience}
- Landing Page: ${landingPage || websiteUrl || 'Practice website'}
- Campaign Period: ${startDate} to ${endDate}

Generate:
1. A compelling post title (5-10 words)
2. The full post content (following the platform rules above)
3. A brief image description for what image would work best with this post

Format your response as JSON with this structure:
{
  "title": "The post title",
  "content": "The full post content with proper formatting, line breaks, emojis where appropriate",
  "imageDescription": "Description of the ideal image to accompany this post"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiData = await response.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('No content generated');
    }

    // Parse the JSON response
    let parsedContent;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      // If parsing fails, use the raw content
      parsedContent = {
        title: postFocus,
        content: aiContent,
        imageDescription: 'Professional dental practice image',
      };
    }

    return new Response(
      JSON.stringify({
        title: parsedContent.title,
        content: parsedContent.content,
        imageDescription: parsedContent.imageDescription,
        imageUrl: null, // Image generation can be added later
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in generate-post function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
