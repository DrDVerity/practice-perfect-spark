import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, Image as ImageIcon, Pencil, RefreshCw, Check, Trash2, Copy, X, Video, Calendar as CalendarIcon, Clock, Upload, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ImageWithRegenerate from './ImageWithRegenerate';

interface EditPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: {
    id: string;
    title: string | null;
    text_content: string | null;
    image_url: string | null;
    video_url?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    status?: string;
  } | null;
  onSave: (data: {
    title: string | null;
    text_content: string | null;
    image_url: string | null;
    video_url?: string | null;
  }) => Promise<void>;
  onDelete?: (postId: string) => Promise<void>;
  onDuplicate?: (post: {
    title: string | null;
    text_content: string | null;
    image_url: string | null;
    video_url?: string | null;
  }) => Promise<void>;
  isSaving?: boolean;
  isAdmin?: boolean;
  platform?: string;
  campaignName?: string;
  practiceName?: string;
}

const EditPostDialog: React.FC<EditPostDialogProps> = ({
  open,
  onOpenChange,
  post,
  onSave,
  onDelete,
  onDuplicate,
  isSaving = false,
  isAdmin = false,
  platform = '',
  campaignName,
  practiceName,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageAccepted, setImageAccepted] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (post) {
      setTitle(post.title || '');
      setContent(post.text_content || '');
      setImageUrl(post.image_url || '');
      setVideoUrl(post.video_url || '');
      setImageAccepted(false);
    }
  }, [post]);

  const handleSave = async () => {
    await onSave({
      title: title || null,
      text_content: content || null,
      image_url: imageUrl || null,
      video_url: videoUrl || null,
    });
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!post || !onDelete) return;
    await onDelete(post.id);
    setShowDeleteConfirm(false);
    onOpenChange(false);
  };

  const handleDuplicate = async () => {
    if (!onDuplicate) return;
    await onDuplicate({
      title: title ? `${title} (Copy)` : null,
      text_content: content || null,
      image_url: imageUrl || null,
      video_url: videoUrl || null,
    });
    onOpenChange(false);
  };

  const handleGenerateVideo = async () => {
    if (!content && !title) {
      toast.error('Post needs content to generate a video');
      return;
    }
    setIsGeneratingVideo(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          platform,
          targetAudience: '',
          postFocus: title || content?.substring(0, 100) || '',
          campaignName,
          practiceName,
        },
      });
      if (error) throw error;
      if (data?.videoUrl) {
        setVideoUrl(data.videoUrl);
        toast.success('Video generated!');
      } else if (data?.script) {
        toast.success('Video concept generated!');
      }
    } catch (error) {
      toast.error('Failed to generate video');
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const [imageChanged, setImageChanged] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleImageRegenerated = (newUrl: string) => {
    setImageUrl(newUrl);
    setImageAccepted(false);
    setImageChanged(true);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of fileArr) {
        const ext = file.name.split('.').pop() || 'bin';
        const path = `${post?.id || 'new'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from('post-media').upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });
        if (error) throw error;
        const { data } = supabase.storage.from('post-media').getPublicUrl(path);
        const url = data.publicUrl;
        if (file.type.startsWith('video/')) {
          setVideoUrl(url);
        } else {
          setImageUrl(url);
          setImageAccepted(false);
          setImageChanged(true);
        }
      }
      toast.success('File uploaded');
    } catch (e: any) {
      toast.error(e.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const handleGenerateImage = async () => {
    if (!title && !content) {
      toast.error('Add a title or content first');
      return;
    }
    setIsGeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-post-image', {
        body: {
          postId: post?.id,
          title,
          content,
          platform,
          campaignName,
          practiceName,
        },
      });
      if (error) throw error;
      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
        setImageAccepted(false);
        setImageChanged(true);
        toast.success('Image generated!');
      } else {
        throw new Error('No image returned');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  if (!post) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title (optional)</Label>
              <Input
                id="edit-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title"
              />
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="edit-content">Content</Label>
              <Textarea
                id="edit-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your post content..."
                rows={4}
              />
            </div>

            {/* Image Section with Edit/Regenerate/Accept + drop area + AI generate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Image</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage || isUploading}
                  className="gap-1.5"
                >
                  {isGeneratingImage ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Generate Image</>
                  )}
                </Button>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative rounded-lg border-2 border-dashed transition-colors ${
                  isDragging ? 'border-primary bg-primary/10' : 'border-border bg-muted/40'
                }`}
              >
                {imageUrl ? (
                  <div className="space-y-3">
                    {imageChanged && !imageAccepted && (
                      <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/30 text-sm text-primary">
                        <RefreshCw className="w-4 h-4" />
                        New image — click <strong>Accept</strong> to keep, or <strong>Save Changes</strong>.
                      </div>
                    )}
                    <div className="relative">
                      <ImageWithRegenerate
                        imageUrl={imageUrl}
                        platform={platform}
                        postFocus={title || content?.substring(0, 80) || ''}
                        targetAudience=""
                        campaignName={campaignName}
                        practiceName={practiceName}
                        onImageRegenerated={handleImageRegenerated}
                        className="max-h-64"
                      />
                      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-2 p-2 bg-background/90 backdrop-blur-sm border-t border-border rounded-b-lg">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newUrl = prompt('Enter new image URL:', imageUrl);
                            if (newUrl !== null) {
                              setImageUrl(newUrl);
                              setImageAccepted(false);
                              setImageChanged(true);
                            }
                          }}
                          className="gap-1.5"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit URL
                        </Button>
                        <Button
                          variant={imageAccepted ? 'secondary' : 'default'}
                          size="sm"
                          onClick={() => {
                            setImageAccepted(true);
                            setImageChanged(false);
                            toast.success('Image accepted!');
                          }}
                          className="gap-1.5"
                          disabled={imageAccepted}
                        >
                          <Check className="w-3.5 h-3.5" />
                          {imageAccepted ? 'Accepted ✓' : 'Accept Image'}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-40 cursor-pointer text-center p-4">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    )}
                    <p className="text-sm font-medium text-foreground">
                      {isUploading ? 'Uploading...' : 'Drop image or video here'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      or click to browse — or use Generate Image above
                    </p>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                    />
                  </label>
                )}
              </div>

              {!imageUrl && (
                <Input
                  id="edit-imageUrl"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="...or paste an image URL"
                />
              )}
            </div>

            {/* Video URL + Generate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-videoUrl">Video URL (optional)</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateVideo}
                  disabled={isGeneratingVideo}
                  className="gap-1.5"
                >
                  {isGeneratingVideo ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Video className="w-3.5 h-3.5" />
                      Generate Video
                    </>
                  )}
                </Button>
              </div>
              <Input
                id="edit-videoUrl"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* Schedule Display */}
            {(post.scheduled_start || post.scheduled_end) && (
              <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Posting Schedule
                </Label>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {post.scheduled_start && (
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>Start: {format(new Date(post.scheduled_start), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  )}
                  {post.scheduled_end && (
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>End: {format(new Date(post.scheduled_end), 'MMM d, yyyy h:mm a')}</span>
                    </div>
                  )}
                </div>
                {post.status && (
                  <p className="text-xs text-primary capitalize">Status: {post.status}</p>
                )}
              </div>
            )}
          </div>

          {/* Bottom Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
            <div className="flex gap-2">
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              )}
              {onDuplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicate}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Duplicate
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditPostDialog;
