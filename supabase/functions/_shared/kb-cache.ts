// Shared KB reuse/upsert helpers for all report-generating edge functions.
// Goal: never accumulate duplicate AI-generated reports.
//
// Pattern per generator:
//   1. Call findCachedKBDoc(...) — returns the most recent matching row.
//   2. If returned AND fresh (< maxAgeDays) AND match_key fields match,
//      reuse its content and skip generation.
//   3. Otherwise generate fresh content and call upsertKBDoc(...) which
//      updates the matched row in place (or inserts if none existed).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type SupabaseAdmin = ReturnType<typeof createClient>;

export function adminClient(): SupabaseAdmin {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function norm(s: string | null | undefined): string {
  return (s ?? "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

export interface MatchKey {
  [k: string]: string | undefined | null;
}

function normalizeKey(mk: MatchKey): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(mk)) {
    const n = norm(v as any);
    if (n) out[k] = n;
  }
  return out;
}

function keysMatch(stored: any, incoming: Record<string, string>): boolean {
  if (!stored || typeof stored !== "object") return Object.keys(incoming).length === 0;
  for (const [k, v] of Object.entries(incoming)) {
    const s = norm(stored[k]);
    if (s && s !== v) return false;
  }
  return true;
}

export interface FindArgs {
  userId: string;
  docType: string;
  title?: string;          // stable title to look up by (exact match preferred)
  titleLike?: string;      // ILIKE pattern if title is not stable
  matchKey?: MatchKey;     // additional metadata fields that must match
  maxAgeDays?: number;     // default 30
}

export async function findCachedKBDoc(args: FindArgs) {
  const supabase = adminClient();
  const cutoff = new Date(Date.now() - (args.maxAgeDays ?? 30) * 86400000).toISOString();
  let q = supabase
    .from("knowledge_base")
    .select("id, title, content, metadata, updated_at, account_id, location_id, scope")
    .eq("user_id", args.userId)
    .eq("doc_type", args.docType)
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (args.title) q = q.eq("title", args.title);
  else if (args.titleLike) q = q.ilike("title", args.titleLike);

  const { data, error } = await q.maybeSingle();
  if (error || !data) return null;

  const incoming = normalizeKey(args.matchKey || {});
  const stored = (data as any).metadata?.match_key || {};
  if (!keysMatch(stored, incoming)) return null;
  return data as any;
}

export interface UpsertArgs {
  userId: string;
  docType: string;
  title: string;           // stable title
  content: string;
  matchKey?: MatchKey;
  extraMetadata?: Record<string, any>;
  accountId?: string | null;
  locationId?: string | null;
  scope?: "group" | "location";
}

// Find-or-create a row matching (user_id, doc_type, title). If a row exists
// (any age), update it in place. Otherwise insert a new one.
export async function upsertKBDoc(args: UpsertArgs) {
  const supabase = adminClient();

  // Resolve workspace context if not provided.
  let accountId = args.accountId ?? null;
  let locationId = args.locationId ?? null;
  if (!accountId) {
    const { data: prof } = await supabase
      .from("profiles").select("account_id").eq("user_id", args.userId).maybeSingle();
    accountId = (prof as any)?.account_id ?? null;
  }
  if (!locationId) {
    const { data: lm } = await supabase
      .from("location_members").select("location_id").eq("user_id", args.userId).limit(1).maybeSingle();
    locationId = (lm as any)?.location_id ?? null;
  }
  const scope = args.scope ?? (locationId ? "location" : "group");

  const metadata = {
    ...(args.extraMetadata || {}),
    match_key: normalizeKey(args.matchKey || {}),
    generated_at: new Date().toISOString(),
  };

  // Look for existing row by exact title (any age).
  const { data: existing } = await supabase
    .from("knowledge_base")
    .select("id, metadata")
    .eq("user_id", args.userId)
    .eq("doc_type", args.docType)
    .eq("title", args.title)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const merged = { ...((existing as any).metadata || {}), ...metadata };
    const { error } = await supabase
      .from("knowledge_base")
      .update({
        content: args.content,
        metadata: merged,
        account_id: accountId,
        location_id: locationId,
        scope,
      })
      .eq("id", (existing as any).id);
    if (error) console.error("upsertKBDoc update error", error);
    return { id: (existing as any).id, updated: true };
  }

  const { data: inserted, error } = await supabase
    .from("knowledge_base")
    .insert({
      user_id: args.userId,
      account_id: accountId,
      location_id: locationId,
      scope,
      title: args.title,
      doc_type: args.docType,
      content: args.content,
      metadata,
    })
    .select("id")
    .single();
  if (error) console.error("upsertKBDoc insert error", error);
  return { id: (inserted as any)?.id, updated: false };
}
