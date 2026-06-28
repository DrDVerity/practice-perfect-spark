// Minimal fal.ai MCP client (Streamable HTTP / JSON-RPC) for Deno edge functions.
// Spec: https://modelcontextprotocol.io/  Endpoint: https://mcp.fal.ai/mcp

const MCP_URL = "https://mcp.fal.ai/mcp";

let sessionId: string | null = null;
let initialized = false;
let cachedTools: Array<{ name: string; description?: string; inputSchema?: any }> | null = null;
let runToolName: string | null = null;
let nextId = 1;

function headers(apiKey: string): HeadersInit {
  const h: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (sessionId) h["Mcp-Session-Id"] = sessionId;
  return h;
}

async function parseResponse(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  const sess = res.headers.get("mcp-session-id");
  if (sess) sessionId = sess;
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    // Parse SSE frames; return the last "data:" JSON payload that has a result/error.
    let last: any = null;
    for (const block of text.split(/\n\n+/)) {
      const dataLines = block
        .split(/\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .filter(Boolean);
      if (!dataLines.length) continue;
      try {
        const parsed = JSON.parse(dataLines.join("\n"));
        if (parsed && (parsed.result !== undefined || parsed.error !== undefined || parsed.jsonrpc)) {
          last = parsed;
        }
      } catch { /* ignore non-JSON frames */ }
    }
    if (!last) throw new Error(`MCP SSE returned no JSON-RPC payload: ${text.slice(0, 400)}`);
    return last;
  }
  // assume JSON
  const text = await res.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch { throw new Error(`MCP non-JSON response: ${text.slice(0, 400)}`); }
}

async function rpc(apiKey: string, method: string, params?: any): Promise<any> {
  const id = nextId++;
  const body = { jsonrpc: "2.0", id, method, params: params ?? {} };
  const res = await fetch(MCP_URL, { method: "POST", headers: headers(apiKey), body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    if (res.status === 403 && /exhausted balance|user is locked/i.test(t)) {
      const err: any = new Error("Fal.ai account balance exhausted. Please top up at https://fal.ai/dashboard/billing to generate videos.");
      err.code = "FAL_BILLING";
      throw err;
    }
    throw new Error(`MCP ${method} HTTP ${res.status}: ${t.slice(0, 400)}`);
  }
  const payload = await parseResponse(res);
  if (payload?.error) {
    const msg = payload.error.message || JSON.stringify(payload.error);
    if (/exhausted balance|user is locked|insufficient/i.test(msg)) {
      const err: any = new Error("Fal.ai account balance exhausted. Please top up at https://fal.ai/dashboard/billing to generate videos.");
      err.code = "FAL_BILLING";
      throw err;
    }
    throw new Error(`MCP ${method} error: ${msg}`);
  }
  return payload?.result;
}

async function ensureInitialized(apiKey: string): Promise<void> {
  if (initialized) return;
  await rpc(apiKey, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "lovable-edge-fal-mcp", version: "0.1.0" },
  });
  // Best-effort notification; ignore failure.
  try {
    await fetch(MCP_URL, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
  } catch { /* ignore */ }
  initialized = true;
}

async function listTools(apiKey: string) {
  if (cachedTools) return cachedTools;
  const result = await rpc(apiKey, "tools/list");
  cachedTools = result?.tools || [];
  console.log("Fal MCP tools available:", cachedTools!.map((t) => t.name).join(", "));
  return cachedTools!;
}

function pickRunTool(tools: Array<{ name: string }>): string {
  const names = tools.map((t) => t.name);
  // Preferred names in order
  const prefer = ["run", "submit", "generate", "fal_run", "fal_submit", "create_request"];
  for (const p of prefer) {
    const hit = names.find((n) => n === p || n.endsWith(`/${p}`) || n.endsWith(`.${p}`));
    if (hit) return hit;
  }
  // Fallback: anything containing "run" or "submit"
  const fuzzy = names.find((n) => /run|submit|generate/i.test(n));
  if (fuzzy) return fuzzy;
  throw new Error(`No suitable fal MCP tool found. Available: ${names.join(", ")}`);
}

function extractVideoUrl(toolResult: any): string | null {
  if (!toolResult) return null;
  // Structured content first
  const sc = toolResult.structuredContent;
  const candidates: any[] = [];
  if (sc) candidates.push(sc);
  // Content array entries
  for (const c of toolResult.content || []) {
    if (c?.type === "resource" && c.resource?.uri) candidates.push({ url: c.resource.uri });
    if (c?.type === "text" && typeof c.text === "string") {
      try { candidates.push(JSON.parse(c.text)); } catch { candidates.push({ _text: c.text }); }
    }
  }
  const findUrl = (o: any): string | null => {
    if (!o || typeof o !== "object") return null;
    const direct =
      o?.video?.url ?? o?.video_url ?? o?.url ?? o?.output?.video?.url ?? o?.output?.url;
    if (typeof direct === "string" && /^https?:\/\//.test(direct)) return direct;
    for (const k of Object.keys(o)) {
      const v = (o as any)[k];
      if (typeof v === "string" && /^https?:\/\/.+\.(mp4|webm|mov)(\?|$)/i.test(v)) return v;
      if (typeof v === "object") {
        const r = findUrl(v);
        if (r) return r;
      }
    }
    return null;
  };
  for (const c of candidates) {
    const u = findUrl(c);
    if (u) return u;
  }
  // Last resort: regex on any text content
  for (const c of toolResult.content || []) {
    if (c?.type === "text" && typeof c.text === "string") {
      const m = c.text.match(/https?:\/\/\S+\.(?:mp4|webm|mov)(?:\?\S*)?/i);
      if (m) return m[0];
    }
  }
  return null;
}

export async function runFalModelViaMcp(opts: {
  apiKey: string;
  model: string;
  input: Record<string, unknown>;
}): Promise<{ videoUrl: string }> {
  await ensureInitialized(opts.apiKey);
  const tools = await listTools(opts.apiKey);
  if (!runToolName) runToolName = pickRunTool(tools);

  // Try a couple of argument shapes — fal MCP tool schemas vary.
  const argShapes: Array<Record<string, unknown>> = [
    { model: opts.model, input: opts.input },
    { application: opts.model, input: opts.input },
    { endpoint: opts.model, arguments: opts.input },
    { ...opts.input, model: opts.model },
  ];
  let lastErr: any = null;
  for (const args of argShapes) {
    try {
      const result = await rpc(opts.apiKey, "tools/call", { name: runToolName, arguments: args });
      if (result?.isError) {
        const txt = (result.content || []).map((c: any) => c?.text).filter(Boolean).join(" ");
        if (/exhausted balance|user is locked|insufficient/i.test(txt)) {
          const err: any = new Error("Fal.ai account balance exhausted. Please top up at https://fal.ai/dashboard/billing to generate videos.");
          err.code = "FAL_BILLING";
          throw err;
        }
        throw new Error(`MCP tool reported error: ${txt.slice(0, 400)}`);
      }
      const videoUrl = extractVideoUrl(result);
      if (videoUrl) {
        console.log("Fal MCP run ok, tool:", runToolName);
        return { videoUrl };
      }
      lastErr = new Error(`MCP tool returned no video URL: ${JSON.stringify(result).slice(0, 500)}`);
    } catch (e: any) {
      if (e?.code === "FAL_BILLING") throw e;
      lastErr = e;
    }
  }
  throw lastErr || new Error("MCP run failed with unknown error");
}
