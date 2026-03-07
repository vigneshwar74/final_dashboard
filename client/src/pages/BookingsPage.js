import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const BookingsPage = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({ status: '', my: 'true' });
  const [form, setForm] = useState({
    resource_id: '', date: '', start_time: '', end_time: '', purpose: '',
  });
  const [availableResources, setAvailableResources] = useState([]);

  const fetchBookings = async () => {
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.my) params.my = filters.my;
      const data = await api.getBookings(params);
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async () => {
    try {
      const data = await api.getResources({ status: 'available' });
      setResources(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch available resources when date/time changes in the form
  const fetchAvailableResources = async () => {
    if (!form.date || !form.start_time || !form.end_time) {
      setAvailableResources(resources);
      return;
    }
    try {
      const data = await api.getAvailableResources({
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
      });
      setAvailableResources(data);
    } catch (err) {
      console.error(err);
      setAvailableResources(resources);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchResources();
    // eslint-disable-next-line
  }, [filters]);

  const openCreate = () => {
    setForm({ resource_id: '', date: '', start_time: '', end_time: '', purpose: '' });
    setAvailableResources(resources);
    setError('');
    setSuccess('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = { ...form, resource_id: parseInt(form.resource_id) };
      await api.createBooking(payload);
      setShowModal(false);
      setSuccess('Booking created successfully!');
      fetchBookings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await api.cancelBooking(id);
      fetchBookings();
    } catch (err) {
      alert(err.message);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const canBook = user?.role === 'staff';

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>My Bookings</h1>
          <p>Manage your venue booking requests</p>
        </div>
        {canBook && (
          <button className="btn btn-primary" onClick={openCreate}>+ New Booking</button>
        )}
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      {/* Filters */}
      <div className="filters-bar">
        <select
          className="form-control"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Resource</th>
                <th>Date</th>
                <th>Time</th>
                <th>Purpose</th>
                <th>Booked By</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No bookings found.</td></tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.resource_name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{b.resource_type}</div>
                    </td>
                    <td>{formatDate(b.date)}</td>
                    <td>{b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}</td>
                    <td>{b.purpose || '—'}</td>
                    <td>{b.user_name}</td>
                    <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                    <td>
                      {(b.status === 'pending' || b.status === 'approved') && (b.user_id === user?.id || user?.role === 'admin') && (
                        <button className="btn btn-sm btn-danger" onClick={() => handleCancel(b.id)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Booking Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Booking</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value, resource_id: '' })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value, resource_id: '' })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value, resource_id: '' })}
                    required
                  />
                </div>
              </div>
              {form.date && form.start_time && form.end_time && (
                <button type="button" className="btn btn-outline" style={{ width: '100%', marginBottom: 12 }} onClick={fetchAvailableResources}>
                  🔍 Show Available Venues
                </button>
              )}
              <div className="form-group">
                <label>Available Venue *</label>
                <select
                  className="form-control"
                  value={form.resource_id}
                  onChange={(e) => setForm({ ...form, resource_id: e.target.value })}
                  required
                >
                  <option value="">Select a venue...</option>
                  {availableResources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.type}) — {r.location}
                    </option>
                  ))}
                </select>
                {availableResources.length === 0 && form.date && form.start_time && form.end_time && (
                  <small style={{ color: '#dc2626' }}>No venues available for this time slot. Try a different time.</small>
                )}
              </div>
              <div className="form-group">
                <label>Purpose</label>
                <textarea
                  className="form-control"
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  placeholder="Describe the purpose of this booking"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
