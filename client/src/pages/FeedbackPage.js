import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const FeedbackPage = () => {
  const { user } = useAuth();
  const [ratings, setRatings] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [form, setForm] = useState({ resource_id: '', booking_id: '', rating: 5, comment: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [r, f] = await Promise.all([
          api.getResourceRatings(),
          api.getFeedback(),
        ]);
        setRatings(r);
        setFeedback(f);
        // Get completed bookings for rating
        if (user?.role !== 'admin') {
          try {
            const bk = await api.getBookings({ status: 'completed', my: 'true' });
            setMyBookings(bk);
          } catch (e) {}
        }
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.submitFeedback({
        resource_id: parseInt(form.resource_id),
        booking_id: form.booking_id ? parseInt(form.booking_id) : null,
        rating: parseInt(form.rating),
        comment: form.comment,
      });
      setSuccess('Thank you for your feedback!');
      setForm({ resource_id: '', booking_id: '', rating: 5, comment: '' });
      // Refresh
      const [r, f] = await Promise.all([api.getResourceRatings(), api.getFeedback()]);
      setRatings(r);
      setFeedback(f);
      setTimeout(() => { setSuccess(''); setShowModal(false); }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit feedback');
    }
  };

  const viewResourceFeedback = (resource) => {
    setSelectedResource(resource);
  };

  const stars = (rating) => '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Feedback & Ratings</h1>
          <p>View venue ratings and share your experience</p>
        </div>
        {user?.role !== 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>⭐ Give Feedback</button>
        )}
      </div>

      {/* Venue Ratings Grid */}
      <div className="ratings-grid">
        {ratings.map(r => (
          <div key={r.id} className="card rating-card" onClick={() => viewResourceFeedback(r)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{r.name}</h3>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{r.type} — {r.location}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#d97706', fontSize: 18 }}>{r.avg_rating ? stars(r.avg_rating) : 'No ratings'}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  {r.avg_rating ? `${r.avg_rating}/5` : ''} ({r.review_count} reviews)
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Selected resource feedback */}
      {selectedResource && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3>Reviews for {selectedResource.name}</h3>
            <button className="btn btn-sm btn-outline" onClick={() => setSelectedResource(null)}>✕ Close</button>
          </div>
          {feedback.filter(f => f.resource_id === selectedResource.id).length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#6b7280' }}>No reviews yet</div>
          ) : (
            feedback.filter(f => f.resource_id === selectedResource.id).map(f => (
              <div key={f.id} style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{f.user_name}</strong>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>({f.user_role})</span>
                  </div>
                  <span style={{ color: '#d97706' }}>{stars(f.rating)}</span>
                </div>
                {f.comment && <p style={{ margin: '4px 0 0', color: '#374151' }}>{f.comment}</p>}
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(f.created_at).toLocaleDateString()}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Submit Feedback Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Submit Feedback</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              {myBookings.length > 0 && (
                <div className="form-group">
                  <label>Rate a Completed Booking (optional)</label>
                  <select value={form.booking_id} onChange={e => {
                    const bk = myBookings.find(b => b.id === parseInt(e.target.value));
                    setForm({ ...form, booking_id: e.target.value, resource_id: bk ? String(bk.resource_id) : form.resource_id });
                  }}>
                    <option value="">Select a booking or choose venue below...</option>
                    {myBookings.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.resource_name} — {new Date(b.date).toLocaleDateString()} ({b.start_time?.slice(0,5)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Venue *</label>
                <select value={form.resource_id} onChange={e => setForm({ ...form, resource_id: e.target.value })} required>
                  <option value="">Select venue...</option>
                  {ratings.map(r => <option key={r.id} value={r.id}>{r.name} — {r.location}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Rating *</label>
                <div className="star-select">
                  {[1, 2, 3, 4, 5].map(n => (
                    <span
                      key={n}
                      onClick={() => setForm({ ...form, rating: n })}
                      style={{ fontSize: 28, cursor: 'pointer', color: n <= form.rating ? '#d97706' : '#d1d5db' }}
                    >★</span>
                  ))}
                  <span style={{ marginLeft: 8, fontSize: 14, color: '#6b7280' }}>{form.rating}/5</span>
                </div>
              </div>

              <div className="form-group">
                <label>Comment (optional)</label>
                <textarea value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })}
                  rows={3} placeholder="Share your experience..." />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Rating</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackPage;
