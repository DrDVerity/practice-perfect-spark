/**
 * Canned terminal scripts for the ProcessingTerminal. These are purely
 * cosmetic narration that runs while a real async job is in flight, so the
 * user always has something to read. Timing is handled by the terminal.
 */

function domainOf(url?: string | null): string {
  if (!url) return "your-practice.com";
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || "your-practice.com";
  }
}

export function scanScript(websiteUrl?: string | null, practiceName?: string | null): string[] {
  const d = domainOf(websiteUrl);
  const name = practiceName?.trim() || "your practice";
  return [
    `connecting to ${d} ...`,
    `fetching sitemap and 24 pages ...`,
    `reading services, hours and locations ...`,
    `extracting brand voice and tone ...`,
    `parsing ${name} team and credentials ...`,
    `collecting patient reviews across platforms ...`,
    `analyzing 5 nearby competitors ...`,
    `scoring local market opportunity ...`,
    `building your brand DNA profile ...`,
    `finalizing practice intelligence ...`,
  ];
}

export function analysisScript(): string[] {
  return [
    "compiling competitive landscape ...",
    "mapping target audience segments ...",
    "modeling demographics and demand ...",
    "grading reputation and sentiment ...",
    "drafting brand guidelines ...",
    "assembling 10 research reports ...",
  ];
}

export function contentScript(topic?: string | null): string[] {
  return [
    topic ? `planning content around "${topic}" ...` : "selecting a high-impact topic ...",
    "writing a long-form article ...",
    "deriving platform-specific posts ...",
    "generating on-brand images ...",
    "tailoring copy for 5 channels ...",
    "assembling your content hub ...",
  ];
}

export function publishScript(): string[] {
  return [
    "validating scheduled posts ...",
    "checking channel connections ...",
    "queueing posts to the publisher ...",
    "confirming optimal send times ...",
    "handing off to the scheduler ...",
  ];
}
