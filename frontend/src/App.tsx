import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './router/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import { LoginPage }           from './pages/LoginPage';
import { SearchPage }          from './pages/SearchPage';
import { ResourceDetailPage }  from './pages/ResourceDetailPage';
import { BookingConfirmation } from './pages/BookingConfirmation';
import { StudentDashboard }    from './pages/StudentDashboard';
import { AdminDashboard }      from './pages/AdminDashboard';
import { FacilitiesDashboard } from './pages/FacilitiesDashboard';
import type { ReactNode } from 'react';

function Layout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#dde3ed' }}>
      <Sidebar />
      <main style={{ flex: 1, overflowX: 'hidden' }}>{children}</main>
    </div>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'ROLE_DEPT_ADMIN') return <Navigate to="/admin" replace />;
  if (user?.role === 'ROLE_FACILITIES') return <Navigate to="/facilities" replace />;
  return <Layout><SearchPage /></Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={
        <ProtectedRoute>
          <HomeRedirect />
        </ProtectedRoute>
      } />

      <Route path="/resources/:id" element={
        <ProtectedRoute>
          <Layout><ResourceDetailPage /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/confirmation" element={
        <ProtectedRoute allowedRoles={['ROLE_STUDENT', 'ROLE_FACULTY']}>
          <Layout><BookingConfirmation /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['ROLE_STUDENT', 'ROLE_FACULTY']}>
          <Layout><StudentDashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['ROLE_DEPT_ADMIN']}>
          <Layout><AdminDashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="/facilities" element={
        <ProtectedRoute allowedRoles={['ROLE_FACILITIES']}>
          <Layout><FacilitiesDashboard /></Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
