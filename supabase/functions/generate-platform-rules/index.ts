import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { platform, userId } = await req.json();

    if (!platform) throw new Error('Platform is required');

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Determine target user_id: if userId provided use it, otherwise extract from JWT
    let targetUserId = userId;
    if (!targetUserId) {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        targetUserId = user?.id;
      }
    }

    if (!targetUserId) throw new Error('User ID is required');

    // Check if this user already has platform rules for this platform
    const { data: existing } = await supabase
      .from('knowledge_base')
      .select('id')
      .eq('user_id', targetUserId)
      .eq('doc_type', 'platform_rules')
      .ilike('title', `%${platform}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Platform rules already exist', alreadyExists: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert social media marketing strategist. Create comprehensive, actionable posting guidelines for healthcare/dental practices. Be specific with numbers, formats, and tactics. Include current best practices and viral tips.`;

    const userPrompt = `Create a comprehensive posting guidelines report for **${platform}**. Cover ALL of the following:

## Content Format & Specs
- Optimal post lengths (characters), image sizes, video dimensions & duration
- Supported formats (carousel, reels, stories, live, polls, etc.)

## Best Posting Times & Frequency
- Best days/times to post (with timezone considerations)
- Optimal posting frequency per week
- How algorithm rewards consistency

## Content Strategy
- What types of content perform best (educational, behind-the-scenes, testimonials, before/after)
- Hook techniques that stop the scroll
- Storytelling frameworks that drive engagement
- Call-to-action best practices

## Hashtag & Discovery Strategy
- Optimal number of hashtags
- Mix strategy (branded, niche, trending)
- How the platform's discovery/algorithm works

## Engagement & Growth Tactics
- How to boost organic reach
- Comment/reply strategies
- Collaboration and cross-promotion tips
- Community building techniques

## Viral Tips & Trends
- Current trending formats and features
- What makes content go viral on this platform
- Algorithm hacks and tips
- Common mistakes to avoid

## Healthcare/Dental Specific
- HIPAA-compliant content guidelines
- Trust-building content strategies
- Patient testimonial best practices
- Before/after photo guidelines

Format as a clean, well-organized document with clear headers and bullet points. Be specific — include actual numbers, percentages, and examples where possible.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
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
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content generated');

    const title = `${platform.charAt(0).toUpperCase() + platform.slice(1)} Posting Guidelines & Best Practices`;

    // Save to KB
    const { data: savedDoc, error: saveError } = await supabase
      .from('knowledge_base')
      .insert({
        user_id: targetUserId,
        title,
        doc_type: 'platform_rules',
        content,
        metadata: { platform, source: 'ai-generated', generated_at: new Date().toISOString() },
      })
      .select()
      .single();

    if (saveError) {
      console.error('Save error:', saveError);
      throw new Error('Failed to save platform rules');
    }

    return new Response(
      JSON.stringify({ success: true, document: savedDoc }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating platform rules:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
