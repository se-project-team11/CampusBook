import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ActiveBookingCard } from '../components/ActiveBookingCard';

vi.mock('../services/api', () => ({
  apiClient: {
    bookings: { cancel: vi.fn() },
  },
}));

vi.mock('../hooks/useCountdown', () => ({
  useCountdown: () => ({ minutes: 4, seconds: 30, expired: false, totalMs: 270000 }),
}));

const future = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const confirmedBooking = {
  booking_id: 'b1',
  resource_id: 'r1',
  slot_start: future(1),
  slot_end:   future(2),
  state: 'CONFIRMED' as const,
  requires_approval: false,
  qr_token: 'TOKEN_ABC',
  expires_at: null,
};

function renderCard(overrides = {}, resourceName = 'Room 101') {
  const onCancelled = vi.fn();
  render(
    <MemoryRouter>
      <ActiveBookingCard
        booking={{ ...confirmedBooking, ...overrides }}
        resourceName={resourceName}
        onCancelled={onCancelled}
      />
    </MemoryRouter>
  );
  return { onCancelled };
}

describe('ActiveBookingCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the resource name', () => {
    renderCard();
    expect(screen.getByText('Room 101')).toBeInTheDocument();
  });

  it('renders the booking state badge', () => {
    renderCard();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });

  it('renders QR button', () => {
    renderCard();
    expect(screen.getByText('QR')).toBeInTheDocument();
  });

  it('shows Cancel button for CONFIRMED bookings', () => {
    renderCard();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not show Cancel button for CHECKED_IN bookings', () => {
    renderCard({ state: 'CHECKED_IN' });
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('shows confirm dialog when Cancel is clicked', () => {
    renderCard();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Cancel this booking?')).toBeInTheDocument();
    expect(screen.getByText('Yes, cancel')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it('hides confirm dialog when Keep is clicked', () => {
    renderCard();
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Keep'));
    expect(screen.queryByText('Cancel this booking?')).toBeNull();
  });

  it('calls apiClient.bookings.cancel and onCancelled on confirm', async () => {
    const { apiClient } = await import('../services/api');
    (apiClient.bookings.cancel as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const { onCancelled } = renderCard();
    fireEvent.click(screen.getByText('Cancel'));
    fireEvent.click(screen.getByText('Yes, cancel'));

    await waitFor(() => expect(apiClient.bookings.cancel).toHaveBeenCalledWith('b1'));
    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
  });
});
