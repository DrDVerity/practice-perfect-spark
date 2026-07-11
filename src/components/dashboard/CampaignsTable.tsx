import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { format, parseISO } from 'date-fns';
import { SectionUpdateFlag } from '@/components/ui/section-update-flag';
import { Plus, ChevronDown, Trash2 } from 'lucide-react';
import { Campaign, CampaignStatus, useCampaignsNew } from '@/hooks/useCampaignsNew';
import { useState } from 'react';

interface CampaignsTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onCreateCampaign: () => void;
}

const statusColors: Record<CampaignStatus, string> = {
  developing: 'bg-amber-500/20 text-amber-600 hover:bg-amber-500/30',
  scheduled: 'bg-blue-500/20 text-blue-600 hover:bg-blue-500/30',
  active: 'bg-green-500/20 text-green-600 hover:bg-green-500/30',
  ended: 'bg-muted text-muted-foreground hover:bg-muted/80',
  canceled: 'bg-destructive/20 text-destructive hover:bg-destructive/30',
};

const statusLabels: Record<CampaignStatus, string> = {
  developing: 'Developing',
  scheduled: 'Scheduled',
  active: 'Active',
  ended: 'Ended',
  canceled: 'Canceled',
};

const allStatuses: CampaignStatus[] = ['developing', 'scheduled', 'active', 'ended'];

export const CampaignsTable: React.FC<CampaignsTableProps> = ({
  campaigns,
  isLoading,
  onCreateCampaign,
}) => {
  const navigate = useNavigate();
  const { updateCampaign, deleteCampaign } = useCampaignsNew();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleStatusChange = async (e: React.MouseEvent, campaignId: string, newStatus: CampaignStatus) => {
    e.stopPropagation();
    await updateCampaign.mutateAsync({ id: campaignId, status: newStatus });
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await deleteCampaign.mutateAsync(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-muted rounded" />
          <div className="h-10 bg-muted rounded" />
          <div className="h-10 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <h3 className="text-lg font-semibold text-foreground mb-2">No campaigns yet</h3>
        <p className="text-muted-foreground mb-6">
          Create your first marketing campaign to get started
        </p>
        <Button onClick={onCreateCampaign}>
          <Plus className="w-4 h-4 mr-2" />
          Create Campaign
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-semibold">Campaign Name</TableHead>
            <TableHead className="font-semibold">Start Date</TableHead>
            <TableHead className="font-semibold">End Date</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow
              key={campaign.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => navigate(`/campaign/${campaign.id}`)}
            >
              <TableCell className="font-medium">
                <span className="inline-flex items-center gap-2">
                  {campaign.name}
                  <SectionUpdateFlag id={`campaign-${campaign.id}`} updatedAt={(campaign as any).updated_at} />
                </span>
              </TableCell>
              <TableCell>
                {campaign.start_date
                  ? format(parseISO(campaign.start_date), 'MMM d, yyyy')
                  : '-'
                }
              </TableCell>
              <TableCell>
                {campaign.end_date
                  ? format(parseISO(campaign.end_date), 'MMM d, yyyy')
                  : '-'
                }
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`gap-1 px-2.5 py-0.5 h-auto text-xs font-semibold rounded-full border-0 ${statusColors[campaign.status]}`}
                    >
                      {statusLabels[campaign.status]}
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-card border border-border z-50">
                    {allStatuses.map((status) => (
                      <DropdownMenuItem
                        key={status}
                        onClick={(e) => handleStatusChange(e, campaign.id, status)}
                        className={`cursor-pointer ${campaign.status === status ? 'bg-accent' : ''}`}
                      >
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[status]}`}>
                          {statusLabels[status]}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(campaign.id); }}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      Delete campaign
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the campaign and all of its data from your account. This cannot be undone.
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
    </div>
  );
};
