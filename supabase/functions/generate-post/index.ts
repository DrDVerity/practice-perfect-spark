import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Fallback platform hints (used only if KB has no rules)
const PLATFORM_HINTS: Record<string, string> = {
  facebook: 'Facebook: credibility, community, and practical value. First 1-2 lines: audience + problem/outcome. 3-6 short sentences. Single CTA. Link to one clear page.',
  instagram: 'Instagram: visual trust and concise benefit. Caption: audience + outcome. CTA: "Tap bio link" or "DM [keyword]". 5-10 targeted hashtags only if useful.',
  linkedin: 'LinkedIn: professional, insight-led, business-outcome focused. First 2 lines: concrete outcome/insight. 3-6 bullets explaining change. CTA: "Learn more" or "Read the full article".',
  twitter: 'X/Twitter: quick answers, thought leadership. Hook in 1-2 lines. One value statement before link. Single link, light CTA.',
  youtube: 'YouTube: deep education, SEO. Hook + clear audience payoff in 0-10s. Step-by-step with benefits. Final 30-60s: recap + CTA.',
  tiktok: 'TikTok: humanize the business, simplify topics. 0-3s pattern-interrupt hook. One explanation with text overlay. Brief CTA. Casual tone.',
};

const MAX_STR = 500;
const clip = (v: unknown, n = MAX_STR): string | undefined => typeof v === 'string' ? v.slice(0, n) : undefined;
const cleanLine = (v: unknown) => String(v || '').replace(/\s+/g, ' ').trim();

interface SocialPostBrief {
  businessName: string;
  businessType: string;
  coreOffer: string;
  campaignTopic: string;
  campaignPromise: string;
  targetAudience: string;
  voice: string;
  mustInclude: string[];
  mustAvoid: string[];
}

const DEFAULT_MUST_AVOID = [
  'teeth whitening', 'Invisalign', 'implants', 'veneers', 'smile makeovers',
  'routine cleanings', 'appointments', 'weddings', 'graduations', 'vacations',
  'summer specials', 'patient-facing dental treatment offers not named in the campaign brief',
];

