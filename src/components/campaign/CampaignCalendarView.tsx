import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { platformLabels, platformColors } from '@/lib/platformIcons';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChannelPostLite {
  id: string;
  title?: string | null;
  text_content?: string | null;
  scheduled_start?: string | null;
}

interface ChannelLite {
  id: string;
  platform: string;
  channel_type: string;
  channel_posts?: ChannelPostLite[];
}

interface AddonLite {
  id: string;
  addon_type: string;
}

interface CampaignCalendarViewProps {
  campaignStart: Date;
  campaignEnd: Date;
  channels: ChannelLite[];
  addons?: AddonLite[];
}

interface CalendarPost {
  postId: string;
  channelId: string;
  platform: string;
  title: string;
  date: Date;
}

const CampaignCalendarView: React.FC<CampaignCalendarViewProps> = ({
  campaignStart,
  campaignEnd,
  channels,
  addons = [],
}) => {
  const [cursor, setCursor] = useState<Date>(startOfMonth(campaignStart));

  const posts: CalendarPost[] = useMemo(() => {
    const items: CalendarPost[] = [];
    channels.forEach((ch) => {
      (ch.channel_posts || []).forEach((p) => {
        if (!p.scheduled_start) return;
        items.push({
          postId: p.id,
          channelId: ch.id,
          platform: ch.platform,
          title: p.title || p.text_content?.slice(0, 40) || 'Untitled',
          date: new Date(p.scheduled_start),
        });
      });
    });
    return items;
  }, [channels]);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const withinCampaign = (day: Date) =>
    isWithinInterval(day, { start: campaignStart, end: campaignEnd });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Campaign Schedule</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, -1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(cursor, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(campaignStart, 'MMM d, yyyy')} — {format(campaignEnd, 'MMM d, yyyy')}
          {addons.length > 0 && (
            <span className="ml-2">
              · {addons.length} vector{addons.length !== 1 ? 's' : ''} running campaign-wide
            </span>
          )}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden text-xs">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="bg-muted px-2 py-1 font-medium text-muted-foreground text-center">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const dayPosts = posts.filter((p) => isSameDay(p.date, day));
            const inMonth = isSameMonth(day, cursor);
            const inCampaign = withinCampaign(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'bg-card min-h-[88px] p-1 flex flex-col gap-1',
                  !inMonth && 'opacity-40',
                  !inCampaign && 'bg-muted/30',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn('text-[10px] font-medium', isSameDay(day, new Date()) && 'text-primary')}>
                    {format(day, 'd')}
                  </span>
                  {dayPosts.length > 2 && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {dayPosts.length}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {dayPosts.slice(0, 3).map((p) => {
                    const color = (platformColors[p.platform as keyof typeof platformColors] || 'bg-primary').split(' ')[0];
                    return (
                      <div
                        key={p.postId}
                        title={`${platformLabels[p.platform as keyof typeof platformLabels] || p.platform}: ${p.title}`}
                        className={cn('rounded px-1 py-0.5 text-[9px] text-white truncate', color)}
                      >
                        {platformLabels[p.platform as keyof typeof platformLabels] || p.platform}: {p.title}
                      </div>
                    );
                  })}
                  {dayPosts.length > 3 && (
                    <span className="text-[9px] text-muted-foreground px-1">
                      +{dayPosts.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {posts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No scheduled posts yet. Add posts to channels and schedule them to see them on the calendar.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default CampaignCalendarView;
