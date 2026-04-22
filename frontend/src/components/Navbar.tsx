import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavLink {
  to: string;
  label: string;
  roles: string[];
}

const NAV_LINKS: NavLink[] = [
  { to: '/',           label: 'Search',     roles: ['ROLE_STUDENT', 'ROLE_FACULTY', 'ROLE_FACILITIES'] },
  { to: '/dashboard',  label: 'My Bookings', roles: ['ROLE_STUDENT', 'ROLE_FACULTY'] },
  { to: '/admin',      label: 'Dashboard',  roles: ['ROLE_DEPT_ADMIN'] },
  { to: '/facilities', label: 'Analytics',  roles: ['ROLE_FACILITIES'] },
];

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
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-brand-600 text-lg tracking-tight">
          CampusBook
        </Link>

        {user && (
          <div className="flex items-center gap-1">
            {visibleLinks.map(l => (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === l.to
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        )}

        {user && (
          <div className="flex items-center gap-3">
            <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full font-medium hidden sm:block">
              {user.role.replace('ROLE_', '')}
            </span>
            <span className="text-sm text-gray-700 hidden sm:block">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
