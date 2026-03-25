import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7AM to 7PM

const toLocalDateKey = (input) => {
  if (!input) return '';
  if (typeof input === 'string') return input.split('T')[0];
  const d = new Date(input);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(':').map((v) => parseInt(v, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const EVENT_COLORS = {
  booking: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', label: '📅 Booking' },
  assignment: { bg: '#ede9fe', border: '#8b5cf6', text: '#5b21b6', label: '👨‍🏫 Assignment' },
  student_activity: { bg: '#d1fae5', border: '#10b981', text: '#065f46', label: '📋 Activity' },
  exam: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', label: '🎓 Exam' },
};

const CalendarPage = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedResource, setSelectedResource] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    return mon;
  });

  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const fetchData = async () => {
    try {
      const [res, ev] = await Promise.all([
        api.getResources(),
        api.getCalendarEvents(),
      ]);
      setResources(res);
      setEvents(ev);
      if (!selectedResource && res.length > 0) {
        setSelectedResource('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, []);

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const getEventsForSlot = (day, hour) => {
    const dateStr = toLocalDateKey(day);
    const slotStart = hour * 60;
    return events.filter((e) => {
      if (selectedResource && String(e.resource_id) !== selectedResource) return false;
      if (selectedType && e.event_type !== selectedType) return false;
      const eDate = toLocalDateKey(e.date);
      if (eDate !== dateStr) return false;
      const startMinutes = timeToMinutes(e.start_time);
      const endMinutes = timeToMinutes(e.end_time);
      return slotStart >= startMinutes && slotStart < endMinutes;
    });
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const weekLabel = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${weekDays[4].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const roleLabel = user?.role === 'admin' ? 'all events' : user?.role === 'staff' ? 'your bookings, assignments & exams' : 'your activities & events';

  return (
    <div>
      <div className="page-header">
        <h1>Calendar</h1>
        <p>Showing {roleLabel} for the week</p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(EVENT_COLORS).map(([type, c]) => (
          <span key={type} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
            padding: '3px 10px', borderRadius: 12, background: c.bg, color: c.text, border: `1px solid ${c.border}`,
          }}>
            {c.label}
          </span>
        ))}
      </div>

      <div className="filters-bar" style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          className="form-control"
          value={selectedResource}
          onChange={(e) => setSelectedResource(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="">All Resources</option>
          {resources.map((r) => (
            <option key={r.id} value={String(r.id)}>{r.name} ({r.type})</option>
          ))}
        </select>
        <select
          className="form-control"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          style={{ maxWidth: 180 }}
        >
          <option value="">All Types</option>
          <option value="booking">Bookings</option>
          <option value="assignment">Assignments</option>
          <option value="student_activity">Student Activities</option>
          <option value="exam">Exams</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevWeek}>← Prev</button>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{weekLabel}</span>
          <button className="btn btn-secondary btn-sm" onClick={nextWeek}>Next →</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="calendar-grid">
          <div className="time-label" style={{ background: '#374151', color: 'white' }}>Time</div>
          {weekDays.map((d, i) => (
            <div key={i} className="day-header">
              {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          ))}

          {HOURS.map((hour) => (
            <React.Fragment key={hour}>
              <div className="time-label">{`${hour}:00`}</div>
              {weekDays.map((day, di) => {
                const slotEvents = getEventsForSlot(day, hour);
                return (
                  <div key={di} className={`slot ${slotEvents.length > 0 ? 'booked' : ''}`}>
                    {slotEvents.map((e, idx) => {
                      const colors = EVENT_COLORS[e.event_type] || EVENT_COLORS.booking;
                      return (
                        <span
                          key={idx}
                          className="booking-chip"
                          title={`${e.title} — ${e.resource_name || ''}`}
                          style={{
                            background: colors.bg,
                            color: colors.text,
                            borderLeft: `3px solid ${colors.border}`,
                          }}
                        >
                          {e.title}
                        </span>
                      );
                    })}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
