import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react';
import { ChevronDown } from 'lucide-react';

export interface CustomAddonData {
  key: string;
  label: string;
  icon: string;
  description: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (addon: CustomAddonData) => void;
}

const AddCustomAddonDialog: React.FC<Props> = ({ open, onOpenChange, onAdd }) => {
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('📦');
  const [description, setDescription] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);

  const handleSubmit = () => {
    if (!label.trim()) {
      toast.error('Please enter a name for the add-on');
      return;
    }
    const key = `custom_${label.trim().toLowerCase().replace(/\s+/g, '_')}`;
    onAdd({ key, label: label.trim(), icon: icon || '📦', description: description.trim() || `Custom marketing channel: ${label.trim()}` });
    setLabel('');
    setIcon('📦');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Campaign Vector</DialogTitle>
          <DialogDescription>
            Create a new marketing channel or strategy to include in campaigns.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Podcast Sponsorship" />
          </div>
          <div className="space-y-2">
            <Label>Icon (emoji)</Label>
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="gap-2 text-xl h-12 px-3">
                  <span>{icon}</span>
                  <ChevronDown className="h-4 w-4 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-auto border-none" align="start">
                <EmojiPicker
                  emojiStyle={EmojiStyle.NATIVE}
                  theme={Theme.AUTO}
                  onEmojiClick={(e) => { setIcon(e.emoji); setEmojiOpen(false); }}
                  width={320}
                  height={400}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this marketing channel..." rows={3} />
          </div>
          <Button onClick={handleSubmit} className="w-full">Add to Campaign Add-Ons</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddCustomAddonDialog;
