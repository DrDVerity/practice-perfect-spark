import React, { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RepositoryDocument } from '@/types/campaign';
import { FolderOpen, Upload, Trash2, FileText } from 'lucide-react';

interface RepositoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documents: RepositoryDocument[];
  onAddDocument: (doc: RepositoryDocument) => void;
  onRemoveDocument: (id: string) => void;
}

export const RepositoryModal: React.FC<RepositoryModalProps> = ({
  open,
  onOpenChange,
  documents,
  onAddDocument,
  onRemoveDocument,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-primary" />
            Campaign Repository
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload documents specific to this campaign (research, product info, target group insights, etc.)
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

          {/* Documents List */}
          {documents.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Uploaded Documents ({documents.length})
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
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No documents uploaded yet</p>
              <p className="text-xs">Upload files to help the AI understand your campaign</p>
            </div>
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
