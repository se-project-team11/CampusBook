import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage } from '../pages/LoginPage';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../services/api', () => ({
  apiClient: {
    auth: {
      login: vi.fn().mockResolvedValue({
        data: { access_token: 'tok', role: 'ROLE_STUDENT', email: 'student@campus.edu', user_id: 'u1' },
      }),
    },
  },
}));

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

describe('LoginPage', () => {
  beforeEach(() => { mockLogin.mockClear(); mockNavigate.mockClear(); });

  it('renders app title', () => {
    renderLogin();
    expect(screen.getByText('CampusBook')).toBeInTheDocument();
  });

  it('renders all four account buttons', () => {
    renderLogin();
    expect(screen.getByText('Student')).toBeInTheDocument();
    expect(screen.getByText('Faculty')).toBeInTheDocument();
    expect(screen.getByText('Dept Admin')).toBeInTheDocument();
    expect(screen.getByText('Facilities Staff')).toBeInTheDocument();
  });

  it('shows role badges', () => {
    renderLogin();
    expect(screen.getByText('STUDENT')).toBeInTheDocument();
    expect(screen.getByText('FACULTY')).toBeInTheDocument();
    expect(screen.getByText('DEPT_ADMIN')).toBeInTheDocument();
    expect(screen.getByText('FACILITIES')).toBeInTheDocument();
  });

  it('shows development mode notice', () => {
    renderLogin();
    expect(screen.getByText(/Development mode/i)).toBeInTheDocument();
  });

  it('calls login and navigates on successful auth', async () => {
    renderLogin();
    fireEvent.click(screen.getByText('Student'));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({
      id: 'u1', role: 'ROLE_STUDENT', email: 'student@campus.edu', token: 'tok',
    }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('shows error message on API failure', async () => {
    const { apiClient } = await import('../services/api');
    vi.mocked(apiClient.auth.login).mockRejectedValueOnce(new Error('Network error'));
    renderLogin();
    fireEvent.click(screen.getByText('Student'));
    await waitFor(() => expect(screen.getByText(/Login failed/i)).toBeInTheDocument());
  });
});
