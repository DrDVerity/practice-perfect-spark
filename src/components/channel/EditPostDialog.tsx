import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { Loader2, Image as ImageIcon, Pencil, RefreshCw, Check, Trash2, Copy, X, Video, Calendar as CalendarIcon, Clock, Upload, Sparkles, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ImageWithRegenerate from './ImageWithRegenerate';
import { useKnowledgeBase } from '@/hooks/useKnowledgeBase';

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
  const [voiceoverScript, setVoiceoverScript] = useState('');
  const [videoDirection, setVideoDirection] = useState('');
  const [imageAccepted, setImageAccepted] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showModifyDialog, setShowModifyDialog] = useState(false);
  const [modifyPrompt, setModifyPrompt] = useState('');
  const [isModifyingImage, setIsModifyingImage] = useState(false);

  const handleModifyImage = async () => {
    if (!modifyPrompt.trim() || !imageUrl) return;
    setIsModifyingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('edit-image', {
        body: { imageUrl, prompt: modifyPrompt },
      });
      if (error) throw error;
      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
        setImageAccepted(false);
        setImageChanged(true);
        toast.success('Image modified!');
        setShowModifyDialog(false);
        setModifyPrompt('');
      } else {
        throw new Error(data?.error || 'No image returned');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to modify image');
    } finally {
      setIsModifyingImage(false);
    }
  };

  useEffect(() => {
    if (post) {
      setTitle(post.title || '');
      setContent(post.text_content || '');
      setImageUrl(post.image_url || '');
      setVideoUrl(post.video_url || '');
      setVoiceoverScript((post as any).voiceover_script || '');
      setImageAccepted(false);
    }
  }, [post]);

  // Poll for video completion when generation is running in the background
  useEffect(() => {
    if (!isGeneratingVideo || !post?.id) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('channel_posts')
        .select('video_url, video_status, voiceover_script')
        .eq('id', post.id)
        .maybeSingle();
      if (!data) return;
      if (data.voiceover_script && !voiceoverScript) setVoiceoverScript(data.voiceover_script);
      if (data.video_status === 'ready' && data.video_url) {
        setVideoUrl(data.video_url);
        setIsGeneratingVideo(false);
        toast.success('Video ready!');
      } else if (data.video_status === 'failed') {
        setIsGeneratingVideo(false);
        toast.error('Video generation failed. Please try again.');
      } else if (data.video_status === 'billing') {
        setIsGeneratingVideo(false);
        toast.error('Fal.ai balance exhausted. Top up at fal.ai/dashboard/billing.', { duration: 8000 });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [isGeneratingVideo, post?.id, voiceoverScript]);

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
    const isShorts = (platform || '').toLowerCase().includes('shorts');
    const tId = toast.loading('Starting video generation — voiceover + visuals (1–5 min)...');
    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          platform,
          targetAudience: '',
          postFocus: title || content?.substring(0, 200) || '',
          campaignName,
          practiceName,
          postId: post?.id,
          aspectRatio: isShorts ? '9:16' : '16:9',
          userDirection: videoDirection || undefined,
          previousScript: voiceoverScript || undefined,
          previousVideoUrl: videoUrl || undefined,
        },
      });
      if (error) {
        let msg = error.message || 'Failed to generate video';
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) msg = body.error;
          } else if (ctx && typeof ctx.text === 'function') {
            const txt = await ctx.text();
            try { const parsed = JSON.parse(txt); if (parsed?.error) msg = parsed.error; } catch {}
          }
        } catch {}
        toast.error(msg, { id: tId, duration: 8000 });
        setIsGeneratingVideo(false);
        return;
      }
      if (data?.success === false) {
        toast.error(data.error || 'Video generation is unavailable right now', { id: tId, duration: 8000 });
        setIsGeneratingVideo(false);
        return;
      }
      if (data?.voiceoverScript) setVoiceoverScript(data.voiceoverScript);
      if (data?.videoUrl) {
        setVideoUrl(data.videoUrl);
        setIsGeneratingVideo(false);
        toast.success('Video generated!', { id: tId });
      } else if (data?.status === 'processing') {
        toast.success('Voiceover script ready. Video is rendering in the background…', { id: tId, duration: 6000 });
        // polling effect will flip isGeneratingVideo off when ready
      } else {
        toast.error(data?.error || 'No video URL returned', { id: tId, duration: 8000 });
        setIsGeneratingVideo(false);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to generate video', { id: tId, duration: 8000 });
      setIsGeneratingVideo(false);
    }
  };

  const [imageChanged, setImageChanged] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [kbPickerOpen, setKbPickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { documents: kbDocs } = useKnowledgeBase();
  const kbImages = (kbDocs || []).filter((d: any) => {
    const meta = d.metadata as any;
    return meta?.file_kind === 'image' && meta?.file_url;
  });
  const isVideoPlatform = ['youtube', 'youtube_shorts', 'tiktok'].includes((platform || '').toLowerCase());

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

  const videoSection = (
    <div className={`space-y-3 rounded-lg border p-3 ${isVideoPlatform ? 'border-primary/40 bg-primary/5' : 'border-border bg-background'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor="edit-videoUrl" className="flex items-center gap-1.5">
            <Video className="h-4 w-4" /> Video {videoUrl ? '' : '(optional)'}
          </Label>
          {isVideoPlatform && (
            <p className="text-xs text-muted-foreground">
              YouTube posts use this video file. Generate one, upload one, or paste a video URL.
            </p>
          )}
        </div>
        <Button
          variant={isVideoPlatform && !videoUrl ? 'default' : 'outline'}
          size="sm"
          onClick={handleGenerateVideo}
          disabled={isGeneratingVideo}
          className="gap-1.5 shrink-0"
        >
          {isGeneratingVideo ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating (1–5 min)...
            </>
          ) : (
            <>
              <Video className="w-3.5 h-3.5" />
              {videoUrl ? 'Regenerate Video' : 'Generate Video'}
            </>
          )}
        </Button>
      </div>
      {isGeneratingVideo && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary">
          <div className="flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 animate-spin" /> Generating video
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-primary/20">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}
      {videoUrl ? (
        <div className="rounded-lg overflow-hidden border border-border bg-foreground">
          <video
            key={videoUrl}
            src={videoUrl}
            controls
            playsInline
            className="w-full max-h-72 bg-foreground"
          />
        </div>
      ) : isVideoPlatform ? (
        <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-background/60 p-4 text-center">
          <Video className="mb-2 h-8 w-8 text-primary" />
          <p className="text-sm font-medium text-foreground">No video attached yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Use Generate Video or upload a video in the media area below.</p>
        </div>
      ) : null}
      <Input
        id="edit-videoUrl"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="https://... (paste a video URL or generate one)"
      />
      {(voiceoverScript || isGeneratingVideo) && (
        <div className="space-y-1.5">
          <Label htmlFor="edit-voiceover" className="text-xs">
            Voiceover script (~30s, ends with CTA)
          </Label>
          <Textarea
            id="edit-voiceover"
            value={voiceoverScript}
            onChange={(e) => setVoiceoverScript(e.target.value)}
            placeholder="Voiceover script will appear here after generation…"
            rows={5}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Record this script as the voiceover for the generated clip. It ends with a call-to-action pointing to your landing-page link.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
            {isVideoPlatform && (
              <DialogDescription>
                This YouTube post can include a generated or uploaded video.
              </DialogDescription>
            )}
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

            {isVideoPlatform && videoSection}

            {/* Image Section with Edit/Regenerate/Accept + drop area + AI generate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Image</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && uploadFiles(e.target.files)}
                  />
                  <Popover open={kbPickerOpen} onOpenChange={setKbPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isGeneratingImage || isUploading}
                        className="gap-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Add Image
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-80 p-3">
                      <div className="space-y-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => {
                            setKbPickerOpen(false);
                            fileInputRef.current?.click();
                          }}
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload from device
                        </Button>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5" /> From Knowledge Base
                          </p>
                          {kbImages.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-3 text-center">
                              No images in Knowledge Base yet. Upload images via the KB page.
                            </p>
                          ) : (
                            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                              {kbImages.map((doc: any) => {
                                const url = (doc.metadata as any)?.file_url as string;
                                return (
                                  <button
                                    type="button"
                                    key={doc.id}
                                    onClick={() => {
                                      setImageUrl(url);
                                      setImageAccepted(false);
                                      setImageChanged(true);
                                      setKbPickerOpen(false);
                                      toast.success('Image added from Knowledge Base');
                                    }}
                                    className="aspect-square rounded border border-border overflow-hidden hover:ring-2 hover:ring-primary transition"
                                    title={doc.title}
                                  >
                                    <img src={url} alt={doc.title} className="w-full h-full object-cover" />
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
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
                          variant="outline"
                          size="sm"
                          onClick={() => setShowModifyDialog(true)}
                          className="gap-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Modify Current Image
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

            {!isVideoPlatform && videoSection}

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

      {/* Modify Current Image Dialog */}
      <Dialog open={showModifyDialog} onOpenChange={(o) => { if (!isModifyingImage) setShowModifyDialog(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modify Current Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {imageUrl && (
              <div className="rounded-lg overflow-hidden bg-muted max-h-48">
                <img src={imageUrl} alt="Current" className="w-full h-auto object-contain max-h-48" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="modify-prompt">How should this image be modified?</Label>
              <Textarea
                id="modify-prompt"
                value={modifyPrompt}
                onChange={(e) => setModifyPrompt(e.target.value)}
                placeholder="e.g. change the dentist's hair to grey"
                rows={3}
                disabled={isModifyingImage}
              />
              <p className="text-xs text-muted-foreground">
                The AI will modify the current image based on your prompt while keeping the rest intact.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowModifyDialog(false)} disabled={isModifyingImage}>
                Cancel
              </Button>
              <Button onClick={handleModifyImage} disabled={isModifyingImage || !modifyPrompt.trim()} className="gap-1.5">
                {isModifyingImage ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Modifying...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Modify Image</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditPostDialog;
