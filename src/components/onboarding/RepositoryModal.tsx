import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RepositoryDocument } from '@/types/campaign';
import { FolderOpen, Upload, Trash2, FileText, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';

interface GeneratedReport {
  id: string;
  name: string;
  type: 'research';
  content: string;
}

interface RepositoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: RepositoryDocument[];
  onAddDocument: (doc: RepositoryDocument) => void;
  onRemoveDocument: (id: string) => void;
  campaignFocus?: string;
  targetAudience?: string;
}

export const RepositoryModal: React.FC<RepositoryModalProps> = ({
  open,
  onOpenChange,
  documents,
  onAddDocument,
  onRemoveDocument,
  campaignFocus = '',
  targetAudience = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const docType = getDocumentType(file.name);
      const newDoc: RepositoryDocument = {
        id: crypto.randomUUID(),
        name: file.name,
        type: docType,
        url: URL.createObjectURL(file),
      };
      onAddDocument(newDoc);
    });

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getDocumentType = (filename: string): RepositoryDocument['type'] => {
    const lower = filename.toLowerCase();
    if (lower.includes('research') || lower.includes('study')) return 'research';
    if (lower.includes('product')) return 'product';
    if (lower.includes('service')) return 'service';
    return 'other';
  };

  const getTypeLabel = (type: RepositoryDocument['type']) => {
    switch (type) {
      case 'research': return 'Research';
      case 'product': return 'Product';
      case 'service': return 'Service';
      default: return 'Other';
    }
  };

  const handleGenerateReports = async () => {
    if (!campaignFocus.trim() || !targetAudience.trim()) {
      toast.error('Please fill in Campaign Focus and Target Audience first');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-analysis-reports', {
        body: { campaignFocus, targetAudience },
      });

      if (error) {
        throw error;
      }

      const reports: GeneratedReport[] = [
        data.audienceReport,
        data.marketReport,
      ];

      setGeneratedReports(reports);
      
      // Auto-expand both reports
      const expanded: Record<string, boolean> = {};
      reports.forEach(r => { expanded[r.id] = true; });
      setExpandedReports(expanded);

      toast.success('Analysis reports generated successfully!');
    } catch (error) {
      console.error('Error generating reports:', error);
      toast.error('Failed to generate reports. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddReportAsDocument = (report: GeneratedReport) => {
    const newDoc: RepositoryDocument = {
      id: report.id,
      name: `${report.name}.md`,
      type: 'research',
    };
    onAddDocument(newDoc);
    setGeneratedReports(prev => prev.filter(r => r.id !== report.id));
    toast.success(`${report.name} added to repository`);
  };

  const toggleReportExpanded = (id: string) => {
    setExpandedReports(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const hasNoContent = documents.length === 0 && generatedReports.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Campaign Repository
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload documents or generate AI analysis reports for this campaign.
          </p>

          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Click to upload documents</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOC, TXT, or any document file
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Empty State with Auto-Generate Option */}
          {hasNoContent && (
            <div className="bg-accent/30 border border-border rounded-lg p-6 text-center">
              <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary" />
              <h4 className="font-semibold text-foreground mb-2">No documents yet</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Generate AI-powered analysis reports based on your campaign focus and target audience, 
                or upload your own documents above.
              </p>
              <Button
                onClick={handleGenerateReports}
                disabled={isGenerating || !campaignFocus.trim() || !targetAudience.trim()}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Reports...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Analysis Reports
                  </>
                )}
              </Button>
              {(!campaignFocus.trim() || !targetAudience.trim()) && (
                <p className="text-xs text-muted-foreground mt-2">
                  Fill in Campaign Focus and Target Audience to enable report generation
                </p>
              )}
            </div>
          )}

          {/* Generated Reports */}
          {generatedReports.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Generated Reports
              </h4>
              {generatedReports.map((report) => (
                <div
                  key={report.id}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  <div
                    className="flex items-center justify-between p-3 bg-accent/50 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => toggleReportExpanded(report.id)}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{report.name}</span>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        AI Generated
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddReportAsDocument(report);
                        }}
                      >
                        Add to Repository
                      </Button>
                      {expandedReports[report.id] ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  {expandedReports[report.id] && (
                    <div className="p-4 bg-background border-t border-border">
                      <div className="prose prose-sm max-w-none text-foreground">
                        <pre className="whitespace-pre-wrap text-sm font-sans bg-muted/50 p-4 rounded-lg overflow-x-auto">
                          {report.content}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Documents List */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Repository Documents ({documents.length})
              </p>
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-accent/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {getTypeLabel(doc.type)}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveDocument(doc.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generate Reports Button (when documents exist but no generated reports) */}
          {documents.length > 0 && generatedReports.length === 0 && (
            <Button
              variant="outline"
              onClick={handleGenerateReports}
              disabled={isGenerating || !campaignFocus.trim() || !targetAudience.trim()}
              className="w-full gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating Reports...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Additional Analysis Reports
                </>
              )}
            </Button>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
