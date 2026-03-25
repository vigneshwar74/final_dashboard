import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const MentorGroupsPage = () => {
  const [groups, setGroups] = useState([]);
  const [staff, setStaff] = useState([]);
  const [availableStudents, setAvailableStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ staff_id: '', student_ids: [] });

  const fetchData = useCallback(async () => {
    try {
      const [groupData, meta] = await Promise.all([
        api.getMentorGroups(),
        api.getMentorGroupsMeta(),
      ]);
      setGroups(groupData);
      setStaff(meta.availableStaff || meta.staff || []);
      setAvailableStudents(meta.availableStudents || []);
    } catch (err) {
      setError(err.message || 'Failed to load mentor groups.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditingGroup(null);
    setForm({ staff_id: '', student_ids: [] });
    setSearch('');
    setFilterDept('');
    setFilterYear('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (group) => {
    setEditingGroup(group);
    setForm({
      staff_id: String(group.staff_id),
      student_ids: (group.students || []).map((s) => s.id),
    });
    setSearch('');
    setFilterDept('');
    setFilterYear('');
    setError('');
    setShowModal(true);
  };

  const departmentOptions = useMemo(() => {
    return Array.from(new Set((availableStudents || []).map((s) => s.department).filter(Boolean))).sort();
  }, [availableStudents]);

  const yearOptions = useMemo(() => {
    return Array.from(new Set((availableStudents || []).map((s) => s.year).filter(Boolean))).sort();
  }, [availableStudents]);

  const selectableStaff = useMemo(() => {
    if (!editingGroup) return staff;
    const selected = { id: editingGroup.staff_id, name: editingGroup.staff_name, email: editingGroup.staff_email };
    const map = new Map([selected, ...staff].map((s) => [s.id, s]));
    return Array.from(map.values());
  }, [editingGroup, staff]);

  const selectableStudents = useMemo(() => {
    const selectedFromGroup = editingGroup?.students || [];
    const map = new Map();
    [...availableStudents, ...selectedFromGroup].forEach((s) => map.set(s.id, s));
    const list = Array.from(map.values());
    return list.filter((s) => {
      if (filterDept && s.department !== filterDept) return false;
      if (filterYear && s.year !== filterYear) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.department?.toLowerCase().includes(q)
      );
    });
  }, [availableStudents, editingGroup, search, filterDept, filterYear]);

  const toggleStudent = (id) => {
    const exists = form.student_ids.includes(id);
    setForm({
      ...form,
      student_ids: exists ? form.student_ids.filter((x) => x !== id) : [...form.student_ids, id],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        staff_id: parseInt(form.staff_id, 10),
        student_ids: form.student_ids,
      };
      if (editingGroup) {
        await api.updateMentorGroup(editingGroup.id, payload);
        setSuccess('Mentor group updated.');
      } else {
        await api.createMentorGroup(payload);
        setSuccess('Mentor group created.');
      }
      setShowModal(false);
      await fetchData();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError(err.message || 'Save failed.');
    }
  };

  const handleDelete = async (group) => {
    if (!window.confirm(`Delete mentor group "${group.name}"?`)) return;
    try {
      await api.deleteMentorGroup(group.id);
      setSuccess('Mentor group deleted.');
      await fetchData();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Group Mentor &amp; Mentees</h1>
          <p>Create groups, assign mentor staff, and manage mentee students.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>+ New Group</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {groups.length === 0 ? (
          <div className="card" style={{ padding: 24, color: 'var(--gray-500)' }}>
            No mentor groups created yet.
          </div>
        ) : groups.map((group) => (
          <div className="card" key={group.id} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>{group.staff_name}</h3>
                <p style={{ margin: '6px 0', fontSize: 13, color: 'var(--gray-500)' }}>
                  Mentor Staff ({group.staff_email})
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--gray-500)' }}>{group.name}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(group)}>Edit</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(group)}>Delete</button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>
              Students: {group.student_count}
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(group.students || []).map((s) => (
                <span key={s.id} style={{
                  fontSize: 12,
                  background: '#eef2ff',
                  color: '#3730a3',
                  border: '1px solid #c7d2fe',
                  borderRadius: 999,
                  padding: '4px 10px',
                }}>
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 860 }}>
            <div className="modal-header">
              <h2>{editingGroup ? 'Edit Mentor Group' : 'Create Mentor Group'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}

              <div className="form-group">
                <label>1. Select Mentor Staff *</label>
                <select
                  value={form.staff_id}
                  onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
                  required
                >
                  <option value="">Select staff...</option>
                  {selectableStaff.map((st) => (
                    <option key={st.id} value={st.id}>{st.name} ({st.email})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>2. Search Students</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, department"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Department Filter</label>
                  <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                    <option value="">All Departments</option>
                    {departmentOptions.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Year Filter</label>
                  <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                    <option value="">All Years</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>
                3. Select students, then create the group.
              </div>

              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 10, maxHeight: 320, overflow: 'auto', padding: 10 }}>
                {selectableStudents.length === 0 ? (
                  <div style={{ color: 'var(--gray-500)', padding: 12 }}>No available students found.</div>
                ) : selectableStudents.map((student) => {
                  const checked = form.student_ids.includes(student.id);
                  return (
                    <label key={student.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      border: checked ? '1px solid #93c5fd' : '1px solid var(--gray-200)',
                      background: checked ? '#eff6ff' : '#fff',
                      borderRadius: 8,
                      padding: '10px 12px',
                      marginBottom: 8,
                      cursor: 'pointer',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{student.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                          {student.email} {student.department ? `• ${student.department}` : ''} {student.year ? `• ${student.year}` : ''}
                        </div>
                      </div>
                      <input type="checkbox" checked={checked} onChange={() => toggleStudent(student.id)} />
                    </label>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 8 }}>
                Selected students: {form.student_ids.length}
              </div>

              <div className="modal-actions" style={{ marginTop: 14 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!form.staff_id || form.student_ids.length === 0}
                >
                  {editingGroup ? 'Update Group' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorGroupsPage;
