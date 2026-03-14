import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Fallback platform hints (used only if KB has no rules)
const PLATFORM_HINTS: Record<string, string> = {
  facebook: 'Facebook: credibility, community, family decisions. First 1-2 lines: local + problem/outcome. 3-6 short sentences. Single CTA button. Link to one clear page.',
  instagram: 'Instagram: visual trust, cosmetic appeal. High-quality vertical content. Caption: local + benefit. CTA: "Tap bio link" or "DM [keyword]". 5-10 targeted hashtags.',
  linkedin: 'LinkedIn: professional trust, referrals. First 2 lines: concrete outcome/insight. 3-6 bullets explaining change. CTA: "Learn more" or "Refer patients".',
  twitter: 'X/Twitter: quick answers, thought leadership. Hook in 1-2 lines. One value statement before link. Single link, light CTA.',
  youtube: 'YouTube: deep education, SEO. Hook + reassurance in 0-10s. Step-by-step with benefits. Final 30-60s: recap + local CTA.',
  tiktok: 'TikTok: humanize clinicians, simplify topics. 0-3s pattern-interrupt hook. One explanation with text overlay. Brief CTA. Casual tone.',
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
      variationCount = 3,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch platform-specific rules and KB context for the user
    let platformRulesContent = '';
    let kbContext = '';
    try {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);

        if (user) {
          // 1. Check client KB for platform-specific posting rules
          const { data: platformDocs } = await supabase
            .from('knowledge_base')
            .select('content')
            .eq('user_id', user.id)
            .eq('doc_type', 'platform_rules')
            .ilike('title', `%${platform}%`)
            .limit(1);

          if (platformDocs && platformDocs.length > 0) {
            // Truncate to ~1500 chars for prompt efficiency
            const content = platformDocs[0].content;
            platformRulesContent = content.length > 1500 
              ? content.substring(0, 1500) + '...' 
              : content;
          } else {
            // 2. Fallback: check admin KB for platform rules
            const { data: adminRoles } = await supabase
              .from('user_roles')
              .select('user_id')
              .eq('role', 'admin')
              .limit(1);

            const adminUserId = adminRoles?.[0]?.user_id;
            if (adminUserId) {
              const { data: adminPlatformDocs } = await supabase
                .from('knowledge_base')
                .select('title, content, metadata')
                .eq('user_id', adminUserId)
                .eq('doc_type', 'platform_rules')
                .ilike('title', `%${platform}%`)
                .limit(1);

              if (adminPlatformDocs && adminPlatformDocs.length > 0) {
                const adminDoc = adminPlatformDocs[0];
                const content = adminDoc.content;
                platformRulesContent = content.length > 1500 
                  ? content.substring(0, 1500) + '...' 
                  : content;

                // Auto-copy to client KB for future use
                await supabase
                  .from('knowledge_base')
                  .insert({
                    user_id: user.id,
                    title: adminDoc.title,
                    doc_type: 'platform_rules',
                    content: adminDoc.content,
                    metadata: { ...adminDoc.metadata, copied_from: 'admin_kb' },
                  });
              }
            }
          }

          // 3. Fetch other relevant KB docs (audience, market, brand)
          const { data: kbDocs } = await supabase
            .from('knowledge_base')
            .select('title, doc_type, content')
            .eq('user_id', user.id)
            .in('doc_type', ['audience_analysis', 'market_analysis', 'competitive_landscape', 'brand_guidelines'])
            .order('updated_at', { ascending: false })
            .limit(4);

          if (kbDocs && kbDocs.length > 0) {
            const summaries = kbDocs.map((doc: any) => {
              const truncated = doc.content.length > 500 
                ? doc.content.substring(0, 500) + '...' 
                : doc.content;
              return `[${doc.title}]: ${truncated}`;
            });
            kbContext = `\n\nKnowledge Base context (use these insights):\n${summaries.join('\n\n')}`;
          }
        }
      }
    } catch (kbError) {
      console.warn('Could not fetch KB docs:', kbError);
    }

    const platformHint = PLATFORM_HINTS[platform?.toLowerCase()] || PLATFORM_HINTS.facebook;

    const systemPrompt = `You are an expert healthcare social media marketer. Create posts for local dental/wellness practices targeting adults 25-55.

Rules:
- Lead with specific patient questions/problems
- Use local anchors (city, neighborhood)
- One clear, low-friction CTA per post
- HIPAA compliant, no patient identities
- Emphasize: convenience, affordability, comfort, trust
- Plain language, no jargon

Platform: ${platformHint}${kbContext}`;

    const userPrompt = `Create ${variationCount} unique social media post variations for ${platform}.

Practice: ${practiceName} | Website: ${websiteUrl || 'N/A'} | Campaign: ${campaignName || 'General'}
Focus: ${postFocus} | Audience: ${targetAudience} | Landing: ${landingPage || websiteUrl || 'Practice website'}
Period: ${startDate} to ${endDate}

For each variation, generate a compelling title (5-10 words), full post content (hook + value + CTA), and a brief image description.

Return JSON array:
[
  { "title": "...", "content": "...", "imageDescription": "..." },
  { "title": "...", "content": "...", "imageDescription": "..." },
  { "title": "...", "content": "...", "imageDescription": "..." }
]`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
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

    let variations;
    try {
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        variations = JSON.parse(jsonMatch[0]);
      } else {
        // Try single object fallback
        const objMatch = aiContent.match(/\{[\s\S]*\}/);
        if (objMatch) {
          variations = [JSON.parse(objMatch[0])];
        } else {
          throw new Error('No JSON found');
        }
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      variations = [{
        title: postFocus,
        content: aiContent,
        imageDescription: 'Professional dental practice showing real staff and welcoming environment',
      }];
    }

    return new Response(
      JSON.stringify({ variations }),
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
