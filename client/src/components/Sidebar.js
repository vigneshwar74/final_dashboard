import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
      { to: '/exam-allocations', label: 'Exam Halls', icon: '🎓' },
      { to: '/occupancy', label: 'Occupancy', icon: '📍' },
      { to: '/feedback', label: 'Feedback', icon: '⭐' },
      { to: '/audit-log', label: 'Audit Log', icon: '📜' },
      { to: '/messages', label: 'Messages', icon: '💬' }
    );
  }

  if (user?.role === 'staff') {
    navItems.push(
      { to: '/bookings', label: 'Bookings', icon: '📅' },
      { to: '/calendar', label: 'Calendar', icon: '🗓️' },
      { to: '/my-assignments', label: 'My Assignments', icon: '👨‍🏫' },
      { to: '/student-activities', label: 'Student Activities', icon: '📋' },
      { to: '/occupancy', label: 'Occupancy', icon: '📍' },
      { to: '/feedback', label: 'Feedback', icon: '⭐' },
      { to: '/messages', label: 'Messages', icon: '💬' }
    );
  }

  if (user?.role === 'student') {
    navItems.push(
      { to: '/my-activities', label: 'My Activities', icon: '📋' },
      { to: '/calendar', label: 'Calendar', icon: '🗓️' },
      { to: '/occupancy', label: 'Occupancy', icon: '📍' },
      { to: '/feedback', label: 'Feedback', icon: '⭐' },
      { to: '/messages', label: 'Messages', icon: '💬' }
    );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>📚 College Resources</h2>
        <p>Utilization Dashboard</p>
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
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-name">{user?.name}</div>
          <div className="user-role">{user?.role}</div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
