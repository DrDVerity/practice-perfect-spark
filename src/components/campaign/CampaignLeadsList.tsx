import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Phone, Loader2, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Lead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  source_url: string | null;
  created_at: string;
}

export function CampaignLeadsList({ campaignId }: { campaignId: string }) {
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['campaign-leads', campaignId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('landing_page_leads')
        .select('id, name, email, phone, message, source_url, created_at')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Lead[];
    },
    enabled: !!campaignId,
    refetchInterval: 30_000,
  });

  return (
    <div className="border-t pt-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold inline-flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" />
          Landing page leads
          <span className="text-xs font-normal text-muted-foreground">({leads.length})</span>
        </h4>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading leads…
        </div>
      ) : leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No leads yet. They'll appear here as visitors submit the contact form.
        </p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-auto">
          {leads.map((l) => (
            <li key={l.id} className="rounded-md border bg-background p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{l.name || '(no name)'}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 mt-0.5">
                    {l.email && (
                      <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:text-primary">
                        <Mail className="w-3 h-3" /> {l.email}
                      </a>
                    )}
                    {l.phone && (
                      <a href={`tel:${l.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                        <Phone className="w-3 h-3" /> {l.phone}
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                </div>
              </div>
              {l.message && (
                <p className="mt-2 text-muted-foreground whitespace-pre-wrap break-words">{l.message}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
