import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const DEPT_COLORS = {
  'Computer Science': { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  'Electronics': { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  'Mechanical': { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  'Electrical': { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  'Civil': { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
};
const getColor = (dept) => DEPT_COLORS[dept] || { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', roll_number: '', department: '', year: '', email: '' });

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (filterDept) params.department = filterDept;
      if (search) params.search = search;
      const [s, d, st] = await Promise.all([
        api.getStudents(params),
        api.getStudentDepartments(),
        api.getStudentStats(),
      ]);
      setStudents(s);
      setDepartments(d);
      setStats(st);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filterDept, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAddModal = () => {
    setEditingStudent(null);
    setForm({ name: '', roll_number: '', department: '', year: '', email: '' });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (student) => {
    setEditingStudent(student);
    setForm({
      name: student.name,
      roll_number: student.roll_number,
      department: student.department,
      year: student.year || '',
      email: student.email || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingStudent) {
        await api.updateStudent(editingStudent.id, form);
        setSuccess('Student updated!');
      } else {
        await api.createStudent(form);
        setSuccess('Student added!');
      }
      setShowModal(false);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Remove student "${name}"? This cannot be undone.`)) return;
    try {
      await api.deleteStudent(id);
      setSuccess('Student removed.');
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>👨‍🎓 Students Management</h1>
          <p>View, add, edit, and remove students across departments</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>+ Add Student</button>
      </div>

      {success && <div className="alert alert-success">{success}</div>}

      {/* Stats cards */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: 12, marginBottom: 20,
        }}>
          <div className="summary-card total">
            <span className="label">Total Students</span>
            <span className="value">{stats.total}</span>
          </div>
          {stats.byDepartment.map(d => {
            const color = getColor(d.department);
            return (
              <div key={d.department} style={{
                background: color.bg, border: `1.5px solid ${color.border}`,
                borderRadius: 10, padding: '14px 16px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: color.text }}>{d.department}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: color.text }}>{d.count}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="form-control" style={{ maxWidth: 220 }} value={filterDept}
          onChange={e => setFilterDept(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="text" placeholder="Search name or roll no..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--gray-300)', fontSize: 14, maxWidth: 280 }}
        />
        <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
          Showing {students.length} student{students.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Students table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Roll Number</th>
                <th>Department</th>
                <th>Year</th>
                <th>Email</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#6b7280' }}>No students found</td></tr>
              ) : students.map((s, i) => {
                const color = getColor(s.department);
                return (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--gray-400)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td><code style={{ background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 4, fontSize: 13 }}>{s.roll_number}</code></td>
                    <td>
                      <span style={{
                        background: color.bg, color: color.text, border: `1px solid ${color.border}`,
                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      }}>{s.department}</span>
                    </td>
                    <td>{s.year || '-'}</td>
                    <td style={{ fontSize: 13 }}>{s.email || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm btn-outline" onClick={() => openEditModal(s)}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(s.id, s.name)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2>{editingStudent ? 'Edit Student' : 'Add Student'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label>Full Name *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  required placeholder="e.g. Aarav Sharma" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Roll Number *</label>
                  <input type="text" value={form.roll_number} onChange={e => setForm({ ...form, roll_number: e.target.value })}
                    required placeholder="e.g. CS-011" />
                </div>
                <div className="form-group">
                  <label>Department *</label>
                  <input type="text" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                    required placeholder="e.g. Computer Science" list="dept-list" />
                  <datalist id="dept-list">
                    {departments.map(d => <option key={d} value={d} />)}
                  </datalist>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label>Year</label>
                  <select value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}>
                    <option value="">Select...</option>
                    <option value="1st Year">1st Year</option>
                    <option value="2nd Year">2nd Year</option>
                    <option value="3rd Year">3rd Year</option>
                    <option value="4th Year">4th Year</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="student@college.edu" />
                </div>
              </div>

              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingStudent ? 'Update Student' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;
