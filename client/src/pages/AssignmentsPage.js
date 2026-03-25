import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const AssignmentsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [assignments, setAssignments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [availabilityMsg, setAvailabilityMsg] = useState('');
  const [form, setForm] = useState({
    staff_id: '',
    resource_id: '',
    title: '',
    description: '',
    start_time: '',
    end_time: '',
  });
  const [error, setError] = useState('');

  const fetchAssignments = useCallback(async () => {
    try {
      const data = await api.getAssignments();
      setAssignments(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAssignments();
    if (isAdmin) {
      Promise.all([api.getStaffList(), api.getResources()])
        .then(([s, r]) => { setStaffList(s); setResources(r); })
        .catch(console.error);
    }
  }, [fetchAssignments, isAdmin]);

  const checkAvailability = async () => {
    if (!form.staff_id || !form.start_time || !form.end_time) return;
    try {
      const startDate = form.start_time.split('T')[0];
      const startTime = form.start_time.split('T')[1]?.substring(0, 5);
      const endTime = form.end_time.split('T')[1]?.substring(0, 5);
      const res = await api.checkStaffAvailability({
        staff_id: form.staff_id,
        date: startDate,
        start_time: startTime,
        end_time: endTime,
      });
      setAvailabilityMsg(res.available
        ? '✅ Staff is available for this time slot'
        : `❌ Conflict: ${res.conflicts?.map(c => c.title || c.resource_name).join(', ')}`);
    } catch (err) {
      setAvailabilityMsg('⚠️ Could not check availability');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const startDate = form.start_time.split('T')[0];
      const startTime = form.start_time.split('T')[1]?.substring(0, 5);
      const endTime = form.end_time.split('T')[1]?.substring(0, 5);
      await api.createAssignment({
        ...form,
        date: startDate,
        start_time: startTime,
        end_time: endTime,
      });
      setShowModal(false);
      setForm({ staff_id: '', resource_id: '', title: '', description: '', start_time: '', end_time: '' });
      setAvailabilityMsg('');
      fetchAssignments();
    } catch (err) {
      setError(err.message || 'Failed to create assignment');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this assignment?')) return;
    try {
      await api.deleteAssignment(id);
      fetchAssignments();
    } catch (err) { console.error(err); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateAssignmentStatus(id, { status });
      fetchAssignments();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>{isAdmin ? 'Staff Assignments' : 'My Assignments'}</h1>
          <p>{isAdmin ? 'Assign staff members to venues and activities' : 'View your venue and activity assignments'}</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New Assignment
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                {isAdmin && <th>Staff</th>}
                <th>Title</th>
                <th>Venue</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>
                  No assignments found
                </td></tr>
              ) : assignments.map(a => (
                <tr key={a.id}>
                  {isAdmin && <td>{a.staff_name}</td>}
                  <td style={{ fontWeight: 600 }}>{a.title}</td>
                  <td>{a.resource_name}</td>
                  <td>{new Date(a.start_time).toLocaleString()}</td>
                  <td>{new Date(a.end_time).toLocaleString()}</td>
                  <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    {isAdmin ? (
                      <>
                        {a.status !== 'completed' && (
                          <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(a.id, 'completed')}>
                            Complete
                          </button>
                        )}
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(a.id)}>Delete</button>
                      </>
                    ) : (
                      a.status === 'active' && (
                        <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(a.id, 'completed')}>
                          Mark Done
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Assignment Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Staff to Venue</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label>Staff Member *</label>
                <select value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })} required>
                  <option value="">Select staff...</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Venue / Resource *</label>
                <select value={form.resource_id} onChange={e => setForm({ ...form, resource_id: e.target.value })} required>
                  <option value="">Select venue...</option>
                  {resources.map(r => <option key={r.id} value={r.id}>{r.name} - {r.location}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Title *</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="e.g., Physics Lab Session" />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional details..." rows={2} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Start Time *</label>
                  <input type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>End Time *</label>
                  <input type="datetime-local" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
                </div>
              </div>

              <button type="button" className="btn btn-outline" style={{ width: '100%', marginBottom: 8 }} onClick={checkAvailability}>
                🔍 Check Staff Availability
              </button>
              {availabilityMsg && <div style={{ padding: 8, marginBottom: 12, borderRadius: 6, background: availabilityMsg.startsWith('✅') ? '#ecfdf5' : '#fef2f2', fontSize: 14 }}>{availabilityMsg}</div>}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentsPage;
