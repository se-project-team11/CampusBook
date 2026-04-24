import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../router/ProtectedRoute';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

function renderRoute(content: React.ReactNode, initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/protected" element={content} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no logged-in user', async () => {
    const { useAuth } = await import('../context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({ user: null, login: vi.fn(), logout: vi.fn(), isRole: vi.fn() });

    renderRoute(
      <ProtectedRoute><div>Secret</div></ProtectedRoute>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).toBeNull();
  });

  it('renders children when user is authenticated', async () => {
    const { useAuth } = await import('../context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', role: 'ROLE_STUDENT', token: 't' },
      login: vi.fn(), logout: vi.fn(), isRole: vi.fn(),
    });

    renderRoute(
      <ProtectedRoute><div>Secret</div></ProtectedRoute>
    );
    expect(screen.getByText('Secret')).toBeInTheDocument();
  });

  it('renders children when role matches allowedRoles', async () => {
    const { useAuth } = await import('../context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', role: 'ROLE_DEPT_ADMIN', token: 't' },
      login: vi.fn(), logout: vi.fn(), isRole: vi.fn(),
    });

    renderRoute(
      <ProtectedRoute allowedRoles={['ROLE_DEPT_ADMIN' as any]}><div>Admin area</div></ProtectedRoute>
    );
    expect(screen.getByText('Admin area')).toBeInTheDocument();
  });

  it('shows Access Denied when role is not in allowedRoles', async () => {
    const { useAuth } = await import('../context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', role: 'ROLE_STUDENT', token: 't' },
      login: vi.fn(), logout: vi.fn(), isRole: vi.fn(),
    });

    renderRoute(
      <ProtectedRoute allowedRoles={['ROLE_DEPT_ADMIN' as any]}><div>Admin area</div></ProtectedRoute>
    );
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Admin area')).toBeNull();
  });

  it('displays the user role in the Access Denied message', async () => {
    const { useAuth } = await import('../context/AuthContext');
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'u1', email: 'a@b.com', role: 'ROLE_STUDENT', token: 't' },
      login: vi.fn(), logout: vi.fn(), isRole: vi.fn(),
    });

    renderRoute(
      <ProtectedRoute allowedRoles={['ROLE_DEPT_ADMIN' as any]}><div>x</div></ProtectedRoute>
    );
    expect(screen.getByText(/STUDENT/)).toBeInTheDocument();
  });
});
