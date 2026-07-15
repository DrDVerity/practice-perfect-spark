/**
 * Shared scheduling helpers — used by CampaignScheduler and per-channel
 * "Fit Posts" so both follow the same platform best-practice rules.
 *
 * SCHEDULING_GUIDE (applied by fitPostsToWindow + fitSlotsToCampaign):
 *
 *  1. Launch-day salvo — the first Facebook, Instagram, X/Twitter and LinkedIn
 *     post of a campaign lands on the campaign's Day 1 to kick things off.
 *  2. First-week weighting — remaining social posts are packed into the first
 *     7 days of the campaign window, then spaced out over the remainder.
 *  3. Max 1 post per platform per day — if a proposed slot collides, the post
 *     is pushed to the next best-practice day for that platform.
 *  4. Same-day duplicates — if two posts for the same platform are explicitly
 *     required on the same day (e.g. Instagram twice on launch), one is split
 *     to a morning slot (~09:00) and one to an evening slot (~19:00).
 *  5. Email weekly cap — no more than one email per rolling 7 days per channel,
 *     UNLESS the post is part of a funnel / drip sequence (isFunnel === true),
 *     in which case the funnel's own cadence is preserved.
 *  6. SMS minimum gap — at least 3 days between SMS sends on the same channel.
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
  facebook:       { days: [1, 2, 3, 4],    times: ['09:00', '19:00'] },
  instagram:      { days: [1, 2, 3, 4, 5], times: ['09:00', '14:00', '19:00'] },
  linkedin:       { days: [2, 3, 4],       times: ['08:00', '12:00'] },
  twitter:        { days: [1, 2, 3, 4, 5], times: ['09:00', '12:00', '19:00'] },
  youtube:        { days: [4, 5, 6],       times: ['15:00', '17:00'] },
  tiktok:         { days: [2, 3, 4, 5],    times: ['10:00', '19:00'] },
  internal_email: { days: [2, 3, 4],       times: ['09:00', '10:00'] },
  mailchimp:      { days: [2, 3, 4],       times: ['09:00', '10:00'] },
  beehive:        { days: [2, 3, 4],       times: ['09:00', '10:00'] },
  internal_sms:   { days: [2, 3, 4, 5],    times: ['11:00', '17:00'] },
};

/** Platforms that participate in the launch-day salvo (rule 1). */
export const LAUNCH_PLATFORMS = new Set<string>([
  'facebook', 'instagram', 'twitter', 'linkedin',
]);
export const EMAIL_PLATFORMS = new Set<string>([
  'internal_email', 'mailchimp', 'beehive',
]);
export const SMS_PLATFORMS = new Set<string>(['internal_sms']);

/** Human-readable summary of the scheduling rules for docs / posting guides. */
export const SCHEDULING_GUIDE_MARKDOWN = `## Scheduling rules for social posts

1. **Launch-day salvo.** The first Facebook, Instagram, X/Twitter and LinkedIn post of the campaign is scheduled for Day 1 (campaign start) to launch the campaign together.
2. **First-week weighting.** Remaining social posts are concentrated in the first 7 days of the campaign window, then spaced out over the remainder.
3. **Max one post per platform per day.** Never schedule two posts for the same platform on the same day; push the second post to the next best-practice day for that platform.
4. **Same-day duplicates.** If the plan explicitly requires two posts for the same platform on the same day, split them into one morning slot (~09:00) and one evening slot (~19:00).
5. **Email cadence cap.** Send at most one email per rolling 7 days per channel — **unless the email is part of a funnel / drip sequence**, in which case the funnel's own cadence is preserved.
6. **SMS minimum gap.** At least 3 days between SMS sends on the same channel.

Always honor each platform's best-practice weekdays and times when snapping schedules.`;

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

/** Find the next best-practice day for `platform` at or after `from`, within [min,max]. */
export function nextBestDay(
  from: Date, platform: string, min: Date, max: Date,
): Date | null {
  const rule = BEST_PRACTICE[platform];
  const span = differenceInCalendarDays(max, from);
  for (let i = 0; i <= Math.max(0, span); i++) {
    const cand = addDays(from, i);
    if (cand > max) break;
    if (!rule || rule.days.includes(cand.getDay())) return cand;
  }
  return null;
}

