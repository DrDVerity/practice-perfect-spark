import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useKnowledgeBase, KBDocumentType, getDocTypeLabel, KBDocument } from '@/hooks/useKnowledgeBase';
import {
  ArrowLeft,
  Plus,
  BookOpen,
  FileText,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  Search,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';

const docTypeColors: Record<KBDocumentType, string> = {
  platform_rules: 'bg-blue-500/20 text-blue-700',
  audience_analysis: 'bg-purple-500/20 text-purple-700',
  market_analysis: 'bg-green-500/20 text-green-700',
  competitive_landscape: 'bg-orange-500/20 text-orange-700',
  demographics: 'bg-pink-500/20 text-pink-700',
  brand_guidelines: 'bg-amber-500/20 text-amber-700',
  custom: 'bg-muted text-muted-foreground',
};

const DEMOGRAPHIC_QUESTIONS = [
  { key: 'location', label: 'Geographic area (city, region, or radius)', placeholder: 'e.g., Greater Houston area, 25-mile radius' },
  { key: 'ageRange', label: 'Target age range', placeholder: 'e.g., 25-55 years old' },
  { key: 'income', label: 'Income level / Insurance status', placeholder: 'e.g., Middle to upper income, PPO insurance' },
  { key: 'services', label: 'Primary services to promote', placeholder: 'e.g., Cosmetic dentistry, implants, family care' },
  { key: 'competitors', label: 'Key competitors or market context', placeholder: 'e.g., 3 competing practices within 5 miles' },
];

const DOC_TYPE_PROMPTS: Record<string, string> = {
  demographics: 'Generate a comprehensive demographics report for my dental/healthcare practice.',
  audience_analysis: 'Generate a target audience analysis for my practice marketing campaigns.',
  market_analysis: 'Generate a market analysis report for my practice area and services.',
  competitive_landscape: 'Generate a competitive landscape analysis for my practice market.',
  brand_guidelines: 'Generate brand guidelines for my dental/healthcare practice.',
  platform_rules: 'Generate social media posting best practices and platform rules.',
};

const allDocTypes: KBDocumentType[] = [
  'platform_rules',
  'audience_analysis',
  'market_analysis',
  'competitive_landscape',
  'demographics',
  'brand_guidelines',
  'custom',
];

const KnowledgeBase = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { documents, isLoading, addDocument, updateDocument, deleteDocument, getDocsByType } = useKnowledgeBase();

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showCustomListDialog, setShowCustomListDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showRegenDialog, setShowRegenDialog] = useState(false);
  const [regenDoc, setRegenDoc] = useState<KBDocument | null>(null);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [regenTitle, setRegenTitle] = useState('');
  const [viewingDoc, setViewingDoc] = useState<KBDocument | null>(null);

  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<KBDocumentType | 'all'>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateType, setGenerateType] = useState<KBDocumentType>('custom');

  // Form state for Add/Edit
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<KBDocumentType>('custom');
  const [formPrompt, setFormPrompt] = useState('');
  const [formContent, setFormContent] = useState('');

  // Demographics questionnaire state
  const [demoAnswers, setDemoAnswers] = useState<Record<string, string>>({});

  const resetForm = () => {
    setFormTitle('');
    setFormType('custom');
    setFormPrompt('');
    setFormContent('');
    setEditingDoc(null);
    setDemoAnswers({});
  };

  const generateDocument = async (docType: KBDocumentType, prompt: string, title?: string) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-kb-document', {
        body: {
          docType,
          prompt,
          practiceInfo: {
            practiceName: profile?.practice_name,
            campaignFocus: profile?.campaign_focus,
            targetAudience: profile?.target_audience,
            websiteUrl: profile?.website_url,
          },
        },
      });

      if (error) throw error;

      const docTitle = title || `${getDocTypeLabel(docType)} Report`;
      await addDocument.mutateAsync({
        title: docTitle,
        doc_type: docType,
        content: data.content,
        metadata: { generated: true, prompt },
      });

      toast.success(`${docTitle} generated and saved!`);
      return data.content;
    } catch (error) {
      console.error('Error generating document:', error);
      toast.error('Failed to generate document. Please try again.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle tile click - generate if empty, filter if has docs
  const handleTileClick = (type: KBDocumentType) => {
    const docsOfType = getDocsByType(type);

    if (type === 'custom') {
      if (docsOfType.length === 0) {
        // Open add dialog for custom
        resetForm();
        setFormType('custom');
        setShowAddDialog(true);
      } else {
        setShowCustomListDialog(true);
      }
      return;
    }

    if (docsOfType.length === 0) {
      // No docs - trigger generation flow
      setGenerateType(type);
      if (type === 'demographics') {
        setDemoAnswers({});
        setShowGenerateDialog(true);
      } else {
        // Auto-generate with default prompt
        const prompt = DOC_TYPE_PROMPTS[type] || `Generate a ${getDocTypeLabel(type)} report.`;
        setFormPrompt(prompt);
        setGenerateType(type);
        setShowGenerateDialog(true);
      }
    } else {
      // Has docs - toggle filter
      setFilterType(filterType === type ? 'all' : type);
    }
  };

  const handleGenerateFromDialog = async () => {
    let prompt = formPrompt;

    if (generateType === 'demographics') {
      const parts = Object.entries(demoAnswers)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => {
          const q = DEMOGRAPHIC_QUESTIONS.find(q => q.key === k);
          return `${q?.label || k}: ${v}`;
        });
      prompt = `Generate a comprehensive demographics and target audience profile report.\n\n${parts.join('\n')}`;
    }

    if (!prompt.trim()) {
      toast.error('Please provide details for the report');
      return;
    }

    await generateDocument(generateType, prompt);
    setShowGenerateDialog(false);
    resetForm();
  };

  // Handle prompt-based add document
  const handleAddWithPrompt = async () => {
    if (!formPrompt.trim()) {
      toast.error('Please describe the report you want');
      return;
    }

    if (editingDoc) {
      // Editing existing - just update content
      await updateDocument.mutateAsync({
        id: editingDoc,
        title: formTitle || `${getDocTypeLabel(formType)} Report`,
        doc_type: formType,
        content: formContent,
      });
      toast.success('Document updated');
    } else {
      // Generate new from prompt
      const title = formTitle.trim() || `${getDocTypeLabel(formType)} Report`;
      await generateDocument(formType, formPrompt, title);
    }

    setShowAddDialog(false);
    resetForm();
  };

  const handleEdit = (doc: KBDocument) => {
    setEditingDoc(doc.id);
    setFormTitle(doc.title);
    setFormType(doc.doc_type);
    setFormContent(doc.content);
    setFormPrompt((doc.metadata as any)?.prompt || '');
    setShowAddDialog(true);
  };

  const handleRegenerate = (doc: KBDocument) => {
    const originalPrompt = (doc.metadata as any)?.prompt || '';
    setRegenDoc(doc);
    setRegenPrompt(originalPrompt);
    setRegenTitle(doc.title);
    setShowRegenDialog(true);
  };

  const handleRegenConfirm = async () => {
    if (!regenDoc || !regenPrompt.trim()) {
      toast.error('Please provide a prompt for regeneration');
      return;
    }
    const titleChanged = regenTitle.trim() !== regenDoc.title.trim();
    setShowRegenDialog(false);
    setIsGenerating(true);
    try {
      const content = await generateDocument(regenDoc.doc_type, regenPrompt, regenTitle.trim() || regenDoc.title);
      if (content && !titleChanged) {
        // Same title = replace old doc
        await deleteDocument.mutateAsync(regenDoc.id);
      }
      // If title changed, we keep both (new one was already created by generateDocument)
    } finally {
      setIsGenerating(false);
      setRegenDoc(null);
      setRegenPrompt('');
      setRegenTitle('');
    }
  };

  const handleEditRegenerate = async () => {
    if (!editingDoc || !formPrompt.trim()) {
      toast.error('Please provide a prompt to regenerate');
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-kb-document', {
        body: {
          docType: formType,
          prompt: formPrompt,
          practiceInfo: {
            practiceName: profile?.practice_name,
            campaignFocus: profile?.campaign_focus,
            targetAudience: profile?.target_audience,
            websiteUrl: profile?.website_url,
          },
        },
      });
      if (error) throw error;
      setFormContent(data.content);
      toast.success('Content regenerated from prompt');
    } catch (err) {
      console.error('Error regenerating:', err);
      toast.error('Failed to regenerate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleView = (doc: KBDocument) => {
    setViewingDoc(doc);
    setShowViewDialog(true);
  };

  const handleGenerateReports = async () => {
    const focus = profile?.campaign_focus || '';
    const audience = profile?.target_audience || '';

    if (!focus.trim() || !audience.trim()) {
      toast.error('Please set Campaign Focus and Target Audience in your profile first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-analysis-reports', {
        body: { campaignFocus: focus, targetAudience: audience },
      });

      if (error) throw error;

      await Promise.all([
        addDocument.mutateAsync({
          title: data.audienceReport.name,
          doc_type: 'audience_analysis',
          content: data.audienceReport.content,
          metadata: { campaignFocus: focus, targetAudience: audience },
        }),
        addDocument.mutateAsync({
          title: data.marketReport.name,
          doc_type: 'market_analysis',
          content: data.marketReport.content,
          metadata: { campaignFocus: focus, targetAudience: audience },
        }),
      ]);

      toast.success('Analysis reports generated and saved!');
    } catch (error) {
      console.error('Error generating reports:', error);
      toast.error('Failed to generate reports. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedDocs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = !searchQuery ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || doc.doc_type === filterType;
    return matchesSearch && matchesType;
  });

  const typeCounts = allDocTypes.reduce((acc, type) => {
    acc[type] = documents.filter(d => d.doc_type === type).length;
    return acc;
  }, {} as Record<KBDocumentType, number>);

  const customDocs = getDocsByType('custom');

  if (!user) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-primary/50">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo />
          </div>
        </div>
      </header>

      <main className="container px-4 py-8 md:py-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              Knowledge Base
            </h1>
            <p className="text-muted-foreground mt-1">
              Click a category to generate a report, or add a custom document
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleGenerateReports}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Analysis Reports
            </Button>
            <Button
              onClick={() => { resetForm(); setShowAddDialog(true); }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Document
            </Button>
          </div>
        </div>

        {/* Category Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {allDocTypes.map(type => (
            <Card
              key={type}
              className={`cursor-pointer transition-all hover:shadow-md ${filterType === type ? 'ring-2 ring-primary' : ''} ${typeCounts[type] === 0 ? 'border-dashed border-primary/30 hover:border-primary' : ''}`}
              onClick={() => handleTileClick(type)}
            >
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-foreground">{typeCounts[type]}</div>
                <div className="text-xs text-muted-foreground mt-1">{getDocTypeLabel(type)}</div>
                {typeCounts[type] === 0 && type !== 'custom' && (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary font-medium">Click to generate</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {filterType !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setFilterType('all')}>
              Clear filter
            </Button>
          )}
        </div>

        {/* Documents List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredDocs.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {documents.length === 0 ? 'No documents yet' : 'No matching documents'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {documents.length === 0
                  ? 'Click any category tile above to auto-generate a report, or add a custom document.'
                  : 'Try adjusting your search or filter.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map(doc => (
              <Card key={doc.id} className="overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => toggleExpanded(doc.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{doc.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className={docTypeColors[doc.doc_type]}>
                          {getDocTypeLabel(doc.doc_type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Updated {format(new Date(doc.updated_at), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleEdit(doc); }} title="Edit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleRegenerate(doc); }} title="Regenerate" disabled={isGenerating}>
                      <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteDocument.mutate(doc.id); }} title="Delete">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    {expandedDocs[doc.id] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {expandedDocs[doc.id] && (
                  <div className="px-4 pb-4 border-t border-border">
                    <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/50 p-4 rounded-lg mt-3 overflow-x-auto max-h-96 overflow-y-auto">
                      {doc.content}
                    </pre>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Generate Dialog (tile click) */}
      <Dialog open={showGenerateDialog} onOpenChange={(open) => { setShowGenerateDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Generate {getDocTypeLabel(generateType)} Report
            </DialogTitle>
          </DialogHeader>

          {generateType === 'demographics' ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Answer these questions to generate a tailored demographics report:
              </p>
              {DEMOGRAPHIC_QUESTIONS.map(q => (
                <div key={q.key} className="space-y-1">
                  <Label className="text-sm">{q.label}</Label>
                  <Input
                    placeholder={q.placeholder}
                    value={demoAnswers[q.key] || ''}
                    onChange={(e) => setDemoAnswers(prev => ({ ...prev, [q.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Customize the prompt below or click Generate to use the default:
              </p>
              <Textarea
                value={formPrompt || DOC_TYPE_PROMPTS[generateType] || ''}
                onChange={(e) => setFormPrompt(e.target.value)}
                className="min-h-[120px]"
                placeholder="Describe what you want in this report..."
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setShowGenerateDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleGenerateFromDialog} disabled={isGenerating} className="gap-2">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Document Dialog (prompt-based) */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {editingDoc ? 'Edit Document' : 'Add Document'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g., LinkedIn Posting Guidelines"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as KBDocumentType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allDocTypes.map(type => (
                    <SelectItem key={type} value={type}>{getDocTypeLabel(type)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {editingDoc ? (
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="min-h-[250px]"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Describe the report you want AI to generate</Label>
                <Textarea
                  placeholder="e.g., Create a comprehensive analysis of our competitive landscape focusing on cosmetic dentistry practices within a 10-mile radius..."
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  className="min-h-[150px]"
                />
                <p className="text-xs text-muted-foreground">
                  AI will use your practice profile and this prompt to generate a tailored report.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>Cancel</Button>
              {editingDoc ? (
                <Button onClick={async () => {
                  await updateDocument.mutateAsync({ id: editingDoc, title: formTitle, doc_type: formType, content: formContent });
                  toast.success('Document updated');
                  setShowAddDialog(false);
                  resetForm();
                }} disabled={updateDocument.isPending}>
                  Update
                </Button>
              ) : (
                <Button onClick={handleAddWithPrompt} disabled={isGenerating || addDocument.isPending} className="gap-2">
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate & Save
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Custom Documents List Dialog */}
      <Dialog open={showCustomListDialog} onOpenChange={setShowCustomListDialog}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custom Reports</DialogTitle>
          </DialogHeader>
          {customDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No custom reports yet.</p>
          ) : (
            <div className="space-y-2">
              {customDocs.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(doc.updated_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => { setShowCustomListDialog(false); handleView(doc); }} title="View">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setShowCustomListDialog(false); handleEdit(doc); }} title="Edit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setShowCustomListDialog(false); handleRegenerate(doc); }} title="Regenerate" disabled={isGenerating}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteDocument.mutate(doc.id)} title="Delete">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button onClick={() => { setShowCustomListDialog(false); resetForm(); setFormType('custom'); setShowAddDialog(true); }} className="w-full gap-2 mt-2">
            <Plus className="w-4 h-4" /> Add Custom Report
          </Button>
        </DialogContent>
      </Dialog>

      {/* View Document Dialog */}
      <Dialog open={showViewDialog} onOpenChange={(open) => { setShowViewDialog(open); if (!open) setViewingDoc(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingDoc?.title}</DialogTitle>
          </DialogHeader>
          {viewingDoc && (
            <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/50 p-4 rounded-lg overflow-x-auto">
              {viewingDoc.content}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBase;
