import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginWall } from './LoginWall';
import { PracticeData } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Loader2, FileText, Mail, Facebook, ThumbsUp, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface CampaignPreviewProps {
  practiceData: PracticeData;
  onBack: () => void;
}

interface ProspectReport {
  doc_type: string;
  title: string;
  content: string;
  metadata: any;
}

interface ProspectPost {
  variation: string;
  textCopy: string;
  imagePrompt: string;
  format?: 'image' | 'carousel' | 'interactive';
  slides?: Array<{ heading: string; body: string; imagePrompt?: string }> | null;
  interactive?: {
    kind?: 'quiz' | 'puzzle' | 'game';
    title?: string;
    intro?: string;
    questions?: Array<{ q: string; choices: string[]; answerIndex: number; explanation?: string }>;
    steps?: string[];
  } | null;
}

interface ProspectEmail {
  day: number;
  subject: string;
  preview: string;
  body: string;
}

interface ProspectCampaign {
  blog_title: string | null;
  blog_html: string | null;
  hero_image_url: string | null;
  illustrations: Array<{ caption: string; prompt: string }>;
  posts: ProspectPost[];
  email_funnel: ProspectEmail[];
}

export const CampaignPreview: React.FC<CampaignPreviewProps> = ({ practiceData, onBack }) => {
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useAuth();
  const { updateProfile } = useProfile();

  const [showLoginWall, setShowLoginWall] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [reports, setReports] = useState<ProspectReport[]>([]);
  const [campaign, setCampaign] = useState<ProspectCampaign | null>(null);
  const [selectedReport, setSelectedReport] = useState<ProspectReport | null>(null);
  const [loading, setLoading] = useState(true);

  const prospectId = practiceData.prospectId || (typeof window !== 'undefined' ? sessionStorage.getItem('prospectId') || undefined : undefined);
  const audienceText = practiceData.targetAudience.join(', ') || 'your target patients';

  useEffect(() => {
    if (!prospectId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-started-fetch', {
          body: { prospectId },
        });
        if (cancelled) return;
        if (error) throw new Error(error.message);
        setReports(((data as any)?.reports || []) as ProspectReport[]);
        setCampaign(((data as any)?.campaign || null) as ProspectCampaign | null);
      } catch (e: any) {
        toast.error('Could not load preview', { description: e.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [prospectId]);

  const handleGoogleLogin = async () => {
    try { await signInWithGoogle(); }
    catch (e) { toast.error('Failed to sign in.'); }
  };

  // After successful login, save profile + promote prospect
  useEffect(() => {
    if (!user || !showLoginWall) return;
    (async () => {
      setIsPromoting(true);
      try {
        await updateProfile.mutateAsync({
          practice_name: practiceData.practiceName,
          website_url: practiceData.websiteUrl,
          target_audience: practiceData.targetAudience.join(', '),
          campaign_focus: practiceData.campaignFocus,
        });
        if (prospectId) {
          try {
            await supabase.functions.invoke('promote-prospect', { body: { prospectId } });
          } catch (e) {
            console.warn('promote-prospect failed', e);
          }
        }
        toast.success('Your research and campaign are saved to your account!');
        navigate('/dashboard');
      } catch (e: any) {
        toast.error('Could not save your data', { description: e.message });
      } finally {
        setIsPromoting(false);
        setShowLoginWall(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isLoggedIn = !!user;
  const reportLabels: Record<string, string> = {
    practice_analysis: 'Practice Analysis',
    competitive_analysis: 'Competitive Analysis',
    audience_analysis: 'Audience Analysis',
    brand_guidelines: 'Brand Guidelines',
  };

  const promptSignIn = () => setShowLoginWall(true);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Start Over
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Your Campaign Preview
          </h1>
          <p className="text-muted-foreground mt-1">
            Personalised for <span className="font-medium text-foreground">{practiceData.practiceName}</span> — audience: {audienceText}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {reports.length} reports · {campaign?.posts?.length || 0} posts · {campaign?.email_funnel?.length || 0} emails
          </span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {!loading && (
        <div className="space-y-10">
          {/* Reports strip */}
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Research reports
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {reports.length === 0 && (
                <p className="text-sm text-muted-foreground col-span-full">
                  Reports are still generating. Refresh in a moment.
                </p>
              )}
              {reports.map((r) => (
                <div key={r.doc_type} className="p-4 rounded-xl bg-card border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    {reportLabels[r.doc_type] || r.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                    {r.metadata?.summary || r.content?.slice(0, 140) + '...'}
                  </p>
                  <Button size="sm" variant="outline" onClick={() => setSelectedReport(r)}>
                    View report
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Blog article */}
          {campaign?.blog_html && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Blog article
              </h2>
              <article className="rounded-2xl bg-card border border-border overflow-hidden">
                {campaign.hero_image_url && (
                  <img src={campaign.hero_image_url} alt={campaign.blog_title || 'Hero'} className="w-full h-64 object-cover" />
                )}
                <div className="p-6">
                  {campaign.blog_title && <h3 className="text-2xl font-bold text-foreground mb-4">{campaign.blog_title}</h3>}
                  <div
                    className="prose prose-sm max-w-none text-foreground [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-3"
                    dangerouslySetInnerHTML={{
                      __html: campaign.blog_html.replace(
                        /\[ILLUSTRATION:\s*([^\]]+)\]/g,
                        (_, cap) => `<div class="my-4 p-4 border border-dashed border-border rounded-lg bg-muted/40 text-center text-xs text-muted-foreground">🎨 Illustration: ${cap.trim()}</div>`
                      ),
                    }}
                  />
                </div>
              </article>
            </section>
          )}

          {/* 3 Facebook variations */}
          {(campaign?.posts?.length ?? 0) > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Facebook className="w-5 h-5 text-primary" /> 3 Facebook post variations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {campaign!.posts.map((post, i) => (
                  <div key={i} className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
                    <div className="p-3 border-b border-border flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        {practiceData.practiceName.charAt(0).toUpperCase() || 'P'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{practiceData.practiceName || 'Your Practice'}</p>
                        <p className="text-xs text-muted-foreground">Sponsored · {post.variation}</p>
                      </div>
                    </div>
                    <div className="px-3 pt-3 pb-2 text-sm whitespace-pre-wrap">{post.textCopy}</div>
                    {campaign!.hero_image_url && (
                      <img src={campaign!.hero_image_url} alt="" className="w-full aspect-video object-cover" />
                    )}
                    <div className="px-3 py-2 border-t border-border flex items-center justify-around text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ThumbsUp className="w-4 h-4" /> Like</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-4 h-4" /> Comment</span>
                      <span className="flex items-center gap-1"><Share2 className="w-4 h-4" /> Share</span>
                    </div>
                    <div className="p-3 border-t border-border">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => (isLoggedIn ? navigate('/dashboard') : promptSignIn())}
                      >
                        {isLoggedIn ? 'Edit in dashboard' : 'Sign in to edit'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Email funnel */}
          {(campaign?.email_funnel?.length ?? 0) > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" /> 6-email nurture funnel
              </h2>
              <div className="rounded-2xl bg-card border border-border p-4">
                <Accordion type="single" collapsible className="w-full">
                  {campaign!.email_funnel.map((email, i) => (
                    <AccordionItem key={i} value={`email-${i}`}>
                      <AccordionTrigger className="text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">Day {email.day}: {email.subject}</p>
                          <p className="text-xs text-muted-foreground truncate">{email.preview}</p>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="whitespace-pre-wrap text-sm text-foreground/90 pt-2">{email.body}</div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </section>
          )}

          {/* CTA */}
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="mx-auto max-w-3xl text-base md:text-lg text-foreground leading-relaxed">
              Schedule posts and full campaigns to all your social accounts at once. Connect your channels, refine the AI content, and grow your practice with a free account.
            </p>
            <Button
              size="lg"
              className="mt-6"
              onClick={() => (isLoggedIn ? navigate('/dashboard') : promptSignIn())}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              {isLoggedIn ? 'Go to Dashboard' : 'Get a free account'}
            </Button>
          </div>
        </div>
      )}

      {/* Report modal */}
      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && setSelectedReport(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedReport?.title}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {selectedReport?.content}
          </div>
        </DialogContent>
      </Dialog>

      {isPromoting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
          <div className="bg-card rounded-2xl p-8 text-center">
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Saving your campaign...</h3>
          </div>
        </div>
      )}

      {showLoginWall && !isPromoting && (
        <LoginWall
          onGoogleLogin={handleGoogleLogin}
          onClose={() => setShowLoginWall(false)}
        />
      )}
    </div>
  );
};
