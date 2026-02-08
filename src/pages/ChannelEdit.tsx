import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Logo } from '@/components/icons/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCampaignsNew, ChannelPost } from '@/hooks/useCampaignsNew';
import { platformIcons, platformColors, platformLabels } from '@/lib/platformIcons';
import { ArrowLeft, Calendar as CalendarIcon, Plus, Trash2, Clock, Image } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import AddPostDialog, { PostFormData } from '@/components/channel/AddPostDialog';
import EditPostDialog from '@/components/channel/EditPostDialog';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const ChannelEdit = () => {
  const { id: campaignId, channelId } = useParams<{ id: string; channelId: string }>();
  const navigate = useNavigate();
  const { useChannelWithPosts, addPost, updatePost, deletePost } = useCampaignsNew();
  const { data: channelData, isLoading } = useChannelWithPosts(channelId);
  
  const [showAddPostDialog, setShowAddPostDialog] = useState(false);
  const [editingPost, setEditingPost] = useState<ChannelPost | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [schedulingPostId, setSchedulingPostId] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState<Date | undefined>();
  const [scheduleEnd, setScheduleEnd] = useState<Date | undefined>();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary/50 flex items-center justify-center">
        <div className="animate-pulse text-primary-foreground">Loading...</div>
      </div>
    );
  }

  if (!channelData) {
    return (
      <div className="min-h-screen bg-primary/50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Channel not found</h2>
          <Button onClick={() => navigate(`/campaign/${campaignId}`)}>Back to Campaign</Button>
        </div>
      </div>
    );
  }

  const channel = channelData;
  const campaign = (channel as any).campaigns;
  const posts: ChannelPost[] = (channel as any).channel_posts || [];

  const resetForm = () => {
    setScheduleStart(undefined);
    setScheduleEnd(undefined);
    setEditingPost(null);
  };

  // New post submission from AddPostDialog
  const handleNewPostSubmit = async (data: PostFormData) => {
    if (!channelId) return;
    
    await addPost.mutateAsync({
      campaign_channel_id: channelId,
      title: data.title,
      text_content: data.text_content,
      image_url: data.image_url,
      video_url: null,
      scheduled_start: data.scheduled_start,
      scheduled_end: data.scheduled_end,
      status: data.scheduled_start ? 'scheduled' : 'draft',
    });
  };

  const handleUpdatePost = async (data: {
    title: string | null;
    text_content: string | null;
    image_url: string | null;
    video_url?: string | null;
  }) => {
    if (!editingPost || !channelId) return;
    
    try {
      await updatePost.mutateAsync({
        id: editingPost.id,
        channelId,
        title: data.title,
        text_content: data.text_content,
        image_url: data.image_url,
      });
      toast.success('Post updated successfully');
      resetForm();
    } catch (error) {
      toast.error('Failed to update post');
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!channelId) return;
    await deletePost.mutateAsync({ id: postId, channelId });
  };

  const handleSchedulePost = async () => {
    if (!schedulingPostId || !channelId) return;
    
    await updatePost.mutateAsync({
      id: schedulingPostId,
      channelId,
      scheduled_start: scheduleStart?.toISOString() || null,
      scheduled_end: scheduleEnd?.toISOString() || null,
      status: scheduleStart ? 'scheduled' : 'draft',
    });
    
    setShowScheduleDialog(false);
    setSchedulingPostId(null);
    setScheduleStart(undefined);
    setScheduleEnd(undefined);
  };

  const openEditPost = (post: ChannelPost) => {
    setEditingPost(post);
    setShowEditDialog(true);
  };

  const openScheduleDialog = (post: ChannelPost) => {
    setSchedulingPostId(post.id);
    setScheduleStart(post.scheduled_start ? new Date(post.scheduled_start) : undefined);
    setScheduleEnd(post.scheduled_end ? new Date(post.scheduled_end) : undefined);
    setShowScheduleDialog(true);
  };

  return (
    <div className="min-h-screen bg-primary/50">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/campaign/${campaignId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-8 md:py-12 max-w-4xl">
        {/* Channel Header with Large Icon */}
        <div className="flex flex-col items-center mb-8">
          <div className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-4 ${platformColors[channel.platform]}`}>
            <div className="w-12 h-12">
              {platformIcons[channel.platform]}
            </div>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            {platformLabels[channel.platform]}
          </h1>
          {campaign && (
            <p className="text-muted-foreground">{campaign.name}</p>
          )}
          
          {/* Schedule Info */}
          <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
            {posts.some(p => p.scheduled_start) && (
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                <span>
                  {posts.filter(p => p.scheduled_start).length} scheduled
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Posts Section */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Posts</h2>
          <Button onClick={() => { resetForm(); setShowAddPostDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Add New
          </Button>
        </div>

        {posts.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No posts yet for this channel</p>
            <Button onClick={() => { resetForm(); setShowAddPostDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Post
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <Card 
                key={post.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openEditPost(post)}
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Image Preview */}
                    {post.image_url ? (
                      <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img 
                          src={post.image_url} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Image className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground mb-1 truncate">
                        {post.title || 'Untitled Post'}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.text_content || 'No content'}
                      </p>
                      
                      {/* Schedule */}
                      {post.scheduled_start && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-primary">
                          <Clock className="w-3 h-3" />
                          <span>{format(new Date(post.scheduled_start), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-start gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openScheduleDialog(post);
                        }}
                      >
                        <CalendarIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePost(post.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add New Post Dialog - with AI generation */}
      <AddPostDialog
        open={showAddPostDialog}
        onOpenChange={setShowAddPostDialog}
        onSubmit={handleNewPostSubmit}
        platform={channel.platform}
        campaignName={campaign?.name}
        isSubmitting={addPost.isPending}
      />

      {/* Edit Post Dialog - with image preview */}
      <EditPostDialog
        open={showEditDialog}
        onOpenChange={(open) => { if (!open) resetForm(); setShowEditDialog(open); }}
        post={editingPost}
        onSave={handleUpdatePost}
        isSaving={updatePost.isPending}
      />

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Start Date & Time</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !scheduleStart && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleStart ? format(scheduleStart, 'MMM d, yyyy h:mm a') : 'Select start'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleStart}
                    onSelect={setScheduleStart}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>End Date & Time</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !scheduleEnd && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduleEnd ? format(scheduleEnd, 'MMM d, yyyy h:mm a') : 'Select end'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduleEnd}
                    onSelect={setScheduleEnd}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSchedulePost} disabled={updatePost.isPending}>
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChannelEdit;
