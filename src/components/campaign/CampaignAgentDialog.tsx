import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import {
  Bot, Send, Loader2, Sparkles, Printer, Wand2, Check, Pencil, RefreshCw,
  ListChecks, AlertCircle, Info, Paperclip, X as XIcon,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import BudgetPromptDialog from './BudgetPromptDialog';
import { ThemeToggle } from '@/components/ThemeToggle';

type AgentTab = 'chat' | 'dev' | 'generate';

const TAB_LABELS: Record<AgentTab, string> = {
  chat: 'Chat',
  dev: 'Campaign Dev.',
  generate: 'Generate Campaign',
};

const TAB_DEFAULT_GUIDANCE: Record<AgentTab, string> = {
  chat:
    'You are a general-purpose assistant for the user\'s marketing account. Answer broad questions about the platform, account, workflows, and best practices. Do NOT focus exclusively on the current campaign unless explicitly asked.',
  dev:
    'You are focused on developing and refining THIS campaign\'s strategy: target audience, positioning, channel mix, messaging, offers, budget allocation, and creative direction. Stay in strategy-development mode.',
  generate:
    'You are focused on the CAMPAIGN GENERATION process: producing posts, images, landing pages, scheduling, channel publishing, troubleshooting generation errors, and content quality. Help resolve issues that block generation.',
};

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

  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [customFocusInput, setCustomFocusInput] = useState('');
  const [activeFocus, setActiveFocus] = useState<string>(campaignFocus?.trim() || '');
  const startedRef = useRef(false);

  // Strategy generation state
  const [budgetPromptOpen, setBudgetPromptOpen] = useState(false);
  const [strategyBudget, setStrategyBudget] = useState<number>(0);
  const [strategyMode, setStrategyMode] = useState<'paid' | 'organic' | null>(null);
  const [strategyContent, setStrategyContent] = useState<string>('');
  const [strategyComplete, setStrategyComplete] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState(false);
  const [editedStrategy, setEditedStrategy] = useState('');
  const [accepting, setAccepting] = useState(false);

  // Tabs & soul-style instructions
  const [activeTab, setActiveTab] = useState<AgentTab>('chat');
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructions, setInstructions] = useState<Record<AgentTab, string>>({
    chat: '', dev: '', generate: '',
  });
  const [draftInstructions, setDraftInstructions] = useState<Record<AgentTab, string>>({
    chat: '', dev: '', generate: '',
  });
  const [savingInstructions, setSavingInstructions] = useState(false);
  const reviewedRef = useRef(false);

  // Attachments (campaign assets) — uploaded to kb-files bucket
  interface Attachment { name: string; url: string; path: string; size: number; }
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load persisted instructions when dialog opens
  useEffect(() => {
    if (!open || !campaignId) return;
    (async () => {
      const { data } = await supabase
        .from('campaign_agent_instructions' as any)
        .select('chat_instructions, dev_instructions, generate_instructions')
        .eq('campaign_id', campaignId)
        .maybeSingle();
      if (data) {
        setInstructions({
          chat: (data as any).chat_instructions || '',
          dev: (data as any).dev_instructions || '',
          generate: (data as any).generate_instructions || '',
        });
      }
    })();
  }, [open, campaignId]);

  const openInstructionsDialog = () => {
    setDraftInstructions(instructions);
    setInstructionsOpen(true);
  };

  const saveInstructions = async () => {
    if (!campaignId) return;
    setSavingInstructions(true);
    try {
      const { error } = await supabase
        .from('campaign_agent_instructions' as any)
        .upsert({
          campaign_id: campaignId,
          chat_instructions: draftInstructions.chat,
          dev_instructions: draftInstructions.dev,
          generate_instructions: draftInstructions.generate,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'campaign_id' });
      if (error) throw error;
      setInstructions(draftInstructions);
      setInstructionsOpen(false);
      toast.success('Agent instructions saved');
    } catch (e: any) {
      toast.error('Could not save instructions', { description: e?.message });
    } finally {
      setSavingInstructions(false);
    }
  };

  const handleAttachClick = () => fileInputRef.current?.click();

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingAttachment(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) throw new Error('Not signed in');
      const newAttachments: Attachment[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^\w.\-]+/g, '_');
        const path = `${uid}/campaign-${campaignId}/assets/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from('kb-files').upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage
          .from('kb-files').createSignedUrl(path, 60 * 60 * 24 * 30);
        newAttachments.push({
          name: file.name, url: signed?.signedUrl || '', path, size: file.size,
        });
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
      toast.success(`Attached ${newAttachments.length} file${newAttachments.length > 1 ? 's' : ''}`);
    } catch (err: any) {
      toast.error('Upload failed', { description: err?.message });
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (path: string) => {
    setAttachments((prev) => prev.filter((a) => a.path !== path));
  };

  // Structured suggestions (parsed from the review) that can be auto-applied
  type SuggestionAction =
    | 'update_focus'
    | 'update_target_audience'
    | 'update_strategy'
    | 'add_addon'
    | 'set_budget_total'
    | 'set_landing_page_url'
    | 'manual';
  interface Suggestion {
    id: string;
    title: string;
    description: string;
    action: SuggestionAction;
    payload?: any;
    manual: boolean;
    manual_reason?: string;
  }
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<Set<string>>(new Set());
  const [loadingSuggestions2, setLoadingSuggestions2] = useState(false);
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);
  const [appliedLog, setAppliedLog] = useState<{ title: string; status: 'applied' | 'manual' | 'failed'; message?: string }[]>([]);
  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-campaign-topics', {
        body: { campaignId, campaignName },
      });
      if (error) throw error;
      const topics: string[] = Array.isArray(data?.topics) ? data.topics.slice(0, 3) : [];
      setTopicSuggestions(topics);
    } catch (e) {
      console.error('suggest-campaign-topics error', e);
      toast.error('Could not generate topic suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const persistFocus = async (focus: string) => {
    try {
      await supabase.from('campaigns').update({ focus } as any).eq('id', campaignId);
    } catch (e) {
      console.error('persist focus error', e);
    }
  };

  const runBlogResearch = async (focus: string) => {
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: `🔎 Researching **${focus}** — searching your knowledge base, agency knowledge base, and online forums…` },
    ]);
    try {
      const { data, error } = await supabase.functions.invoke('topic-blog-research', {
        body: { campaignId, focus },
      });
      if (error) throw error;
      const article: string = data?.article || 'No article was generated.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: article },
        { role: 'assistant', content: `Approve this article to save it to your knowledge base, or click **Generate Strategy** to build the full campaign plan.` },
      ]);
    } catch (e: any) {
      console.error('topic-blog-research error', e);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, research failed: ${e?.message || 'unknown error'}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const approveArticle = async () => {
    const article = [...messages].reverse().find((m) => m.role === 'assistant' && m.content.length > 400)?.content;
    if (!article) {
      toast.error('No article to save yet.');
      return;
    }
    try {
      const { data: camp } = await supabase
        .from('campaigns')
        .select('user_id, location_id')
        .eq('id', campaignId)
        .maybeSingle();
      const ownerId = (camp as any)?.user_id;
      const locationId = (camp as any)?.location_id;
      if (!ownerId || !locationId) throw new Error('Campaign owner/location not found');
      const { data: prof } = await supabase
        .from('profiles')
        .select('account_id')
        .eq('user_id', ownerId)
        .maybeSingle();
      const accountId = (prof as any)?.account_id;
      if (!accountId) throw new Error('Account not found');
      await supabase.from('knowledge_base').insert({
        user_id: ownerId,
        account_id: accountId,
        location_id: locationId,
        scope: 'location',
        title: `Blog: ${activeFocus}`,
        content: article,
        doc_type: 'custom',
        metadata: { source: 'campaign-agent-blog', campaign_id: campaignId, focus: activeFocus },
      });
      toast.success('Article saved to knowledge base');
    } catch (e: any) {
      toast.error('Could not save article', { description: e?.message });
    }
  };

  const chooseFocus = async (focus: string) => {
    const trimmed = focus.trim();
    if (!trimmed) return;
    setActiveFocus(trimmed);
    setTopicSuggestions([]);
    setMessages((prev) => [...prev, { role: 'user', content: `Use focus: ${trimmed}` }]);
    await persistFocus(trimmed);
    await runBlogResearch(trimmed);
  };

  const runCampaignReview = async () => {
    try {
      // Fetch latest campaign details + posts + budget for full context
      const [{ data: camp }, { data: chans }, { data: budgetRow }] = await Promise.all([
        supabase.from('campaigns').select('focus, strategy, landing_page_url, start_date, end_date, status').eq('id', campaignId).maybeSingle(),
        supabase.from('campaign_channels').select('id, platform, channel_type').eq('campaign_id', campaignId),
        supabase.from('campaign_budgets').select('total_amount, allocations, accepted').eq('campaign_id', campaignId).maybeSingle(),
      ]);

      const channelIds = (chans || []).map((c: any) => c.id);
      let posts: any[] = [];
      if (channelIds.length) {
        const { data: postRows } = await supabase
          .from('channel_posts')
          .select('title, status, scheduled_start, campaign_channel_id')
          .in('campaign_channel_id', channelIds);
        posts = postRows || [];
      }

      const channelMap = new Map((chans || []).map((c: any) => [c.id, `${c.platform} (${c.channel_type})`]));
      const scheduleSummary = posts.length
        ? posts.slice(0, 25).map((p: any) =>
            `- [${p.status}] ${channelMap.get(p.campaign_channel_id) || 'channel'} — ${p.title || '(untitled)'}${p.scheduled_start ? ` @ ${new Date(p.scheduled_start).toLocaleDateString()}` : ' (unscheduled)'}`
          ).join('\n')
        : '(no posts scheduled yet)';

      const budgetSummary = budgetRow
        ? `Total: $${Number((budgetRow as any).total_amount || 0).toLocaleString()} — ${(budgetRow as any).accepted ? 'Accepted' : 'Pending'}\nAllocations: ${JSON.stringify((budgetRow as any).allocations || {})}`
        : '(no budget set)';

      const reviewPrompt = `Please REVIEW the current state of this campaign. DO NOT generate new topic suggestions, strategy reports, or content. Analyze what already exists and identify concrete ways to improve it.

