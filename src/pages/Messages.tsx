import { useMemo, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/hooks/useAuth';
import { useCampaignMessages, type CampaignMessage } from '@/hooks/useCampaignMessages';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Mail, MessageSquare, Send, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

type Camp = { id: string; name: string };

export default function Messages() {
  const { accountId, isLoading: wsLoading } = useWorkspace();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = (location.state as any)?.prefill as
    | { type?: 'email' | 'sms'; recipient_type?: 'manager' | 'client' | 'vendor'; to?: string; subject?: string; body?: string; name?: string }
    | undefined;
  const [selected, setSelected] = useState<string | null>(null); // campaign_id or null=General

  // Clear route state so a hard refresh doesn't re-apply the prefill.
  useEffect(() => {
    if (prefill) navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['messages_campaign_list', accountId],
    queryFn: async (): Promise<Camp[]> => {
      if (!accountId) return [];
      const { data, error } = await (supabase as any)
        .from('campaigns')
        .select('id, name, location_id, locations!inner(account_id)')
        .eq('locations.account_id', accountId)
        .order('created_at', { ascending: false });
      if (error) {
        // Fallback: some schemas may not join through; try location scoping via workspace locations
        const { data: locs } = await (supabase as any)
          .from('locations').select('id').eq('account_id', accountId);
        const ids = (locs || []).map((l: any) => l.id);
        if (!ids.length) return [];
        const { data: c } = await (supabase as any)
          .from('campaigns').select('id, name').in('location_id', ids).order('created_at', { ascending: false });
        return c || [];
      }
      return (data || []).map((c: any) => ({ id: c.id, name: c.name }));
    },
    enabled: !!accountId,
  });

  const { messages, isLoading, send } = useCampaignMessages(selected);

  const activeName = useMemo(() => {
    if (!selected) return 'General';
    return campaigns.find((c) => c.id === selected)?.name ?? 'Campaign';
  }, [selected, campaigns]);

  if (wsLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!accountId) return <div className="p-8">No practice account.</div>;

  return (
    <div className="flex h-[calc(100vh-2rem)] w-full gap-4 p-4">
      {/* Left pane */}
      <Card className="w-72 shrink-0 overflow-hidden">
        <div className="border-b p-4">
          <h2 className="font-display text-lg font-semibold">Campaigns</h2>
          <p className="text-xs text-muted-foreground">Select a thread</p>
        </div>
        <ScrollArea className="h-[calc(100%-4.5rem)]">
          <button
            className={cn(
              'flex w-full items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-accent',
              selected === null && 'bg-accent'
            )}
            onClick={() => setSelected(null)}
          >
            <Inbox className="h-4 w-4" /> General
          </button>
          {campaigns.map((c) => (
            <button
              key={c.id}
              className={cn(
                'flex w-full items-center gap-2 border-b px-4 py-3 text-left text-sm hover:bg-accent',
                selected === c.id && 'bg-accent'
              )}
              onClick={() => setSelected(c.id)}
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
          {campaigns.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">No campaigns yet.</div>
          )}
        </ScrollArea>
      </Card>

      {/* Right pane */}
      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h1 className="font-display text-xl font-semibold">{activeName}</h1>
            <p className="text-xs text-muted-foreground">Collaborate with managers, clients & vendors</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Mail className="h-3 w-3" /> mg.archerdental.marketing
          </Badge>
        </div>

        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No messages yet. Start the conversation below.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <MessageBubble key={m.id} m={m} selfId={user?.id ?? null} />
              ))}
            </div>
          )}
        </ScrollArea>

        <Composer prefill={prefill} onSend={async (p) => {
          try { await send.mutateAsync(p); toast.success('Sent'); } catch { /* toast in hook */ }
        }} sending={send.isPending} />
      </Card>
    </div>
  );
}

function MessageBubble({ m, selfId }: { m: CampaignMessage; selfId: string | null }) {
  const mine = m.direction === 'outbound' && m.sender_user_id === selfId;
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
        mine ? 'bg-primary text-primary-foreground' : 'bg-muted'
      )}>
        <div className="mb-1 flex items-center gap-2 text-xs opacity-80">
          <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px] uppercase">
            {m.type}
          </Badge>
          <span>{m.sender_display || m.sender_address || (mine ? 'You' : 'External')}</span>
          <span>→ {m.recipient_address}</span>
          <span className="ml-auto">{format(new Date(m.created_at), 'MMM d, h:mm a')}</span>
        </div>
        {m.subject && <div className="mb-1 font-medium">{m.subject}</div>}
        <div className="whitespace-pre-wrap break-words">{m.body}</div>
      </div>
    </div>
  );
}

function Composer({
  onSend, sending,
}: {
  onSend: (p: { type: 'email' | 'sms'; recipient_type: 'manager' | 'client' | 'vendor'; recipient_address: string; subject?: string; body: string }) => void | Promise<void>;
  sending: boolean;
}) {
  const [type, setType] = useState<'email' | 'sms'>('email');
  const [recipientType, setRecipientType] = useState<'manager' | 'client' | 'vendor'>('vendor');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const submit = async () => {
    if (!to.trim() || !body.trim()) { toast.error('Recipient and body required'); return; }
    await onSend({ type, recipient_type: recipientType, recipient_address: to.trim(), subject: type === 'email' ? subject.trim() : undefined, body: body.trim() });
    setBody(''); setSubject('');
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs value={type} onValueChange={(v) => setType(v as 'email' | 'sms')}>
          <TabsList>
            <TabsTrigger value="email"><Mail className="mr-1 h-3.5 w-3.5" />Email</TabsTrigger>
            <TabsTrigger value="sms"><MessageSquare className="mr-1 h-3.5 w-3.5" />SMS</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={recipientType} onValueChange={(v) => setRecipientType(v as any)}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="vendor">Vendor</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="flex-1 min-w-[220px]"
          placeholder={type === 'email' ? 'recipient@example.com' : '+15551234567'}
          value={to} onChange={(e) => setTo(e.target.value)}
        />
      </div>
      {type === 'email' && (
        <Input className="mb-2" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      )}
      <div className="flex gap-2">
        <Textarea rows={3} placeholder="Write your message…" value={body} onChange={(e) => setBody(e.target.value)} />
        <Button onClick={submit} disabled={sending} className="self-end">
          <Send className="mr-1 h-4 w-4" /> Send
        </Button>
      </div>
    </div>
  );
}
