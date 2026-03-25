import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ResourcesPage = () => {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ type: '', status: '', search: '' });
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', type: 'classroom', location: '', building: '', capacity: '', status: 'available', description: '',
  });

  const fetchResources = async () => {
    try {
      const params = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      const data = await api.getResources(params);
      setResources(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
    // eslint-disable-next-line
  }, [filters]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', type: 'classroom', location: '', building: '', capacity: '', status: 'available', description: '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (resource) => {
    setEditing(resource);
    setForm({
      name: resource.name,
      type: resource.type,
      location: resource.location || '',
      building: resource.building || '',
      capacity: resource.capacity || '',
      status: resource.status,
      description: resource.description || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form };
      if (payload.capacity) payload.capacity = parseInt(payload.capacity);
      else delete payload.capacity;

      if (editing) {
        await api.updateResource(editing.id, payload);
      } else {
        await api.createResource(payload);
      }
      setShowModal(false);
      fetchResources();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this resource? All associated bookings will also be removed.')) return;
    try {
      await api.deleteResource(id);
      fetchResources();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Resources</h1>
          <p>Manage classrooms, labs, exam halls, equipment, and computers</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={openAdd}>+ Add Resource</button>
        )}
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select
          className="form-control"
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="">All Types</option>
          <option value="classroom">Classroom</option>
          <option value="lab">Lab</option>
          <option value="exam_hall">Exam Hall</option>
          <option value="equipment">Equipment</option>
          <option value="computer">Computer</option>
        </select>
        <select
          className="form-control"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="available">Available</option>
          <option value="in_use">In Use</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <input
          type="text"
          className="form-control"
          placeholder="Search by name/location..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Location</th>
                <th>Building</th>
                <th>Capacity</th>
                <th>Status</th>
                {user?.role === 'admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {resources.length === 0 ? (
                <tr><td colSpan={7} className="empty-state">No resources found.</td></tr>
              ) : (
                resources.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td><span className={`badge badge-${r.type}`}>{r.type}</span></td>
                    <td>{r.location || '—'}</td>
                    <td>{r.building || '—'}</td>
                    <td>{r.capacity || '—'}</td>
                    <td><span className={`badge badge-${r.status}`}>{r.status.replace('_', ' ')}</span></td>
                    {user?.role === 'admin' && (
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-sm btn-secondary" onClick={() => openEdit(r)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => handleDelete(r.id)}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Resource' : 'Add Resource'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type *</label>
                  <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="classroom">Classroom</option>
                    <option value="lab">Lab</option>
                    <option value="exam_hall">Exam Hall</option>
                    <option value="equipment">Equipment</option>
                    <option value="computer">Computer</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="available">Available</option>
                    <option value="in_use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Location</label>
                  <input className="form-control" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Building</label>
                  <input className="form-control" value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" className="form-control" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} min="1" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea className="form-control" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourcesPage;
