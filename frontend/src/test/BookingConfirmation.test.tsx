import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { BookingConfirmation } from '../pages/BookingConfirmation';

vi.mock('../hooks/useCountdown', () => ({
  useCountdown: () => ({ minutes: 4, seconds: 0, expired: false, totalMs: 240000 }),
}));

// Suppress qrcode.react from crashing in jsdom (canvas not supported)
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="qr-code" data-value={value} />,
}));

const future = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const confirmedBooking = {
  booking_id: 'b1',
  resource_id: 'r1',
  slot_start: future(1),
  slot_end:   future(2),
  state: 'CONFIRMED',
  requires_approval: false,
  qr_token: 'QR_TOKEN_XYZ',
  expires_at: null,
};

const reservedBooking = {
  ...confirmedBooking,
  booking_id: 'b2',
  state: 'RESERVED',
  qr_token: '',
};

const mockResource = {
  id: 'r1', name: 'Room 101', type: 'STUDY_ROOM',
  location: 'Block A', capacity: 6, amenities: [],
};

function renderPage(locationState: Record<string, unknown>) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/confirmation', state: locationState }]}
    >
      <BookingConfirmation />
    </MemoryRouter>
  );
}

describe('BookingConfirmation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows fallback when no booking state is provided', () => {
    renderPage({});
    expect(screen.getByText('No booking data found.')).toBeInTheDocument();
    expect(screen.getByText('Back to search')).toBeInTheDocument();
  });

  it('shows "Booking Confirmed!" for a CONFIRMED booking', () => {
    renderPage({ booking: confirmedBooking, resource: mockResource });
    expect(screen.getByText('Booking Confirmed!')).toBeInTheDocument();
  });

  it('shows "Awaiting Approval" for a RESERVED booking', () => {
    renderPage({ booking: reservedBooking, resource: mockResource });
    expect(screen.getByText('Awaiting Approval')).toBeInTheDocument();
  });

  it('shows the resource name in the booking card', () => {
    renderPage({ booking: confirmedBooking, resource: mockResource });
    expect(screen.getByText('Room 101')).toBeInTheDocument();
  });

  it('falls back to "Resource" when no resource object is provided', () => {
    renderPage({ booking: confirmedBooking });
    expect(screen.getByText('Resource')).toBeInTheDocument();
  });

  it('renders QR code for a CONFIRMED booking', () => {
    renderPage({ booking: confirmedBooking, resource: mockResource });
    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
  });

  it('does NOT render QR code for a RESERVED (pending) booking', () => {
    renderPage({ booking: reservedBooking, resource: mockResource });
    expect(screen.queryByTestId('qr-code')).toBeNull();
  });

  it('shows "Approval required" notice for a RESERVED booking', () => {
    renderPage({ booking: reservedBooking, resource: mockResource });
    expect(screen.getByText('Approval required')).toBeInTheDocument();
  });

  it('shows My Bookings and Book Another links', () => {
    renderPage({ booking: confirmedBooking, resource: mockResource });
    expect(screen.getByText('My Bookings')).toBeInTheDocument();
    expect(screen.getByText('Book Another')).toBeInTheDocument();
  });

  it('shows the booking status row', () => {
    renderPage({ booking: confirmedBooking, resource: mockResource });
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
  });
});
