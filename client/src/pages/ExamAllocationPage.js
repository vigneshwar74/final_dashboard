import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const ExamAllocationPage = () => {
  const [allocations, setAllocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [suitableVenues, setSuitableVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [form, setForm] = useState({
    department: '', num_students: '', exam_name: '', date: '',
    start_time: '', end_time: '', resource_id: '', notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filterDept) params.department = filterDept;
      const [a, d] = await Promise.all([
        api.getExamAllocations(params),
        api.getDepartments(),
      ]);
      setAllocations(a);
      setDepartments(d);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filterDept]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const findVenues = async () => {
    if (!form.num_students || !form.date || !form.start_time || !form.end_time) {
      setError('Fill in number of students, date, and time first.');
      return;
    }
    setError('');
    try {
      const venues = await api.getSuitableVenues({
        num_students: form.num_students,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
      });
      setSuitableVenues(venues);
      if (venues.length === 0) {
        setError('No suitable venues found for the given criteria. Try different time/date or reduce student count.');
      }
    } catch (err) {
      setError(err.message || 'Failed to find venues');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.createExamAllocation({
        ...form,
        resource_id: parseInt(form.resource_id),
        num_students: parseInt(form.num_students),
      });
      setSuccess('Exam hall allocated successfully!');
      setShowModal(false);
      setForm({ department: '', num_students: '', exam_name: '', date: '', start_time: '', end_time: '', resource_id: '', notes: '' });
      setSuitableVenues([]);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to create allocation');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.updateExamAllocationStatus(id, { status });
      fetchData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this exam allocation?')) return;
    try {
      await api.deleteExamAllocation(id);
      fetchData();
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Exam Hall Allocation</h1>
          <p>Choose department, number of students, and find suitable venues</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowModal(true); setError(''); setSuitableVenues([]); }}>
          + Allocate Hall
        </button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <select className="form-control" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Exam</th>
                <th>Department</th>
                <th>Students</th>
                <th>Venue</th>
                <th>Capacity</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No exam allocations found</td></tr>
              ) : allocations.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.exam_name}</td>
                  <td>{a.department}</td>
                  <td>{a.num_students}</td>
                  <td>{a.resource_name}</td>
                  <td>{a.capacity || '-'}</td>
                  <td>{new Date(a.date).toLocaleDateString()}</td>
                  <td>{a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}</td>
                  <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {a.status === 'scheduled' && (
                      <>
                        <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(a.id, 'ongoing')}>Start</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleStatusChange(a.id, 'cancelled')}>Cancel</button>
                      </>
                    )}
                    {a.status === 'ongoing' && (
                      <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(a.id, 'completed')}>Complete</button>
                    )}
                    <button className="btn btn-sm btn-outline" onClick={() => handleDelete(a.id)}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 550 }}>
            <div className="modal-header">
              <h2>Allocate Exam Hall</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Department *</label>
                  <select value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required>
                    <option value="">Select dept...</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>No. of Students *</label>
                  <input type="number" min="1" value={form.num_students}
                    onChange={e => setForm({ ...form, num_students: e.target.value })} required placeholder="e.g. 60" />
                </div>
              </div>

              <div className="form-group">
                <label>Exam Name *</label>
                <input type="text" value={form.exam_name}
                  onChange={e => setForm({ ...form, exam_name: e.target.value })} required placeholder="e.g. Mid-Term Mathematics" />
              </div>

              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Start Time *</label>
                  <input type="time" value={form.start_time}
                    onChange={e => setForm({ ...form, start_time: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>End Time *</label>
                  <input type="time" value={form.end_time}
                    onChange={e => setForm({ ...form, end_time: e.target.value })} required />
                </div>
              </div>

              <button type="button" className="btn btn-outline" style={{ width: '100%', marginBottom: 12 }} onClick={findVenues}>
                🔍 Find Suitable Venues ({form.num_students || '?'} students)
              </button>

              {suitableVenues.length > 0 && (
                <div className="form-group">
                  <label>Select Venue * (showing venues with capacity ≥ {form.num_students})</label>
                  <select value={form.resource_id} onChange={e => setForm({ ...form, resource_id: e.target.value })} required>
                    <option value="">Choose venue...</option>
                    {suitableVenues.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.location} (Capacity: {v.capacity})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2} placeholder="Any special requirements..." />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!form.resource_id}>Allocate Hall</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamAllocationPage;
