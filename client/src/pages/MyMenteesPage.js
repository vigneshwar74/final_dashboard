import React, { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const MyMenteesPage = () => {
  const [groups, setGroups] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [totalMentees, setTotalMentees] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ mentor_group_id: '', subject: '', body: '' });

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getMyMentees();
      setGroups(data.groups || []);
      setMentees(data.mentees || []);
      setTotalMentees(data.totalMentees || 0);
    } catch (err) {
      setError(err.message || 'Failed to load mentees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sendMessage = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        subject: form.subject,
        body: form.body,
      };
      if (form.mentor_group_id) payload.mentor_group_id = parseInt(form.mentor_group_id, 10);
      const result = await api.sendMessageToMentees(payload);
      setSuccess(result.message || 'Message sent to mentees.');
      setForm({ mentor_group_id: '', subject: '', body: '' });
      setTimeout(() => {
        setSuccess('');
        setShowMessageModal(false);
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>My Mentees</h1>
          <p>Students assigned to you under mentor groups.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowMessageModal(true)} disabled={totalMentees === 0}>
          Message My Mentees
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Total Groups</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{groups.length}</div>
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>Total Mentees</div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{totalMentees}</div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card" style={{ padding: 24, color: 'var(--gray-500)' }}>
          No mentees are assigned to you yet.
        </div>
      ) : groups.map((group) => (
        <div key={group.id} className="card" style={{ marginBottom: 14, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{group.name}</h3>
            <span style={{ fontSize: 12, background: '#eef2ff', color: '#4338ca', padding: '4px 10px', borderRadius: 999 }}>
              {group.student_count} mentee(s)
            </span>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Year</th>
                </tr>
              </thead>
              <tbody>
                {group.students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.email || '-'}</td>
                    <td>{s.department || '-'}</td>
                    <td>{s.year || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {showMessageModal && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2>Message Mentees</h2>
              <button className="modal-close" onClick={() => setShowMessageModal(false)}>&times;</button>
            </div>

            <form onSubmit={sendMessage}>
              <div className="form-group">
                <label>Target Group (optional)</label>
                <select
                  value={form.mentor_group_id}
                  onChange={(e) => setForm({ ...form, mentor_group_id: e.target.value })}
                >
                  <option value="">All my mentees</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.student_count})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Subject *</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  required
                  placeholder="Subject"
                />
              </div>

              <div className="form-group">
                <label>Message *</label>
                <textarea
                  rows={6}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  required
                  placeholder="Write your message to mentees..."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowMessageModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={sending}>
                  {sending ? 'Sending...' : 'Send to Mentees'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyMenteesPage;
