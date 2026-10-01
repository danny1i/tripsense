import { useId, useState, type FormEvent, type KeyboardEvent } from 'react';
import { MAX_MESSAGE_LENGTH } from '../../bff/schemas';
import { Icon } from '../Icon/Icon';
import './Search.css';

interface Props {
  onSubmit: (text: string) => void;
  variant?: 'hero' | 'compact';
  placeholder?: string;
  label?: string;
  busy?: boolean;
  submitLabel?: string;
  autoFocus?: boolean;
}

export const DEFAULT_PLACEHOLDER = 'Try: Find me a cheap 4-day beach holiday somewhere warm in November...';

/** The conversational input — used on the landing page and in the chat. */
export function SearchBox({
  onSubmit,
  variant = 'hero',
  placeholder = DEFAULT_PLACEHOLDER,
  label = 'Describe the trip you want',
  busy = false,
  submitLabel = 'Search',
  autoFocus = false,
}: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const text = value.trim();
    if (!text) {
      setError('Tell us a little about the trip you want — for example, where, when or your budget.');
      return;
    }
    setError(null);
    onSubmit(text);
    setValue('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className={`search-box search-box--${variant}${error ? ' has-error' : ''}`} onSubmit={submit} role="search">
      <label htmlFor={inputId} className="visually-hidden">
        {label}
      </label>
      {variant === 'hero' && <Icon name="sparkle" size={22} className="search-box__icon" />}
      <textarea
        id={inputId}
        className="search-box__input"
        value={value}
        rows={variant === 'hero' ? 2 : 1}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder={placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={onKeyDown}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        autoFocus={autoFocus}
        enterKeyHint="search"
      />
      <button type="submit" className="btn btn-primary search-box__submit" disabled={busy} aria-label={variant === 'compact' ? submitLabel : undefined}>
        {variant === 'compact' ? <Icon name="send" size={18} /> : <Icon name="search" size={18} />}
        {variant === 'hero' && <span>{submitLabel}</span>}
      </button>
      {error && (
        <p id={errorId} className="search-box__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export const SUGGESTED_PROMPTS = [
  'Find me somewhere warm for £500',
  'I want a 4-day European city break',
  'Find a family-friendly beach holiday',
  'Somewhere warm with good nightlife',
  'Find me a cheap November getaway',
];

export function SuggestedPrompts({ onPick, prompts = SUGGESTED_PROMPTS, label = 'Suggested searches' }: { onPick: (p: string) => void; prompts?: string[]; label?: string }) {
  return (
    <div className="suggested">
      <p className="suggested__label">{label}</p>
      <ul className="suggested__list">
        {prompts.map((prompt) => (
          <li key={prompt}>
            <button type="button" className="chip" onClick={() => onPick(prompt)}>
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
