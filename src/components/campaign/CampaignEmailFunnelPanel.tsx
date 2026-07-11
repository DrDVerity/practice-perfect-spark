/**
 * CampaignEmailFunnelPanel, displays and manages the 6-email lead-nurture
 * funnel generated for a campaign. Includes preview, per-email edit,
 * regenerate-all, and an accept flag persisted on campaigns.assets_accepted.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Loader2, Mail, RefreshCw, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface FunnelEmail {
  id: string;
  order_index: number;
  subject: string;
  preview_text: string | null;
  body_html: string;
  send_offset_days: number;
}

interface Props {
  campaignId: string;
  accepted?: boolean;
  onToggleAccepted?: (v: boolean) => void;
}

export function CampaignEmailFunnelPanel({ campaignId, accepted, onToggleAccepted }: Props) {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<FunnelEmail>>({});

  const { data: emails, isLoading } = useQuery({
    queryKey: ['campaign-email-funnel', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_email_funnel' as any)
        .select('*')
        .eq('campaign_id', campaignId)
        .order('order_index');
      if (error) throw error;
      return (data || []) as unknown as FunnelEmail[];
    },
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-email-funnel', {
        body: { campaignId, regenerate: true },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      toast.success('Email funnel regenerated');
      qc.invalidateQueries({ queryKey: ['campaign-email-funnel', campaignId] });
    },
    onError: (e: Error) => toast.error('Regeneration failed', { description: e.message }),
  });

  const saveEmail = useMutation({
    mutationFn: async () => {
      if (!editingId) return;
      const { error } = await supabase
        .from('campaign_email_funnel' as any)
        .update({
          subject: draft.subject,
          preview_text: draft.preview_text,
          body_html: draft.body_html,
          send_offset_days: draft.send_offset_days,
        } as any)
        .eq('id', editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Email saved');
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ['campaign-email-funnel', campaignId] });
    },
    onError: (e: Error) => toast.error('Save failed', { description: e.message }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading email funnel…
      </div>
    );
  }

  if (!emails || emails.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Mail className="w-8 h-8 mx-auto text-muted-foreground/70 mb-2" />
        <p className="text-sm text-muted-foreground mb-4">
          No lead-nurture emails have been generated yet.
        </p>
        <Button size="sm" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
          {regenerate.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</>
          ) : (
            <>Generate 6-email funnel</>
          )}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Lead-Nurture Email Funnel</h3>
          <p className="text-xs text-muted-foreground">
            Welcome + 5 nurture emails. Sent over the first ~16 days after opt-in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onToggleAccepted && (
            <Button
              size="sm"
              variant={accepted ? 'default' : 'outline'}
              onClick={() => onToggleAccepted(!accepted)}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {accepted ? 'Accepted' : 'Accept funnel'}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
          >
            {regenerate.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Regenerate
          </Button>
        </div>
      </div>

      <ol className="space-y-3">
        {emails.map((e) => {
          const isEditing = editingId === e.id;
          return (
            <li key={e.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Email {e.order_index + 1} · sends day +{e.send_offset_days}
                    </div>
                    {isEditing ? (
                      <Input
                        className="mt-1"
                        value={draft.subject || ''}
                        onChange={(ev) => setDraft({ ...draft, subject: ev.target.value })}
                      />
                    ) : (
                      <div className="font-medium truncate">{e.subject}</div>
                    )}
                    {isEditing ? (
                      <Input
                        className="mt-2"
                        placeholder="Preview text"
                        value={draft.preview_text || ''}
                        onChange={(ev) => setDraft({ ...draft, preview_text: ev.target.value })}
                      />
                    ) : (
                      e.preview_text && (
                        <div className="text-xs text-muted-foreground truncate">{e.preview_text}</div>
                      )
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <Button size="sm" onClick={() => saveEmail.mutate()} disabled={saveEmail.isPending}>
                          <Save className="w-4 h-4 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(e.id);
                          setDraft({
                            subject: e.subject,
                            preview_text: e.preview_text || '',
                            body_html: e.body_html,
                            send_offset_days: e.send_offset_days,
                          });
                        }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <Textarea
                    className="font-mono text-xs min-h-[200px]"
                    value={draft.body_html || ''}
                    onChange={(ev) => setDraft({ ...draft, body_html: ev.target.value })}
                  />
                ) : (
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert border rounded-md p-3 bg-muted/30 max-h-[280px] overflow-auto"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: e.body_html }}
                  />
                )}
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
