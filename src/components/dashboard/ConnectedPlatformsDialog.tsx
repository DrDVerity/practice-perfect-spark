import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useChannelCredentials } from '@/hooks/useChannelCredentials';
import PlatformCredentialCards from '@/components/channel/PlatformCredentialCards';
import ChannelCredentialModal, {
  CredentialEditData,
  ChannelCredentials,
} from '@/components/channel/ChannelCredentialModal';
import { platformIcons, platformColors, platformLabels } from '@/lib/platformIcons';
import { Plus } from 'lucide-react';

const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'linkedin', 'twitter', 'youtube', 'tiktok'];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const ConnectedPlatformsDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { credentials, addCredential, updateCredential, deleteCredential } =
    useChannelCredentials();
  const [modalOpen, setModalOpen] = useState(false);
  const [editData, setEditData] = useState<CredentialEditData | null>(null);
  const [defaultPlatformName, setDefaultPlatformName] = useState<string | undefined>();

  const socialCreds = credentials.filter((c) =>
    SOCIAL_PLATFORMS.includes(c.platform_name.toLowerCase())
  );
  const connectedKeys = new Set(socialCreds.map((c) => c.platform_name.toLowerCase()));
  const unconnected = SOCIAL_PLATFORMS.filter((p) => !connectedKeys.has(p));

  const openAdd = (platform?: string) => {
    setEditData(null);
    setDefaultPlatformName(platform);
    setModalOpen(true);
  };

  const openEdit = (cred: CredentialEditData) => {
    setEditData(cred);
    setDefaultPlatformName(undefined);
    setModalOpen(true);
  };

  const handleSubmit = (creds: ChannelCredentials) => {
    if (editData) {
      updateCredential.mutate({
        id: editData.id,
        platform_name: creds.platformName,
        platform_url: creds.platformUrl || null,
        username: creds.username || null,
        password: creds.password || null,
      });
    } else {
      addCredential.mutate({
        platform_name: creds.platformName,
        platform_url: creds.platformUrl,
        username: creds.username,
        password: creds.password,
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Connected Platforms</DialogTitle>
            <DialogDescription>
              Social media accounts connected for this practice. Click a platform to manage
              its connection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-3">Connected</h3>
              {socialCreds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No social platforms connected yet.
                </p>
              ) : (
                <PlatformCredentialCards
                  credentials={socialCreds}
                  onEdit={openEdit}
                  onAddAnother={(name) => openAdd(name)}
                  variant="pill"
                />
              )}
            </div>

            {unconnected.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Connect a new platform
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {unconnected.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => openAdd(p)}
                      className="p-3 rounded-xl border border-dashed border-border hover:bg-accent/50 transition-colors flex items-center gap-3 text-left"
                    >
                      <div
                        className={`w-8 h-8 rounded-full ${platformColors[p as keyof typeof platformColors]} flex items-center justify-center p-1.5`}
                      >
                        {platformIcons[p as keyof typeof platformIcons]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {platformLabels[p as keyof typeof platformLabels]}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Connect
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <Button variant="outline" className="w-full" onClick={() => openAdd()}>
                <Plus className="w-4 h-4 mr-2" />
                Add custom channel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ChannelCredentialModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        onDelete={(id) => deleteCredential.mutate(id)}
        editData={editData}
        defaultPlatformName={defaultPlatformName}
      />
    </>
  );
};

export default ConnectedPlatformsDialog;
