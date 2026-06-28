# Plan: Use fal.ai MCP in `generate-video` (REST fallback retained)

## Goal
Replace the direct `queue.fal.run` calls in `supabase/functions/generate-video/index.ts` with calls to the fal.ai MCP server (`https://mcp.fal.ai/mcp`, `Authorization: Bearer ${FAL_AI_API_KEY}`). If MCP errors, transparently fall back to the existing REST queue path so video generation keeps working.

## Approach

fal's MCP server speaks the standard MCP Streamable HTTP protocol. We don't need a full MCP SDK in Deno — a tiny JSON-RPC POST helper is enough, and it keeps the edge function lean.

### 1. New shared helper: `supabase/functions/_shared/fal-mcp.ts`
- `mcpRequest(method, params)` — POSTs JSON-RPC to `https://mcp.fal.ai/mcp` with headers:
  - `Authorization: Bearer ${FAL_AI_API_KEY}`
  - `Content-Type: application/json`
  - `Accept: application/json, text/event-stream` (required by MCP spec; missing it returns 406)
- Handles both JSON and SSE responses (parse `event: message` / `data: {...}` frames into the final JSON-RPC result).
- `initialize()` once per cold start (cached), then `tools/call` with `{ name, arguments }`.
- `runFalModel({ model, input })` — calls the fal "run" tool exposed by the MCP server (discovered via `tools/list` on first use and cached; tool name is likely `run` or `submit`/`generate` — we'll log `tools/list` output the first run and pick the matching one, defaulting to a sensible name with override).
- Returns `{ videoUrl }` extracted from MCP tool result content (text or structured), with the same shape `falSubmitAndWait` returns today.

### 2. Update `supabase/functions/generate-video/index.ts`
- Background `runJob()` becomes:
  ```ts
  let result;
  try {
    result = await runFalModelViaMcp({ model, input: falInput });
  } catch (e) {
    console.warn("MCP path failed, falling back to REST queue:", e);
    result = await falSubmitAndWait({ apiKey: falKey, model, input: falInput });
  }
  ```
- Preserve the existing 403 / "exhausted balance" detection in both paths so the `FAL_BILLING` code still surfaces correctly and the post is marked `video_status = 'billing'`.
- Keep storage re-hosting, polling responses, and the 202 "processing" reply unchanged — UI behavior is identical.

### 3. No DB / UI / secret changes
- Same `FAL_AI_API_KEY` secret (already set).
- No migrations, no client changes, no new env vars.

## Files touched
- `supabase/functions/_shared/fal-mcp.ts` (new)
- `supabase/functions/generate-video/index.ts` (edit `runJob` only)

## Verification
- Click **Generate Video** on a YouTube post; confirm `video_status` flips to `processing` then `ready`, video plays.
- Inspect edge function logs: should show "MCP tools available: …" once, then "MCP run ok" or, on failure, "MCP path failed, falling back to REST queue" followed by a successful REST run.
- Billing failure path still returns toast with the existing top-up message.

## Non-goals
- Not wiring MCP into Campaign Agent, `edit-image`, or other functions in this pass (can be done later by importing the same helper).
- Not adding a generic MCP client library — the inline JSON-RPC helper avoids new dependencies in Deno.
