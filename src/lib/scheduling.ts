/**
 * Shared scheduling helpers — used by CampaignScheduler and per-channel
 * "Fit Posts" so both follow the same platform best-practice rules.
 */
import { addDays, differenceInCalendarDays, format } from 'date-fns';

export type PlatformKey =
  | 'facebook' | 'instagram' | 'linkedin' | 'twitter'
  | 'youtube' | 'tiktok'
  | 'internal_email' | 'mailchimp' | 'beehive'
  | 'internal_sms';

export interface BestPracticeRule {
  /** Preferred weekdays, 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** Preferred posting times in `HH:mm` local time. */
  times: string[];
}

export const BEST_PRACTICE: Record<string, BestPracticeRule> = {
  facebook:       { days: [1, 2, 3, 4],    times: ['09:00', '13:00'] },
  instagram:      { days: [1, 2, 3, 4, 5], times: ['11:00', '14:00', '19:00'] },
  linkedin:       { days: [2, 3, 4],       times: ['08:00', '12:00'] },
  twitter:        { days: [1, 2, 3, 4, 5], times: ['09:00', '12:00', '17:00'] },
  youtube:        { days: [4, 5, 6],       times: ['15:00', '17:00'] },
  tiktok:         { days: [2, 3, 4, 5],    times: ['10:00', '19:00'] },
  internal_email: { days: [2, 3, 4],       times: ['09:00', '10:00'] },
  mailchimp:      { days: [2, 3, 4],       times: ['09:00', '10:00'] },
  beehive:        { days: [2, 3, 4],       times: ['09:00', '10:00'] },
  internal_sms:   { days: [2, 3, 4, 5],    times: ['11:00', '17:00'] },
};

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

/** Snap `day` to the nearest best-practice weekday for `platform` (±3 days, clamped). */
export function snapDayToPlatform(
  day: Date,
  platform: string | null,
  minDate: Date,
  maxDate: Date,
): Date {
  if (!platform) return day;
  const rule = BEST_PRACTICE[platform];
  if (!rule) return day;
  for (let delta = 0; delta <= 3; delta++) {
    for (const dir of delta === 0 ? [0] : [-1, 1]) {
      const cand = addDays(day, delta * dir);
      if (cand < minDate || cand > maxDate) continue;
      if (rule.days.includes(cand.getDay())) return cand;
    }
  }
  return day;
}

/** Pick the best-practice time closest to the original. */
export function pickBestPracticeTime(origTime: string, platform: string | null): string {
  if (!platform) return origTime;
  const rule = BEST_PRACTICE[platform];
  if (!rule || rule.times.length === 0) return origTime;
  const target = toMin(origTime || '09:00');
  return [...rule.times].sort((a, b) => Math.abs(toMin(a) - target) - Math.abs(toMin(b) - target))[0];
}

export interface FitInput {
  /** Existing scheduled datetime for a post (any parsable form). */
  scheduledAt: Date | string | null;
  /** Fallback ordering key when scheduledAt is missing (index in list). */
  fallbackIndex: number;
}

export interface FitOutput {
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  iso: string;  // ISO
}

/**
 * Distribute a list of posts for a single platform across [start, end], honoring
 * best-practice weekdays/times and preserving relative ordering.
 */
export function fitPostsToWindow(
  posts: FitInput[],
  platform: string,
  start: Date,
  end: Date,
): FitOutput[] {
  if (posts.length === 0) return [];
  const dstStart = new Date(format(start, 'yyyy-MM-dd') + 'T00:00:00');
  const dstEnd = new Date(format(end, 'yyyy-MM-dd') + 'T00:00:00');
  const dstSpan = Math.max(0, differenceInCalendarDays(dstEnd, dstStart));

  // Normalize: any post without scheduledAt gets an evenly-spaced synthetic date.
  const enriched = posts.map((p, i) => {
    const has = p.scheduledAt ? new Date(p.scheduledAt) : null;
    return { p, i, srcDate: has, order: has ? has.getTime() : i };
  });
  const withDates = enriched.filter(e => e.srcDate);
  const srcStartT = withDates.length ? Math.min(...withDates.map(e => e.srcDate!.getTime())) : dstStart.getTime();
  const srcEndT = withDates.length ? Math.max(...withDates.map(e => e.srcDate!.getTime())) : dstEnd.getTime();
  const srcSpan = Math.max(0, differenceInCalendarDays(new Date(srcEndT), new Date(srcStartT)));

  const proposed = enriched
    .sort((a, b) => a.order - b.order)
    .map((e, idx, arr) => {
      let newDay: Date;
      if (e.srcDate && srcSpan > 0) {
        const ratio = differenceInCalendarDays(e.srcDate, new Date(srcStartT)) / srcSpan;
        newDay = addDays(dstStart, Math.round(ratio * dstSpan));
      } else {
        // Evenly space across the window based on position.
        const ratio = arr.length === 1 ? 0 : idx / (arr.length - 1);
        newDay = addDays(dstStart, Math.round(ratio * dstSpan));
      }
      if (newDay < dstStart) newDay = dstStart;
      if (newDay > dstEnd) newDay = dstEnd;
      const origTime = e.srcDate ? format(e.srcDate, 'HH:mm') : '09:00';
      const snapped = snapDayToPlatform(newDay, platform, dstStart, dstEnd);
      const time = pickBestPracticeTime(origTime, platform);
      return { orig: e, day: snapped, time };
    });

  // Stagger multiple posts on same platform+day across successive best-practice times.
  const rule = BEST_PRACTICE[platform];
  const bucket: Record<string, number> = {};
  const results: (FitOutput & { origIdx: number })[] = proposed.map(item => {
    const dateKey = format(item.day, 'yyyy-MM-dd');
    const key = dateKey;
    const n = bucket[key] || 0;
    const time = rule ? rule.times[n % rule.times.length] : item.time;
    bucket[key] = n + 1;
    const iso = new Date(`${dateKey}T${time}:00`).toISOString();
    return { date: dateKey, time, iso, origIdx: item.orig.i };
  });

  // Re-order results back to input order.
  const out: FitOutput[] = new Array(posts.length);
  for (const r of results) out[r.origIdx] = { date: r.date, time: r.time, iso: r.iso };
  return out;
}
