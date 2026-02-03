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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Campaign, CampaignStatus } from '@/hooks/useCampaignsNew';

interface CampaignsTableProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onCreateCampaign: () => void;
}

const statusColors: Record<CampaignStatus, string> = {
  developing: 'bg-amber-500/20 text-amber-600',
  scheduled: 'bg-blue-500/20 text-blue-600',
  active: 'bg-green-500/20 text-green-600',
  ended: 'bg-muted text-muted-foreground',
  canceled: 'bg-destructive/20 text-destructive',
};

const statusLabels: Record<CampaignStatus, string> = {
  developing: 'Developing',
  scheduled: 'Scheduled',
  active: 'Active',
  ended: 'Ended',
  canceled: 'Canceled',
};

export const CampaignsTable: React.FC<CampaignsTableProps> = ({
  campaigns,
  isLoading,
  onCreateCampaign,
}) => {
  const navigate = useNavigate();

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
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell>
                {campaign.start_date 
                  ? format(new Date(campaign.start_date), 'MMM d, yyyy')
                  : '—'
                }
              </TableCell>
              <TableCell>
                {campaign.end_date 
                  ? format(new Date(campaign.end_date), 'MMM d, yyyy')
                  : '—'
                }
              </TableCell>
              <TableCell>
                <Badge className={statusColors[campaign.status]}>
                  {statusLabels[campaign.status]}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
