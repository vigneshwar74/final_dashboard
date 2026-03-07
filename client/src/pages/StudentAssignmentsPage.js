import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const StudentAssignmentsPage = () => {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const canCreate = user?.role === 'admin' || user?.role === 'staff';

  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    target: 'all_students',
    student_id: '',
  });
  const [error, setError] = useState('');

  const fetchActivities = useCallback(async () => {
    try {
      const data = await api.getStudentAssignments();
      setActivities(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchActivities();
    if (canCreate) {
      api.getUsersByRole('student')
        .then(setStudents)
        .catch(console.error);
    }
  }, [fetchActivities, canCreate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.createStudentAssignment({
        title: form.title,
        description: form.description,
        date: form.due_date || null,
        target: form.target,
        student_id: form.target === 'specific' ? form.student_id : null,
      });
      setShowModal(false);
      setForm({ title: '', description: '', due_date: '', target: 'all_students', student_id: '' });
      fetchActivities();
    } catch (err) {
      setError(err.message || 'Failed to create activity');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateStudentAssignmentStatus(id, { status });
      fetchActivities();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{isStudent ? 'My Activities' : 'Student Activities'}</h1>
          <p>{isStudent ? 'View your assigned activities and tasks' : 'Assign activities and tasks to students'}</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + Assign Activity
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Description</th>
                {!isStudent && <th>Target</th>}
                {!isStudent && <th>Assigned By</th>}
                <th>Due Date</th>
                <th>Status</th>
                {isStudent && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr><td colSpan={isStudent ? 5 : 6} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                  No activities found
                </td></tr>
              ) : activities.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.title}</td>
                  <td>{a.description || '-'}</td>
                  {!isStudent && (
                    <td>
                      {a.target === 'all_students'
                        ? <span className="badge badge-approved">All Students</span>
                        : <span className="badge badge-pending">{a.student_name || 'Specific'}</span>
                      }
                    </td>
                  )}
                  {!isStudent && <td>{a.assigned_by_name}</td>}
                  <td>{a.date ? new Date(a.date).toLocaleDateString() : '-'}</td>
                  <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                  {isStudent && (
                    <td>
                      {a.status === 'active' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(a.id, 'completed')}>
                          Mark Done
                        </button>
                      )}
                      {a.status === 'completed' && <span style={{ color: '#059669' }}>✅ Done</span>}
                      {a.status === 'cancelled' && <span style={{ color: '#6b7280' }}>Cancelled</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Activity Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Activity to Students</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label>Title *</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Activity title" />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Activity description..." rows={3} />
              </div>

              <div className="form-group">
                <label>Due Date</label>
                <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Target *</label>
                <select value={form.target} onChange={e => setForm({ ...form, target: e.target.value })}>
                  <option value="all_students">All Students</option>
                  <option value="specific">Specific Student</option>
                </select>
              </div>

              {form.target === 'specific' && (
                <div className="form-group">
                  <label>Select Student *</label>
                  <select value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })} required>
                    <option value="">Choose student...</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Assign Activity</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAssignmentsPage;
