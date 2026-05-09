import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, Pencil, Plus, Link2 } from 'lucide-react';
import { platformIcons, platformColors, platformLabels } from '@/lib/platformIcons';
import type { ChannelCredential } from '@/hooks/useChannelCredentials';
import type { CredentialEditData } from '@/components/channel/ChannelCredentialModal';

interface Props {
  credentials: ChannelCredential[];
  onEdit: (cred: CredentialEditData) => void;
  onAddAnother?: (platformName: string) => void;
  variant?: 'card' | 'pill';
}

const toEdit = (c: ChannelCredential): CredentialEditData => ({
  id: c.id,
  platform_name: c.platform_name,
  platform_url: c.platform_url ?? null,
  username: c.username ?? null,
  password: c.password ?? null,
});

const PlatformCredentialCards: React.FC<Props> = ({
  credentials,
  onEdit,
  onAddAnother,
  variant = 'card',
}) => {
  const [openPlatform, setOpenPlatform] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, ChannelCredential[]>();
    credentials.forEach((c) => {
      const key = c.platform_name.toLowerCase();
      const arr = map.get(key) || [];
      arr.push(c);
      map.set(key, arr);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      label: platformLabels[key] || items[0].platform_name,
      items,
    }));
  }, [credentials]);

  const activeGroup = openPlatform
    ? grouped.find((g) => g.key === openPlatform)
    : null;

  const handleClick = (group: typeof grouped[number]) => {
    if (group.items.length === 1) {
      onEdit(toEdit(group.items[0]));
    } else {
      setOpenPlatform(group.key);
    }
  };

  return (
    <>
      <div
        className={
          variant === 'pill'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3'
            : 'grid grid-cols-1 md:grid-cols-2 gap-3'
        }
      >
        {grouped.map((group) => {
          const PlatformIcon = platformIcons[group.key];
          const count = group.items.length;
          if (variant === 'pill') {
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => handleClick(group)}
                className="p-3 rounded-xl bg-accent/50 flex items-center gap-3 text-left hover:bg-accent transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-full ${platformColors[group.key] || 'bg-muted'} flex items-center justify-center`}
                >
                  {PlatformIcon ? (
                    <PlatformIcon className="w-4 h-4 text-white" />
                  ) : (
                    <Link2 className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {group.label}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    {count} {count === 1 ? 'account' : 'accounts'} active
                  </p>
                </div>
              </button>
            );
          }
          return (
            <Card
              key={group.key}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleClick(group)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-full ${platformColors[group.key] || 'bg-muted'} flex items-center justify-center flex-shrink-0`}
                  >
                    {PlatformIcon ? (
                      <PlatformIcon className="w-5 h-5 text-white" />
                    ) : (
                      <Link2 className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {group.label}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-xs text-muted-foreground">
                        Connected
                      </span>
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {count} {count === 1 ? 'account' : 'accounts'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Pencil className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={!!activeGroup}
        onOpenChange={(o) => {
          if (!o) setOpenPlatform(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{activeGroup?.label} accounts</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {activeGroup?.items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setOpenPlatform(null);
                  onEdit(toEdit(c));
                }}
                className="w-full p-3 rounded-lg border border-border hover:bg-accent transition-colors flex items-center justify-between text-left"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {c.username || 'Account'}
                  </p>
                  {c.platform_url && (
                    <p className="text-xs text-muted-foreground truncate">
                      {c.platform_url}
                    </p>
                  )}
                </div>
                <Pencil className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
            {onAddAnother && activeGroup && (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => {
                  const name = activeGroup.items[0].platform_name;
                  setOpenPlatform(null);
                  onAddAnother(name);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add another {activeGroup.label} account
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlatformCredentialCards;
