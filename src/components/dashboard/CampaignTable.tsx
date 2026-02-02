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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Edit, X } from 'lucide-react';
import { CampaignVault } from '@/hooks/useCampaigns';

interface CampaignTableProps {
  campaigns: CampaignVault[];
  title: string;
  open: boolean;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-amber-500/20 text-amber-600',
  published: 'bg-primary/20 text-primary',
  active: 'bg-green-500/20 text-green-600',
  completed: 'bg-blue-500/20 text-blue-600',
  canceled: 'bg-destructive/20 text-destructive',
};

export const CampaignTable: React.FC<CampaignTableProps> = ({
  campaigns,
  title,
  open,
  onClose,
}) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {title}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign Name</TableHead>
              <TableHead>Date Created</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell className="font-medium">{campaign.title}</TableCell>
                <TableCell>
                  {format(new Date(campaign.created_at), 'MMM d, yyyy')}
                </TableCell>
                <TableCell>
                  <Badge className={statusColors[campaign.status] || statusColors.draft}>
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onClose();
                      navigate(`/campaign/edit/${campaign.id}`);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};
