import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ApprovalsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const fetchPending = async () => {
    try {
      const data = await api.getBookings({ status: 'pending' });
      setBookings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = async (id, status) => {
    setActionLoading(id);
    try {
      await api.updateBookingStatus(id, { status });
      fetchPending();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Pending Approvals</h1>
        <p>{bookings.length} booking{bookings.length !== 1 ? 's' : ''} awaiting approval</p>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Resource</th>
                <th>Requested By</th>
                <th>Date</th>
                <th>Time</th>
                <th>Purpose</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-state">
                    <div className="icon">✅</div>
                    <p>No pending approvals. You're all caught up!</p>
                  </td>
                </tr>
              ) : (
                bookings.map((b) => (
                  <tr key={b.id}>
                    <td>#{b.id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{b.resource_name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{b.resource_type}</div>
                    </td>
                    <td>
                      <div>{b.user_name}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{b.user_email}</div>
                    </td>
                    <td>{formatDate(b.date)}</td>
                    <td>{b.start_time?.slice(0, 5)} – {b.end_time?.slice(0, 5)}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.purpose || '—'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleAction(b.id, 'approved')}
                          disabled={actionLoading === b.id}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleAction(b.id, 'rejected')}
                          disabled={actionLoading === b.id}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApprovalsPage;
