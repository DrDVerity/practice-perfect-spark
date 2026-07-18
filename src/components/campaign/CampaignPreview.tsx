import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { PlanPickerDialog, PlanTier } from './PlanPickerDialog';
import { PracticeData } from '@/types/campaign';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home, Sparkles, Loader2, FileText, Mail, Facebook, ThumbsUp, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import PdfCanvasViewer from '@/components/dashboard/PdfCanvasViewer';

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
  imageUrl?: string | null;
  format?: 'image' | 'carousel' | 'interactive';
  slides?: Array<{ heading: string; body: string; imagePrompt?: string; imageUrl?: string | null }> | null;
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
  const { theme, setTheme } = useTheme();

  // Force dark mode for the preview experience unless the user has explicitly
  // switched to light during this session.
  const userOverrodeTheme = useRef(false);
  useEffect(() => {
    if (!userOverrodeTheme.current && theme !== 'dark') {
      setTheme('dark');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (theme === 'light') userOverrodeTheme.current = true;
  }, [theme]);

  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [reports, setReports] = useState<ProspectReport[]>([]);
  const [campaign, setCampaign] = useState<ProspectCampaign | null>(null);
  const [selectedReport, setSelectedReport] = useState<ProspectReport | null>(null);
  const [reportPdfUrl, setReportPdfUrl] = useState<string | null>(null);
  const [reportPdfBlob, setReportPdfBlob] = useState<Blob | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfCache, setPdfCache] = useState<Record<string, { url: string; blob: Blob }>>({});
  const [loading, setLoading] = useState(true);

  const prospectId = practiceData.prospectId || (typeof window !== 'undefined' ? sessionStorage.getItem('prospectId') || undefined : undefined);
  const audienceText = practiceData.targetAudience.join(', ') || 'your target patients';

  const openReport = async (r: ProspectReport) => {
    setSelectedReport(r);
    if (pdfCache[r.doc_type]) {
      setReportPdfUrl(pdfCache[r.doc_type].url);
      setReportPdfBlob(pdfCache[r.doc_type].blob);
      return;
    }
    if (!prospectId) {
      toast.error('Missing prospect id');
      return;
    }
    setPdfLoading(true);
    setReportPdfUrl(null);
    setReportPdfBlob(null);
    try {
      const { data, error, response } = await supabase.functions.invoke('generate-report-pdf', {
        body: { prospectId, docType: r.doc_type },
      });
      if (error) {
        let message = error.message || 'Failed to generate report PDF';
        try {
          const text = await response?.clone().text();
          if (text) {
            const parsed = JSON.parse(text);
            message = parsed?.error || text;
          }
        } catch {
          // Keep the SDK error message if the response body is unavailable.
        }
        throw new Error(message);
      }
      if (!(data instanceof Blob)) throw new Error('Report PDF was not returned');
      const blob = data;
      const url = URL.createObjectURL(blob);
      setPdfCache((c) => ({ ...c, [r.doc_type]: { url, blob } }));
      setReportPdfUrl(url);
      setReportPdfBlob(blob);
    } catch (e: any) {
      toast.error('Could not open report', { description: e.message });
    } finally {
      setPdfLoading(false);
    }
  };

  const closeReport = () => {
    setSelectedReport(null);
    setReportPdfUrl(null);
    setReportPdfBlob(null);
  };



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

  const handlePlanSelected = async (plan: PlanTier) => {
    setSelectedPlan(plan);
    try {
      // Persist selection so it survives OAuth redirect
      sessionStorage.setItem('pendingPlanTier', plan);
      if (prospectId) sessionStorage.setItem('prospectId', prospectId);
      await signInWithGoogle();
    } catch (e) {
      toast.error('Failed to sign in.');
    }
  };

  // After successful login, save profile + promote prospect with plan
  useEffect(() => {
    if (!user) return;
    const pendingPlan = (selectedPlan || (sessionStorage.getItem('pendingPlanTier') as PlanTier | null));
    if (!pendingPlan) return;
    (async () => {
      setIsPromoting(true);
      try {
        await updateProfile.mutateAsync({
          practice_name: practiceData.practiceName,
          website_url: practiceData.websiteUrl,
          target_audience: practiceData.targetAudience.join(', '),
          campaign_focus: practiceData.campaignFocus,
        });
        const resolvedProspectId = prospectId || sessionStorage.getItem('prospectId') || undefined;
        try {
          await supabase.functions.invoke('promote-prospect', {
            body: { prospectId: resolvedProspectId, planTier: pendingPlan },
          });
        } catch (e) {
          console.warn('promote-prospect failed', e);
        }
        sessionStorage.removeItem('pendingPlanTier');
        sessionStorage.removeItem('prospectId');
        toast.success(pendingPlan === 'trial' ? 'Your free trial is active!' : 'Your account is set up!');
        navigate('/dashboard');
      } catch (e: any) {
        toast.error('Could not save your data', { description: e.message });
      } finally {
        setIsPromoting(false);
        setShowPlanPicker(false);
        setSelectedPlan(null);
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

  const promptSignIn = () => setShowPlanPicker(true);

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
            Personalised for <span className="font-medium text-foreground">{practiceData.practiceName}</span>, audience: {audienceText}
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
                  <Button size="sm" variant="outline" onClick={() => openReport(r)}>
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
                    className="prose prose-sm max-w-none text-foreground [&_h2]:mt-6 [&_h2]:mb-2 [&_p]:mb-3 [&_figure]:my-6 [&_figure_img]:rounded-xl [&_figcaption]:text-xs [&_figcaption]:text-center [&_figcaption]:text-muted-foreground [&_figcaption]:mt-2"
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
                    
                    {post.format === 'carousel' && post.slides && post.slides.length > 0 ? (
                      <div className="flex overflow-x-auto snap-x snap-mandatory">
                        {post.slides.map((s, si) => (
                          <div key={si} className="snap-center shrink-0 w-full aspect-video relative border-r border-border/50 overflow-hidden">
                            {s.imageUrl ? (
                              <img src={s.imageUrl} alt={s.heading} className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-primary/5" />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                              <div className="text-[10px] uppercase tracking-wide opacity-80 mb-1">Slide {si + 1} of {post.slides!.length}</div>
                              <div className="text-sm font-bold leading-tight">{s.heading}</div>
                              <div className="text-xs mt-1 line-clamp-3 opacity-90">{s.body}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : post.format === 'interactive' && post.interactive ? (
                      <div className="p-4 bg-accent/30 space-y-2">
                        <div className="text-[10px] uppercase tracking-wide text-primary font-semibold">
                          {post.interactive.kind || 'interactive'} · engagement
                        </div>
                        {post.interactive.title && <div className="text-sm font-bold text-foreground">{post.interactive.title}</div>}
                        {post.interactive.intro && <div className="text-xs text-foreground/80">{post.interactive.intro}</div>}
                        {post.interactive.questions && post.interactive.questions.length > 0 && (
                          <div className="space-y-2 pt-1">
                            {post.interactive.questions.slice(0, 1).map((q, qi) => (
                              <div key={qi} className="space-y-1">
                                <div className="text-xs font-medium">{q.q}</div>
                                <div className="grid gap-1">
                                  {q.choices?.map((c, ci) => (
                                    <div key={ci} className="text-[11px] px-2 py-1 rounded bg-background border border-border">
                                      {String.fromCharCode(65 + ci)}. {c}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                            {post.interactive.questions.length > 1 && (
                              <div className="text-[10px] text-muted-foreground">+ {post.interactive.questions.length - 1} more question(s)</div>
                            )}
                          </div>
                        )}
                        {post.interactive.steps && post.interactive.steps.length > 0 && (
                          <ol className="list-decimal ml-4 text-xs text-foreground/80 space-y-0.5">
                            {post.interactive.steps.slice(0, 4).map((st, sti) => <li key={sti}>{st}</li>)}
                          </ol>
                        )}
                      </div>
                    ) : (post.imageUrl || campaign!.hero_image_url) && (
                      <img src={post.imageUrl || campaign!.hero_image_url!} alt="" className="w-full aspect-video object-cover" />
                    )}
                    <div className="px-3 pt-3 pb-2 text-sm whitespace-pre-wrap border-t border-border">{post.textCopy}</div>
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

      {/* Report modal — print-ready branded PDF */}
      <Dialog open={!!selectedReport} onOpenChange={(o) => !o && closeReport()}>
        <DialogContent className="!flex h-[90vh] max-h-[90vh] max-w-5xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 px-6 pt-5 pb-3 border-b flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-base">
              {reportLabels[selectedReport?.doc_type || ''] || selectedReport?.title}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {reportPdfUrl && (
                <>
                  <a
                    href={reportPdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-accent"
                  >
                    Open in new tab
                  </a>
                  <a
                    href={reportPdfUrl}
                    download={`${practiceData.practiceName.replace(/[^A-Za-z0-9]+/g, '_')}_${(selectedReport?.doc_type || 'report')}.pdf`}
                    className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                  >
                    Download PDF
                  </a>
                </>
              )}
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden bg-muted/40">
            {pdfLoading && (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-3 text-sm text-muted-foreground">Rendering print-ready PDF…</span>
              </div>
            )}
            {!pdfLoading && reportPdfBlob && (
              <PdfCanvasViewer blob={reportPdfBlob} title={selectedReport?.title || 'Report'} />
            )}
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

      <PlanPickerDialog
        open={showPlanPicker && !isPromoting}
        onClose={() => setShowPlanPicker(false)}
        onSelect={handlePlanSelected}
      />
    </div>
  );
};
