import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface CreateClientDialogProps {
  open: boolean;
  onClose: () => void;
}

const CreateClientDialog = ({ open, onClose }: CreateClientDialogProps) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    practice_name: '',
    email: '',
    website_url: '',
    target_audience: '',
    campaign_focus: '',
  });

  const handleCreate = async () => {
    if (!form.practice_name.trim()) {
      toast.error('Practice name is required');
      return;
    }

    setSaving(true);

    // Create a placeholder profile. Since we can't create auth users from the client,
    // we generate a UUID as a placeholder user_id for admin-managed accounts.
    const placeholderUserId = crypto.randomUUID();

    const { error } = await supabase.from('profiles').insert({
      user_id: placeholderUserId,
      practice_name: form.practice_name || null,
      email: form.email || null,
      website_url: form.website_url || null,
      target_audience: form.target_audience || null,
      campaign_focus: form.campaign_focus || null,
    });

    setSaving(false);

    if (error) {
      toast.error('Failed to create account', { description: error.message });
    } else {
      toast.success('Client account created');
      queryClient.invalidateQueries({ queryKey: ['admin-profiles'] });
      setForm({ practice_name: '', email: '', website_url: '', target_audience: '', campaign_focus: '' });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Client Account</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="new_practice_name">Practice Name *</Label>
            <Input
              id="new_practice_name"
              value={form.practice_name}
              onChange={(e) => setForm(prev => ({ ...prev, practice_name: e.target.value }))}
              placeholder="e.g. Bright Smiles Dental"
            />
          </div>
          <div>
            <Label htmlFor="new_email">Email</Label>
            <Input
              id="new_email"
              type="email"
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="client@example.com"
            />
          </div>
          <div>
            <Label htmlFor="new_website_url">Website URL</Label>
            <Input
              id="new_website_url"
              value={form.website_url}
              onChange={(e) => setForm(prev => ({ ...prev, website_url: e.target.value }))}
              placeholder="https://example.com"
            />
          </div>
          <div>
            <Label htmlFor="new_target_audience">Target Audience</Label>
            <Textarea
              id="new_target_audience"
              value={form.target_audience}
              onChange={(e) => setForm(prev => ({ ...prev, target_audience: e.target.value }))}
              rows={2}
              placeholder="Families, young professionals, etc."
            />
          </div>
          <div>
            <Label htmlFor="new_campaign_focus">Campaign Focus</Label>
            <Textarea
              id="new_campaign_focus"
              value={form.campaign_focus}
              onChange={(e) => setForm(prev => ({ ...prev, campaign_focus: e.target.value }))}
              rows={2}
              placeholder="Invisalign, teeth whitening, etc."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {saving ? 'Creating...' : 'Create Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClientDialog;
