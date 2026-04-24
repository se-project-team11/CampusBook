import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

// useAuth MUST be a vi.fn() so individual tests can call mockReturnValueOnce on it.
vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'u1', email: 'student@campus.edu', role: 'ROLE_STUDENT', token: 't' },
    logout: mockLogout,
    login: vi.fn(),
    isRole: vi.fn(),
  })),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderSidebar() {
  return render(<MemoryRouter initialEntries={['/']}><Sidebar /></MemoryRouter>);
}

describe('Sidebar', () => {
  it('renders app name', () => {
    renderSidebar();
    expect(screen.getByText('CampusBook')).toBeInTheDocument();
  });

  it('shows Search link for ROLE_STUDENT', () => {
    renderSidebar();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('shows My Bookings link for ROLE_STUDENT', () => {
    renderSidebar();
    expect(screen.getByText('My Bookings')).toBeInTheDocument();
  });

  it('shows user email', () => {
    renderSidebar();
    expect(screen.getByText('student@campus.edu')).toBeInTheDocument();
  });

  it('shows role label', () => {
    renderSidebar();
    expect(screen.getByText('Student')).toBeInTheDocument();
  });

  it('calls logout and navigates on sign out', () => {
    renderSidebar();
    fireEvent.click(screen.getByText('Sign out'));
    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

describe('Sidebar — admin role', () => {
  it('shows Dashboard link for ROLE_DEPT_ADMIN', async () => {
    const { useAuth } = await import('../context/AuthContext');
    vi.mocked(useAuth).mockReturnValueOnce({
      user: { id: 'u2', email: 'admin@campus.edu', role: 'ROLE_DEPT_ADMIN', token: 't' },
      logout: mockLogout,
      login: vi.fn(),
      isRole: vi.fn(),
    } as any);
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
