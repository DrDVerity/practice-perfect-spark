import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  fileBase64: string; // raw base64 (no data: prefix)
  mimeType: string;
  fileName: string;
  instruction?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileBase64, mimeType, fileName, instruction } = (await req.json()) as Body;
    if (!fileBase64 || !mimeType || !fileName) {
      return new Response(JSON.stringify({ error: "fileBase64, mimeType and fileName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is not configured");

    const dataUrl = `data:${mimeType};base64,${fileBase64}`;
    const userInstruction =
      instruction ||
      "Extract the full strategic plan / campaign strategy content from the attached document and return it as clean, well-structured Markdown. Preserve headings, bullet lists, tables, budgets and timelines. Do not summarize — return the complete content. Do not add commentary, preamble, or code fences.";

    // Build multimodal content. PDFs use the `file` type; images use `image_url`.
    const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
    const isImage = mimeType.startsWith("image/");

    let contentParts: any[];
    if (isPdf) {
      contentParts = [
        { type: "text", text: userInstruction },
        { type: "file", file: { filename: fileName, file_data: dataUrl } },
      ];
    } else if (isImage) {
      contentParts = [
        { type: "text", text: userInstruction },
        { type: "image_url", image_url: { url: dataUrl } },
      ];
    } else {
      // Plain text / markdown / docx-as-text → decode and pass inline
      try {
        const bin = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
        const text = new TextDecoder("utf-8", { fatal: false }).decode(bin);
        contentParts = [
          { type: "text", text: `${userInstruction}\n\n--- DOCUMENT (${fileName}) ---\n${text}` },
        ];
      } catch {
        return new Response(JSON.stringify({ error: `Unsupported file type: ${mimeType}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You convert uploaded campaign/strategy documents into clean Markdown faithfully. Never invent content.",
          },
          { role: "user", content: contentParts },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("OpenRouter error", resp.status, errText);
      return new Response(JSON.stringify({ error: `LLM error: ${resp.status}`, details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("extract-document-text error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
