import type { ReactNode } from 'react';
import type { Route } from '../../hooks/useHashRoute';
import type { Transport } from '../../services/apiClient';
import { Icon } from '../Icon/Icon';
import './Layout.css';

interface HeaderProps {
  route: Route;
  onNavigate: (route: Route) => void;
  hasSearch: boolean;
  transport: Transport | null;
  aiMode: 'demo' | 'llm' | null;
}

export function Header({ route, onNavigate, hasSearch, transport, aiMode }: HeaderProps) {
  const link = (target: Route, label: string, current: boolean) => (
    <a
      href={target.name === 'home' ? '#/' : `#/${target.name}`}
      className={`nav-link nav-link--${target.name}${current ? ' is-current' : ''}`}
      aria-current={current ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(target);
      }}
    >
      {label}
    </a>
  );

  const modeLabel = aiMode === 'llm' ? 'AI model connected' : 'Demo Mode';
  const transportLabel = transport === 'bff' ? 'via BFF API' : transport === 'in-browser' ? 'running in browser' : 'connecting…';

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a
          href="#/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            onNavigate({ name: 'home' });
          }}
        >
          <span className="brand__mark" aria-hidden="true">
            <Icon name="sun" size={18} />
          </span>
          <span className="brand__name">TripSense</span>
        </a>
        <nav aria-label="Main" className="site-nav">
          {link({ name: 'home' }, 'Home', route.name === 'home')}
          {hasSearch && link({ name: 'search' }, 'Results', route.name === 'search' || route.name === 'trip')}
          {link({ name: 'engineering' }, 'Engineering', route.name === 'engineering')}
        </nav>
        <p className="mode-pill" title={`${modeLabel} — ${transportLabel}`}>
          <span className={`mode-pill__dot${aiMode === 'llm' ? ' is-llm' : ''}`} aria-hidden="true" />
          <span>{modeLabel}</span>
          <span className="mode-pill__sub">{transportLabel}</span>
        </p>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <p>
          <strong>TripSense</strong> is a technical demonstration prototype.
        </p>
        <p className="muted">Demo travel data — prices and availability are illustrative.</p>
      </div>
    </footer>
  );
}

export function DemoNotice({ children }: { children?: ReactNode }) {
  return (
    <p className="demo-notice">
      <Icon name="info" size={16} />
      <span>{children ?? 'Demo travel data — prices and availability are illustrative.'}</span>
    </p>
  );
}
