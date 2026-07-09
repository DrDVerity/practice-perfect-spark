/**
 * ChannelCredentialModal
 *
 * Social platforms (facebook, instagram, linkedin, twitter, youtube, tiktok):
 *   → Shows "Connect via Bundle.social" button that opens the OAuth link in a new tab.
 *     No username/password stored — OAuth tokens live inside Bundle.social.
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
import { Trash2, ExternalLink, Loader2, CheckCircle2, Plus } from 'lucide-react';
import { useBundleSocial } from '@/hooks/useBundleSocial';
import { platformIcons, platformColors, platformLabels } from '@/lib/platformIcons';

// Platforms managed via Bundle.social OAuth — no manual credentials needed
const BUNDLE_SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'youtube',
  'tiktok',
] as const;
const BUNDLE_SOCIAL_SET = new Set<string>(BUNDLE_SOCIAL_PLATFORMS);

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
  startCustom?: boolean;
}

const ChannelCredentialModal: React.FC<ChannelCredentialModalProps> = ({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  editData,
  defaultPlatformName,
  startCustom = false,
}) => {
  const [platformName, setPlatformName] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [linkOpened, setLinkOpened] = useState(false);
  const [connectUrl, setConnectUrl] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const { getConnectLink } = useBundleSocial();

  const isEditing = !!editData;
  const normalizedPlatform = (editData?.platform_name || platformName).toLowerCase().trim();
  const isBundleSocialPlatform = BUNDLE_SOCIAL_SET.has(normalizedPlatform);
  // Show the Bundle.social picker when adding fresh and no platform pre-selected
  const showPicker = !isEditing && !defaultPlatformName && !platformName && !showCustom;

  useEffect(() => {
    setLinkOpened(false);
    setConnectUrl(null);
    setPopupBlocked(false);
    if (editData) {
      setPlatformName(editData.platform_name);
      setPlatformUrl(editData.platform_url || '');
      setUsername(editData.username || '');
      setPassword(editData.password || '');
      setShowCustom(false);
    } else {
      resetForm();
      if (defaultPlatformName) setPlatformName(defaultPlatformName);
      setShowCustom(startCustom);
    }
  }, [editData, open, defaultPlatformName, startCustom]);


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

  const handleConnectViaBundleSocial = async () => {
    try {
      const result = await getConnectLink.mutateAsync({ platform: normalizedPlatform });
      setConnectUrl(result.url);
      const win = window.open(result.url, '_blank', 'noopener,noreferrer');
      if (!win) {
        setPopupBlocked(true);
      } else {
        setLinkOpened(true);
        setPopupBlocked(false);
      }
    } catch {
      // error already toasted by the hook
    }
  };

  const handleCopyLink = async () => {
    if (!connectUrl) return;
    try {
      await navigator.clipboard.writeText(connectUrl);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Copy failed — select and copy the link manually');
    }
  };

  const renderOAuthPanel = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect your{' '}
        <span className="font-medium capitalize text-foreground">{normalizedPlatform}</span>{' '}
        account securely through Bundle.social. The connection opens in a separate browser tab where
        you can complete the provider login — no passwords are stored in Archer.
      </p>

      {linkOpened && (
        <div className="flex items-start gap-3 rounded-lg bg-green-500/10 border border-green-500/20 p-4">
          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Connection page opened</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Complete the login in the opened tab, then return here and close this dialog.
            </p>
          </div>
        </div>
      )}

      <Button
        className="w-full"
        onClick={handleConnectViaBundleSocial}
        disabled={getConnectLink.isPending}
      >
        {getConnectLink.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <ExternalLink className="w-4 h-4 mr-2" />
        )}
        {linkOpened ? 'Re-open Connection Page' : `Connect ${normalizedPlatform.charAt(0).toUpperCase() + normalizedPlatform.slice(1)} via Bundle.social`}
      </Button>

      {connectUrl && (popupBlocked || linkOpened) && (
        <div className="space-y-2 rounded-lg border border-border p-3 bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {popupBlocked
              ? "Your browser blocked the popup. Copy the link below and open it in a new browser tab to complete the connection."
              : "If the connection page didn't open, use this link in a new browser tab:"}
          </p>
          <div className="flex gap-2">
            <Input readOnly value={connectUrl} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" size="sm" onClick={handleCopyLink}>
              Copy
            </Button>
          </div>
          <a
            href={connectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4"
          >
            <ExternalLink className="w-3 h-3" />
            Open in new tab
          </a>
        </div>
      )}
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

  const renderPicker = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect a social account securely through Bundle.social — no passwords stored in Archer.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {BUNDLE_SOCIAL_PLATFORMS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatformName(p)}
            className="p-3 rounded-xl border border-border hover:bg-accent/50 transition-colors flex items-center gap-3 text-left"
          >
            <div className={`w-8 h-8 rounded-full ${platformColors[p]} flex items-center justify-center p-1.5`}>
              {platformIcons[p]}
            </div>
            <span className="text-sm font-medium">{platformLabels[p]}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setShowCustom(true)}
        className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-4 pt-1"
      >
        Add a custom channel (manual credentials) instead
      </button>
    </div>
  );

  const renderBody = () => {
    if (showPicker) return renderPicker();
    if (isBundleSocialPlatform) return renderOAuthPanel();
    return renderManualForm();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? `Edit ${editData?.platform_name} Channel`
              : isBundleSocialPlatform && normalizedPlatform
              ? `Connect ${normalizedPlatform.charAt(0).toUpperCase() + normalizedPlatform.slice(1)}`
              : showPicker
              ? 'Connect a Channel'
              : 'Add Custom Channel'}
          </DialogTitle>
        </DialogHeader>

        {renderBody()}

        <DialogFooter className="gap-2">
          {isEditing && onDelete && (
            <Button variant="destructive" size="icon" onClick={handleDelete} className="mr-auto">
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {linkOpened ? 'Done' : 'Cancel'}
          </Button>
          {!isBundleSocialPlatform && !showPicker && (
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
