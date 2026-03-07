import React, { useState, useEffect } from 'react';
import api from '../services/api';

const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entity_type: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const params = {};
        if (filters.action) params.action = filters.action;
        if (filters.entity_type) params.entity_type = filters.entity_type;
        const [l, s] = await Promise.all([
          api.getAuditLogs(params),
          api.getAuditStats(),
        ]);
        setLogs(l);
        setStats(s);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    load();
  }, [filters]);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  const actionTypes = [...new Set(logs.map(l => l.action))];
  const entityTypes = [...new Set(logs.map(l => l.entity_type))];

  return (
    <div>
      <div className="page-header">
        <h1>Audit Log</h1>
        <p>Track all system activities and changes</p>
      </div>

      {/* Stats summary */}
      <div className="summary-grid" style={{ marginBottom: 20 }}>
        {stats.slice(0, 4).map((s, i) => (
          <div key={i} className="summary-card total">
            <span className="label">{s.action} ({s.entity_type})</span>
            <span className="value">{s.count}</span>
          </div>
        ))}
      </div>

      <div className="filters-bar" style={{ marginBottom: 16 }}>
        <select className="form-control" value={filters.action}
          onChange={e => setFilters({ ...filters, action: e.target.value })}>
          <option value="">All Actions</option>
          {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="form-control" value={filters.entity_type}
          onChange={e => setFilters({ ...filters, entity_type: e.target.value })}>
          <option value="">All Entities</option>
          {entityTypes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No audit logs found</td></tr>
              ) : logs.map(l => (
                <tr key={l.id}>
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>{l.user_name || 'System'}</td>
                  <td><span className={`badge badge-${l.user_role}`}>{l.user_role}</span></td>
                  <td><span className="badge badge-active">{l.action}</span></td>
                  <td>{l.entity_type} #{l.entity_id}</td>
                  <td style={{ maxWidth: 200, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {l.details ? JSON.stringify(l.details).slice(0, 80) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogPage;
