import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavLink {
  to: string;
  label: string;
  roles: string[];
}

const NAV_LINKS: NavLink[] = [
  { to: '/',           label: 'Search',      roles: ['ROLE_STUDENT', 'ROLE_FACULTY', 'ROLE_FACILITIES'] },
  { to: '/dashboard',  label: 'My Bookings', roles: ['ROLE_STUDENT', 'ROLE_FACULTY'] },
  { to: '/admin',      label: 'Dashboard',   roles: ['ROLE_DEPT_ADMIN'] },
  { to: '/facilities', label: 'Analytics',   roles: ['ROLE_FACILITIES'] },
];

const ROLE_LABEL: Record<string, string> = {
  ROLE_STUDENT:    'Student',
  ROLE_FACULTY:    'Faculty',
  ROLE_DEPT_ADMIN: 'Admin',
  ROLE_FACILITIES: 'Facilities',
};

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleLinks = NAV_LINKS.filter(l => user && l.roles.includes(user.role));

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
      <div className="max-w-6xl mx-auto px-5 h-15 flex items-center justify-between" style={{ height: '3.75rem' }}>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-bold text-brand-700 text-base tracking-tight shrink-0">
          <span className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
            CB
          </span>
          CampusBook
        </Link>

        {/* Nav links */}
        {user && (
          <div className="flex items-center gap-0.5">
            {visibleLinks.map(l => {
              const active = location.pathname === l.to;
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-brand-50 text-brand-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* User info */}
        {user && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-gray-700 leading-tight">{user.email}</span>
              <span className="text-xs text-brand-600 font-medium">{ROLE_LABEL[user.role] ?? user.role}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold uppercase">
              {user.email[0]}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-medium text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
