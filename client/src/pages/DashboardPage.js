import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#1a56db', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777'];

/* ─── Staff Dashboard ─── */
const StaffDashboard = ({ user }) => {
  const [bookings, setBookings] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [b, a, u] = await Promise.all([
          api.getBookings(),
          api.getAssignments(),
          api.getUnreadCount(),
        ]);
        setBookings(b);
        setAssignments(a);
        setUnread(u.count || 0);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const approved = bookings.filter(b => b.status === 'approved').length;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const rejected = bookings.filter(b => b.status === 'rejected').length;

  return (
    <div>
      <div className="page-header">
        <h1>Welcome, {user.name}</h1>
        <p>Department: <strong>{user.department || 'N/A'}</strong></p>
      </div>
      <div className="summary-grid">
        <div className="summary-card total">
          <span className="label">Total Bookings</span>
          <span className="value">{bookings.length}</span>
        </div>
        <div className="summary-card free">
          <span className="label">Approved</span>
          <span className="value">{approved}</span>
        </div>
        <div className="summary-card booked">
          <span className="label">Pending</span>
          <span className="value">{pending}</span>
        </div>
        <div className="summary-card maintenance">
          <span className="label">Rejected</span>
          <span className="value">{rejected}</span>
        </div>
      </div>
      <div className="summary-grid" style={{ marginTop: 16 }}>
        <div className="summary-card" style={{ borderLeft: '4px solid #7c3aed' }}>
          <span className="label">Active Assignments</span>
          <span className="value">{assignments.filter(a => a.status === 'active').length}</span>
        </div>
        <div className="summary-card" style={{ borderLeft: '4px solid #db2777' }}>
          <span className="label">Unread Messages</span>
          <span className="value">{unread}</span>
        </div>
      </div>
      {bookings.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header"><h3>Recent Bookings</h3></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Resource</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
              <tbody>
                {bookings.slice(0, 5).map(b => (
                  <tr key={b.id}>
                    <td>{b.resource_name}</td>
                    <td>{new Date(b.start_time).toLocaleDateString()}</td>
                    <td>{new Date(b.start_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} - {new Date(b.end_time).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
                    <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Student Dashboard ─── */
const StudentDashboard = ({ user }) => {
  const [activities, setActivities] = useState([]);
  const [unread, setUnread] = useState(0);
  const [mentor, setMentor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [a, u, m] = await Promise.all([
          api.getStudentAssignments(),
          api.getUnreadCount(),
          api.getMyMentor(),
        ]);
        setActivities(a);
        setUnread(u.count || 0);
        setMentor(m || null);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Welcome, {user.name}</h1>
        <p>Department: <strong>{user.department || 'N/A'}</strong> &nbsp;|&nbsp; Year: <strong>{user.year || 'N/A'}</strong></p>
      </div>
      <div className="summary-grid">
        <div className="summary-card total">
          <span className="label">Assigned Activities</span>
          <span className="value">{activities.length}</span>
        </div>
        <div className="summary-card free">
          <span className="label">Completed</span>
          <span className="value">{activities.filter(a => a.status === 'completed').length}</span>
        </div>
        <div className="summary-card booked">
          <span className="label">Active</span>
          <span className="value">{activities.filter(a => a.status === 'active').length}</span>
        </div>
        <div className="summary-card" style={{ borderLeft: '4px solid #db2777' }}>
          <span className="label">Unread Messages</span>
          <span className="value">{unread}</span>
        </div>
      </div>

      <div className="card mentor-card" style={{ marginTop: 16 }}>
        <div className="card-header"><h3>My Mentor</h3></div>
        {mentor?.assigned ? (
          <div className="mentor-grid">
            <div>
              <div className="mentor-label">Mentor Name</div>
              <div className="mentor-value">{mentor.mentor_name}</div>
            </div>
            <div>
              <div className="mentor-label">Email</div>
              <div className="mentor-value">{mentor.mentor_email || '-'}</div>
            </div>
            <div>
              <div className="mentor-label">Department</div>
              <div className="mentor-value">{mentor.mentor_department || '-'}</div>
            </div>
            <div>
              <div className="mentor-label">Mentor Group</div>
              <div className="mentor-value">{mentor.mentor_group_name}</div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--gray-500)' }}>
            Mentor is not assigned yet. Please contact admin.
          </div>
        )}
      </div>

      {activities.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header"><h3>My Activities</h3></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Title</th><th>Description</th><th>Due Date</th><th>Status</th></tr></thead>
              <tbody>
                {activities.slice(0, 5).map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.title}</td>
                    <td>{a.description || '-'}</td>
                    <td>{a.date ? new Date(a.date).toLocaleDateString() : '-'}</td>
                    <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Admin Dashboard (analytics - original) ─── */
const AdminDashboard = ({ user }) => {
  const [summary, setSummary] = useState(null);
  const [byType, setByType] = useState([]);
  const [trend, setTrend] = useState([]);
  const [topResources, setTopResources] = useState([]);
  const [studentStats, setStudentStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(7);

  const fetchData = async () => {
    try {
      const [s, t, tr, top, ss] = await Promise.all([
        api.getSummary(),
        api.getByType(),
        api.getTrend(trendDays),
        api.getTopResources(5),
        api.getStudentStats(),
      ]);
      setSummary(s);
      setByType(t);
      setTrend(tr);
      setTopResources(top);
      setStudentStats(ss);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [trendDays]);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const pieData = summary ? [
    { name: 'Free', value: summary.free },
    { name: 'Booked', value: summary.booked },
    { name: 'Maintenance', value: summary.maintenance },
  ].filter(d => d.value > 0) : [];

  const typeData = byType.map(b => ({
    name: b.type.charAt(0).toUpperCase() + b.type.slice(1),
    total: parseInt(b.total_resources),
    booked: parseInt(b.booked_resources),
  }));

  const trendData = trend.map(t => ({
    date: new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    bookings: parseInt(t.total_bookings),
    resources: parseInt(t.booked_resources),
  }));

  const handleExport = () => { api.exportCSV(); };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Admin Dashboard</h1>
          <p>Welcome back, {user?.name}. Here's today's resource overview.</p>
        </div>
        <button className="btn btn-outline" onClick={handleExport}>📥 Export CSV</button>
      </div>

      {summary && (
        <div className="summary-grid">
          <div className="summary-card total">
            <span className="label">Total Resources</span>
            <span className="value">{summary.total}</span>
          </div>
          <div className="summary-card free">
            <span className="label">Available</span>
            <span className="value">{summary.free}</span>
          </div>
          <div className="summary-card booked">
            <span className="label">Booked Today</span>
            <span className="value">{summary.booked}</span>
          </div>
          <div className="summary-card maintenance">
            <span className="label">Maintenance</span>
            <span className="value">{summary.maintenance}</span>
          </div>
        </div>
      )}

      {/* Student Stats */}
      {studentStats && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ marginBottom: 10, fontSize: 15 }}>👨‍🎓 Students Overview</h3>
          <div className="summary-grid">
            <div className="summary-card" style={{ borderLeft: '4px solid #7c3aed' }}>
              <span className="label">Total Students</span>
              <span className="value">{studentStats.total}</span>
            </div>
            {studentStats.byDepartment.map(d => (
              <div key={d.department} className="summary-card" style={{ borderLeft: '4px solid #1a56db' }}>
                <span className="label">{d.department}</span>
                <span className="value">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="charts-grid">
        <div className="card">
          <div className="card-header"><h3>Utilization by Status</h3></div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80} dataKey="value">
                {pieData.map((entry, index) => (
                  <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <div className="card-header"><h3>Utilization by Type</h3></div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" /><YAxis /><Tooltip /><Legend />
              <Bar dataKey="total" fill="#93c5fd" name="Total" />
              <Bar dataKey="booked" fill="#1a56db" name="Booked" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Booking Trend</h3>
          <div style={{ display: 'flex', gap: 4 }}>
            {[7, 14, 30].map(d => (
              <button key={d} className={`btn btn-sm ${trendDays === d ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setTrendDays(d)}>{d}d</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" /><YAxis /><Tooltip /><Legend />
            <Line type="monotone" dataKey="bookings" stroke="#1a56db" name="Bookings" strokeWidth={2} />
            <Line type="monotone" dataKey="resources" stroke="#059669" name="Unique Resources" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <div className="card-header"><h3>Top Used Resources</h3></div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Rank</th><th>Resource</th><th>Type</th><th>Location</th><th>Bookings</th><th>Total Hours</th></tr></thead>
            <tbody>
              {topResources.map((r, i) => (
                <tr key={r.id}>
                  <td>#{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td><span className={`badge badge-${r.type}`}>{r.type}</span></td>
                  <td>{r.location}</td>
                  <td>{r.booking_count}</td>
                  <td>{Number(r.total_hours || 0).toFixed(1)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Dashboard Router ─── */
const DashboardPage = () => {
  const { user } = useAuth();

  if (user?.role === 'staff') return <StaffDashboard user={user} />;
  if (user?.role === 'student') return <StudentDashboard user={user} />;
  return <AdminDashboard user={user} />;
};

export default DashboardPage;