export interface FitInput {
  /** Existing scheduled datetime for a post (any parsable form). */
  scheduledAt: Date | string | null;
  /** Fallback ordering key when scheduledAt is missing (index in list). */
  fallbackIndex: number;
  /** True if this post belongs to a funnel/drip sequence (skips weekly email cap). */
  isFunnel?: boolean;
}

export interface FitOutput {
  date: string; // yyyy-MM-dd
  time: string; // HH:mm
  iso: string;  // ISO
}

export interface FitOptions {
  /** Campaign start date — enables launch-day salvo + first-week weighting. */
  campaignStart?: Date;
  /** Force the very first post to land on `campaignStart` if the platform is in LAUNCH_PLATFORMS. */
  launchDay?: boolean;
}

/**
 * Distribute a list of posts for a single platform across [start, end], honoring
 * best-practice weekdays/times and the SCHEDULING_GUIDE rules.
 */
export function fitPostsToWindow(
  posts: FitInput[],
  platform: string,
  start: Date,
  end: Date,
  options: FitOptions = {},
): FitOutput[] {
  if (posts.length === 0) return [];
  const dstStart = new Date(format(start, 'yyyy-MM-dd') + 'T00:00:00');
  const dstEnd = new Date(format(end, 'yyyy-MM-dd') + 'T00:00:00');
  const dstSpan = Math.max(0, differenceInCalendarDays(dstEnd, dstStart));
  const launchDate = options.campaignStart
    ? new Date(format(options.campaignStart, 'yyyy-MM-dd') + 'T00:00:00')
    : dstStart;
  const useLaunch = (options.launchDay ?? LAUNCH_PLATFORMS.has(platform)) && launchDate >= dstStart && launchDate <= dstEnd;
  const isSocial = LAUNCH_PLATFORMS.has(platform) || platform === 'youtube' || platform === 'tiktok';
  const isEmail = EMAIL_PLATFORMS.has(platform);
  const isSms = SMS_PLATFORMS.has(platform);

  // Normalize: any post without scheduledAt gets an evenly-spaced synthetic date.
  const enriched = posts.map((p, i) => {
    const has = p.scheduledAt ? new Date(p.scheduledAt) : null;
    return { p, i, srcDate: has, order: has ? has.getTime() : i };
  });
  const withDates = enriched.filter(e => e.srcDate);
  const srcStartT = withDates.length ? Math.min(...withDates.map(e => e.srcDate!.getTime())) : dstStart.getTime();
  const srcEndT = withDates.length ? Math.max(...withDates.map(e => e.srcDate!.getTime())) : dstEnd.getTime();
  const srcSpan = Math.max(0, differenceInCalendarDays(new Date(srcEndT), new Date(srcStartT)));

  // Weighting curve: for social platforms, bias toward first 7 days.
  // Map ratio r in [0,1] → biased ratio r' so the first ~60% of posts land in week 1.
  const weekOneRatio = dstSpan > 0 ? Math.min(7, dstSpan) / dstSpan : 1;
  const weightRatio = (r: number) => {
    if (!isSocial || dstSpan <= 7) return r;
    // First 60% of posts → first-week window; remaining 40% → rest of window.
    if (r < 0.6) return (r / 0.6) * weekOneRatio;
    return weekOneRatio + ((r - 0.6) / 0.4) * (1 - weekOneRatio);
  };

  const proposed = enriched
    .sort((a, b) => a.order - b.order)
    .map((e, idx, arr) => {
      let newDay: Date;
      const posRatio = arr.length === 1 ? 0 : idx / (arr.length - 1);
      if (e.srcDate && srcSpan > 0) {
        const srcRatio = differenceInCalendarDays(e.srcDate, new Date(srcStartT)) / srcSpan;
        const r = weightRatio(srcRatio);
        newDay = addDays(dstStart, Math.round(r * dstSpan));
      } else {
        const r = weightRatio(posRatio);
        newDay = addDays(dstStart, Math.round(r * dstSpan));
      }
      if (newDay < dstStart) newDay = dstStart;
      if (newDay > dstEnd) newDay = dstEnd;
      const origTime = e.srcDate ? format(e.srcDate, 'HH:mm') : '09:00';
      // Launch-day salvo: force the very first post to campaign Day 1.
      const isFirst = idx === 0;
      const snapped = useLaunch && isFirst
        ? launchDate
        : snapDayToPlatform(newDay, platform, dstStart, dstEnd);
      const time = pickBestPracticeTime(origTime, platform);
      return { orig: e, day: snapped, time };
    });

  // Rule 3 & 4: enforce max-1/platform/day + morning/evening split for explicit dupes.
  const rule = BEST_PRACTICE[platform];
  const usedDays = new Set<string>();
  // Pre-count how many posts landed on the same day; those groups get M/E split.
  const dayCounts: Record<string, number> = {};
  for (const p of proposed) {
    const k = format(p.day, 'yyyy-MM-dd');
    dayCounts[k] = (dayCounts[k] || 0) + 1;
  }

  const staggered = proposed.map((item) => {
    let day = item.day;
    let key = format(day, 'yyyy-MM-dd');
    // If this day already used, push to next best-practice day.
    if (usedDays.has(key)) {
      const next = nextBestDay(addDays(day, 1), platform, dstStart, dstEnd);
      if (next) day = next;
      key = format(day, 'yyyy-MM-dd');
      // If still colliding (rare), walk forward one day at a time.
      while (usedDays.has(key) && day < dstEnd) {
        day = addDays(day, 1);
        key = format(day, 'yyyy-MM-dd');
      }
    }
    usedDays.add(key);
    // Same-day duplicate handling: if original bucket had ≥2, first uses morning, second evening.
    let time = item.time;
    const dupCount = dayCounts[format(item.day, 'yyyy-MM-dd')] || 1;
    if (dupCount >= 2 && rule && rule.times.length >= 2) {
      // Assign morning to first, evening to subsequent based on staggered index within original day.
      time = rule.times[0]; // morning
      // If this is the *second* occurrence of the original day, use the last time (evening).
      // Track occurrence count per original day:
    }
    return { orig: item.orig, day, time, origDayKey: format(item.day, 'yyyy-MM-dd') };
  });

  // Second pass: assign evening slot to duplicates that kept their original day.
  if (rule && rule.times.length >= 2) {
    const seenOrigDay: Record<string, number> = {};
    for (const s of staggered) {
      const n = seenOrigDay[s.origDayKey] || 0;
      const dupCount = dayCounts[s.origDayKey] || 1;
      if (dupCount >= 2) {
        s.time = n === 0 ? rule.times[0] : rule.times[rule.times.length - 1];
      }
      seenOrigDay[s.origDayKey] = n + 1;
    }
  }

  // Rule 5 & 6: enforce cadence for email/SMS.
  if (isEmail || isSms) {
    const minGapDays = isSms ? 3 : 7;
    let lastNonFunnel: Date | null = null;
    for (const s of staggered) {
      if (s.orig.p.isFunnel) continue;
      if (lastNonFunnel) {
        const gap = differenceInCalendarDays(s.day, lastNonFunnel);
        if (gap < minGapDays) {
          const target = addDays(lastNonFunnel, minGapDays);
          const next = nextBestDay(target, platform, dstStart, dstEnd);
          if (next) s.day = next;
        }
      }
      lastNonFunnel = s.day;
    }
  }

  const out: FitOutput[] = new Array(posts.length);
  for (const s of staggered) {
    const dateKey = format(s.day, 'yyyy-MM-dd');
    const iso = new Date(`${dateKey}T${s.time}:00`).toISOString();
    out[s.orig.i] = { date: dateKey, time: s.time, iso };
  }
  return out;
}
