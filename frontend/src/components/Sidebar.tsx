import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SearchIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);
const CalendarIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const GridIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
);
const ChartIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);
const SignOutIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const NAV_LINKS = [
  { to: '/',           label: 'Search',      roles: ['ROLE_STUDENT', 'ROLE_FACULTY'], Icon: SearchIcon },
  { to: '/dashboard',  label: 'My Bookings', roles: ['ROLE_STUDENT', 'ROLE_FACULTY'], Icon: CalendarIcon },
  { to: '/admin',      label: 'Dashboard',   roles: ['ROLE_DEPT_ADMIN'],              Icon: GridIcon },
  { to: '/facilities', label: 'Analytics',   roles: ['ROLE_FACILITIES'],              Icon: ChartIcon },
];

const ROLE_LABEL: Record<string, string> = {
  ROLE_STUDENT:    'Student',
  ROLE_FACULTY:    'Faculty',
  ROLE_DEPT_ADMIN: 'Dept Admin',
  ROLE_FACILITIES: 'Facilities',
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/login'); };
  const visibleLinks = NAV_LINKS.filter(l => user && l.roles.includes(user.role));

  return (
    <aside style={{
      width: 220, minWidth: 220,
      background: '#2d3e50',
      height: '100vh',
      position: 'sticky', top: 0,
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '28px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: '#4ca8b0', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>CampusBook</span>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding: '8px 22px 6px' }}>
        <p style={{ color: '#4d6477', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
          Menu
        </p>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '2px 10px 0' }}>
        {visibleLinks.map(l => {
          const active = location.pathname === l.to;
          return (
            <Link
              key={l.to}
              to={l.to}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                color: active ? 'white' : '#8ca0b3',
                background: active ? 'rgba(76,168,176,0.18)' : 'transparent',
                fontWeight: active ? 600 : 400,
                fontSize: 13.5, textDecoration: 'none',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <span style={{ color: active ? '#4ca8b0' : '#5e7a8c', flexShrink: 0 }}>
                <l.Icon />
              </span>
              {l.label}
              {active && (
                <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#4ca8b0', flexShrink: 0 }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile */}
      {user && (
        <div style={{ padding: '14px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', background: '#4ca8b0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>
              {user.email[0]?.toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ color: 'white', fontSize: 12.5, fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </p>
              <p style={{ color: '#7a9ab0', fontSize: 11, margin: 0 }}>
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '7px 0',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, color: '#8ca0b3', fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <SignOutIcon />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
