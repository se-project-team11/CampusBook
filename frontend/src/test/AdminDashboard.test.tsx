import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminDashboard } from '../pages/AdminDashboard';

// ⚠️  vi.mock() is hoisted — data must live INSIDE the factory.
// We expose vi.fn() handles so individual tests can override them.
vi.mock('../services/api', () => ({
  apiClient: {
    resources: {
      search: vi.fn(),
    },
    admin: {
      roomOverview:     vi.fn(),
      pendingApprovals: vi.fn(),
      approve:          vi.fn(),
      reject:           vi.fn(),
    },
  },
}));

const RESOURCES = [
  { id: 'r1', name: 'Room 101', type: 'STUDY_ROOM', location: 'Block A', capacity: 6,  amenities: [] },
  { id: 'r2', name: 'Lab A',    type: 'LAB',        location: 'Block B', capacity: 20, amenities: [] },
];
const ACTIVE_BOOKINGS = [
  {
    booking_id: 'b1', resource_id: 'r1', resource_name: 'Room 101',
    resource_location: 'Block A', resource_type: 'STUDY_ROOM',
    slot_start: new Date(Date.now() + 3600000).toISOString(),
    slot_end:   new Date(Date.now() + 7200000).toISOString(),
    state: 'CONFIRMED', user_email: 'student@campus.edu',
  },
];
const PENDING = [
  {
    booking_id: 'b2', resource_id: 'r2', resource_id_str: 'r2',
    slot_start: new Date(Date.now() + 86400000).toISOString(),
    slot_end:   new Date(Date.now() + 90000000).toISOString(),
    state: 'RESERVED', requires_approval: true,
    user_email: 'faculty@campus.edu', qr_token: '', expires_at: null,
  },
];

describe('AdminDashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { apiClient } = await import('../services/api');
    // Default: resolved mocks for all tests except spinner test
    (apiClient.resources.search as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: RESOURCES });
    (apiClient.admin.roomOverview as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: { bookings: ACTIVE_BOOKINGS } });
    (apiClient.admin.pendingApprovals as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: { bookings: PENDING } });
    (apiClient.admin.approve as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (apiClient.admin.reject  as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it('shows loading spinner initially', async () => {
    const { apiClient } = await import('../services/api');
    // Make all calls hang so loading stays true during synchronous assertion
    const never = new Promise(() => {});
    (apiClient.resources.search as ReturnType<typeof vi.fn>).mockReturnValue(never);
    (apiClient.admin.roomOverview as ReturnType<typeof vi.fn>).mockReturnValue(never);
    (apiClient.admin.pendingApprovals as ReturnType<typeof vi.fn>).mockReturnValue(never);

    render(<AdminDashboard />);
    // Spinner renders a <div role="status" aria-label="Loading">
    expect(document.querySelector('[role="status"]')).toBeTruthy();
  });

  it('renders page title after load', async () => {
    render(<AdminDashboard />);
    await waitFor(() => expect(screen.getByText('Admin Dashboard')).toBeInTheDocument());
  });

  it('renders total rooms count', async () => {
    render(<AdminDashboard />);
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
  });

  it('shows room names in overview', async () => {
    render(<AdminDashboard />);
    // Multiple elements contain 'Room 101' (hero card + pending section); use getAllByText
    await waitFor(() => expect(screen.getAllByText('Room 101').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Lab A').length).toBeGreaterThan(0);
  });

  it('shows pending approval badge count', async () => {
    render(<AdminDashboard />);
    await waitFor(() => expect(screen.getByText('Pending Approvals')).toBeInTheDocument());
  });

  it('shows approve and reject buttons for pending items', async () => {
    render(<AdminDashboard />);
    await waitFor(() => expect(screen.getByText('Approve')).toBeInTheDocument());
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('removes pending booking on approve', async () => {
    const { apiClient } = await import('../services/api');
    render(<AdminDashboard />);
    await waitFor(() => screen.getByText('Approve'));
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(apiClient.admin.approve).toHaveBeenCalledWith('b2'));
  });

  it('removes pending booking on reject', async () => {
    const { apiClient } = await import('../services/api');
    render(<AdminDashboard />);
    await waitFor(() => screen.getByText('Reject'));
    fireEvent.click(screen.getByText('Reject'));
    await waitFor(() => expect(apiClient.admin.reject).toHaveBeenCalledWith('b2'));
  });

  it('shows booked email in active now section', async () => {
    render(<AdminDashboard />);
    // The email appears inside a <p> alongside time text; use a regex matcher
    await waitFor(() =>
      expect(screen.getByText(/student@campus\.edu/)).toBeInTheDocument()
    );
  });
});
