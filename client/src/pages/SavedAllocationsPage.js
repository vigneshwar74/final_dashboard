import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';

const DEPT_COLORS = [
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  { bg: '#ccfbf1', text: '#134e4a', border: '#5eead4' },
  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  { bg: '#f3e8ff', text: '#6b21a8', border: '#c4b5fd' },
];
const getDeptColor = (i) => DEPT_COLORS[i % DEPT_COLORS.length];

const STATUS_STYLES = {
  scheduled: { bg: '#dbeafe', text: '#1e40af' },
  ongoing: { bg: '#fef3c7', text: '#92400e' },
  completed: { bg: '#dcfce7', text: '#166534' },
  cancelled: { bg: '#fee2e2', text: '#991b1b' },
};

const SavedAllocationsPage = () => {
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [highlightDept, setHighlightDept] = useState(null);
  const [seatsPerRow, setSeatsPerRow] = useState(8);
  const [editMode, setEditMode] = useState(false);
  const [editedSeating, setEditedSeating] = useState(null);
  const [dragFromSeat, setDragFromSeat] = useState(null);
  const [dragOverSeat, setDragOverSeat] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchAllocations = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      const data = await api.getExamAllocations(params);
      setAllocations(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { fetchAllocations(); }, [fetchAllocations]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this seating allocation? The students will become available for new allocations.')) return;
    try {
      await api.deleteExamAllocation(id);
      if (selectedId === id) {
        setSelectedId(null);
        setDetails(null);
        setEditMode(false);
        setEditedSeating(null);
      }
      fetchAllocations();
    } catch (err) {
      console.error(err);
      alert('Failed to delete allocation.');
    }
  };

  const startEdit = () => {
    if (!details) return;
    setEditedSeating([...details.seating]);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditedSeating(null);
    setDragFromSeat(null);
    setDragOverSeat(null);
  };

  const handleSwapSeats = (fromSeatNo, toSeatNo) => {
    if (fromSeatNo === toSeatNo || !editedSeating) return;
    const newSeating = [...editedSeating];
    const fromIdx = newSeating.findIndex(s => s.seatNo === fromSeatNo);
    const toIdx = newSeating.findIndex(s => s.seatNo === toSeatNo);
    if (fromIdx === -1 || toIdx === -1) return;
    const fromData = newSeating[fromIdx];
    const toData = newSeating[toIdx];
    newSeating[fromIdx] = { ...toData, seatNo: fromData.seatNo };
    newSeating[toIdx] = { ...fromData, seatNo: toData.seatNo };
    setEditedSeating(newSeating);
  };

  const saveEdit = async () => {
    if (!editedSeating || !selectedId) return;
    setSavingEdit(true);
    try {
      await api.updateExamSeating(selectedId, { seating: editedSeating });
      // Refresh details
      const data = await api.getExamSeatingDetails(selectedId);
      setDetails(data);
      setEditMode(false);
      setEditedSeating(null);
    } catch (err) {
      console.error(err);
      alert('Failed to save seating changes.');
    } finally {
      setSavingEdit(false);
    }
  };

  const viewDetails = async (id) => {
    if (selectedId === id && details) {
      setSelectedId(null);
      setDetails(null);
      setEditMode(false);
      setEditedSeating(null);
      return;
    }
    setSelectedId(id);
    setEditMode(false);
    setEditedSeating(null);
    setDetailLoading(true);
    try {
      const data = await api.getExamSeatingDetails(id);
      setDetails(data);
    } catch (err) {
      console.error(err);
      setDetails(null);
    }
    finally { setDetailLoading(false); }
  };

  /* ── PDF export for saved allocation ── */
  const exportPDF = () => {
    if (!details) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    const { venue, exam_name, date, start_time, end_time, departments: depts, seating, totalStudents: total } = details;

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Exam Hall Seating Arrangement', 105, 18, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const info = [
      `Exam: ${exam_name}`,
      `Hall: ${venue.name} — ${venue.location || ''} ${venue.building ? '(' + venue.building + ')' : ''}`,
      `Date: ${new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`,
      `Time: ${start_time} – ${end_time}`,
      `Total Students: ${total}   |   Hall Capacity: ${venue.capacity || 'N/A'}`,
      `Departments: ${depts.map(d => `${d.name} (${d.count})`).join(', ')}`,
    ];
    let y = 28;
    info.forEach(line => { doc.text(line, 14, y); y += 6; });

    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Seat No', 'Student Name', 'Roll Number', 'Department']],
      body: seating.map(s => [s.seatNo, s.name || '-', s.rollNo, s.department]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [26, 86, 219], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 18 },
        1: { cellWidth: 42 },
        2: { cellWidth: 35 },
        3: { cellWidth: 40 },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body') {
          const dept = seating[data.row.index]?.department;
          const idx = depts.findIndex(d => d.name === dept);
          const color = DEPT_COLORS[idx % DEPT_COLORS.length];
          if (color) {
            const hex = color.bg;
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            data.cell.styles.fillColor = [r, g, b];
          }
        }
      },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Department Summary', 14, finalY);
    autoTable(doc, {
      startY: finalY + 4,
      head: [['Department', 'Students', 'Seat Range']],
      body: depts.map(d => {
        const deptSeats = seating.filter(s => s.department === d.name);
        const range = deptSeats.length > 0
          ? `${deptSeats[0].seatNo} – ${deptSeats[deptSeats.length - 1].seatNo}`
          : '-';
        return [d.name, d.count, range];
      }),
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [55, 65, 81], textColor: 255 },
      margin: { left: 14, right: 14 },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`Seating_${exam_name.replace(/\s+/g, '_')}_${date}.pdf`);
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>📋 Saved Seating Allocations</h1>
          <p>View all confirmed exam seating arrangements and download PDFs</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="form-control" style={{ maxWidth: 200 }} value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
          {allocations.length} allocation{allocations.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {allocations.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <h3>No saved allocations yet</h3>
          <p>Generate and save a seating arrangement from the Exam Halls page</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {allocations.map(a => {
            const statusStyle = STATUS_STYLES[a.status] || STATUS_STYLES.scheduled;
            const isSelected = selectedId === a.id;
            return (
              <div key={a.id}>
                {/* Allocation summary card */}
                <div className="card" style={{
                  padding: '16px 20px', cursor: 'pointer',
                  border: isSelected ? '2px solid var(--primary)' : '1px solid var(--gray-200)',
                  transition: 'all 0.2s',
                }}
                  onClick={() => viewDetails(a.id)}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{a.exam_name}</h3>
                        <span style={{
                          background: statusStyle.bg, color: statusStyle.text,
                          padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                          textTransform: 'uppercase',
                        }}>{a.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--gray-500)' }}>
                        <span>🏫 {a.resource_name}</span>
                        <span>📅 {new Date(a.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span>⏰ {a.start_time} – {a.end_time}</span>
                        <span>👥 {a.num_students} students</span>
                        <span>📂 {a.department}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button
                        className="btn btn-sm btn-danger"
                        style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                        title="Delete allocation"
                      >
                        🗑️ Delete
                      </button>
                      <span style={{ fontSize: 20, transform: isSelected ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>▼</span>
                    </div>
                  </div>
                </div>

                {/* Expanded seating details */}
                {isSelected && (
                  <div style={{ border: '2px solid var(--primary)', borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                    {detailLoading ? (
                      <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner"></div></div>
                    ) : details ? (
                      <div style={{ padding: 24, background: 'var(--gray-50)' }}>
                        {/* Action buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
                          {!editMode ? (
                            <>
                              <button className="btn btn-secondary" onClick={startEdit}>✏️ Edit Seating</button>
                              <button className="btn btn-primary" onClick={exportPDF}>📄 Download PDF</button>
                              <button className="btn btn-danger" onClick={() => handleDelete(a.id)} style={{ background: '#dc2626', color: '#fff' }}>🗑️ Delete Allocation</button>
                            </>
                          ) : (
                            <>
                              <span style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, alignSelf: 'center' }}>🔄 Drag seats to swap students</span>
                              <button className="btn btn-success" onClick={saveEdit} disabled={savingEdit} style={{ background: '#16a34a', color: '#fff' }}>
                                {savingEdit ? '⏳ Saving...' : '💾 Save Changes'}
                              </button>
                              <button className="btn btn-secondary" onClick={cancelEdit}>Cancel</button>
                            </>
                          )}
                        </div>

                        {/* Summary cards */}
                        <div style={{
                          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                          gap: 12, marginBottom: 20,
                        }}>
                          <div style={{
                            background: '#eff6ff', border: '1.5px solid #93c5fd',
                            borderRadius: 10, padding: '14px 16px', textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 12, color: '#1e40af', fontWeight: 600 }}>Hall</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: '#1e40af' }}>{details.venue.name}</div>
                          </div>
                          <div style={{
                            background: '#f0fdf4', border: '1.5px solid #86efac',
                            borderRadius: 10, padding: '14px 16px', textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>Students</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: '#166534' }}>{details.totalStudents}</div>
                          </div>
                          <div style={{
                            background: '#fefce8', border: '1.5px solid #fcd34d',
                            borderRadius: 10, padding: '14px 16px', textAlign: 'center',
                          }}>
                            <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>Departments</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: '#92400e' }}>{details.departments.length}</div>
                          </div>
                          {details.venue.capacity && (
                            <div style={{
                              background: '#faf5ff', border: '1.5px solid #c4b5fd',
                              borderRadius: 10, padding: '14px 16px', textAlign: 'center',
                            }}>
                              <div style={{ fontSize: 12, color: '#6b21a8', fontWeight: 600 }}>Empty Seats</div>
                              <div style={{ fontSize: 28, fontWeight: 800, color: '#6b21a8' }}>
                                {Math.max(0, details.venue.capacity - details.totalStudents)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Seating grid */}
                        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
                            <h3 style={{ margin: 0 }}>🪑 Seating Arrangement</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <label style={{ fontSize: 13, fontWeight: 600 }}>Seats/Row:</label>
                              <select style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--gray-300)' }}
                                value={seatsPerRow} onChange={e => setSeatsPerRow(parseInt(e.target.value))}>
                                {[4, 5, 6, 7, 8, 10, 12].map(n => <option key={n} value={n}>{n}</option>)}
                              </select>
                            </div>
                          </div>

                          {/* Legend */}
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                            {details.departments.map((d, i) => {
                              const color = getDeptColor(i);
                              const isActive = highlightDept === d.name;
                              return (
                                <div key={d.name}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
                                    cursor: 'pointer', padding: '4px 10px', borderRadius: 6,
                                    background: isActive ? color.bg : 'transparent',
                                    border: isActive ? `1.5px solid ${color.border}` : '1.5px solid transparent',
                                    transition: 'all 0.2s',
                                  }}
                                  onClick={() => setHighlightDept(highlightDept === d.name ? null : d.name)}
                                >
                                  <div style={{ width: 14, height: 14, borderRadius: 4, background: color.bg, border: `1.5px solid ${color.border}` }} />
                                  <span>{d.name} ({d.count})</span>
                                </div>
                              );
                            })}
                            {highlightDept && (
                              <button style={{ fontSize: 12, background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}
                                onClick={() => setHighlightDept(null)}>Clear filter</button>
                            )}
                          </div>

                          {/* Grid */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(${seatsPerRow}, 1fr)`,
                            gap: 6,
                          }}>
                            {(() => {
                              const deptIndexMap = {};
                              details.departments.forEach((d, i) => { deptIndexMap[d.name] = i; });
                              const items = [];
                              const currentSeating = editMode && editedSeating ? editedSeating : details.seating;
                              const editSeatMap = {};
                              currentSeating.forEach(s => { editSeatMap[s.seatNo] = s; });
                              const editMaxSeatNo = currentSeating.length > 0
                                ? Math.max(...currentSeating.map(s => s.seatNo))
                                : 0;
                              const capacity = details.venue.capacity || editMaxSeatNo;
                              const actualTotalSlots = Math.max(capacity, editMaxSeatNo);
                              for (let i = 1; i <= actualTotalSlots; i++) {
                                const s = editSeatMap[i];
                                if (s) {
                                  const dIdx = deptIndexMap[s.department] || 0;
                                  const color = getDeptColor(dIdx);
                                  const dimmed = highlightDept && highlightDept !== s.department;
                                  const isDragSource = dragFromSeat === i;
                                  const isDragTarget = dragOverSeat === i && dragFromSeat !== null && dragFromSeat !== i;
                                  items.push(
                                    <div key={i}
                                      draggable={editMode}
                                      onDragStart={editMode ? (e) => {
                                        setDragFromSeat(i);
                                        e.dataTransfer.effectAllowed = 'move';
                                      } : undefined}
                                      onDragOver={editMode ? (e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        setDragOverSeat(i);
                                      } : undefined}
                                      onDragLeave={editMode ? () => setDragOverSeat(null) : undefined}
                                      onDrop={editMode ? (e) => {
                                        e.preventDefault();
                                        if (dragFromSeat !== null) handleSwapSeats(dragFromSeat, i);
                                        setDragFromSeat(null);
                                        setDragOverSeat(null);
                                      } : undefined}
                                      onDragEnd={editMode ? () => { setDragFromSeat(null); setDragOverSeat(null); } : undefined}
                                      style={{
                                        padding: '8px 4px', borderRadius: 8, textAlign: 'center',
                                        background: color.bg, color: color.text,
                                        border: `1.5px solid ${color.border}`,
                                        fontSize: 11, fontWeight: 600,
                                        opacity: isDragSource ? 0.4 : dimmed ? 0.25 : 1,
                                        filter: dimmed ? 'grayscale(0.8)' : 'none',
                                        transition: 'all 0.2s',
                                        outline: isDragTarget ? '2.5px dashed var(--primary)' : 'none',
                                        outlineOffset: isDragTarget ? '-2px' : 0,
                                        transform: isDragTarget ? 'scale(1.1)' : 'scale(1)',
                                        cursor: editMode ? 'grab' : 'default',
                                      }}
                                      title={`Seat ${s.seatNo} | ${s.name} | ${s.rollNo} | ${s.department}${editMode ? ' — drag to swap' : ''}`}
                                    >
                                      <div style={{ fontSize: 13, fontWeight: 700 }}>{s.seatNo}</div>
                                      <div style={{ fontSize: 10, fontWeight: 600, marginTop: 1 }}>{s.name ? s.name.split(' ')[0] : ''}</div>
                                      <div style={{ fontSize: 10, opacity: 0.85, marginTop: 2 }}>{s.rollNo}</div>
                                      <div style={{ fontSize: 9, opacity: 0.7, marginTop: 1 }}>{s.department.length > 8 ? s.department.substring(0, 8) + '..' : s.department}</div>
                                    </div>
                                  );
                                } else {
                                  items.push(
                                    <div key={i} style={{
                                      padding: '8px 4px', borderRadius: 8, textAlign: 'center',
                                      background: 'var(--gray-100)', border: '1.5px dashed var(--gray-300)',
                                      fontSize: 11, color: 'var(--gray-400)',
                                    }}>
                                      <div style={{ fontSize: 13 }}>—</div>
                                      <div style={{ fontSize: 10 }}>Empty</div>
                                    </div>
                                  );
                                }
                              }
                              return items;
                            })()}
                          </div>
                        </div>

                        {/* Department-wise table */}
                        <div className="card" style={{ padding: 20 }}>
                          <h3 style={{ marginBottom: 12 }}>📋 Department-wise Seating List</h3>
                          {details.departments.map((d, i) => {
                            const color = getDeptColor(i);
                            const deptSeats = details.seating.filter(s => s.department === d.name);
                            return (
                              <div key={d.name} style={{ marginBottom: 20 }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                                  padding: '8px 14px', borderRadius: 8, background: color.bg,
                                  border: `1.5px solid ${color.border}`,
                                }}>
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: color.text }} />
                                  <span style={{ fontWeight: 700, color: color.text }}>{d.name}</span>
                                  <span style={{ fontSize: 12, color: color.text, opacity: 0.7 }}>— {d.count} students</span>
                                  <span style={{ marginLeft: 'auto', fontSize: 12, color: color.text }}>
                                    Seats: {deptSeats[0]?.seatNo} – {deptSeats[deptSeats.length - 1]?.seatNo}
                                  </span>
                                </div>
                                <div className="table-wrapper">
                                  <table>
                                    <thead>
                                      <tr>
                                        <th style={{ width: 80, textAlign: 'center' }}>Seat No</th>
                                        <th>Student Name</th>
                                        <th>Roll Number</th>
                                        <th>Department</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {deptSeats.map(s => (
                                        <tr key={s.seatNo}>
                                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.seatNo}</td>
                                          <td style={{ fontWeight: 600 }}>{s.name || '-'}</td>
                                          <td>{s.rollNo}</td>
                                          <td>{s.department}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
                        Failed to load seating details
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SavedAllocationsPage;
