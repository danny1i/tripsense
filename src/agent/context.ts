import type { ChangeNote } from '../types/agent';
import type { PreferenceKey, TravelPreferences, TripOption } from '../types/travel';
import { DESTINATIONS_BY_ID } from '../data/destinations';
import type { ParsedIntent } from './intent';

/** Round down / up to the nearest £50 — keeps budgets human-friendly. */
const floor50 = (value: number) => Math.floor(value / 50) * 50;
const ceil50 = (value: number) => Math.ceil(value / 50) * 50;

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : sorted[mid];
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Remove undefined keys so the preference object stays tidy. */
export function compact(preferences: TravelPreferences): TravelPreferences {
  return Object.fromEntries(Object.entries(preferences).filter(([, v]) => v !== undefined)) as TravelPreferences;
}

export interface MergeResult {
  preferences: TravelPreferences;
  changes: ChangeNote[];
}

/**
 * Merge a newly parsed message into the current search context.
 *
 * - "new" requests replace the context.
 * - "refine" requests keep everything and layer the new constraints on top.
 * - Relative words are resolved against what the user is currently looking at.
 */
export function mergeIntent(current: TravelPreferences, intent: ParsedIntent, visibleTrips: TripOption[]): MergeResult {
  if (intent.mode === 'reset') return { preferences: {}, changes: [] };

  const base: TravelPreferences = intent.mode === 'new' ? {} : { ...current };
  for (const key of intent.remove) delete base[key];

  const next: TravelPreferences = { ...base, ...intent.set };

  // Holiday types accumulate when refining ("…and somewhere with good food").
  if (intent.mode === 'refine' && current.holidayTypes && intent.set.holidayTypes) {
    next.holidayTypes = [...new Set([...current.holidayTypes, ...intent.set.holidayTypes])];
  }

  const { relative } = intent;
  if (relative.cheaper) {
    if (next.budgetMax !== undefined) {
      next.budgetMax = Math.max(100, floor50(next.budgetMax * 0.85));
    } else {
      const mid = median(visibleTrips.map((t) => t.price));
      if (mid !== undefined) {
        const maxVisible = Math.max(...visibleTrips.map((t) => t.price));
        const proposed = ceil50(mid);
        next.budgetMax = proposed < maxVisible ? proposed : floor50(mid);
      }
      next.budgetLevel = 'low';
    }
  }
  if (relative.closerToBeach) {
    next.beach = true;
    next.beachMaxDistance = next.beachMaxDistance !== undefined ? Math.max(100, Math.round(next.beachMaxDistance / 2 / 50) * 50) : 1000;
    next.holidayTypes = [...new Set([...(next.holidayTypes ?? []), 'beach' as const])];
  }
  if (relative.warmer) next.temperature = next.temperature === 'warm' ? 'hot' : 'warm';
  if (relative.longer) next.durationDays = (next.durationDays ?? 4) + 2;
  if (relative.shorter) next.durationDays = Math.max(2, (next.durationDays ?? 6) - 2);
  if (relative.quieter) {
    delete next.nightlife;
    next.holidayTypes = [...new Set([...(next.holidayTypes ?? []), 'relaxation' as const])];
  }

  const preferences = compact(next);
  return { preferences, changes: diffPreferences(current, preferences) };
}

/** Human-readable label for one preference, e.g. "Budget: under £400". */
export function describePreference(key: PreferenceKey, preferences: TravelPreferences): string | null {
  const p = preferences;
  switch (key) {
    case 'destinationIds':
      return p.destinationIds?.length
        ? p.destinationIds.map((id) => DESTINATIONS_BY_ID.get(id)?.name ?? id).join(', ')
        : null;
    case 'europeOnly':
      return p.europeOnly ? 'Europe' : null;
    case 'month':
      return p.month ?? null;
    case 'durationDays':
      return p.durationDays ? `${p.durationDays} days` : null;
    case 'temperature':
      return p.temperature ? `${p.temperature[0]?.toUpperCase()}${p.temperature.slice(1)} destination` : null;
    case 'budgetMax':
      return p.budgetMax ? `Under £${p.budgetMax}` : null;
    case 'budgetLevel':
      if (!p.budgetLevel || p.budgetMax) return null;
      return p.budgetLevel === 'low' ? 'Budget-friendly' : p.budgetLevel === 'luxury' ? 'Luxury' : 'Mid-range';
    case 'beach':
      return p.beach && p.beachMaxDistance === undefined ? 'Beach' : null;
    case 'beachMaxDistance':
      return p.beachMaxDistance !== undefined
        ? `Beach within ${p.beachMaxDistance >= 1000 ? `${p.beachMaxDistance / 1000} km` : `${p.beachMaxDistance} m`}`
        : null;
    case 'holidayTypes': {
      const types = (p.holidayTypes ?? []).filter((t) => !(t === 'beach' && p.beach));
      return types.length ? types.map((t) => `${t[0]?.toUpperCase()}${t.slice(1)}`).join(', ') : null;
    }
    case 'nightlife':
      return p.nightlife ? 'Good nightlife' : null;
    case 'familyFriendly':
      return p.familyFriendly ? 'Family-friendly' : null;
    case 'coupleFriendly':
      return p.coupleFriendly ? 'Great for couples' : null;
    case 'minRating':
      return p.minRating ? `Rated ${p.minRating}+` : null;
    case 'travellers':
      return p.travellers ? `${p.travellers} travellers` : null;
    default:
      return null;
  }
}

export const PREFERENCE_ORDER: PreferenceKey[] = [
  'destinationIds',
  'europeOnly',
  'temperature',
  'durationDays',
  'month',
  'budgetMax',
  'budgetLevel',
  'beach',
  'beachMaxDistance',
  'holidayTypes',
  'nightlife',
  'familyFriendly',
  'coupleFriendly',
  'minRating',
  'travellers',
];

export function diffPreferences(before: TravelPreferences, after: TravelPreferences): ChangeNote[] {
  const notes: ChangeNote[] = [];
  for (const key of PREFERENCE_ORDER) {
    if (sameValue(before[key], after[key])) continue;
    const label = describePreference(key, after);
    if (label) notes.push({ key, label });
    else if (before[key] !== undefined && after[key] === undefined) notes.push({ key, label: `Removed ${describePreference(key, before) ?? key}` });
  }
  return notes;
}

/** Remove one preference — used by the chip "×" buttons. */
export function removePreference(preferences: TravelPreferences, key: PreferenceKey): TravelPreferences {
  const next = { ...preferences };
  delete next[key];
  if (key === 'beach') delete next.beachMaxDistance;
  if (key === 'budgetMax' && next.budgetLevel === 'low') delete next.budgetLevel;
  if (key === 'beach' || key === 'beachMaxDistance') {
    if (key === 'beach') next.holidayTypes = next.holidayTypes?.filter((t) => t !== 'beach');
    if (next.holidayTypes?.length === 0) delete next.holidayTypes;
  }
  return compact(next);
}
