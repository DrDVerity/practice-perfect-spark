/**
 * BlogArticlePanel, renders the campaign's blog title, hero image, first-
 * paragraph hook, and the rest of the markdown article. Provides an
 * Accept toggle wired to campaigns.assets_accepted.blog and a Regenerate
 * image control (prompt-editable) that updates campaigns.hero_image_url.
 */
import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  Circle,
  ImageOff,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  campaignId?: string;
  title: string | null | undefined;
  heroImageUrl: string | null | undefined;
  article: string | null | undefined;
  accepted: boolean;
  isRegenerating?: boolean;
  onRegenerate?: () => void;
  onToggleAccepted: (next: boolean) => void;
  onHeroImageUpdated?: (url: string) => void;
}

export default function BlogArticlePanel({
  campaignId,
  title,
  heroImageUrl,
  article,
  accepted,
  isRegenerating = false,
  onRegenerate,
  onToggleAccepted,
  onHeroImageUpdated,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [regenLoading, setRegenLoading] = useState(false);
  const [localHero, setLocalHero] = useState<string | null | undefined>(heroImageUrl);
  React.useEffect(() => { setLocalHero(heroImageUrl); }, [heroImageUrl]);

  const { firstPara, rest } = useMemo(() => {
    const body = (article || '').trim();
    if (!body) return { firstPara: '', rest: '' };
    const paras = body.split(/\n{2,}/);
    let idx = 0;
    while (idx < paras.length && /^\s*#{1,6}\s+/.test(paras[idx])) idx++;
    const first = paras[idx] || '';
    const rest = paras.slice(idx + 1).join('\n\n');
    return { firstPara: first, rest };
  }, [article]);

  const openImageDialog = () => {
    setRegenPrompt(
      `Photorealistic, editorial hero image for a blog article titled "${title || ''}". ` +
      `Bright, modern, professional composition. No on-screen text, no logos, no watermarks. Wide 16:9.`
    );
    setShowImageDialog(true);
  };

  const regenerateHeroImage = async () => {
    if (!campaignId || !regenPrompt.trim()) return;
    setRegenLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { prompt: regenPrompt, platform: 'blog' },
      });
      if (error) throw error;
      const url = (data as any)?.imageUrl;
      if (!url) throw new Error('No image returned');
      const { error: updErr } = await supabase
        .from('campaigns')
        .update({ hero_image_url: url } as any)
        .eq('id', campaignId);
      if (updErr) throw updErr;
      setLocalHero(url);
      onHeroImageUpdated?.(url);
      toast.success('Hero image regenerated');
      setShowImageDialog(false);
    } catch (e: any) {
      toast.error('Failed to regenerate image', { description: e.message });
    } finally {
      setRegenLoading(false);
    }
  };

  if (!article) return null;

  return (
    <Card className="p-6 md:p-8 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
          {title || 'Blog article'}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {campaignId && (
            <Button size="sm" variant="outline" onClick={openImageDialog}>
              <ImageIcon className="w-4 h-4 mr-1" />
              Regenerate image
            </Button>
          )}
          {onRegenerate && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Regenerate blog
            </Button>
          )}
          <Button
            size="sm"
            variant={accepted ? 'default' : 'outline'}
            onClick={() => onToggleAccepted(!accepted)}
            className={cn(accepted && 'bg-primary hover:bg-primary/90 text-primary-foreground')}
          >
            {accepted
              ? <><CheckCircle2 className="w-4 h-4 mr-1" /> Accepted</>
              : <><Circle className="w-4 h-4 mr-1" /> Accept</>}
          </Button>
        </div>
      </div>

      {localHero ? (
        <img
          src={localHero}
          alt={title || 'Blog hero'}
          className="w-full h-auto max-h-[420px] object-cover rounded-lg mb-6"
        />
      ) : (
        <div className="w-full h-48 rounded-lg mb-6 bg-muted flex items-center justify-center text-muted-foreground text-sm">
          <ImageOff className="w-5 h-5 mr-2" /> Hero image not generated yet
        </div>
      )}

      {firstPara && (
        <div className="prose prose-lg dark:prose-invert max-w-none border-l-4 border-primary pl-4 italic text-foreground/90 mb-6">
          <ReactMarkdown>{firstPara}</ReactMarkdown>
        </div>
      )}

      {expanded ? (
        <div className="prose dark:prose-invert max-w-none">
          <ReactMarkdown>{rest}</ReactMarkdown>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(false)} className="mt-4">
            Collapse article
          </Button>
        </div>
      ) : (
        rest && (
          <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
            Read full article
          </Button>
        )
      )}

      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Regenerate blog hero image</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="blog-hero-prompt">Image prompt</Label>
            <Textarea
              id="blog-hero-prompt"
              rows={5}
              value={regenPrompt}
              onChange={(e) => setRegenPrompt(e.target.value)}
              placeholder="Describe what you want changed, or leave as-is for a fresh variation."
            />
            {localHero && (
              <div className="w-full max-h-40 overflow-hidden rounded-lg bg-muted">
                <img src={localHero} alt="Current" className="w-full h-auto object-cover" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageDialog(false)} disabled={regenLoading}>
              Cancel
            </Button>
            <Button onClick={regenerateHeroImage} disabled={regenLoading || !regenPrompt.trim()}>
              {regenLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
