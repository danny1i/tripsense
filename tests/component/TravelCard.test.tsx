// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TravelCard } from '../../src/components/TravelCard/TravelCard';
import { rankTrips } from '../../src/agent/ranking';
import { TRIPS } from '../../src/data/trips';
import { DESTINATIONS_BY_ID } from '../../src/data/destinations';

describe('<TravelCard>', () => {
  it('shows price, facts and why it matches, and opens the trip', async () => {
    const trip = TRIPS.find((t) => t.id === 'trip-001')!;
    const [ranked] = rankTrips([{ trip, destination: DESTINATIONS_BY_ID.get('tenerife')! }], { temperature: 'warm', month: 'November', beach: true }, 'November');
    const onView = vi.fn();
    render(<TravelCard ranked={ranked!} onView={onView} />);
    expect(screen.getByRole('heading', { name: 'Tenerife' })).toBeInTheDocument();
    expect(screen.getByText('£389')).toBeInTheDocument();
    expect(screen.getByText(/600m from beach/)).toBeInTheDocument();
    expect(screen.getByText(/Why this matches:/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /View trip/ }));
    expect(onView).toHaveBeenCalledWith('trip-001');
  });
});
