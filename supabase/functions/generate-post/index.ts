import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Executive Summary for Local Healthcare Social Content
const EXECUTIVE_SUMMARY = `
# Executive Summary (Healthcare, Local, 25–55)

For local healthcare (dental and wellness) serving adults 25–55, the most effective social media posts do three things consistently:

1. **Answer real patient questions fast**
   Lead with practical, specific answers patients actually search for: "When should I see a dentist?", "How much does this cost?", "What happens at my first visit?", "Is this available near me?"

2. **Show real people and local proof**
   Feature real clinicians and staff, simple visuals of the practice, local cues (city, neighborhood, community events), and HIPAA‑safe patient stories and reviews.

3. **Make the next step extremely clear and low‑friction**
   Give one obvious next action and link to a mobile‑friendly page that matches the promise in the post.

Emphasize: Locality, Convenience, Affordability/transparency, Comfort/trust, Preventive and cosmetic outcomes.
`;

// Core Strategy
const CORE_STRATEGY = `
# Core Strategy for Local Healthcare Social Content

## Define Patient‑Centric Goals
Choose one main goal per post: Bookings, Lead capture, Education, or Relationship building.
Choose one main KPI: CTR, form submissions, DMs with intent, or saves/shares.

## Define the Local Patient Persona
- Age band within 25–55
- Life situation and primary concern
- Local anchor (city, neighborhood)
- One sentence you speak directly to

## Clarify Offer and Destination
- Define the offer clearly (new patient special, free consult, whitening, etc.)
- Specify the destination (booking page, service page, DM flow)
- Ensure message match between post and landing page
`;

// Universal Creative Rules
const UNIVERSAL_CREATIVE_RULES = `
# Universal Creative Rules

## Hook (First line / first 3 seconds)
- Name a specific problem or symptom ("Bleeding when you floss?")
- Promise a specific outcome ("A same‑day crown in one visit")
- Or directly call out the local audience

## Value and Proof
Include at least one of:
- A "when to come in" rule of thumb
- A mini before/after scenario (HIPAA‑safe)
- A specific, believable metric
- A short social proof point

## Call to Action
Give one primary action. Reduce friction by mentioning online booking, hours, or membership options.

## Visuals
- Favor real clinicians, staff, and space over stock
- Keep visuals simple, bright, legible on phone
- Minimal on‑image text (3–7 words)

## Compliance
- Never reference specific patient identities without consent
- Don't diagnose in comments/DMs
- Avoid fear‑mongering
`;

// Platform-specific rules
const FACEBOOK_RULES = `
## Facebook Rules
**Primary role:** Credibility, community presence, family‑level decisions.
**Structure:**
- First 1–2 lines: local + problem/outcome
- 3–6 short sentences with benefit and proof
- Single CTA aligned with button: "Book now," "Learn more," "Send message"
**Best practices:** Link to one clear page, show benefit visually, encourage comments.
`;

const INSTAGRAM_RULES = `
## Instagram Rules
**Primary role:** Visual trust, cosmetic appeal, younger/mid-career adults.
**Structure:**
- Visual first: high-quality vertical content
- Caption: local + benefit in first lines, step breakdown in middle
- CTA: "Tap bio link" or "DM [keyword]"
**Hashtags:** 5–10 targeted (local + service + demographic)
**Stories:** Use link stickers, polls, question boxes
`;

const TWITTER_RULES = `
## X (Twitter) Rules
**Primary role:** Quick answers, thought leadership, link distribution.
**Structure:**
- Hook in 1–2 lines: symptom, myth, or outcome
- One value statement before link
- Single link, light CTA
**Threads:** 3–6 tweets: problem → explanation → action → CTA/link
`;

const LINKEDIN_RULES = `
## LinkedIn Rules
**Primary role:** Professional trust, referrals, hiring.
**Structure:**
- First 2 lines: concrete outcome or insight
- Middle: 3–6 sentences/bullets explaining change
- CTA: "Learn more," "Refer patients," "We're hiring"
`;

const YOUTUBE_RULES = `
## YouTube Rules
**Primary role:** Deep education, SEO, conversion.
**Long-form structure:**
- 0–10s: hook + reassurance
- 10–60s: context, who this is for
- Middle: step-by-step with benefits
- Final 30–60s: recap + local CTA
**Shorts:** 15–45s, one problem/answer, hook in first 1–2 seconds
`;

const TIKTOK_RULES = `
## TikTok Rules
**Primary role:** Humanize clinicians, simplify topics, reach younger adults.
**Structure:**
- 0–3s: pattern‑interrupt hook (local + symptom/outcome)
- Middle: one explanation with text overlay
- End: brief CTA
**Tone:** Casual, friendly, factually careful. No diagnosing.
`;

// Platform rules map
const PLATFORM_RULES: Record<string, string> = {
  facebook: FACEBOOK_RULES,
  instagram: INSTAGRAM_RULES,
  linkedin: LINKEDIN_RULES,
  twitter: TWITTER_RULES,
  youtube: YOUTUBE_RULES,
  tiktok: TIKTOK_RULES,
};

const getPostingRulesForPlatform = (platform: string): string => {
  const normalizedPlatform = platform?.toLowerCase() || 'facebook';
  const platformRules = PLATFORM_RULES[normalizedPlatform] || FACEBOOK_RULES;
  return `${EXECUTIVE_SUMMARY}\n${CORE_STRATEGY}\n${UNIVERSAL_CREATIVE_RULES}\n${platformRules}`;
};

serve(async (req) => {
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

    const platformRules = getPostingRulesForPlatform(platform);

    const systemPrompt = `You are an expert social media marketing specialist for local healthcare practices (dental and wellness). 
You create highly engaging, compliant, and effective social media posts that drive patient engagement and bookings.

Follow these platform-specific posting rules:
${platformRules}

Always generate content that is:
- Patient-centric with specific, practical answers
- HIPAA compliant (no patient information)
- Locally anchored with city/neighborhood references
- Focused on convenience, trust, and clear outcomes
- Clear with a single, low-friction call to action`;

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
1. A compelling post title (5-10 words) with local anchor
2. The full post content following the platform rules (hook, value/proof, single CTA)
3. A brief image description showing real staff/space, not stock imagery

Format your response as JSON:
{
  "title": "The post title",
  "content": "The full post content with proper formatting, line breaks, emojis where appropriate",
  "imageDescription": "Description of ideal image featuring real clinicians/staff/space"
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

    let parsedContent;
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedContent = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      parsedContent = {
        title: postFocus,
        content: aiContent,
        imageDescription: 'Professional dental practice showing real staff and welcoming environment',
      };
    }

    return new Response(
      JSON.stringify({
        title: parsedContent.title,
        content: parsedContent.content,
        imageDescription: parsedContent.imageDescription,
        imageUrl: null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-post function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
