import React from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: number;
  onClick?: () => void;
  isClickable?: boolean;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  onClick,
  isClickable = false,
}) => {
  const clickable = isClickable && value > 0;
  
  return (
    <div
      className={cn(
        'p-4 rounded-xl bg-card border border-border transition-all duration-200',
        clickable && 'cursor-pointer hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5'
      )}
      onClick={clickable ? onClick : undefined}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {clickable && (
        <p className="text-xs text-primary mt-1">Click to view</p>
      )}
    </div>
  );
};
