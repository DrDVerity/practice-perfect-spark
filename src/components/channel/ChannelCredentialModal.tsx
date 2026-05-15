/**
 * ChannelCredentialModal
 *
 * Social platforms (facebook, instagram, linkedin, twitter, youtube, tiktok):
 *   → Shows "Connect via Ayrshare" button that opens the OAuth link in a new tab.
 *     No username/password stored — OAuth tokens live inside Ayrshare.
 *
 * All other platforms (mailchimp, beehive, custom CRMs, etc.):
 *   → Shows the original manual credential form (platform URL + username + password).
 */

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
import { Trash2, ExternalLink, Loader2, CheckCircle2 } from 'lucide-react';
import { useAyrshare } from '@/hooks/useAyrshare';

// Platforms managed via Ayrshare OAuth — no manual credentials needed
const AYRSHARE_PLATFORMS = new Set([
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'youtube',
  'tiktok',
]);

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
  const [linkOpened, setLinkOpened] = useState(false);

  const { getSocialLink } = useAyrshare();

  const isEditing = !!editData;
  const normalizedPlatform = (editData?.platform_name || platformName).toLowerCase().trim();
  const isAyrsharePlatform = AYRSHARE_PLATFORMS.has(normalizedPlatform);

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
    setLinkOpened(false);
  }, [editData, open, defaultPlatformName]);

  const resetForm = () => {
    setPlatformName('');
    setPlatformUrl('');
    setUsername('');
    setPassword('');
  };

  const handleClose = () => {
    resetForm();
    setLinkOpened(false);
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

  const handleConnectViaAyrshare = async () => {
    try {
      const result = await getSocialLink.mutateAsync();
      window.open(result.url, '_blank', 'noopener,noreferrer');
      setLinkOpened(true);
    } catch {
      // error already toasted by the hook
    }
  };

  const renderOAuthPanel = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect your{' '}
        <span className="font-medium capitalize text-foreground">{normalizedPlatform}</span>{' '}
        account securely through Ayrshare. You'll be taken to a hosted page where you can
        authorise access — no passwords are stored in Archer.
      </p>

      {linkOpened && (
        <div className="flex items-start gap-3 rounded-lg bg-green-500/10 border border-green-500/20 p-4">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Connection page opened</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete the connection in the new tab, then close this dialog.
            </p>
          </div>
        </div>
      )}

      <Button
        className="w-full"
        onClick={handleConnectViaAyrshare}
        disabled={getSocialLink.isPending}
      >
        {getSocialLink.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <ExternalLink className="w-4 h-4 mr-2" />
        )}
        {linkOpened ? 'Re-open Connection Page' : `Connect ${normalizedPlatform.charAt(0).toUpperCase() + normalizedPlatform.slice(1)} via Ayrshare`}
      </Button>
    </div>
  );

  const renderManualForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="platformName" className="text-sm font-medium">
          Platform Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="platformName"
          value={platformName}
          onChange={(e) => setPlatformName(e.target.value)}
          placeholder="e.g., MailChimp, Beehiiv, Custom CRM..."
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
          Username / Account ID
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
          Password / API Key
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
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? `Edit ${editData?.platform_name} Channel`
              : isAyrsharePlatform && normalizedPlatform
              ? `Connect ${normalizedPlatform.charAt(0).toUpperCase() + normalizedPlatform.slice(1)}`
              : 'Add New Channel'}
          </DialogTitle>
        </DialogHeader>

        {isAyrsharePlatform ? renderOAuthPanel() : renderManualForm()}

        <DialogFooter className="gap-2">
          {isEditing && onDelete && (
            <Button variant="destructive" size="icon" onClick={handleDelete} className="mr-auto">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {linkOpened ? 'Done' : 'Cancel'}
          </Button>
          {!isAyrsharePlatform && (
            <Button onClick={handleSubmit}>
              {isEditing ? 'Save Changes' : 'Add Channel'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChannelCredentialModal;
