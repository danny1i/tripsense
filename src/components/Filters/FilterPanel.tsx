import { useEffect, useId, useState, type FormEvent } from 'react';
import type { HolidayType, Month, TravelPreferences } from '../../types/travel';
import { HOLIDAY_TYPES, MONTHS } from '../../types/travel';
import { DESTINATIONS } from '../../data/destinations';
import { compact } from '../../agent/context';
import './FilterPanel.css';

interface Props {
  preferences: TravelPreferences;
  onApply: (preferences: TravelPreferences) => void;
  disabled?: boolean;
}

interface Draft {
  budget: string;
  destination: string;
  month: string;
  duration: string;
  temperature: string;
  rating: string;
  beach: string;
  types: HolidayType[];
  nightlife: boolean;
  family: boolean;
}

const BUDGETS = ['300', '400', '500', '750', '1000'];
const DURATIONS = ['3', '4', '5', '8'];
const BEACH = ['2000', '1000', '500', '250'];

function toDraft(p: TravelPreferences): Draft {
  return {
    budget: p.budgetMax ? String(p.budgetMax) : p.budgetLevel === 'low' ? 'low' : '',
    destination: p.destinationIds?.length === 1 ? (p.destinationIds[0] ?? '') : p.destinationIds?.length ? 'multiple' : '',
    month: p.month ?? '',
    duration: p.durationDays ? String(p.durationDays) : '',
    temperature: p.temperature ?? '',
    rating: p.minRating ? String(p.minRating) : '',
    beach: p.beachMaxDistance ? String(p.beachMaxDistance) : p.beach ? 'any' : '',
    types: (p.holidayTypes ?? []).filter((t) => t !== 'beach'),
    nightlife: p.nightlife === 'high',
    family: Boolean(p.familyFriendly),
  };
}

function fromDraft(d: Draft, base: TravelPreferences): TravelPreferences {
  const beach = d.beach !== '';
  return compact({
    ...base,
    budgetMax: d.budget && d.budget !== 'low' ? Number(d.budget) : undefined,
    budgetLevel: d.budget === 'low' ? 'low' : d.budget ? base.budgetLevel : undefined,
    destinationIds: d.destination === 'multiple' ? base.destinationIds : d.destination ? [d.destination] : undefined,
    month: (d.month || undefined) as Month | undefined,
    durationDays: d.duration ? Number(d.duration) : undefined,
    temperature: (d.temperature || undefined) as TravelPreferences['temperature'],
    minRating: d.rating ? Number(d.rating) : undefined,
    beach: beach || undefined,
    beachMaxDistance: d.beach && d.beach !== 'any' ? Number(d.beach) : undefined,
    holidayTypes: [...d.types, ...(beach ? (['beach'] as HolidayType[]) : [])].length ? [...d.types, ...(beach ? (['beach'] as HolidayType[]) : [])] : undefined,
    nightlife: d.nightlife ? 'high' : undefined,
    familyFriendly: d.family || undefined,
  });
}

/** Traditional filters that share the same preference state as the conversation. */
export function FilterPanel({ preferences, onApply, disabled }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(preferences));
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;

  // Keep the form in sync when the conversation changes the search.
  useEffect(() => setDraft(toDraft(preferences)), [preferences]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onApply(fromDraft(draft, preferences));
  };

  const select = (key: keyof Draft, label: string, options: { value: string; label: string }[], anyLabel = 'Any') => (
    <div className="filter-field">
      <label htmlFor={fid(key)}>{label}</label>
      <select id={fid(key)} value={String(draft[key])} onChange={(e) => set(key, e.target.value as never)}>
        <option value="">{anyLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const budgetOptions = [{ value: 'low', label: 'Budget-friendly' }, ...BUDGETS.map((b) => ({ value: b, label: `Under £${b}` }))];
  if (preferences.budgetMax && !BUDGETS.includes(String(preferences.budgetMax))) {
    budgetOptions.push({ value: String(preferences.budgetMax), label: `Under £${preferences.budgetMax}` });
  }
  const durationOptions = DURATIONS.map((d) => ({ value: d, label: `${d} days` }));
  if (preferences.durationDays && !DURATIONS.includes(String(preferences.durationDays))) {
    durationOptions.push({ value: String(preferences.durationDays), label: `${preferences.durationDays} days` });
  }
  const beachOptions = [{ value: 'any', label: 'Any beach distance' }, ...BEACH.map((b) => ({ value: b, label: Number(b) >= 1000 ? `Within ${Number(b) / 1000} km` : `Within ${b} m` }))];
  if (preferences.beachMaxDistance && !BEACH.includes(String(preferences.beachMaxDistance))) {
    beachOptions.push({ value: String(preferences.beachMaxDistance), label: `Within ${preferences.beachMaxDistance} m` });
  }
  const destinationOptions = DESTINATIONS.map((d) => ({ value: d.id, label: d.name }));
  if ((preferences.destinationIds?.length ?? 0) > 1) destinationOptions.unshift({ value: 'multiple', label: 'Several (from conversation)' });

  return (
    <form className="filter-panel card" onSubmit={submit} aria-label="Filters">
      <div className="filter-grid">
        {select('budget', 'Budget (per person)', budgetOptions)}
        {select('destination', 'Destination', destinationOptions, 'Anywhere')}
        {select('month', 'Month', MONTHS.map((m) => ({ value: m, label: m })), 'Any month')}
        {select('duration', 'Duration', durationOptions)}
        {select('temperature', 'Temperature', [
          { value: 'mild', label: 'Mild (14–24°C)' },
          { value: 'warm', label: 'Warm (20°C+)' },
          { value: 'hot', label: 'Hot (27°C+)' },
        ])}
        {select('rating', 'Hotel rating', [
          { value: '4', label: '4+ stars' },
          { value: '4.5', label: '4.5+ stars' },
        ])}
        {select('beach', 'Beach', beachOptions, 'Not needed')}
      </div>

      <fieldset className="filter-types">
        <legend>Holiday type</legend>
        <div className="filter-types__list">
          {HOLIDAY_TYPES.filter((t) => t !== 'beach' && t !== 'family' && t !== 'nightlife').map((type) => (
            <label key={type} className="check-chip">
              <input
                type="checkbox"
                checked={draft.types.includes(type)}
                onChange={(e) => set('types', e.target.checked ? [...draft.types, type] : draft.types.filter((t) => t !== type))}
              />
              <span>{type}</span>
            </label>
          ))}
          <label className="check-chip">
            <input type="checkbox" checked={draft.nightlife} onChange={(e) => set('nightlife', e.target.checked)} />
            <span>Good nightlife</span>
          </label>
          <label className="check-chip">
            <input type="checkbox" checked={draft.family} onChange={(e) => set('family', e.target.checked)} />
            <span>Family-friendly</span>
          </label>
        </div>
      </fieldset>

      <div className="filter-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setDraft(toDraft({}))} disabled={disabled}>
          Clear all
        </button>
        <button type="submit" className="btn btn-primary" disabled={disabled}>
          Apply filters
        </button>
      </div>
    </form>
  );
}
