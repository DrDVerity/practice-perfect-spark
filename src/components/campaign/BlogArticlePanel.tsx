/**
 * BlogArticlePanel — renders the campaign's blog title, hero image, first-
 * paragraph hook, and the rest of the markdown article. Provides an
 * Accept toggle wired to campaigns.assets_accepted.blog.
 */
import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle, ImageOff, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  title: string | null | undefined;
  heroImageUrl: string | null | undefined;
  article: string | null | undefined;
  accepted: boolean;
  isRegenerating?: boolean;
  onRegenerate?: () => void;
  onToggleAccepted: (next: boolean) => void;
}

export default function BlogArticlePanel({
  title,
  heroImageUrl,
  article,
  accepted,
  isRegenerating = false,
  onRegenerate,
  onToggleAccepted,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const { firstPara, rest } = useMemo(() => {
    const body = (article || '').trim();
    if (!body) return { firstPara: '', rest: '' };
    // Skip any leading H1/H2 headings, take the first non-empty paragraph as the hook.
    const paras = body.split(/\n{2,}/);
    let idx = 0;
    while (idx < paras.length && /^\s*#{1,6}\s+/.test(paras[idx])) idx++;
    const first = paras[idx] || '';
    const rest = paras.slice(idx + 1).join('\n\n');
    return { firstPara: first, rest };
  }, [article]);

  if (!article) return null;

  return (
    <Card className="p-6 md:p-8 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
          {title || 'Blog article'}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
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

      {heroImageUrl ? (
        <img
          src={heroImageUrl}
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
    </Card>
  );
}
