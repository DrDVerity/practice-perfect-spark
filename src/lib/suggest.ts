import { supabase } from "@/integrations/supabase/client";

export interface SuggestParams {
  /** Semantic field id, e.g. "campaign_focus", "target_audience", "campaign_name", "post_caption". */
  field: string;
  /** Optional free-form context (current values, platform, etc.) to sharpen suggestions. */
  context?: Record<string, unknown>;
  userId?: string | null;
  campaignId?: string | null;
  count?: number;
}

/**
 * Fetch AI suggestions for any field, relevant to the practice scan.
 *
 * Tries, in order:
 *  1. the deployed `suggest-campaign-topics` function for focus/topic fields
 *  2. the generic `suggest-field` function
 *  3. a local heuristic fallback (so a Suggest button ALWAYS returns something)
 */
export async function suggestField(params: SuggestParams): Promise<string[]> {
  const { field, context, userId, campaignId, count = 4 } = params;

  // Route focus/topic to the existing, battle-tested topics function when we have a campaign.
  if ((field === "campaign_focus" || field === "topic") && campaignId) {
    try {
      const { data, error } = await supabase.functions.invoke("suggest-campaign-topics", {
        body: { campaignId, campaignName: context?.campaignName },
      });
      if (!error && Array.isArray(data?.topics) && data.topics.length) {
        return dedupe(data.topics).slice(0, count);
      }
    } catch {
      /* fall through */
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke("suggest-field", {
      body: { field, context, userId, campaignId, count },
    });
    if (!error && Array.isArray(data?.suggestions) && data.suggestions.length) {
      return dedupe(data.suggestions).slice(0, count);
    }
  } catch {
    /* fall through to local fallback */
  }

  return localFallback(field, context, count);
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const v = (s || "").toString().trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

/**
 * Heuristic fallback suggestions per field. Not as sharp as the AI, but keeps
 * every Suggest button useful when the edge function isn't reachable. Rotates
 * with `salt` so "refresh" shows different options.
 */
export function localFallback(field: string, context?: Record<string, unknown>, count = 4, salt = 0): string[] {
  const practice = (context?.practiceName as string) || "your practice";
  const focus = (context?.focus as string) || "";
  const banks: Record<string, string[]> = {
    campaign_focus: [
      "Attract new patients",
      "Promote teeth whitening",
      "Dental implants awareness",
      "Invisalign / clear aligners",
      "New patient special offer",
      "Reactivate lapsed patients",
      "Grow 5-star reviews",
      "Family & pediatric dentistry",
      "Emergency dental care",
      "Membership / savings plan",
    ],
    topic: [
      "5 signs you need a dental checkup",
      "How teeth whitening actually works",
      "Are dental implants right for you?",
      "What to expect at your first visit",
      "Invisalign vs braces: which is better?",
      "Handling a dental emergency",
    ],
    target_audience: [
      "Families with young children nearby",
      "Adults 25-45 seeking cosmetic dentistry",
      "New residents within 10 miles",
      "Professionals interested in Invisalign",
      "Seniors considering implants",
      "Lapsed patients who haven't visited in 12+ months",
    ],
    campaign_name: focus
      ? [`${focus} Drive`, `${focus} 2026`, `${focus} Special`, `${practice}: ${focus}`]
      : ["New Patient Drive", "Spring Whitening Promo", "Smile Makeover Campaign", "Reactivation Push"],
    post_caption: [
      "Your best smile starts here. Book today.",
      "New patients welcome, gentle care for the whole family.",
      "Ask us about same-day appointments this week.",
      "Brighten your smile in one visit. Learn how.",
    ],
    goal: [
      "Book 20 new patient appointments",
      "Fill next month's schedule",
      "Grow to 100 five-star reviews",
      "Launch a specialty service",
    ],
  };
  const bank = banks[field] || banks.campaign_focus;
  // rotate by salt so refresh varies the set
  const rotated = [...bank.slice(salt % bank.length), ...bank.slice(0, salt % bank.length)];
  return dedupe(rotated).slice(0, count);
}
