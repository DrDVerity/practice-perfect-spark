import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useKnowledgeBase, KBDocumentType, getDocTypeLabel } from '@/hooks/useKnowledgeBase';
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
  const { documents, isLoading, addDocument, updateDocument, deleteDocument } = useKnowledgeBase();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingDoc, setEditingDoc] = useState<string | null>(null);
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<KBDocumentType | 'all'>('all');
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<KBDocumentType>('custom');
  const [formContent, setFormContent] = useState('');

  const resetForm = () => {
    setFormTitle('');
    setFormType('custom');
    setFormContent('');
    setEditingDoc(null);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      toast.error('Title and content are required');
      return;
    }

    if (editingDoc) {
      await updateDocument.mutateAsync({
        id: editingDoc,
        title: formTitle,
        doc_type: formType,
        content: formContent,
      });
      toast.success('Document updated');
    } else {
      await addDocument.mutateAsync({
        title: formTitle,
        doc_type: formType,
        content: formContent,
      });
      toast.success('Document added to Knowledge Base');
    }
    setShowAddDialog(false);
    resetForm();
  };

  const handleEdit = (doc: { id: string; title: string; doc_type: KBDocumentType; content: string }) => {
    setEditingDoc(doc.id);
    setFormTitle(doc.title);
    setFormType(doc.doc_type);
    setFormContent(doc.content);
    setShowAddDialog(true);
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

      // Save both reports to KB
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

      toast.success('Analysis reports generated and saved to Knowledge Base!');
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

  // Group by type for summary cards
  const typeCounts = allDocTypes.reduce((acc, type) => {
    acc[type] = documents.filter(d => d.doc_type === type).length;
    return acc;
  }, {} as Record<KBDocumentType, number>);

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
              AI-powered reference library for smarter content generation
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleGenerateReports}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Generate Analysis Reports
            </Button>
            <Button
              onClick={() => {
                resetForm();
                setShowAddDialog(true);
              }}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Document
            </Button>
          </div>
        </div>

        {/* Category Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {allDocTypes.map(type => (
            <Card
              key={type}
              className={`cursor-pointer transition-all hover:shadow-md ${filterType === type ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setFilterType(filterType === type ? 'all' : type)}
            >
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold text-foreground">{typeCounts[type]}</div>
                <div className="text-xs text-muted-foreground mt-1">{getDocTypeLabel(type)}</div>
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
                  ? 'Add platform rules, analysis reports, or custom documents to power smarter AI content generation.'
                  : 'Try adjusting your search or filter.'}
              </p>
              {documents.length === 0 && (
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" onClick={handleGenerateReports} disabled={isGenerating} className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    Auto-Generate Reports
                  </Button>
                  <Button onClick={() => { resetForm(); setShowAddDialog(true); }} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Document
                  </Button>
                </div>
              )}
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
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); handleEdit(doc); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); deleteDocument.mutate(doc.id); }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                    {expandedDocs[doc.id] ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
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

      {/* Add/Edit Dialog */}
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allDocTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {getDocTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                placeholder="Paste or write document content..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="min-h-[250px]"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={addDocument.isPending || updateDocument.isPending}>
                {editingDoc ? 'Update' : 'Save to KB'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KnowledgeBase;
