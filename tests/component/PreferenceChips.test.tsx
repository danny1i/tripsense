// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferenceChips } from '../../src/components/Preferences/PreferenceChips';

describe('<PreferenceChips>', () => {
  it('shows active preferences and lets the user remove one', async () => {
    const onRemove = vi.fn();
    render(<PreferenceChips preferences={{ temperature: 'warm', durationDays: 4, month: 'November', budgetLevel: 'low' }} onRemove={onRemove} />);
    expect(screen.getByRole('list', { name: 'Your current preferences' })).toBeInTheDocument();
    for (const label of ['Warm destination', '4 days', 'November', 'Budget-friendly']) expect(screen.getByText(label)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove November' }));
    expect(onRemove).toHaveBeenCalledWith('month');
  });

  it('renders nothing without preferences', () => {
    const { container } = render(<PreferenceChips preferences={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
