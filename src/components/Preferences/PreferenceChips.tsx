import type { PreferenceKey, TravelPreferences } from '../../types/travel';
import { describePreference, PREFERENCE_ORDER } from '../../agent/context';
import { Icon, type IconName } from '../Icon/Icon';
import './PreferenceChips.css';

const ICONS: Partial<Record<PreferenceKey, IconName>> = {
  destinationIds: 'plane',
  europeOnly: 'plane',
  temperature: 'sun',
  durationDays: 'clock',
  month: 'calendar',
  budgetMax: 'pound',
  budgetLevel: 'pound',
  beach: 'beach',
  beachMaxDistance: 'beach',
  holidayTypes: 'sparkle',
  nightlife: 'music',
  familyFriendly: 'family',
  coupleFriendly: 'sparkle',
  minRating: 'star',
  travellers: 'family',
};

export function activePreferenceChips(preferences: TravelPreferences): { key: PreferenceKey; label: string }[] {
  return PREFERENCE_ORDER.flatMap((key) => {
    const label = describePreference(key, preferences);
    return label ? [{ key, label }] : [];
  });
}

interface Props {
  preferences: TravelPreferences;
  onRemove?: (key: PreferenceKey) => void;
  disabled?: boolean;
}

/** The active search context, shown as removable chips. */
export function PreferenceChips({ preferences, onRemove, disabled }: Props) {
  const chips = activePreferenceChips(preferences);
  if (chips.length === 0) return null;
  return (
    <ul className="pref-chips" aria-label="Your current preferences">
      {chips.map(({ key, label }) => (
        <li key={key} className="pref-chip">
          <Icon name={ICONS[key] ?? 'sparkle'} size={16} className="pref-chip__icon" />
          <span>{label}</span>
          {onRemove && (
            <button type="button" className="pref-chip__remove" onClick={() => onRemove(key)} disabled={disabled} aria-label={`Remove ${label}`}>
              <Icon name="x" size={14} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
