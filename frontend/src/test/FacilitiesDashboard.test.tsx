import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FacilitiesDashboard } from '../pages/FacilitiesDashboard';

// ⚠️  vi.mock() is hoisted — use only bare vi.fn() stubs here.
// Configure them in beforeEach after import, to avoid the
// "Cannot access variable before initialization" hoisting error.
vi.mock('../services/api', () => ({
  apiClient: {
    analytics: {
      utilization: vi.fn(),
      heatmap:     vi.fn(),
    },
  },
}));

const UTILIZATION_DATA = {
  data: {
    resources: [
      { resource_id: 'r1', resource_name: 'Room 101', total: 10, no_show: 2, confirmed: 6, checked_in: 2, no_show_rate: 20.0 },
      { resource_id: 'r2', resource_name: 'Lab A',    total: 5,  no_show: 0, confirmed: 4, checked_in: 1, no_show_rate: 0.0  },
    ],
  },
};
const HEATMAP_DATA = {
  data: {
    cells: Array.from({ length: 7 }, () => Array(14).fill(0)),
    peak: 5,
  },
};

describe('FacilitiesDashboard', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { apiClient } = await import('../services/api');
    (apiClient.analytics.utilization as ReturnType<typeof vi.fn>).mockResolvedValue(UTILIZATION_DATA);
    (apiClient.analytics.heatmap     as ReturnType<typeof vi.fn>).mockResolvedValue(HEATMAP_DATA);
  });

  it('shows loading spinner initially', async () => {
    const { apiClient } = await import('../services/api');
    // Never-resolving promises keep loading === true during the synchronous assertion
    const never = new Promise(() => {});
    (apiClient.analytics.utilization as ReturnType<typeof vi.fn>).mockReturnValue(never);
    (apiClient.analytics.heatmap     as ReturnType<typeof vi.fn>).mockReturnValue(never);

    render(<FacilitiesDashboard />);
    // Spinner renders a <div role="status" aria-label="Loading">
    expect(document.querySelector('[role="status"]')).toBeTruthy();
  });

  it('renders page title after load', async () => {
    render(<FacilitiesDashboard />);
    await waitFor(() => expect(screen.getByText('Facilities Analytics')).toBeInTheDocument());
  });

  it('renders total bookings count (10 + 5 = 15)', async () => {
    render(<FacilitiesDashboard />);
    await waitFor(() => expect(screen.getByText('15')).toBeInTheDocument());
  });

  it('renders no-show rate', async () => {
    render(<FacilitiesDashboard />);
    await waitFor(() => expect(screen.getByText('13.3%')).toBeInTheDocument());
  });

  it('renders resource names in breakdown', async () => {
    render(<FacilitiesDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Room 101')).toBeInTheDocument();
      expect(screen.getByText('Lab A')).toBeInTheDocument();
    });
  });

  it('renders heatmap day labels', async () => {
    render(<FacilitiesDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
    });
  });

  it('renders Confirmed Rate card', async () => {
    render(<FacilitiesDashboard />);
    await waitFor(() => expect(screen.getByText('Confirmed Rate')).toBeInTheDocument());
  });

  it('renders Booking Density heading', async () => {
    render(<FacilitiesDashboard />);
    await waitFor(() => expect(screen.getByText('Booking Density')).toBeInTheDocument());
  });
});
