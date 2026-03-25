import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

const NotificationBell = () => {
  const { notifications, unreadCount, markRead, markAllRead } = useSocket();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="notification-wrapper" ref={ref}>
      <button className="notification-bell" onClick={() => setOpen(!open)} title="Notifications">
        🔔
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <strong>Notifications</strong>
            {unreadCount > 0 && (
              <button className="btn btn-sm btn-outline" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-state" style={{ padding: 18, fontSize: 13 }}>No notifications yet</div>
            ) : notifications.slice(0, 20).map(n => (
              <div
                key={n.id}
                className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                onClick={() => { if (!n.is_read) markRead(n.id); }}
              >
                <div className="notif-title">{n.title}</div>
                {n.body && <div className="notif-body">{n.body}</div>}
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
