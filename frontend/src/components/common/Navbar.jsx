import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMap, FiChevronRight, FiLogOut } from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from './ThemeToggle';

/**
 * Navbar -- top navigation bar with breadcrumbs and a logout button.
 * Dynamically builds breadcrumbs from the current route path.
 */
const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const getBreadcrumbs = () => {
    const parts = location.pathname.split('/').filter(Boolean);
    const crumbs = [];

    if (parts[0] === 'location-tool') {
      crumbs.push({ label: 'Location Tool', path: null });
    } else if (parts[0] === 'casting-tool') {
      crumbs.push({ label: 'Casting (Main)', path: null });
    } else if (parts[0] === 'background-casting-tool') {
      crumbs.push({ label: 'Casting (Background)', path: null });
    } else if (parts[0] === 'costume-tool') {
      crumbs.push({ label: 'Costume (Main)', path: null });
    } else if (parts[0] === 'background-costume-tool') {
      crumbs.push({ label: 'Costume (Background)', path: null });
    }

    return crumbs;
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-[var(--navbar-height)] px-5 bg-gradient-to-r from-slate-900 to-slate-800 shadow-md print-hide">
      <div className="flex items-center">
        <Link to="/" className="flex items-center gap-2 text-white font-bold no-underline hover:text-blue-300 transition-colors">
          <FiMap className="text-xl" />
          <span className="text-lg tracking-tight">Zillit</span>
        </Link>
      </div>

      <div className="flex items-center gap-1 text-sm text-slate-400">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && <FiChevronRight className="text-slate-500 mx-1" />}
            {crumb.path ? (
              <Link to={crumb.path} className="text-blue-400 hover:text-blue-300 no-underline hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-white font-medium">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user && (
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-300 bg-white/10 border border-white/20 rounded-lg cursor-pointer hover:bg-white/20 hover:text-white transition-all"
            onClick={handleLogout}
            title="Sign out"
          >
            <FiLogOut />
            <span>Logout</span>
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
