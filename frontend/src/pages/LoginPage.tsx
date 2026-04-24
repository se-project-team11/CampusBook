import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui/Spinner';
import type { UserRole } from '../types';

const ACCOUNTS = [
  { key: 'student', label: 'Student',         role: 'ROLE_STUDENT',    desc: 'Search & book resources' },
  { key: 'faculty', label: 'Faculty',          role: 'ROLE_FACULTY',    desc: 'Search & book resources' },
  { key: 'admin',   label: 'Dept Admin',       role: 'ROLE_DEPT_ADMIN', desc: 'View all bookings' },
  { key: 'staff',   label: 'Facilities Staff', role: 'ROLE_FACILITIES', desc: 'View all bookings' },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const handleLogin = async (account: string) => {
    setLoading(account);
    setError(null);
    try {
      const res = await apiClient.auth.login(account);
      login({
        id:    res.data.user_id,
        role:  res.data.role as UserRole,
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
    <div style={{
      minHeight: '100vh',
      background: '#dde3ed',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo mark */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52,
            background: '#2d3e50',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
            boxShadow: '0 4px 16px rgba(45,62,80,0.25)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1a2535', margin: 0, letterSpacing: '-0.4px' }}>CampusBook</h1>
          <p style={{ fontSize: 13, color: '#6b7a8d', margin: '5px 0 0' }}>Smart Campus Resource Booking</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'white',
          borderRadius: 20,
          padding: '28px 28px 22px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9aa5b4', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 16px' }}>
            Sign in as
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ACCOUNTS.map(acct => (
              <button
                key={acct.key}
                onClick={() => handleLogin(acct.key)}
                disabled={loading !== null}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 16px',
                  border: '1px solid #e8ecf0',
                  borderRadius: 14,
                  background: loading === acct.key ? '#f8fafc' : 'white',
                  cursor: loading !== null ? 'default' : 'pointer',
                  opacity: loading !== null && loading !== acct.key ? 0.55 : 1,
                  textAlign: 'left',
                  transition: 'border-color 0.15s, background 0.15s',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  if (loading === null) (e.currentTarget as HTMLButtonElement).style.borderColor = '#4ca8b0';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#e8ecf0';
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#1a2535', margin: 0 }}>{acct.label}</p>
                  <p style={{ fontSize: 12, color: '#9aa5b4', margin: '2px 0 0' }}>{acct.desc}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                    color: '#6b7a8d', background: '#f2f4f8',
                    padding: '3px 9px', borderRadius: 6,
                  }}>
                    {acct.role.replace('ROLE_', '')}
                  </span>
                  {loading === acct.key
                    ? <Spinner size="sm" />
                    : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa5b4" strokeWidth="2" strokeLinecap="round">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                    )
                  }
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div style={{
              marginTop: 14, background: '#fde8e3', border: '1px solid #f5c6b8',
              borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#c0402c',
            }}>
              {error}
            </div>
          )}

          <p style={{ textAlign: 'center', fontSize: 11, color: '#b0bac6', marginTop: 18, marginBottom: 0 }}>
            Development mode — no real credentials required
          </p>
        </div>
      </div>
    </div>
  );
}
