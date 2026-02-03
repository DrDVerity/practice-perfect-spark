import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Facebook Posting Rules for AI context
const FACEBOOK_POSTING_RULES = `
Posting Rules for Facebook

1. Identify the post goal and KPI
- Define a single, primary objective for the post (e.g., drive link clicks, generate lead form submissions, get messages).
- Set one main performance metric (e.g., click-through rate, cost per click, number of messages) to guide all creative decisions.

2. Define the target audience
- Specify who the post is for using concrete traits: location, age range, interests, problems, and stage of awareness.
- Summarize the audience in one sentence you can write to directly.

3. Clarify the offer and destination
- Describe exactly what the user gets by clicking (article, booking page, quiz, discount, webinar, etc.).
- Confirm that the landing page headline, promise, and imagery closely match what the post will say.

4. Craft a single, strong hook line
- Write the first line to immediately grab attention using one of these angles: pain point, bold benefit, curiosity, or time-limited offer.
- Make the hook specific and concrete, avoiding vague language.

5. Speak directly to the audience
- Use "you" language and, when appropriate, explicitly call out the audience.
- Mirror the audience's own words for their problem or desire.

6. Focus on one core message
- Choose one main idea or promise for the post and remove secondary ideas that compete for attention.
- Ensure every sentence in the copy supports this single message.

7. Structure the primary text clearly
- Place the hook in the first 1–2 lines so it appears before the "See more" cutoff.
- Use short sentences and line breaks to create a visually scannable structure.
- Keep the text concise but complete.

8. Highlight a specific benefit and proof
- State the most important outcome or benefit the user cares about.
- Add one clear piece of proof: a number, short testimonial snippet, or qualification.

9. Add urgency or relevance without deception
- If appropriate, specify a time or quantity limit.
- Ensure all urgency or scarcity claims are accurate.

10. Use a direct, explicit call to action
- Choose one action verb that matches the goal and destination.
- Place the call to action near the end of the primary text.

11. Match tone to objective and audience
- Choose a tone (friendly, expert, urgent, empathetic) that fits both the brand and the audience.
- Keep the tone confident but not exaggerated; prioritize clarity over cleverness.

12. Avoid common friction and spam triggers
- Do not use clickbait phrases that overpromise results.
- Avoid excessive punctuation, all caps, or emoji overload.

13. Localize when relevant
- Mention city, neighborhood, or local landmarks when the offer is location-specific.
`;

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

    // Build the prompt
    const systemPrompt = `You are an expert social media marketing specialist for dental practices. 
You create highly engaging, compliant, and effective social media posts that drive patient engagement and bookings.

Follow these platform-specific posting rules:
${FACEBOOK_POSTING_RULES}

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
