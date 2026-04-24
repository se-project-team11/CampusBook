import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResourceDetailPage } from '../pages/ResourceDetailPage';

// ⚠️  vi.mock() hoisted — use bare stubs only
vi.mock('../services/api', () => ({
  apiClient: {
    resources:    { getById: vi.fn() },
    availability: { slots: vi.fn() },
    bookings:     { create: vi.fn() },
    waitlist:     { join: vi.fn() },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/useResourceSocket', () => ({
  useResourceSocket: vi.fn(),
}));

const RESOURCE = {
  id: 'r1', name: 'Room 101', type: 'STUDY_ROOM',
  location: 'Block A', capacity: 6, amenities: ['Projector'],
};

function renderDetail(locationState?: unknown, path = '/resources/r1') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state: { resource: locationState } }]}>
      <Routes>
        <Route path="/resources/:id" element={<ResourceDetailPage />} />
        <Route path="/" element={<div>Search</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ResourceDetailPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useAuth } = await import('../context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', role: 'ROLE_STUDENT', token: 't' },
      login: vi.fn(), logout: vi.fn(), isRole: vi.fn(),
    });

    const { apiClient } = await import('../services/api');
    (apiClient.availability.slots as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: { slots: [] } });
  });

  it('shows loading spinner when resource is not yet available', async () => {
    const { apiClient } = await import('../services/api');
    // Make the fetch hang so it stays in loading state
    (apiClient.resources.getById as ReturnType<typeof vi.fn>)
      .mockReturnValue(new Promise(() => {}));

    // Render without location state so it must fetch
    render(
      <MemoryRouter initialEntries={[{ pathname: '/resources/r1', state: {} }]}>
        <Routes>
          <Route path="/resources/:id" element={<ResourceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    expect(document.querySelector('[role="status"]')).toBeTruthy();
  });

  it('shows resource name when passed via location state', async () => {
    renderDetail(RESOURCE);
    await waitFor(() => expect(screen.getByText('Room 101')).toBeInTheDocument());
  });

  it('shows resource location', async () => {
    renderDetail(RESOURCE);
    await waitFor(() => expect(screen.getByText('Block A')).toBeInTheDocument());
  });

  it('shows capacity', async () => {
    renderDetail(RESOURCE);
    await waitFor(() => expect(screen.getByText('6')).toBeInTheDocument());
  });

  it('shows amenities', async () => {
    renderDetail(RESOURCE);
    await waitFor(() => expect(screen.getByText(/Projector/)).toBeInTheDocument());
  });

  it('shows Back to search button', async () => {
    renderDetail(RESOURCE);
    await waitFor(() => expect(screen.getByText('Back to search')).toBeInTheDocument());
  });

  it('shows "Resource not found" when fetch fails', async () => {
    const { apiClient } = await import('../services/api');
    (apiClient.resources.getById as ReturnType<typeof vi.fn>)
      .mockRejectedValue(new Error('Not found'));

    render(
      <MemoryRouter initialEntries={[{ pathname: '/resources/bad', state: {} }]}>
        <Routes>
          <Route path="/resources/:id" element={<ResourceDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText('Resource not found.')).toBeInTheDocument());
  });

  it('shows admin restriction notice for non-bookable roles', async () => {
    const { useAuth } = await import('../context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u2', email: 'a@b.com', role: 'ROLE_DEPT_ADMIN', token: 't' },
      login: vi.fn(), logout: vi.fn(), isRole: vi.fn(),
    });

    renderDetail(RESOURCE);
    await waitFor(() =>
      expect(screen.getByText(/Only students and faculty can book/)).toBeInTheDocument()
    );
  });
});
