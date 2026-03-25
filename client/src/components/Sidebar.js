import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const roleTitle = user?.role ? `${user.role.charAt(0).toUpperCase()}${user.role.slice(1)}` : 'User';
  const initials = (user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
  ];

  if (user?.role === 'admin') {
    navItems.push(
      { to: '/resources', label: 'Resources', icon: '🏫' },
      { to: '/assignments', label: 'Assign Staff', icon: '👨‍🏫' },
      { to: '/approvals', label: 'Approvals', icon: '✅' },
      { to: '/student-activities', label: 'Student Activities', icon: '📋' },
      { to: '/calendar', label: 'Calendar', icon: '🗓️' },
      { to: '/students', label: 'Students', icon: '👨‍🎓' },
      { to: '/mentor-groups', label: 'Group Mentor & Mentees', icon: '🧑‍🤝‍🧑' },
      { to: '/exam-allocations', label: 'Exam Halls', icon: '🎓' },
      { to: '/saved-allocations', label: 'Seating Results', icon: '📋' },
      { to: '/audit-log', label: 'Audit Log', icon: '📜' },
      { to: '/messages', label: 'Messages', icon: '💬' }
    );
  }

  if (user?.role === 'staff') {
    navItems.push(
      { to: '/bookings', label: 'Bookings', icon: '📅' },
      { to: '/calendar', label: 'Calendar', icon: '🗓️' },
      { to: '/my-assignments', label: 'My Assignments', icon: '👨‍🏫' },
      { to: '/my-mentees', label: 'My Mentees', icon: '🧑‍🎓' },
      { to: '/student-activities', label: 'Student Activities', icon: '📋' },
      { to: '/messages', label: 'Messages', icon: '💬' }
    );
  }

  if (user?.role === 'student') {
    navItems.push(
      { to: '/my-activities', label: 'My Activities', icon: '📋' },
      { to: '/calendar', label: 'Calendar', icon: '🗓️' },
      { to: '/messages', label: 'Messages', icon: '💬' }
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Campus Hub</h2>
        <p>Resource Intelligence</p>
        <div className="portal-role">{roleTitle} Portal</div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'active' : '')}
            end={item.to === '/'}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{initials || 'U'}</div>
          <div>
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
