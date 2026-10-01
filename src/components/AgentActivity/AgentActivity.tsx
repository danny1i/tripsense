import { useEffect, useState } from 'react';
import type { AgentStep } from '../../types/agent';
import { Icon } from '../Icon/Icon';
import './AgentActivity.css';

const THINKING_LABELS = ['Understanding your request…', 'Searching destinations…', 'Comparing options…', 'Preparing recommendations…'];

/** Shown while waiting for the agent: a calm, cycling status line. */
export function ThinkingIndicator() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => Math.min(i + 1, THINKING_LABELS.length - 1)), 700);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="thinking" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{THINKING_LABELS[index]}</span>
    </div>
  );
}

function StepIcon({ status, revealed }: { status: AgentStep['status']; revealed: boolean }) {
  if (!revealed) return <span className="step-icon step-icon--running" aria-hidden="true"><span className="spinner spinner--sm" /></span>;
  if (status === 'error') return <span className="step-icon step-icon--error" aria-hidden="true"><Icon name="alert" size={14} /></span>;
  return <span className="step-icon step-icon--done" aria-hidden="true"><Icon name="check" size={14} /></span>;
}

interface StepListProps {
  steps: AgentStep[];
  revealed: number;
  showTools?: boolean;
}

export function StepList({ steps, revealed, showTools = false }: StepListProps) {
  // Show the revealed steps plus the one currently "running".
  const visible = steps.slice(0, Math.min(steps.length, revealed + 1));
  return (
    <ol className="step-list">
      {visible.map((step, index) => {
        const isRevealed = index < revealed;
        return (
          <li key={step.id} className={`step${isRevealed ? ' is-done' : ' is-running'}${step.status === 'error' ? ' is-error' : ''}`}>
            <StepIcon status={step.status} revealed={isRevealed} />
            <span className="step__body">
              <span className="step__label">
                {step.label}
                {!isRevealed && '…'}
              </span>
              {isRevealed && step.detail && <span className="step__detail">{step.detail}</span>}
            </span>
            {showTools && isRevealed && (
              <code className="step__tool" title="Tool called">
                {step.tool}
              </code>
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface PanelProps {
  steps: AgentStep[];
  revealed: number;
  running: boolean;
  intentSource?: 'rules' | 'llm';
  telemetry?: { latencyMs: number; toolCalls: number; toolErrors: number };
  defaultOpen?: boolean;
}

/**
 * "Agent activity" — an expandable, high-level log of what the agent did.
 * It shows actions and tool names only, never hidden reasoning.
 */
export function AgentActivityPanel({ steps, revealed, running, intentSource, telemetry, defaultOpen = false }: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const done = !running && revealed >= steps.length;
  const tools = new Set(steps.map((s) => s.tool)).size;

  if (steps.length === 0) return null;

  return (
    <section className={`agent-panel card${open ? ' is-open' : ''}`} aria-label="Agent activity">
      <button type="button" className="agent-panel__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className={`agent-panel__status${done ? ' is-done' : ''}`} aria-hidden="true">
          {done ? <Icon name="check" size={14} /> : <span className="spinner spinner--sm" />}
        </span>
        <span className="agent-panel__title">Agent activity</span>
        <span className="agent-panel__summary">
          {done ? `${steps.length} steps · ${tools} tools` : 'Working…'}
          {done && telemetry ? ` · ${telemetry.latencyMs} ms` : ''}
        </span>
        <Icon name="chevronDown" size={20} className="agent-panel__chevron" />
      </button>
      {open && (
        <div className="agent-panel__body">
          <StepList steps={steps} revealed={revealed} showTools />
          <p className="agent-panel__note">
            High-level actions only. Intent read by {intentSource === 'llm' ? 'the AI model' : 'built-in rules (Demo Mode)'}
            {telemetry && telemetry.toolErrors > 0 ? ` · ${telemetry.toolErrors} non-critical step failed and was skipped` : ''}.
          </p>
        </div>
      )}
    </section>
  );
}
