import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui/Spinner';
import type { UserRole } from '../types';

const ACCOUNTS = [
  { key: 'student', label: 'Student',          role: 'ROLE_STUDENT',    desc: 'Search & book resources' },
  { key: 'faculty', label: 'Faculty',           role: 'ROLE_FACULTY',    desc: 'Search & book resources' },
  { key: 'admin',   label: 'Dept Admin',        role: 'ROLE_DEPT_ADMIN', desc: 'View all bookings' },
  { key: 'staff',   label: 'Facilities Staff',  role: 'ROLE_FACILITIES', desc: 'View all bookings' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (account: string) => {
    setLoading(account);
    setError(null);
    try {
      const res = await apiClient.auth.login(account);
      login({
        id: res.data.user_id,
        role: res.data.role as UserRole,
        email: res.data.email,
        token: res.data.access_token,
      });
      navigate('/');
    } catch {
      setError('Login failed. Make sure the API server is running.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏫</div>
          <h1 className="text-3xl font-bold text-gray-900">CampusBook</h1>
          <p className="text-gray-500 mt-2">Smart Campus Resource Booking</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Sign in as
          </h2>

          <div className="space-y-3">
            {ACCOUNTS.map(acct => (
              <button
                key={acct.key}
                onClick={() => handleLogin(acct.key)}
                disabled={loading !== null}
                className="w-full flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 hover:border-brand-400 hover:bg-brand-50 transition-all disabled:opacity-50 text-left group"
              >
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{acct.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{acct.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 group-hover:bg-brand-100 text-gray-600 group-hover:text-brand-700 px-2 py-0.5 rounded-full font-medium transition-colors">
                    {acct.role.replace('ROLE_', '')}
                  </span>
                  {loading === acct.key
                    ? <Spinner size="sm" />
                    : <span className="text-gray-400 group-hover:text-brand-500 transition-colors">→</span>
                  }
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-5">
            Development mode — no real credentials required
          </p>
        </div>
      </div>
    </div>
  );
}
