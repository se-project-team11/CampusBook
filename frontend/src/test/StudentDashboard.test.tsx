import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { StudentDashboard } from '../pages/StudentDashboard';

// ⚠️  vi.mock() is hoisted — expose vi.fn() stubs only; configure in beforeEach.
vi.mock('../services/api', () => ({
  apiClient: {
    bookings:  { myBookings: vi.fn() },
    resources: { search: vi.fn() },
    waitlist:  { mine: vi.fn() },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'student@campus.edu', role: 'ROLE_STUDENT', token: 't' },
  }),
}));

vi.mock('../hooks/useCountdown', () => ({
  useCountdown: () => ({ minutes: 0, seconds: 0, expired: false, totalMs: 0 }),
}));

const BOOKINGS = [
  {
    booking_id: 'b1', resource_id: 'r1',
    slot_start: new Date(Date.now() + 2 * 3600000).toISOString(),
    slot_end:   new Date(Date.now() + 3 * 3600000).toISOString(),
    state: 'CONFIRMED', requires_approval: false, qr_token: 'qr1', expires_at: null,
  },
  {
    booking_id: 'b2', resource_id: 'r2',
    slot_start: new Date(Date.now() + 24 * 3600000).toISOString(),
    slot_end:   new Date(Date.now() + 25 * 3600000).toISOString(),
    state: 'RESERVED', requires_approval: true, qr_token: '', expires_at: null,
  },
  {
    booking_id: 'b3', resource_id: 'r1',
    slot_start: new Date(Date.now() - 4 * 3600000).toISOString(),
    slot_end:   new Date(Date.now() - 3 * 3600000).toISOString(),
    state: 'NO_SHOW', requires_approval: false, qr_token: '', expires_at: null,
  },
];
const RESOURCES = [
  { id: 'r1', name: 'Room 101',  type: 'STUDY_ROOM', location: 'Block A', capacity: 6,  amenities: [] },
  { id: 'r2', name: 'Seminar A', type: 'SEMINAR',    location: 'Block C', capacity: 40, amenities: [] },
];

describe('StudentDashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { apiClient } = await import('../services/api');
    (apiClient.bookings.myBookings as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: { bookings: BOOKINGS } });
    (apiClient.resources.search as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: RESOURCES });
    (apiClient.waitlist.mine as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: { entries: [] } });
  });

  function renderDashboard() {
    return render(<MemoryRouter><StudentDashboard /></MemoryRouter>);
  }

  it('shows loading spinner initially', async () => {
    const { apiClient } = await import('../services/api');
    const never = new Promise(() => {});
    (apiClient.bookings.myBookings  as ReturnType<typeof vi.fn>).mockReturnValue(never);
    (apiClient.resources.search     as ReturnType<typeof vi.fn>).mockReturnValue(never);
    (apiClient.waitlist.mine        as ReturnType<typeof vi.fn>).mockReturnValue(never);

    renderDashboard();
    // Spinner renders a <div role="status" aria-label="Loading">
    expect(document.querySelector('[role="status"]')).toBeTruthy();
  });

  it('renders page title after load', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('My Bookings')).toBeInTheDocument());
  });

  it('shows total bookings count (3)', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('shows active booking section', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Active Bookings')).toBeInTheDocument());
  });

  it('shows pending approval section when there are pending bookings', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Pending Approval')).toBeInTheDocument());
  });

  it('shows resource name in pending approval', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('Seminar A')).toBeInTheDocument());
  });

  it('shows history section', async () => {
    renderDashboard();
    // 'History' appears in both the stat-row and the card header → use getAllByText
    await waitFor(() => expect(screen.getAllByText('History').length).toBeGreaterThan(0));
  });

  it('shows waitlist section', async () => {
    renderDashboard();
    // 'Waitlist' appears in both the stat-row and the card header → use getAllByText
    await waitFor(() => expect(screen.getAllByText('Waitlist').length).toBeGreaterThan(0));
  });

  it('shows new booking link', async () => {
    renderDashboard();
    await waitFor(() => expect(screen.getByText('+ New Booking')).toBeInTheDocument());
  });
});
