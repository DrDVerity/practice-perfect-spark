import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Campaign } from '@/types/campaign';
import { Download, Edit, Play, Lock } from 'lucide-react';
// FIX #5: Use canonical platform maps, removed local redeclarations
import { platformColors as allPlatformColors } from '@/lib/platformIcons';

const platformColors = allPlatformColors as Record<string, string>;

interface CampaignCardProps {
  campaign: Campaign;
  onDownload: () => void;
  onEdit: () => void;
  onClick?: () => void;
  isLocked?: boolean;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  onDownload,
  onEdit,
  onClick,
  isLocked = true,
}) => {
  return (
    <div
      className="campaign-card group cursor-pointer"
      onClick={onClick}
    >
      <div className="absolute top-4 left-4 z-10">
        <Badge className={`${platformColors[campaign.platform] || 'bg-muted'} text-white border-0`}>
          {campaign.platform.charAt(0).toUpperCase() + campaign.platform.slice(1)}
        </Badge>
      </div>

      <div className="relative aspect-video rounded-xl overflow-hidden mb-4 bg-muted">
        <img
          src={campaign.imageUrl}
          alt={campaign.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {campaign.videoUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/20">
            <div className="w-14 h-14 rounded-full bg-card/90 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform">
              <Play className="w-6 h-6 text-primary ml-1" />
            </div>
          </div>
        )}
      </div>

      <h3 className="font-semibold text-lg text-foreground mb-2 line-clamp-1">{campaign.title}</h3>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{campaign.description}</p>

      <div className="p-3 rounded-lg bg-muted/50 mb-4">
        <p className="text-sm text-foreground line-clamp-3 italic">"{campaign.textCopy}"</p>
      </div>

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        <Button variant={isLocked ? 'outline' : 'default'} size="sm" onClick={onDownload} className="flex-1">
          {isLocked ? <Lock className="w-4 h-4 mr-1" /> : <Download className="w-4 h-4 mr-1" />}
          Download
        </Button>
        <Button variant={isLocked ? 'outline' : 'secondary'} size="sm" onClick={onEdit} className="flex-1">
          {isLocked ? <Lock className="w-4 h-4 mr-1" /> : <Edit className="w-4 h-4 mr-1" />}
          Edit
        </Button>
      </div>
    </div>
  );
};
