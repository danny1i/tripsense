import { useEffect, useRef } from 'react';
import type { ChatMessage, SearchPhase } from '../../hooks/useTripSearch';
import type { AgentStep, SearchSuggestion } from '../../types/agent';
import type { TravelPreferences } from '../../types/travel';
import { SearchBox } from '../Search/SearchBox';
import { StepList, ThinkingIndicator } from '../AgentActivity/AgentActivity';
import { Icon } from '../Icon/Icon';
import './Chat.css';

interface Props {
  messages: ChatMessage[];
  phase: SearchPhase;
  steps: AgentStep[];
  revealedSteps: number;
  onSend: (text: string) => void;
  onApplySuggestion: (preferences: TravelPreferences, suggestion: SearchSuggestion) => void;
  onReset: () => void;
}

function AssistantAvatar() {
  return (
    <span className="avatar" aria-hidden="true">
      <Icon name="sparkle" size={16} />
    </span>
  );
}

export function ConversationPanel({ messages, phase, steps, revealedSteps, onSend, onApplySuggestion, onReset }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const busy = phase === 'thinking' || phase === 'revealing';
  const lastAssistantIndex = messages.findLastIndex((m) => m.role === 'assistant');

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages.length, phase, revealedSteps]);

  return (
    <section className="conversation card" aria-labelledby="conversation-title">
      <header className="conversation__header">
        <h2 id="conversation-title" className="conversation__title">
          Conversation
        </h2>
        {messages.length > 0 && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onReset}>
            <Icon name="refresh" size={16} /> New search
          </button>
        )}
      </header>

      <div className="conversation__thread" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation with TripSense">
        {messages.length === 0 && !busy && (
          <p className="conversation__empty">Describe your ideal trip. You can refine it as you go — for example “make it cheaper” or “what about Tenerife?”.</p>
        )}

        {messages.map((message, index) => {
          if (message.role === 'user') {
            return (
              <div key={message.id} className="msg msg--user fade-up">
                <p className="msg__bubble">{message.text}</p>
              </div>
            );
          }
          if (message.role === 'system') {
            return (
              <p key={message.id} className="msg msg--system fade-up">
                {message.text}
              </p>
            );
          }

          const isLatest = index === lastAssistantIndex && index === messages.length - 1;
          const revealing = isLatest && phase === 'revealing';
          const response = message.response;

          return (
            <div key={message.id} className={`msg msg--assistant fade-up${message.isError ? ' is-error' : ''}`}>
              <AssistantAvatar />
              <div className="msg__content">
                {revealing ? (
                  <div className="msg__bubble">
                    <StepList steps={steps} revealed={revealedSteps} />
                  </div>
                ) : (
                  <>
                    <div className="msg__bubble">
                      {message.isError && <Icon name="alert" size={16} className="msg__error-icon" />}
                      <p>{message.text}</p>
                      {response && response.changes.length > 0 && (
                        <ul className="msg__changes" aria-label="What changed">
                          {response.changes.map((change) => (
                            <li key={change.key}>
                              <Icon name="check" size={14} /> {change.label}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {isLatest && response && response.suggestions.length > 0 && (
                      <div className="msg__actions" aria-label="Ways to broaden your search">
                        {response.suggestions.map((s) => (
                          <button key={s.id} type="button" className="chip chip--action" onClick={() => onApplySuggestion(s.preferences, s)} disabled={busy}>
                            {s.label} <span className="muted">({s.resultCount})</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {isLatest && response && response.quickReplies.length > 0 && !busy && (
                      <div className="msg__actions" aria-label="Suggested follow-ups">
                        {response.quickReplies.map((reply) => (
                          <button key={reply} type="button" className="chip" onClick={() => onSend(reply)}>
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {phase === 'thinking' && (
          <div className="msg msg--assistant">
            <AssistantAvatar />
            <div className="msg__bubble">
              <ThinkingIndicator />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="conversation__input">
        <SearchBox
          variant="compact"
          onSubmit={onSend}
          busy={busy}
          label="Refine your search"
          placeholder={messages.length ? 'Refine your search…' : 'Describe your trip…'}
          submitLabel="Send"
        />
      </div>
    </section>
  );
}
