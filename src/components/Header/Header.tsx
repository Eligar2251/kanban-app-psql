import React, { memo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, ChevronRight, LayoutGrid, Code2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Avatar from '../Avatar/Avatar';
import InvitationsBanner from '../InvitationsBanner/InvitationsBanner';
import './Header.css';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface HeaderProps {
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
}

const Header = memo(function Header({ breadcrumbs, actions }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, logout } = useAuthStore();

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const handleProfile = useCallback(() => {
    navigate('/profile');
  }, [navigate]);

  const handleLogoClick = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleWorkspace = useCallback(() => {
    navigate('/workspace');
  }, [navigate]);

  const displayName = profile?.full_name || profile?.email || 'User';
  const isWorkspace = location.pathname === '/workspace';

  return (
    <header className="header">
      <div className="header-left">
        <button className="header-logo" onClick={handleLogoClick}>
          <LayoutGrid size={16} className="header-logo-icon" />
          <span className="header-logo-text">KANBAN</span>
        </button>

        {/* Navigation links */}
        <nav className="header-nav">
          <button
            className={`header-nav-link ${!isWorkspace && !breadcrumbs?.length ? 'header-nav-link--active' : ''}`}
            onClick={handleLogoClick}
          >
            Projects
          </button>
          <button
            className={`header-nav-link ${isWorkspace ? 'header-nav-link--active' : ''}`}
            onClick={handleWorkspace}
          >
            <Code2 size={12} />
            Workspace
          </button>
        </nav>

        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="header-breadcrumbs">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                <ChevronRight size={12} className="breadcrumb-sep" />
                {crumb.href ? (
                  <button
                    className="breadcrumb-link"
                    onClick={() => navigate(crumb.href!)}
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="breadcrumb-current">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>

      <div className="header-right">
        {actions && <div className="header-actions">{actions}</div>}

        <InvitationsBanner compact />

        <button className="header-profile-btn" onClick={handleProfile}>
          <Avatar
            name={displayName}
            userId={profile?.id}
            size="sm"
          />
          <span className="header-profile-name">{displayName}</span>
        </button>

        <button
          className="header-logout-btn"
          onClick={handleLogout}
          title="Sign out"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
});

export default Header;