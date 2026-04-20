import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-bold text-brand-600 text-lg tracking-tight">
          CampusBook
        </Link>

        {user && (
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-gray-600 hover:text-brand-600 font-medium transition-colors"
            >
              My Bookings
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full font-medium">
                {user.role.replace('ROLE_', '')}
              </span>
              <span className="text-sm text-gray-700">{user.email}</span>
            </div>
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
