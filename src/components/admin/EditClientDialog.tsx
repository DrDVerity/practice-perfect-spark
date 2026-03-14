import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2, Save, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface ClientProfile {
  user_id: string;
  practice_name: string | null;
  email: string | null;
  website_url: string | null;
  brand_dna_url: string | null;
  target_audience: string | null;
  campaign_focus: string | null;
}

interface EditClientDialogProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  onDeleted?: () => void;
}

const EditClientDialog = ({ open, onClose, clientId, onDeleted }: EditClientDialogProps) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState<ClientProfile | null>(null);

  useEffect(() => {
    if (open && clientId) {
      setLoading(true);
      supabase
        .from('profiles')
        .select('user_id, practice_name, email, website_url, brand_dna_url, target_audience, campaign_focus')
        .eq('user_id', clientId)
        .single()
        .then(({ data, error }) => {
          if (error) {
            toast.error('Failed to load client profile');
          } else {
            setForm(data as ClientProfile);
          }
          setLoading(false);
        });
    }
  }, [open, clientId]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        practice_name: form.practice_name,
        email: form.email,
        website_url: form.website_url,
        brand_dna_url: form.brand_dna_url,
        target_audience: form.target_audience,
        campaign_focus: form.campaign_focus,
      })
      .eq('user_id', clientId);

    setSaving(false);
    if (error) {
      toast.error('Failed to save changes', { description: error.message });
    } else {
      toast.success('Client profile updated');
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['client-profile', clientId] });
      onClose();
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    // Delete campaigns, then profile. The user auth record remains but data is cleared.
    const { error: campError } = await supabase
      .from('campaigns')
      .delete()
      .eq('user_id', clientId);

    if (campError) {
      toast.error('Failed to delete campaigns', { description: campError.message });
      setDeleting(false);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', clientId);

    setDeleting(false);
    if (profileError) {
      toast.error('Failed to delete account', { description: profileError.message });
    } else {
      toast.success('Account deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-campaigns'] });
      onClose();
      onDeleted?.();
    }
  };

  const updateField = (field: keyof ClientProfile, value: string) => {
    setForm(prev => prev ? { ...prev, [field]: value || null } : prev);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Client Account</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : form ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="practice_name">Practice Name</Label>
              <Input
                id="practice_name"
                value={form.practice_name || ''}
                onChange={(e) => updateField('practice_name', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={form.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="website_url">Website URL</Label>
              <Input
                id="website_url"
                value={form.website_url || ''}
                onChange={(e) => updateField('website_url', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="brand_dna_url">Brand DNA URL</Label>
              <Input
                id="brand_dna_url"
                value={form.brand_dna_url || ''}
                onChange={(e) => updateField('brand_dna_url', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="target_audience">Target Audience</Label>
              <Textarea
                id="target_audience"
                value={form.target_audience || ''}
                onChange={(e) => updateField('target_audience', e.target.value)}
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="campaign_focus">Campaign Focus</Label>
              <Textarea
                id="campaign_focus"
                value={form.campaign_focus || ''}
                onChange={(e) => updateField('campaign_focus', e.target.value)}
                rows={2}
              />
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">Profile not found.</p>
        )}

        <DialogFooter className="flex gap-2 sm:gap-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting || !form}>
                <Trash2 className="w-4 h-4 mr-2" />
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this client's profile and all their campaigns. This action cannot be undone.
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

          <Button onClick={handleSave} disabled={saving || !form}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditClientDialog;
