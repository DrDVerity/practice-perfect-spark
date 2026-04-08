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
import { Bot, Send, Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
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
  onStrategyGenerated,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: `Hi! I'm your Campaign Agent. I'm here to help you build and refine the **${campaignName}** campaign. Ask me about content ideas, channel strategies, scheduling, audience targeting, or click **Generate Strategy** to create a full campaign strategy report.`,
        },
      ]);
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
    const strategyPrompt = `Generate a comprehensive campaign strategy report for "${campaignName}". Include:
1. **Executive Summary** - campaign goals and objectives
2. **Target Audience Analysis** - who we're targeting and why
3. **Channel Strategy** - which channels to use and how
${addonTypes.length > 0 ? `4. **Add-On Strategies** - specific plans for: ${addonTypes.join(', ')}` : ''}
${budgetTotal ? `5. **Budget Allocation Recommendations** - how to distribute the $${budgetTotal.toLocaleString()} budget` : ''}
6. **Content Calendar** - suggested posting schedule
7. **Key Performance Indicators** - metrics to track success
8. **Creative Direction** - tone, messaging, visual guidelines

Make it actionable and specific to a healthcare/dental practice.`;

    const userMsg: Message = { role: 'user', content: strategyPrompt };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    const result = await streamRequest(updatedMessages);
    if (result && onStrategyGenerated) {
      onStrategyGenerated(result);
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
      <DialogContent className="max-w-2xl h-[600px] flex flex-col">
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
                  className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
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

        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={generateStrategy}
            disabled={isLoading}
            className="shrink-0"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Generate Strategy
          </Button>
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
