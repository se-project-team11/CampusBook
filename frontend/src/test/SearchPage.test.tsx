import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SearchPage } from '../pages/SearchPage';

// ⚠️  vi.mock() hoisted — use bare stubs only
vi.mock('../services/api', () => ({
  apiClient: {
    resources: { search: vi.fn() },
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.com', role: 'ROLE_STUDENT', token: 't' },
  }),
}));

const RESOURCES = [
  { id: 'r1', name: 'Room 101', type: 'STUDY_ROOM', location: 'Block A', capacity: 6, amenities: [] },
  { id: 'r2', name: 'Lab A',    type: 'LAB',        location: 'Block B', capacity: 20, amenities: [] },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/resources/:id" element={<div>Resource Detail</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SearchPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { apiClient } = await import('../services/api');
    (apiClient.resources.search as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ data: RESOURCES });
  });

  it('renders the page heading', async () => {
    renderPage();
    expect(screen.getByText('Find a Resource')).toBeInTheDocument();
  });

  it('renders the subtitle', () => {
    renderPage();
    expect(screen.getByText(/Search and book campus study rooms/)).toBeInTheDocument();
  });

  it('renders resource cards after load', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Room 101')).toBeInTheDocument());
    expect(screen.getByText('Lab A')).toBeInTheDocument();
  });
});