function extractJsonObject<T = any>(raw: string): T {
  const cleaned = raw.replace(/```[a-z]*\n?/gi, '').trim();
  try { return JSON.parse(cleaned) as T; } catch {}
  const obj = cleaned.match(/\{[\s\S]*\}/);
  if (obj) return JSON.parse(obj[0]) as T;
  throw new Error('No JSON object found');
}

async function callBriefAI(apiKey: string, system: string, user: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.25,
      response_format: { type: 'json_object' },
    }),
  });
  if (!response.ok) throw new Error(`Brief AI error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function buildSocialPostBrief(opts: {
  apiKey: string;
  practiceName: string;
  profileFocus: string;
  campaignName: string;
  campaignFocus: string;
  postFocus: string;
  targetAudience: string;
  brandVoice: string;
  strategy: string;
  psychologicalApproach: string;
  targetMarketRefined: string;
  kbExcerpt: string;
}): Promise<SocialPostBrief> {
  const topic = cleanLine(opts.postFocus || opts.campaignName || opts.campaignFocus);
  const fallback: SocialPostBrief = {
    businessName: cleanLine(opts.practiceName) || 'the business',
    businessType: cleanLine(opts.profileFocus) || 'the business described in the campaign strategy and knowledge base',
    coreOffer: cleanLine(opts.campaignFocus || topic),
    campaignTopic: topic,
    campaignPromise: cleanLine(opts.postFocus || opts.campaignFocus || topic),
    targetAudience: cleanLine(opts.targetAudience) || 'the campaign target audience',
    voice: cleanLine(opts.brandVoice) || 'professional, direct, credible, and warm',
    mustInclude: [topic, opts.postFocus, opts.campaignFocus].map(cleanLine).filter(Boolean).slice(0, 8),
    mustAvoid: DEFAULT_MUST_AVOID,
  };

  if (!opts.strategy && !opts.kbExcerpt) return fallback;

  try {
    const raw = await callBriefAI(opts.apiKey,
      `You are a campaign brief editor for social post generation. Return ONLY valid JSON with keys:
{"businessName":string,"businessType":string,"coreOffer":string,"campaignTopic":string,"campaignPromise":string,"targetAudience":string,"voice":string,"mustInclude":string[],"mustAvoid":string[]}

SOURCE PRIORITY: campaign strategy/name/focus/post focus are authoritative; profile and KB are background. Do not convert a B2B marketing-agent campaign into a patient-facing dental treatment promotion. Do not invent seasonal offers or clinical services unless explicitly named.`,
      `CAMPAIGN NAME: ${opts.campaignName || '(none)'}
POST FOCUS / TOPIC: ${opts.postFocus || '(none)'}
CAMPAIGN FOCUS / OFFER: ${opts.campaignFocus || '(none)'}

STRATEGIC PLAN (AUTHORITATIVE):
${opts.strategy || '(none)'}

PSYCHOLOGICAL APPROACH:
${opts.psychologicalApproach || '(none)'}

REFINED TARGET MARKET:
${opts.targetMarketRefined || '(none)'}

PROFILE:
- Business/profile name: ${opts.practiceName || '(unknown)'}
- Business focus/positioning: ${opts.profileFocus || '(none)'}
- Default target audience: ${opts.targetAudience || '(none)'}
- Brand voice: ${opts.brandVoice || '(none)'}

KNOWLEDGE BASE EXCERPTS:
${opts.kbExcerpt || '(none)'}

Build the approved social post brief now. If this is about Archer Marketing / an AI marketing agent / the best hiring decision for a dental practice owner, keep it B2B marketing, ROI, efficiency, growth, and delegation focused.`
    );
    const parsed = extractJsonObject<Partial<SocialPostBrief>>(raw);
    return {
      businessName: cleanLine(parsed.businessName) || fallback.businessName,
      businessType: cleanLine(parsed.businessType) || fallback.businessType,
      coreOffer: cleanLine(parsed.coreOffer) || fallback.coreOffer,
      campaignTopic: cleanLine(parsed.campaignTopic) || fallback.campaignTopic,
      campaignPromise: cleanLine(parsed.campaignPromise) || fallback.campaignPromise,
      targetAudience: cleanLine(parsed.targetAudience) || fallback.targetAudience,
      voice: cleanLine(parsed.voice) || fallback.voice,
      mustInclude: Array.isArray(parsed.mustInclude) ? parsed.mustInclude.map(cleanLine).filter(Boolean).slice(0, 8) : fallback.mustInclude,
      mustAvoid: Array.isArray(parsed.mustAvoid) ? [...parsed.mustAvoid.map(cleanLine).filter(Boolean), ...DEFAULT_MUST_AVOID].slice(0, 18) : fallback.mustAvoid,
    };
  } catch (e) {
    console.warn('Could not build AI social post brief:', e);
    return fallback;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authenticated caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const _authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await _authClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Rate limit (per minute, per user)
    {
      const _userId = (claimsData.claims as any).sub as string;
      const _sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const { data: _ok } = await _sb.rpc('check_and_consume_rate_limit', { _user_id: _userId, _endpoint: 'generate-post', _max_per_minute: 10 });
      if (_ok === false) return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const campaignId = clip(body.campaignId, 100);
    const platform = clip(body.platform, 50);
    const requestedPracticeName = clip(body.practiceName, 200);
    const practiceEmail = clip(body.practiceEmail, 200);
    const websiteUrl = clip(body.websiteUrl, 500);
    const requestedTargetAudience = clip(body.targetAudience, 500);
    const requestedPostFocus = clip(body.postFocus, 500);
    const landingPage = clip(body.landingPage, 500);
    const startDate = clip(body.startDate, 50);
    const endDate = clip(body.endDate, 50);
    const campaignName = clip(body.campaignName, 200);
    const variationCount = Math.min(Math.max(Number(body.variationCount) || 3, 1), 5);

    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let ownerId = user.id;
    let campaign: any = null;
    if (campaignId) {
      const { data: campaignRow } = await supabase
        .from('campaigns')
        .select('id,user_id,name,focus,content_topic,strategy,target_market_refined,psychological_approach,landing_page_url,start_date,end_date')
        .eq('id', campaignId)
        .maybeSingle();
      if (!campaignRow) throw new Error('Campaign not found');

      let allowed = user.id === campaignRow.user_id;
      if (!allowed) {
        const { data: adminRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
        allowed = !!adminRole;
      }
      if (!allowed) {
        const { data: managerRow } = await supabase.from('manager_assignments').select('id').eq('manager_user_id', user.id).eq('client_user_id', campaignRow.user_id).maybeSingle();
        allowed = !!managerRow;
      }
      if (!allowed) throw new Error('Forbidden');
      campaign = campaignRow;
      ownerId = campaignRow.user_id;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('practice_name, website_url, target_audience, campaign_focus, brand_voice')
      .eq('user_id', ownerId)
      .maybeSingle();

    const practiceName = cleanLine(requestedPracticeName || profile?.practice_name || 'the business');
    const targetAudience = cleanLine(
      requestedTargetAudience ||
      (campaign as any)?.target_market_refined ||
      profile?.target_audience ||
      'the campaign target audience'
    ).slice(0, 1200);
    const postFocus = cleanLine(
      requestedPostFocus ||
      campaign?.content_topic ||
      campaign?.focus ||
      campaign?.name ||
      'campaign message'
    );
    const campaignFocus = cleanLine(campaign?.focus || requestedPostFocus || profile?.campaign_focus || postFocus);
    const effectiveWebsiteUrl = cleanLine(websiteUrl || profile?.website_url || '');
    const strategy = String(campaign?.strategy || '');
    const psychologicalApproach = String(campaign?.psychological_approach || '');
    const targetMarketRefined = String(campaign?.target_market_refined || '');

    // Fetch platform-specific rules and KB context for the owner
    let platformRulesContent = '';
    let kbContext = '';
    try {
          // Platform posting rules live ONLY in the admin KB. Read from there.
          const { data: adminRoles } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin')
            .limit(1);

          const adminUserId = adminRoles?.[0]?.user_id;
          if (adminUserId) {
            const { data: adminPlatformDocs } = await supabase
              .from('knowledge_base')
              .select('content')
              .eq('user_id', adminUserId)
              .eq('doc_type', 'platform_rules')
              .ilike('title', `%${platform}%`)
              .limit(1);

            if (adminPlatformDocs && adminPlatformDocs.length > 0) {
              const content = adminPlatformDocs[0].content;
              platformRulesContent = content.length > 1500
                ? content.substring(0, 1500) + '...'
                : content;
            }
          }


          // 3. Fetch other relevant KB docs (audience, market, brand)
          const { data: kbDocs } = await supabase
            .from('knowledge_base')
            .select('title, doc_type, content, metadata')
            .eq('user_id', ownerId)
            .in('doc_type', ['audience_analysis', 'market_analysis', 'competitive_landscape', 'brand_guidelines', 'system_prompt', 'business_dna', 'demographics', 'custom'])
            .order('updated_at', { ascending: false })
            .limit(10);

          if (kbDocs && kbDocs.length > 0) {
            const summaries = kbDocs.filter((doc: any) => (doc.metadata as any)?.file_kind !== 'image').map((doc: any) => {
              const truncated = doc.content.length > 500 
                ? doc.content.substring(0, 500) + '...' 
                : doc.content;
              return `[${doc.title}]: ${truncated}`;
            });
            kbContext = `\n\nKnowledge Base context (use these insights):\n${summaries.join('\n\n')}`;
          }
    } catch (kbError) {
      console.warn('Could not fetch KB docs:', kbError);
    }

    const socialBrief = await buildSocialPostBrief({
      apiKey: OPENROUTER_API_KEY,
      practiceName,
      profileFocus: profile?.campaign_focus || '',
      campaignName: campaignName || campaign?.name || '',
      campaignFocus,
      postFocus,
      targetAudience,
      brandVoice: profile?.brand_voice || '',
      strategy,
      psychologicalApproach,
      targetMarketRefined,
      kbExcerpt: kbContext,
    });

    // Use comprehensive KB rules if available, otherwise fall back to basic hints
    const platformHint = platformRulesContent || PLATFORM_HINTS[platform?.toLowerCase()] || PLATFORM_HINTS.facebook;

    const systemPrompt = `You are an expert social media marketer. Create platform-native posts from the APPROVED SOCIAL POST BRIEF.

CRITICAL CONTENT FIDELITY RULES:
- The approved brief, campaign strategy, campaign topic, and post focus are authoritative.
- Write from the business named in the brief to the target audience named in the brief.
- Do NOT substitute a different subject, industry, product, service, or seasonal promotion.
- Do NOT write patient-facing dental treatment posts unless the campaign topic/focus explicitly names that treatment.
- Forbidden drift topics unless explicitly in the brief: teeth whitening, Invisalign, implants, veneers, smile makeovers, routine cleanings, appointments, weddings, graduations, vacations, summer specials.
- For LinkedIn, write professional B2B copy with business outcomes, ROI, efficiency, delegation, and credibility when those match the brief.
- One clear, low-friction CTA per post.
- Plain language, no jargon.

Platform Posting Guidelines:
${platformHint}${kbContext}`;

    const userPrompt = `APPROVED SOCIAL POST BRIEF (AUTHORITATIVE):
${JSON.stringify(socialBrief, null, 2)}

Create ${variationCount} unique social media post variations for ${platform}.

Business: ${socialBrief.businessName || practiceName} | Website: ${effectiveWebsiteUrl || 'N/A'} | Campaign: ${campaignName || campaign?.name || 'General'}
Topic / post focus: ${socialBrief.campaignTopic || postFocus}
Campaign promise / offer: ${socialBrief.campaignPromise || campaignFocus}
Audience: ${socialBrief.targetAudience || targetAudience}
Landing: ${landingPage || campaign?.landing_page_url || effectiveWebsiteUrl || 'Business website'}
Period: ${startDate} to ${endDate}

Strategic plan (authoritative):
${strategy.slice(0, 4500) || '(none)'}

Refined target market:
${targetMarketRefined.slice(0, 1600) || '(none)'}

For each variation, generate a compelling title (5-10 words), full post content (hook + value + CTA), and a brief image description.
The image description must match the actual campaign topic and must not default to dental/clinical imagery unless the approved brief requires it.

Return JSON array:
[
  { "title": "...", "content": "...", "imageDescription": "..." },
  { "title": "...", "content": "...", "imageDescription": "..." },
  { "title": "...", "content": "...", "imageDescription": "..." }
]`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
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
        imageDescription: `Professional marketing image for ${socialBrief.campaignTopic || postFocus}, aimed at ${socialBrief.targetAudience || targetAudience}`,
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