=== CAMPAIGN: ${campaignName} ===
Status: ${(camp as any)?.status || 'unknown'}
Focus: ${(camp as any)?.focus || campaignFocus || '(not set)'}
Start: ${(camp as any)?.start_date || '(not set)'} | End: ${(camp as any)?.end_date || '(not set)'}
Landing Page: ${(camp as any)?.landing_page_url || '(not generated)'}

=== CHANNELS (${(chans || []).length}) ===
${(chans || []).map((c: any) => `- ${c.platform} (${c.channel_type})`).join('\n') || '(none)'}

=== ADD-ONS / VECTORS ===
${addonTypes.length ? addonTypes.map(a => `- ${a}`).join('\n') : '(none)'}

=== BUDGET ===
${budgetSummary}

=== POSTING SCHEDULE (${posts.length} posts) ===
${scheduleSummary}

=== EXISTING STRATEGY ===
${(camp as any)?.strategy ? String((camp as any).strategy).slice(0, 3000) : '(no strategy generated yet)'}

INSTRUCTIONS:
1. Begin your reply with EXACTLY this line: "I have reviewed the current campaign and I have some suggestions to improve this campaign:"
2. Then provide a bulleted list of specific, actionable observations and suggestions covering: focus clarity, channel mix, posting cadence/schedule gaps, budget allocation balance, strategy completeness, landing page presence, and any add-on/vector opportunities.
3. Be concrete — reference what's currently set vs. what's missing or weak. Do not invent a new strategy; only suggest improvements.`;

      // Send as a hidden user turn (don't render to keep chat clean)
      await streamRequest([{ role: 'user', content: reviewPrompt }]);
      // After review streams, ask the model for structured machine-applyable suggestions
      await fetchStructuredSuggestions(camp, chans || [], budgetRow);
    } catch (e: any) {
      console.error('campaign review error', e);
      setMessages([{ role: 'assistant', content: `Sorry, I couldn't load the campaign for review: ${e?.message || 'unknown error'}` }]);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (startedRef.current) return;
    startedRef.current = true;

    setMessages([{
      role: 'assistant',
      content: `Hi! I'm your **Campaign Agent** for **${campaignName}**. Switch between **Chat**, **Campaign Dev.**, and **Generate Campaign** tabs above to focus the conversation. Click the ℹ️ next to the title to give me orientation guidance for each tab.`,
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Trigger campaign review the first time the user enters the Campaign Dev tab
  useEffect(() => {
    if (!open) return;
    if (activeTab !== 'dev') return;
    if (reviewedRef.current) return;
    reviewedRef.current = true;
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: `Reviewing **${campaignName}** — analyzing focus, schedule, channels, budget, strategy, and landing page…` },
    ]);
    runCampaignReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, open]);

  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      reviewedRef.current = false;
      setMessages([]);
      setTopicSuggestions([]);
      setCustomFocusInput('');
      setActiveFocus(campaignFocus?.trim() || '');
      setStrategyComplete(false);
      setStrategyContent('');
      setStrategyMode(null);
      setStrategyBudget(0);
      setEditingStrategy(false);
      setSuggestions([]);
      setSelectedSuggestionIds(new Set());
      setAppliedLog([]);
      setLoadingSuggestions2(false);
      setAttachments([]);
      setActiveTab('chat');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);


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
            budgetTotal: strategyMode ? strategyBudget : budgetTotal,
            budgetAllocations,
            budgetMode: strategyMode || undefined,
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

  // Silent (non-UI) streaming request — returns accumulated assistant text
  const silentStream = async (userMessages: Message[]): Promise<string> => {
    let acc = '';
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
      if (!resp.ok || !resp.body) return '';
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let done = false;
      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '' || !line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { done = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) acc += c;
          } catch { buffer = line + '\n' + buffer; break; }
        }
      }
    } catch (e) { console.error('silentStream error', e); }
    return acc;
  };

  const extractJson = (text: string): any | null => {
    if (!text) return null;
    // Try fenced block first
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fence ? fence[1] : text;
    // Find first { ... } block
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
  };

  const fetchStructuredSuggestions = async (camp: any, chans: any[], budgetRow: any) => {
    setLoadingSuggestions2(true);
    try {
      const prompt = `Based on the campaign review you just produced, output ONLY a JSON object (no prose) of the form:
{ "items": [ { "id": "s1", "title": "...", "description": "...", "action": "update_focus|update_target_audience|update_strategy|add_addon|set_budget_total|set_landing_page_url|manual", "payload": <object|string|number>, "manual": true|false, "manual_reason": "..." } ] }

Rules:
- 3 to 8 items. Each item must be a specific, actionable improvement.
- Use action="manual" (manual:true) when the change requires the user to do something a script cannot do for them: adding a channel, connecting/entering channel credentials, scheduling-specific drag-and-drop, uploading media, approving content, etc. Put a clear "manual_reason" telling the user what to do.
- Auto-applyable actions (manual:false):
  - update_focus → payload: new focus string
  - update_target_audience → payload: new target audience string
  - update_strategy → payload: new strategy markdown string (only if existing strategy is empty/weak)
  - add_addon → payload: short addon_type label string (e.g. "Email Drip", "Local SEO")
  - set_budget_total → payload: number (total USD)
  - set_landing_page_url → payload: URL string (only if a real, existing URL is being suggested; otherwise mark manual)
- Current state for reference:
  Focus: ${camp?.focus || campaignFocus || '(none)'}
  Strategy length: ${(camp?.strategy || '').length} chars
  Channels: ${(chans || []).map((c:any)=>c.platform).join(', ') || '(none)'}
  Addons: ${(addonTypes || []).join(', ') || '(none)'}
  Budget total: ${budgetRow?.total_amount ?? '(none)'}
  Landing page: ${camp?.landing_page_url || '(none)'}
Respond with ONLY the JSON object.`;

      const text = await silentStream([{ role: 'user', content: prompt }]);
      const parsed = extractJson(text);
      const items: Suggestion[] = Array.isArray(parsed?.items)
        ? parsed.items.filter((i: any) => i && i.title && i.action).map((i: any, idx: number) => ({
            id: String(i.id || `s${idx}`),
            title: String(i.title),
            description: String(i.description || ''),
            action: i.action as SuggestionAction,
            payload: i.payload,
            manual: i.action === 'manual' ? true : !!i.manual,
            manual_reason: i.manual_reason ? String(i.manual_reason) : undefined,
          }))
        : [];
      setSuggestions(items);
      // Preselect auto-applyable items
      setSelectedSuggestionIds(new Set(items.filter((i) => !i.manual).map((i) => i.id)));
    } catch (e) {
      console.error('fetchStructuredSuggestions error', e);
    } finally {
      setLoadingSuggestions2(false);
    }
  };

  const toggleSuggestion = (id: string) => {
    setSelectedSuggestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const applySelectedSuggestions = async () => {
    if (applyingSuggestions) return;
    const chosen = suggestions.filter((s) => selectedSuggestionIds.has(s.id));
    if (chosen.length === 0) { toast.error('Select at least one suggestion to apply.'); return; }
    setApplyingSuggestions(true);
    const log: { title: string; status: 'applied' | 'manual' | 'failed'; message?: string }[] = [];

    // Lookup campaign owner for profile updates
    let ownerId: string | null = null;
    try {
      const { data: camp } = await supabase.from('campaigns').select('user_id').eq('id', campaignId).maybeSingle();
      ownerId = (camp as any)?.user_id || null;
    } catch {}

    for (const s of chosen) {
      try {
        if (s.manual || s.action === 'manual') {
          log.push({ title: s.title, status: 'manual', message: s.manual_reason || s.description });
          continue;
        }
        if (s.action === 'update_focus' && typeof s.payload === 'string') {
          if (ownerId) {
            await supabase.from('profiles').update({ campaign_focus: s.payload }).eq('user_id', ownerId);
          }
          await supabase.from('campaigns').update({ focus: s.payload } as any).eq('id', campaignId);
          log.push({ title: s.title, status: 'applied' });
        } else if (s.action === 'update_target_audience' && typeof s.payload === 'string') {
          if (!ownerId) throw new Error('Campaign owner not found');
          await supabase.from('profiles').update({ target_audience: s.payload }).eq('user_id', ownerId);
          log.push({ title: s.title, status: 'applied' });
        } else if (s.action === 'update_strategy' && typeof s.payload === 'string') {
          await supabase.from('campaigns').update({ strategy: s.payload } as any).eq('id', campaignId);
          log.push({ title: s.title, status: 'applied' });
        } else if (s.action === 'set_landing_page_url' && typeof s.payload === 'string') {
          await supabase.from('campaigns').update({ landing_page_url: s.payload } as any).eq('id', campaignId);
          log.push({ title: s.title, status: 'applied' });
        } else if (s.action === 'add_addon' && typeof s.payload === 'string') {
          await supabase.from('campaign_addons').insert({ campaign_id: campaignId, addon_type: s.payload } as any);
          log.push({ title: s.title, status: 'applied' });
        } else if (s.action === 'set_budget_total' && (typeof s.payload === 'number' || typeof s.payload === 'string')) {
          const total = Number(s.payload);
          if (!isFinite(total) || total < 0) throw new Error('Invalid budget amount');
          const { data: existing } = await supabase.from('campaign_budgets').select('id, allocations').eq('campaign_id', campaignId).maybeSingle();
          if (existing) {
            await supabase.from('campaign_budgets').update({ total_amount: total }).eq('id', (existing as any).id);
          } else {
            await supabase.from('campaign_budgets').insert({ campaign_id: campaignId, total_amount: total, allocations: {} } as any);
          }
          log.push({ title: s.title, status: 'applied' });
        } else {
          log.push({ title: s.title, status: 'manual', message: 'Requires manual review.' });
        }
      } catch (e: any) {
        log.push({ title: s.title, status: 'failed', message: e?.message || 'Unknown error' });
      }
    }

    setAppliedLog(log);
    const appliedCount = log.filter((l) => l.status === 'applied').length;
    const manualCount = log.filter((l) => l.status === 'manual').length;
    const failedCount = log.filter((l) => l.status === 'failed').length;
    if (appliedCount) toast.success(`Applied ${appliedCount} change${appliedCount > 1 ? 's' : ''} to the campaign.`);
    if (failedCount) toast.error(`${failedCount} change${failedCount > 1 ? 's' : ''} failed.`);

    // Build a summary message in the chat
    const summaryLines = log.map((l) => {
      if (l.status === 'applied') return `- ✅ **${l.title}** — applied`;
      if (l.status === 'manual') return `- ⚠️ **${l.title}** — manual: ${l.message || ''}`;
      return `- ❌ **${l.title}** — failed: ${l.message || ''}`;
    }).join('\n');
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: `Here's what I did with your accepted suggestions:\n\n${summaryLines}${manualCount ? `\n\n**${manualCount} item${manualCount > 1 ? 's' : ''} need your manual attention** (e.g. adding a channel, entering credentials, or scheduling). See the list above.` : ''}` },
    ]);

    // Remove successfully applied items from the list so user sees only what's left
    setSuggestions((prev) => prev.filter((s) => {
      const entry = log.find((l) => l.title === s.title);
      return !entry || entry.status !== 'applied';
    }));
    setSelectedSuggestionIds(new Set());
    setApplyingSuggestions(false);
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

  const openStrategyPrompt = () => {
    if (isLoading) return;
    setBudgetPromptOpen(true);
  };

  const runStrategyWithBudget = async (amount: number, mode: 'paid' | 'organic') => {
    setStrategyBudget(amount);
    setStrategyMode(mode);
    setStrategyComplete(false);
    setStrategyContent('');

    const channelList = channels.length > 0
      ? channels.map(c => `${c.platform} (${c.channel_type})`).join(', ')
      : 'none yet';
    const addonList = addonTypes.length > 0 ? addonTypes.join(', ') : 'none yet';

    const budgetLine = mode === 'paid'
      ? `Total budget: $${amount.toLocaleString()} — calculate the optimal allocation for best ROI.`
      : `No budget — generate an organic-only social media plan with $0 spend (no paid ads or boosts).`;

    const strategyPrompt = `Generate a comprehensive campaign strategy report for "${campaignName}".

Campaign channels: ${channelList}
Campaign add-ons/vectors: ${addonList}
${budgetLine}

Make it actionable and specific to a healthcare/dental practice. After the report, the user will be presented with Accept / Edit / Regenerate options.`;

    const userMsg: Message = { role: 'user', content: strategyPrompt };
    // Use a slightly delayed state set so streamRequest sees fresh strategyMode
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    const result = await streamRequest(updatedMessages);
    if (result) {
      setStrategyContent(result);
      setStrategyComplete(true);
      if (onStrategyGenerated) onStrategyGenerated(result);
      // Persist to campaigns.strategy
      try {
        await supabase.from('campaigns').update({ strategy: result } as any).eq('id', campaignId);
      } catch (e) { console.error('persist strategy', e); }
    }
  };

  // Generate a PDF blob from markdown strategy
  const generateStrategyPdf = (content: string): Blob => {
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 48;
    let y = margin;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`${campaignName} — Campaign Strategy`, margin, y);
    y += 22;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(new Date().toLocaleDateString(), margin, y);
    y += 18;
    doc.setTextColor(0);

    // Strip markdown formatting to plain text-ish
    const lines = content.split('\n');
    for (const raw of lines) {
      const line = raw;
      let size = 11;
      let style: 'normal' | 'bold' = 'normal';
      let text = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
      if (/^#{1,3}\s/.test(text)) {
        const level = text.match(/^(#{1,3})/)![1].length;
        text = text.replace(/^#{1,3}\s+/, '');
        size = level === 1 ? 16 : level === 2 ? 13 : 12;
        style = 'bold';
        y += 4;
      } else if (/^\s*[-*]\s+/.test(text)) {
        text = '• ' + text.replace(/^\s*[-*]\s+/, '');
      }
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      const wrapped = doc.splitTextToSize(text, pageW - margin * 2);
      for (const w of wrapped) {
        if (y > pageH - margin) { doc.addPage(); y = margin; }
        doc.text(w, margin, y);
        y += size * 1.3;
      }
    }
    return doc.output('blob');
  };

  const stripPaidSections = (md: string): string => {
    // Remove sections starting with headings about Budget Allocation / Ad Content (paid)
    const lines = md.split('\n');
    const out: string[] = [];
    let skip = false;
    for (const line of lines) {
      if (/^#{1,3}\s+(Budget\s+Allocation|Paid|Ad\s+Spend|Advertising\s+Budget)/i.test(line)) {
        skip = true;
        continue;
      }
      if (skip && /^#{1,3}\s+/.test(line)) {
        skip = false;
      }
      if (!skip) out.push(line);
    }
    return out.join('\n');
  };

  const handleAcceptStrategy = async () => {
    if (accepting) return;
    const content = editingStrategy ? editedStrategy : strategyContent;
    if (!content || content.length < 200) {
      toast.error('No strategy to accept yet.');
      return;
    }
    setAccepting(true);
    try {
      // Persist final strategy
      await supabase.from('campaigns').update({ strategy: content } as any).eq('id', campaignId);

      // Get campaign owner
      const { data: camp } = await supabase.from('campaigns').select('user_id').eq('id', campaignId).maybeSingle();
      const ownerId = (camp as any)?.user_id;

      // If paid, build PDF, upload, notify manager
      let pdfUrl: string | undefined;
      if (strategyMode === 'paid' && strategyBudget > 0 && ownerId) {
        try {
          const pdfBlob = generateStrategyPdf(content);
          const path = `${ownerId}/strategy-${campaignId}-${Date.now()}.pdf`;
          const { error: upErr } = await supabase.storage.from('kb-files').upload(path, pdfBlob, {
            contentType: 'application/pdf', upsert: true,
          });
          if (!upErr) {
            const { data: signed } = await supabase.storage.from('kb-files').createSignedUrl(path, 60 * 60 * 24 * 30);
            pdfUrl = signed?.signedUrl;
          }
        } catch (e) { console.warn('pdf upload failed', e); }

        toast.info('Notifying campaign manager…');
        const { data: notifyData, error: notifyErr } = await supabase.functions.invoke('notify-manager-strategy', {
          body: {
            campaignId,
            campaignName,
            clientUserId: ownerId,
            strategyMarkdown: content,
            budgetTotal: strategyBudget,
            pdfUrl,
          },
        });
        if (notifyErr) {
          toast.error('Manager notification failed', { description: notifyErr.message });
        } else {
          toast.success((notifyData as any)?.isNewAssignment
            ? 'Assigned Alyssa as manager and sent her the strategic plan.'
            : 'Strategic plan sent to your campaign manager.');
        }
      }

      // Always run organic content generation via Bundle.social flow
      if (channels.length > 0) {
        toast.info('Generating organic posts via Bundle.social…');
        const organicSummary = stripPaidSections(content);
        try {
          const { data, error } = await supabase.functions.invoke('generate-campaign-content', {
            body: { campaignId, strategy: organicSummary },
          });
          if (error) throw error;
          const created = (data as any)?.postsCreated ?? 0;
          toast.success(`Generated ${created} organic posts across your channels.`);
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: `✅ **Strategy accepted!** Created **${created} organic posts** for Bundle.social.${strategyMode === 'paid' ? ' Paid budget plan sent to manager.' : ''}` },
          ]);
        } catch (e: any) {
          toast.error('Failed to generate organic posts', { description: e?.message });
        }
      } else {
        toast.success('Strategy accepted.');
      }

      setEditingStrategy(false);
    } catch (e: any) {
      toast.error('Failed to accept strategy', { description: e?.message });
    } finally {
      setAccepting(false);
    }
  };

  const handleRegenerateStrategy = () => {
    if (strategyMode === null) { setBudgetPromptOpen(true); return; }
    runStrategyWithBudget(strategyBudget, strategyMode);
  };

  const handleEditStrategy = () => {
    setEditedStrategy(strategyContent);
    setEditingStrategy(true);
  };

  const saveEditedStrategy = async () => {
    setStrategyContent(editedStrategy);
    setEditingStrategy(false);
    try {
      await supabase.from('campaigns').update({ strategy: editedStrategy } as any).eq('id', campaignId);
      toast.success('Strategy updated.');
    } catch (e: any) {
      toast.error('Could not save edits', { description: e?.message });
    }
  };

  // Find the latest assistant report (the longest assistant message after a user prompt asking for a strategy)
  const getReportContent = (): string => {
    if (strategyContent) return strategyContent;
    const assistantMsgs = messages.filter((m) => m.role === 'assistant');
    if (assistantMsgs.length === 0) return '';
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
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Campaign Agent
            </DialogTitle>
            <ThemeToggle />
          </div>
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

            {/* Topic suggestion picker (shown when no focus is set) */}
            {!activeFocus && false && (
              <div className="border rounded-lg p-3 bg-muted/40 space-y-2">
                <div className="text-sm font-semibold">Choose a topic / focus:</div>
                {loadingSuggestions && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating ideas from your practice KB…
                  </div>
                )}
                {!loadingSuggestions && topicSuggestions.map((t, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left h-auto py-2 whitespace-normal"
                    onClick={() => chooseFocus(t)}
                    disabled={isLoading}
                  >
                    <Sparkles className="w-4 h-4 mr-2 shrink-0 text-primary" />
                    <span>{t}</span>
                  </Button>
                ))}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customFocusInput}
                    onChange={(e) => setCustomFocusInput(e.target.value)}
                    placeholder="Or enter your own focus…"
                    className="flex-1 px-3 py-2 text-sm rounded-md border bg-background"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') chooseFocus(customFocusInput);
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => chooseFocus(customFocusInput)}
                    disabled={!customFocusInput.trim() || isLoading}
                  >
                    Use
                  </Button>
                </div>
              </div>
            )}

            {/* Structured Suggestions panel */}
            {(loadingSuggestions2 || suggestions.length > 0) && (
              <div className="border rounded-lg p-3 bg-muted/40 space-y-2">
                <div className="text-sm font-semibold flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary" />
                  Suggested improvements
                  {loadingSuggestions2 && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </div>
                {!loadingSuggestions2 && (
                  <p className="text-xs text-muted-foreground">
                    Check the ones you want to apply, then click <strong>Apply Selected</strong>. Items marked <em>Manual</em> can't be auto-applied — you'll see what to do.
                  </p>
                )}
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <label
                      key={s.id}
                      className={`flex gap-2 items-start rounded-md border p-2 cursor-pointer hover:bg-accent/40 transition-colors ${
                        selectedSuggestionIds.has(s.id) ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <Checkbox
                        checked={selectedSuggestionIds.has(s.id)}
                        onCheckedChange={() => toggleSuggestion(s.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{s.title}</span>
                          {s.manual ? (
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 inline-flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Manual
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                              Auto
                            </span>
                          )}
                        </div>
                        {s.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{s.description}</p>
                        )}
                        {s.manual && s.manual_reason && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                            <strong>To do:</strong> {s.manual_reason}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={applySelectedSuggestions}
                      disabled={applyingSuggestions || selectedSuggestionIds.size === 0}
                    >
                      {applyingSuggestions ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                      Apply Selected ({selectedSuggestionIds.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedSuggestionIds(new Set(suggestions.filter((s) => !s.manual).map((s) => s.id)))}
                      disabled={applyingSuggestions}
                    >
                      Select all auto
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedSuggestionIds(new Set())}
                      disabled={applyingSuggestions}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {editingStrategy && (
          <div className="border-t pt-2">
            <div className="text-xs font-semibold mb-1 text-muted-foreground">Edit strategy (markdown):</div>
            <Textarea
              value={editedStrategy}
              onChange={(e) => setEditedStrategy(e.target.value)}
              className="min-h-[200px] max-h-[300px] font-mono text-xs"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {activeFocus && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={approveArticle}
                disabled={isLoading || isGeneratingCampaign}
                className="shrink-0"
              >
                ✅ Approve Article
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runBlogResearch(activeFocus)}
                disabled={isLoading || isGeneratingCampaign}
                className="shrink-0"
              >
                <Wand2 className="w-4 h-4 mr-1" /> Regenerate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setActiveFocus(''); setTopicSuggestions([]); fetchSuggestions(); }}
                disabled={isLoading || isGeneratingCampaign}
                className="shrink-0"
              >
                Edit Focus
              </Button>
            </>
          )}
          {!strategyComplete && (
            <Button
              variant="outline"
              size="sm"
              onClick={openStrategyPrompt}
              disabled={isLoading || isGeneratingCampaign}
              className="shrink-0"
            >
              <Sparkles className="w-4 h-4 mr-1" />
              Generate Strategy
            </Button>
          )}
          {strategyComplete && !editingStrategy && (
            <>
              <Button
                size="sm"
                onClick={handleAcceptStrategy}
                disabled={accepting || isLoading}
                className="shrink-0"
              >
                <Check className="w-4 h-4 mr-1" />
                {accepting ? 'Working…' : 'Accept Strategy'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditStrategy}
                disabled={accepting || isLoading}
                className="shrink-0"
              >
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateStrategy}
                disabled={accepting || isLoading}
                className="shrink-0"
              >
                <RefreshCw className="w-4 h-4 mr-1" /> Regenerate
              </Button>
            </>
          )}
          {editingStrategy && (
            <>
              <Button size="sm" onClick={saveEditedStrategy} className="shrink-0">
                <Check className="w-4 h-4 mr-1" /> Save Edits
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingStrategy(false)} className="shrink-0">
                Cancel
              </Button>
            </>
          )}
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
        </div>

        <BudgetPromptDialog
          open={budgetPromptOpen}
          onOpenChange={setBudgetPromptOpen}
          onConfirm={(amt, mode) => runStrategyWithBudget(amt, mode)}
        />

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
