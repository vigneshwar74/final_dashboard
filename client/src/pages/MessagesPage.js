import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const MessagesPage = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [recipientUsers, setRecipientUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('inbox');
  const [mentorGroups, setMentorGroups] = useState([]);
  const [form, setForm] = useState({
    recipient_role: '',
    recipient_id: '',
    send_to_mentees: false,
    mentor_group_id: '',
    subject: '',
    body: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMessages = useCallback(async () => {
    try {
      const data = await api.getMessages();
      setMessages(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    const fetchMentorGroups = async () => {
      if (user?.role !== 'staff') return;
      try {
        const data = await api.getMyMentees();
        setMentorGroups(data.groups || []);
      } catch (err) {
        setMentorGroups([]);
      }
    };
    fetchMentorGroups();
  }, [user?.role]);

  // Determine who this user can message
  const canCompose = user?.role === 'admin' || user?.role === 'staff';

  const allowedRecipientRoles = user?.role === 'admin'
    ? [{ value: 'staff', label: 'Staff' }, { value: 'student', label: 'Students' }]
    : user?.role === 'staff'
    ? [{ value: 'student', label: 'Students' }]
    : [];

  const handleRoleChange = async (role) => {
    setForm({ ...form, recipient_role: role, recipient_id: '' });
    if (role) {
      try {
        const users = await api.getUsersByRole(role);
        setRecipientUsers(users);
      } catch (err) { setRecipientUsers([]); }
    } else {
      setRecipientUsers([]);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (user?.role === 'staff' && form.send_to_mentees) {
        await api.sendMessageToMentees({
          mentor_group_id: form.mentor_group_id || null,
          subject: form.subject,
          body: form.body,
        });
      } else {
        await api.sendMessage({
          recipient_role: form.recipient_role,
          recipient_id: form.recipient_id || null,
          subject: form.subject,
          body: form.body,
        });
      }
      setSuccess('Message sent successfully!');
      setForm({ recipient_role: '', recipient_id: '', send_to_mentees: false, mentor_group_id: '', subject: '', body: '' });
      setTimeout(() => { setSuccess(''); setShowCompose(false); }, 1500);
      fetchMessages();
    } catch (err) {
      setError(err.message || 'Failed to send message');
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.markMessageRead(id);
      fetchMessages();
    } catch (err) { console.error(err); }
  };

  const inboxMessages = messages.filter(m => {
    if (m.recipient_id === user?.id) return true;
    if (!m.recipient_id && m.recipient_role === user?.role) return true;
    return false;
  });

  const sentMessages = messages.filter(m => m.sender_id === user?.id);

  const displayMessages = activeTab === 'inbox' ? inboxMessages : sentMessages;

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Messages</h1>
          <p>View and manage your messages</p>
        </div>
        {canCompose && (
          <button className="btn btn-primary" onClick={() => setShowCompose(true)}>
            ✉️ Compose
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`btn ${activeTab === 'inbox' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('inbox')}>
          Inbox ({inboxMessages.filter(m => !m.is_read).length} unread)
        </button>
        {canCompose && (
          <button className={`btn ${activeTab === 'sent' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab('sent')}>
            Sent ({sentMessages.length})
          </button>
        )}
      </div>

      {/* Messages List */}
      <div className="messages-list">
        {displayMessages.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
            No messages in {activeTab}
          </div>
        ) : displayMessages.map(m => (
          <div
            key={m.id}
            className={`card message-card ${!m.is_read && activeTab === 'inbox' ? 'unread' : ''}`}
            style={{ marginBottom: 8, cursor: activeTab === 'inbox' && !m.is_read ? 'pointer' : 'default' }}
            onClick={() => activeTab === 'inbox' && !m.is_read && handleMarkRead(m.id)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {!m.is_read && activeTab === 'inbox' && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a56db', display: 'inline-block' }} />
                  )}
                  <strong style={{ fontSize: 16 }}>{m.subject}</strong>
                </div>
                <p style={{ margin: '4px 0', color: '#374151' }}>{m.body}</p>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
                  {activeTab === 'inbox' ? (
                    <span>From: <strong>{m.sender_name}</strong> ({m.sender_role})</span>
                  ) : (
                    <span>To: <strong>{m.recipient_name || `All ${m.recipient_role}s`}</strong></span>
                  )}
                  <span style={{ marginLeft: 16 }}>
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="modal-overlay" onClick={() => setShowCompose(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Compose Message</h2>
              <button className="modal-close" onClick={() => setShowCompose(false)}>&times;</button>
            </div>
            <form onSubmit={handleSend}>
              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              {user?.role === 'staff' && (
                <div className="form-group" style={{ border: '1px solid var(--gray-200)', borderRadius: 10, padding: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={form.send_to_mentees}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          send_to_mentees: e.target.checked,
                          recipient_role: e.target.checked ? '' : form.recipient_role,
                          recipient_id: '',
                        });
                      }}
                    />
                    Send to my mentees
                  </label>

                  {form.send_to_mentees && (
                    <select
                      value={form.mentor_group_id}
                      onChange={(e) => setForm({ ...form, mentor_group_id: e.target.value })}
                    >
                      <option value="">All my mentees</option>
                      {mentorGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name} ({g.student_count})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {!form.send_to_mentees && (
                <div className="form-group">
                  <label>Send To (Role) *</label>
                  <select value={form.recipient_role} onChange={e => handleRoleChange(e.target.value)} required>
                    <option value="">Select role...</option>
                    {allowedRecipientRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              )}

              {!form.send_to_mentees && form.recipient_role && (
                <div className="form-group">
                  <label>Specific Recipient (optional - leave blank to send to all)</label>
                  <select value={form.recipient_id} onChange={e => setForm({ ...form, recipient_id: e.target.value })}>
                    <option value="">All {form.recipient_role}s</option>
                    {recipientUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Subject *</label>
                <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required placeholder="Message subject" />
              </div>

              <div className="form-group">
                <label>Message *</label>
                <textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} required rows={5} placeholder="Type your message here..." />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCompose(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Send Message</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
