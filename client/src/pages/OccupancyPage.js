import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const OccupancyPage = ({ user }) => {
  const [venues, setVenues] = useState([]);
  const [myCheckins, setMyCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [venuePeople, setVenuePeople] = useState([]);
  const [showPeopleModal, setShowPeopleModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [v, mc] = await Promise.all([
        api.getOccupancy(),
        api.getMyCheckins(),
      ]);
      setVenues(v);
      setMyCheckins(mc);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const myActiveCheckinIds = new Set(myCheckins.filter(c => !c.checked_out_at).map(c => c.resource_id));

  const handleCheckin = async (resourceId) => {
    try {
      await api.checkIn(resourceId);
      fetchData();
    } catch (err) { alert(err.message || 'Check-in failed'); }
  };

  const handleCheckout = async (resourceId) => {
    try {
      await api.checkOut(resourceId);
      fetchData();
    } catch (err) { alert(err.message || 'Check-out failed'); }
  };

  const viewPeople = async (venue) => {
    setSelectedVenue(venue);
    try {
      const people = await api.getVenuePeople(venue.id);
      setVenuePeople(people);
      setShowPeopleModal(true);
    } catch (err) { console.error(err); }
  };

  const getOccupancyColor = (current, capacity) => {
    if (!capacity) return '#6b7280';
    const pct = (current / capacity) * 100;
    if (pct >= 90) return '#ef4444';
    if (pct >= 70) return '#f59e0b';
    if (pct >= 40) return '#3b82f6';
    return '#10b981';
  };

  const getOccupancyLabel = (current, capacity) => {
    if (!capacity) return 'N/A';
    const pct = (current / capacity) * 100;
    if (pct >= 90) return 'Almost Full';
    if (pct >= 70) return 'Busy';
    if (pct >= 40) return 'Moderate';
    if (pct > 0) return 'Available';
    return 'Empty';
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Live Occupancy Tracker</h1>
        <p>Real-time venue occupancy — check in/out when you enter or leave</p>
      </div>

      {/* My Active Check-ins Banner */}
      {myCheckins.filter(c => !c.checked_out_at).length > 0 && (
        <div className="alert alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 20 }}>📍</span>
          <span>
            You are currently checked into: <strong>
              {myCheckins.filter(c => !c.checked_out_at).map(c => c.resource_name).join(', ')}
            </strong>
          </span>
        </div>
      )}

      {/* Occupancy Grid */}
      <div className="occupancy-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {venues.map(v => {
          const current = parseInt(v.current_count) || 0;
          const cap = v.capacity || 0;
          const pct = cap ? Math.min((current / cap) * 100, 100) : 0;
          const color = getOccupancyColor(current, cap);
          const isCheckedIn = myActiveCheckinIds.has(v.id);

          return (
            <div key={v.id} className="card occupancy-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>{v.name}</h3>
                  <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: 13 }}>{v.location}</p>
                </div>
                <span className="occupancy-label" style={{
                  background: color + '20',
                  color,
                  padding: '4px 10px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  height: 'fit-content',
                }}>{getOccupancyLabel(current, cap)}</span>
              </div>

              {/* Progress bar */}
              <div style={{ background: '#e5e7eb', borderRadius: 8, height: 12, marginBottom: 8, overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`,
                  background: color,
                  height: '100%',
                  borderRadius: 8,
                  transition: 'width 0.5s ease',
                }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 14 }}>
                <span style={{ fontWeight: 600, color }}>{current} / {cap || '?'}</span>
                <span style={{ color: '#6b7280' }}>{cap ? `${Math.round(pct)}%` : 'No capacity set'}</span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {isCheckedIn ? (
                  <button className="btn btn-sm btn-danger" style={{ flex: 1 }}
                    onClick={() => handleCheckout(v.id)}>
                    Check Out
                  </button>
                ) : (
                  <button className="btn btn-sm btn-primary" style={{ flex: 1 }}
                    onClick={() => handleCheckin(v.id)}>
                    Check In
                  </button>
                )}
                <button className="btn btn-sm btn-outline"
                  onClick={() => viewPeople(v)}>
                  👥 {current}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {venues.length === 0 && (
        <div className="empty-state card" style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 40, margin: 0 }}>🏫</p>
          <p style={{ color: '#6b7280' }}>No venues found. Add resources first.</p>
        </div>
      )}

      {/* People in Venue Modal */}
      {showPeopleModal && (
        <div className="modal-overlay" onClick={() => setShowPeopleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2>People in {selectedVenue?.name}</h2>
              <button className="modal-close" onClick={() => setShowPeopleModal(false)}>&times;</button>
            </div>
            <div>
              {venuePeople.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#6b7280', padding: 20 }}>No one is currently here</p>
              ) : (
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {venuePeople.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 4px', borderBottom: '1px solid #e5e7eb',
                    }}>
                      <div>
                        <strong>{p.user_name}</strong>
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>{p.email}</span>
                      </div>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        Since {new Date(p.checked_in_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OccupancyPage;
