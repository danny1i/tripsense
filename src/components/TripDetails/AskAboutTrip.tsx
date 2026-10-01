import { useState } from 'react';
import type { TravelPreferences } from '../../types/travel';
import { api, ApiClientError } from '../../services/apiClient';
import { track } from '../../services/analytics';
import { SearchBox } from '../Search/SearchBox';
import { ThinkingIndicator } from '../AgentActivity/AgentActivity';
import { Icon } from '../Icon/Icon';

interface QA {
  id: number;
  question: string;
  answer?: string;
  basedOn?: string[];
  error?: string;
}

const EXAMPLES = ['Is this suitable for a couple?', 'How far is it from the beach?', 'What activities are nearby?', 'What will the weather be like?'];

export function AskAboutTrip({ tripId, destinationName, preferences }: { tripId: string; destinationName: string; preferences: TravelPreferences }) {
  const [items, setItems] = useState<QA[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = async (question: string) => {
    const id = Date.now();
    setItems((list) => [...list, { id, question }]);
    setBusy(true);
    track('trip_question_asked', { tripId, length: question.length });
    try {
      const res = await api.askAboutTrip(tripId, question, preferences);
      setItems((list) => list.map((q) => (q.id === id ? { ...q, answer: res.answer, basedOn: res.basedOn } : q)));
    } catch (error) {
      const message = error instanceof ApiClientError ? error.message : 'Something went wrong while understanding your request. Please try again.';
      setItems((list) => list.map((q) => (q.id === id ? { ...q, error: message } : q)));
      track('error_shown', { where: 'trip_question' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ask card" aria-labelledby="ask-title">
      <div className="ask__header">
        <span className="avatar" aria-hidden="true">
          <Icon name="sparkle" size={16} />
        </span>
        <div>
          <h2 id="ask-title">Ask AI about this trip</h2>
          <p className="muted">Answers use only the trip data we hold for {destinationName}.</p>
        </div>
      </div>

      <div className="ask__thread" role="log" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className="ask__item">
            <div className="msg msg--user">
              <p className="msg__bubble">{item.question}</p>
            </div>
            <div className={`msg msg--assistant${item.error ? ' is-error' : ''}`}>
              <span className="avatar" aria-hidden="true">
                <Icon name="sparkle" size={14} />
              </span>
              <div className="msg__content">
                <div className="msg__bubble">{item.answer ?? item.error ?? <ThinkingIndicator />}</div>
                {item.basedOn && item.basedOn.length > 0 && (
                  <p className="ask__sources">
                    Based on: {item.basedOn.join(' · ')}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <ul className="ask__examples" aria-label="Example questions">
          {EXAMPLES.map((q) => (
            <li key={q}>
              <button type="button" className="chip" onClick={() => void ask(q)} disabled={busy}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}

      <SearchBox variant="compact" onSubmit={(q) => void ask(q)} busy={busy} label="Ask a question about this trip" placeholder="e.g. Is it good for families?" submitLabel="Ask" />
    </section>
  );
}
