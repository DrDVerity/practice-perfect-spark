import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, Loader2, Sparkles, Printer, Wand2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChannelInfo {
  platform: string;
  channel_type: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignName: string;
  campaignId: string;
  systemPrompt?: string;
  practiceReport?: string;
  addonTypes?: string[];
  budgetTotal?: number;
  budgetAllocations?: Record<string, { percent: string; amount: string }>;
  channels?: ChannelInfo[];
  campaignFocus?: string;
  strategyAccepted?: boolean;
  onStrategyGenerated?: (strategy: string) => void;
}

const CampaignAgentDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  campaignName,
  campaignId,
  systemPrompt,
  practiceReport,
  addonTypes = [],
  budgetTotal,
  budgetAllocations,
  channels = [],
  campaignFocus,
  strategyAccepted = false,
  onStrategyGenerated,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingCampaign, setIsGeneratingCampaign] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      const channelLine = channels.length
        ? channels.map(c => `${c.platform}`).join(', ')
        : '_none selected yet_';
      const addonLine = addonTypes.length ? addonTypes.join(', ') : '_none_';
      const budgetLine = budgetTotal && budgetTotal > 0
        ? `$${budgetTotal.toLocaleString()}`
        : '**$0 / not set**';
      const focusLine = campaignFocus?.trim() ? campaignFocus.trim() : '_not specified_';

      const questions: string[] = [];
      if (!campaignFocus?.trim()) {
        questions.push('**Campaign focus** — what is the primary goal/offer of this campaign?');
      }
      if (!budgetTotal || budgetTotal <= 0) {
        questions.push('**Budget** — is this a $0 internal / social-only campaign, or do you have a paid-media budget? If yes, how much?');
      }
      if (channels.length === 0) {
        questions.push('**Channels** — which channels should this run on (Instagram, LinkedIn, Email, SMS, etc.)?');
      }
      questions.push('**Frequency / cadence** — how often do you want to post?');
      questions.push('**Add-on vectors** — any traditional vectors (referrals, events, content marketing, etc.) you want included?');
      const numbered = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

      const intro = `Hi! I'm your Campaign Agent for **${campaignName}**.

**Current campaign context**
- **Focus:** ${focusLine}
- **Channels:** ${channelLine}
- **Add-ons / vectors:** ${addonLine}
- **Total budget:** ${budgetLine}

Before I generate a strategy, please answer the questions below so the plan matches your real budget, channels, and goals:

${numbered}

Once I have your answers, click **Generate Strategy** and I'll produce a full plan. After you review it on the campaign page, click the red **Accept** button to actually generate posts, images, and the schedule.

⚠️ _Campaign assets (posts, images, videos) are only generated after you click **Accept** on the strategy._`;

      setMessages([{ role: 'assistant', content: intro }]);
    }
  }, [open, campaignName]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamRequest = async (userMessages: Message[]) => {
    setIsLoading(true);
    let assistantContent = '';
    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length === userMessages.length + 1) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...prev, { role: 'assistant', content: assistantContent }];
      });
    };

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-agent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
            campaignName,
            campaignId,
            systemPrompt: systemPrompt || '',
            practiceReport: practiceReport || '',
            channels,
            addons: addonTypes,
            budgetTotal,
            budgetAllocations,
          }),
        }
      );

      if (!resp.ok || !resp.body) throw new Error('Failed to start stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      return assistantContent;
    } catch (e) {
      console.error('Campaign agent error:', e);
      upsertAssistant('Sorry, I encountered an error. Please try again.');
      return '';
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    await streamRequest(updatedMessages);
  };

  const generateStrategy = async () => {
    if (isLoading) return;
    const channelList = channels.length > 0
      ? channels.map(c => `${c.platform} (${c.channel_type})`).join(', ')
      : 'none yet';
    const addonList = addonTypes.length > 0 ? addonTypes.join(', ') : 'none yet';

    const strategyPrompt = `Generate a comprehensive campaign strategy report for "${campaignName}".

Campaign channels: ${channelList}
Campaign add-ons/vectors: ${addonList}
${budgetTotal ? `Total budget: $${budgetTotal.toLocaleString()}` : 'No budget set yet.'}

Include ALL of the following:
1. **Executive Summary**
2. **Target Audience Analysis**
3. **Channel Strategy** — specific plan for EACH channel
4. **Add-On / Vector Strategies** — specific plans for each add-on
5. **Budget Allocation Table** — markdown table with each channel/vector, $ amount, and % of budget
6. **Ad Content & Creative Direction** — specific ad copy, headlines, CTAs for EACH channel and vector
7. **Content Calendar & Schedule of Events** — detailed weekly timeline
8. **Key Performance Indicators** — metrics per channel/vector

Make it actionable and specific to a healthcare/dental practice.`;

    const userMsg: Message = { role: 'user', content: strategyPrompt };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    const result = await streamRequest(updatedMessages);
    if (result && onStrategyGenerated) {
      onStrategyGenerated(result);
    }
  };

  // Find the latest assistant report (the longest assistant message after a user prompt asking for a strategy)
  const getReportContent = (): string => {
    const assistantMsgs = messages.filter((m) => m.role === 'assistant');
    if (assistantMsgs.length === 0) return '';
    // Pick the longest assistant message — most likely the strategy report
    return assistantMsgs.reduce((a, b) => (b.content.length > a.content.length ? b : a)).content;
  };

  const handlePrintReport = () => {
    const content = getReportContent();
    if (!content || content.length < 200) {
      toast.error('No report to print yet. Click "Generate Strategy" first.');
      return;
    }

    // Convert basic markdown to HTML using the same DOM that React would render.
    // Open a new window and inject styled markdown.
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) {
      toast.error('Pop-up blocked. Please allow pop-ups to print the report.');
      return;
    }

    const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));

    // Very small markdown-to-HTML conversion (headings, bold, italic, lists, code, tables, paragraphs)
    const mdToHtml = (md: string) => {
      const lines = md.split('\n');
      const out: string[] = [];
      let inList = false;
      let inTable = false;
      let tableRows: string[][] = [];
      const flushTable = () => {
        if (!inTable) return;
        out.push('<table>');
        tableRows.forEach((row, i) => {
          const cell = i === 0 ? 'th' : 'td';
          out.push('<tr>' + row.map(c => `<${cell}>${inline(c.trim())}</${cell}>`).join('') + '</tr>');
        });
        out.push('</table>');
        inTable = false;
        tableRows = [];
      };
      const inline = (s: string) => {
        let r = escapeHtml(s);
        r = r.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        r = r.replace(/\*(.+?)\*/g, '<em>$1</em>');
        r = r.replace(/`([^`]+)`/g, '<code>$1</code>');
        return r;
      };
      for (const raw of lines) {
        const line = raw.trimEnd();
        if (/^\s*\|.+\|\s*$/.test(line)) {
          if (/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line)) continue; // separator row
          inTable = true;
          tableRows.push(line.replace(/^\||\|$/g, '').split('|'));
          continue;
        } else if (inTable) {
          flushTable();
        }
        if (/^#{1,6}\s+/.test(line)) {
          if (inList) { out.push('</ul>'); inList = false; }
          const m = line.match(/^(#{1,6})\s+(.*)/)!;
          out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
        } else if (/^\s*[-*]\s+/.test(line)) {
          if (!inList) { out.push('<ul>'); inList = true; }
          out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
        } else if (line.trim() === '') {
          if (inList) { out.push('</ul>'); inList = false; }
          out.push('');
        } else {
          if (inList) { out.push('</ul>'); inList = false; }
          out.push(`<p>${inline(line)}</p>`);
        }
      }
      if (inList) out.push('</ul>');
      flushTable();
      return out.join('\n');
    };

    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(campaignName)} — Campaign Strategy</title>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; line-height: 1.6; padding: 0 24px; }
  h1 { color: hsl(210, 60%, 45%); border-bottom: 2px solid hsl(210, 60%, 75%); padding-bottom: 8px; }
  h2 { color: hsl(210, 60%, 35%); margin-top: 32px; }
  h3 { color: hsl(210, 50%, 30%); }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
  th { background: hsl(210, 60%, 95%); }
  ul { padding-left: 24px; }
  code { background: #f4f4f4; padding: 2px 6px; border-radius: 4px; font-family: 'SF Mono', Menlo, monospace; font-size: 0.9em; }
  .meta { color: #666; font-size: 0.9em; margin-bottom: 24px; }
  .header-bar { display: flex; justify-content: space-between; align-items: baseline; }
  @media print {
    body { margin: 0; max-width: none; padding: 16px; }
    .no-print { display: none; }
  }
  .print-btn { position: fixed; top: 16px; right: 16px; background: hsl(210, 60%, 45%); color: white; border: 0; padding: 10px 18px; border-radius: 6px; font-size: 14px; cursor: pointer; }
</style></head>
<body>
<button class="print-btn no-print" onclick="window.print()">Print / Save as PDF</button>
<div class="header-bar"><h1>${escapeHtml(campaignName)} — Campaign Strategy</h1></div>
<p class="meta">Generated ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
${mdToHtml(content)}
<script>setTimeout(() => window.print(), 400);</script>
</body></html>`);
    win.document.close();
  };

  const handleGenerateCampaign = async () => {
    if (isGeneratingCampaign) return;
    if (!campaignId) {
      toast.error('Campaign not loaded yet.');
      return;
    }
    if (channels.length === 0) {
      toast.error('Add at least one channel to the campaign before generating content.');
      return;
    }
    setIsGeneratingCampaign(true);
    const reportContent = getReportContent();
    toast.info('Generating campaign content for all channels...', { duration: 4000 });
    try {
      const { data, error } = await supabase.functions.invoke('generate-campaign-content', {
        body: {
          campaignId,
          strategy: reportContent && reportContent.length > 200 ? reportContent : undefined,
        },
      });
      if (error) throw error;
      const created = data?.postsCreated ?? 0;
      toast.success(`Generated ${created} posts across ${channels.length} channel${channels.length > 1 ? 's' : ''}!`, {
        description: 'Open each channel to review and schedule.',
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `✅ **Campaign generated!** Created **${created} posts** with text, images, and scheduled dates across ${channels.length} channel${channels.length > 1 ? 's' : ''}.\n\nOpen any channel from the campaign page to review the posts.` },
      ]);
    } catch (e: any) {
      console.error('Generate campaign error:', e);
      toast.error('Failed to generate campaign', { description: e?.message || 'Unknown error' });
    } finally {
      setIsGeneratingCampaign(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Campaign Agent
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" ref={scrollRef as any}>
          <div className="space-y-4 pb-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-4 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={generateStrategy}
            disabled={isLoading || isGeneratingCampaign}
            className="shrink-0"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Generate Strategy
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintReport}
            disabled={isLoading || isGeneratingCampaign}
            className="shrink-0"
          >
            <Printer className="w-4 h-4 mr-1" />
            Print Report
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleGenerateCampaign}
            disabled={isLoading || isGeneratingCampaign}
            className="shrink-0"
          >
            {isGeneratingCampaign ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
            Generate Campaign
          </Button>
        </div>

        <div className="flex gap-2 pt-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your campaign..."
            className="min-h-[44px] max-h-[100px] resize-none"
            rows={1}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignAgentDialog;
