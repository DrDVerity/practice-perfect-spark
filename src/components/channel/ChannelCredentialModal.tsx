import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

export interface ChannelCredentials {
  platformName: string;
  platformUrl: string;
  username: string;
  password: string;
}

export interface CredentialEditData {
  id: string;
  platform_name: string;
  platform_url: string | null;
  username: string | null;
  password: string | null;
}

interface ChannelCredentialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (credentials: ChannelCredentials) => void;
  onDelete?: (id: string) => void;
  editData?: CredentialEditData | null;
  defaultPlatformName?: string;
}

const ChannelCredentialModal: React.FC<ChannelCredentialModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  editData,
  defaultPlatformName,
}) => {
  const [platformName, setPlatformName] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const isEditing = !!editData;

  useEffect(() => {
    if (editData) {
      setPlatformName(editData.platform_name);
      setPlatformUrl(editData.platform_url || '');
      setUsername(editData.username || '');
      setPassword(editData.password || '');
    } else {
      resetForm();
      if (defaultPlatformName) setPlatformName(defaultPlatformName);
    }
  }, [editData, open, defaultPlatformName]);

  const resetForm = () => {
    setPlatformName('');
    setPlatformUrl('');
    setUsername('');
    setPassword('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleSubmit = () => {
    if (!platformName.trim()) {
      toast.error('Platform name is required');
      return;
    }

    onSubmit({
      platformName: platformName.trim(),
      platformUrl: platformUrl.trim(),
      username: username.trim(),
      password,
    });

    handleClose();
  };

  const handleDelete = () => {
    if (editData && onDelete) {
      onDelete(editData.id);
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Channel Credentials' : 'Add New Channel'}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platformName" className="text-sm font-medium">
              Platform Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="platformName"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="e.g., TikTok, Pinterest, Custom CRM..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="platformUrl" className="text-sm font-medium">
              Platform URL
            </Label>
            <Input
              id="platformUrl"
              type="url"
              value={platformUrl}
              onChange={(e) => setPlatformUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channelUsername" className="text-sm font-medium">
              Username
            </Label>
            <Input
              id="channelUsername"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username or account ID"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channelPassword" className="text-sm font-medium">
              Password
            </Label>
            <Input
              id="channelPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password or API key"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          {isEditing && onDelete && (
            <Button variant="destructive" size="icon" onClick={handleDelete} className="mr-auto">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            {isEditing ? 'Save Changes' : 'Add Channel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelCredentialModal;
