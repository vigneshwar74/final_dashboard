import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../services/api';

/* ─── department color palette ─── */
const DEPT_COLORS = [
  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  { bg: '#dcfce7', text: '#166534', border: '#86efac' },
  { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  { bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  { bg: '#ccfbf1', text: '#134e4a', border: '#5eead4' },
  { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  { bg: '#f3e8ff', text: '#6b21a8', border: '#c4b5fd' },
  { bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  { bg: '#e0f2fe', text: '#075985', border: '#7dd3fc' },
];
const getDeptColor = (i) => DEPT_COLORS[i % DEPT_COLORS.length];

/* ─── inline styles (interactive CSS) ─── */
const styles = {
  page: { padding: 0 },

  /* ── Step Wizard ── */
  wizard: {
    display: 'flex', gap: 0, marginBottom: 28,
    background: 'var(--gray-100)', borderRadius: 12, overflow: 'hidden',
    border: '1px solid var(--gray-200)',
  },
  step: (active, done) => ({
    flex: 1, padding: '14px 20px', textAlign: 'center',
    fontWeight: 600, fontSize: 14, cursor: 'default',
    background: active ? 'var(--primary)' : done ? 'var(--primary-light)' : 'transparent',
    color: active ? '#fff' : done ? '#fff' : 'var(--gray-400)',
    transition: 'all 0.3s ease',
    position: 'relative',
  }),
  stepNum: {
    display: 'inline-flex', width: 24, height: 24, borderRadius: '50%',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.25)', marginRight: 8, fontSize: 12,
  },

  /* ── Hall Card ── */
  hallGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 14, marginTop: 14,
  },
  hallCard: (selected) => ({
    border: `2px solid ${selected ? 'var(--primary)' : 'var(--gray-200)'}`,
    borderRadius: 10, padding: 16, cursor: 'pointer',
    background: selected ? 'rgba(26,86,219,0.06)' : '#fff',
    transition: 'all 0.2s ease', position: 'relative',
    boxShadow: selected ? '0 0 0 3px rgba(26,86,219,0.15)' : 'none',
  }),
  hallName: { fontWeight: 700, fontSize: 15, marginBottom: 4 },
  hallMeta: { fontSize: 13, color: 'var(--gray-500)' },
  hallCap: {
    position: 'absolute', top: 10, right: 12,
    background: 'var(--primary)', color: '#fff', fontSize: 12,
    fontWeight: 700, padding: '2px 10px', borderRadius: 20,
  },
  hallCheck: {
    position: 'absolute', bottom: 10, right: 12,
    background: 'var(--success)', color: '#fff', borderRadius: '50%',
    width: 22, height: 22, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 14,
  },

  /* ── Department List ── */
  deptSection: { marginTop: 10 },
  deptRow: (color) => ({
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', borderRadius: 10, marginBottom: 10,
    background: color.bg, border: `1.5px solid ${color.border}`,
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
  }),
  deptBadge: (color) => ({
    width: 10, height: 10, borderRadius: '50%', background: color.text, flexShrink: 0,
  }),
  deptInput: {
    flex: 2, padding: '8px 12px', borderRadius: 8,
    border: '1.5px solid var(--gray-300)', fontSize: 14,
    outline: 'none', transition: 'border 0.2s',
  },
  deptCountInput: {
    width: 90, padding: '8px 12px', borderRadius: 8,
    border: '1.5px solid var(--gray-300)', fontSize: 14, textAlign: 'center',
    outline: 'none', transition: 'border 0.2s',
  },
  removeBtn: {
    background: 'var(--danger)', color: '#fff', border: 'none',
    borderRadius: 8, width: 34, height: 34, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, transition: 'transform 0.15s', flexShrink: 0,
  },
  addDeptBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '10px 20px', borderRadius: 10, border: '2px dashed var(--primary-light)',
    background: 'rgba(26,86,219,0.04)', color: 'var(--primary)',
    cursor: 'pointer', fontWeight: 600, fontSize: 14, width: '100%',
    transition: 'all 0.2s',
  },

  /* ── Exam info grid ── */
  formGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12,
  },
  formGroup: { marginBottom: 12 },
  label: {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'var(--gray-600)', marginBottom: 4,
  },
  input: {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1.5px solid var(--gray-300)', fontSize: 14, outline: 'none',
    transition: 'border 0.2s',
  },

  /* ── Buttons bar ── */
  btnBar: {
    display: 'flex', justifyContent: 'space-between', marginTop: 20, gap: 12,
  },

  /* ── Seating Grid ── */
  seatingWrap: {
    marginTop: 24,
  },
  seatingHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16, flexWrap: 'wrap', gap: 12,
  },
  legend: {
    display: 'flex', gap: 14, flexWrap: 'wrap',
  },
  legendItem: (color) => ({
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500,
  }),
  legendDot: (color) => ({
    width: 14, height: 14, borderRadius: 4, background: color.bg,
    border: `1.5px solid ${color.border}`,
  }),
  grid: (cols) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: 6,
  }),
  seat: (color, highlighted) => ({
    padding: '8px 4px', borderRadius: 8, textAlign: 'center',
    background: highlighted ? color.text : color.bg,
    color: highlighted ? '#fff' : color.text,
    border: `1.5px solid ${color.border}`,
    fontSize: 11, fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    transform: highlighted ? 'scale(1.08)' : 'scale(1)',
    boxShadow: highlighted ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
  }),
  seatNo: { fontSize: 13, fontWeight: 700 },
  seatRoll: { fontSize: 10, opacity: 0.85, marginTop: 2 },
  seatDept: { fontSize: 9, opacity: 0.7, marginTop: 1 },
  emptySeat: {
    padding: '8px 4px', borderRadius: 8, textAlign: 'center',
    background: 'var(--gray-100)', border: '1.5px dashed var(--gray-300)',
    fontSize: 11, color: 'var(--gray-400)',
  },

  /* ── Summary cards ── */
  summaryGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 12, marginBottom: 20,
  },
  summaryCard: (color) => ({
    background: color.bg, border: `1.5px solid ${color.border}`,
    borderRadius: 10, padding: '14px 16px', textAlign: 'center',
  }),
  summaryLabel: (color) => ({ fontSize: 12, color: color.text, fontWeight: 600 }),
  summaryValue: (color) => ({ fontSize: 28, fontWeight: 800, color: color.text }),
};

const ExamAllocationPage = () => {
  const navigate = useNavigate();
  /* ── state ── */
  const [step, setStep] = useState(1); // 1=date/time, 2=hall, 3=departments, 4=result
  const [venues, setVenues] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [deptEntries, setDeptEntries] = useState([{ name: '', count: '' }]);
  const [examInfo, setExamInfo] = useState({ exam_name: '', date: '', start_time: '', end_time: '' });
  const [seatingResult, setSeatingResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [highlightDept, setHighlightDept] = useState(null);
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [seatsPerRow, setSeatsPerRow] = useState(8);

  const [conflictWarnings, setConflictWarnings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [availableCounts, setAvailableCounts] = useState({});
  const [dragFromIndex, setDragFromIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  /* ── fetch departments list on mount ── */
  const fetchDepartments = useCallback(async () => {
    try {
      const d = await api.getStudentDepartments();
      setDepartments(d);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  /* ── fetch available venues when date+time confirmed (step 1 → step 2) ── */
  const fetchAvailableVenues = useCallback(async () => {
    if (!examInfo.date || !examInfo.start_time || !examInfo.end_time) return;
    setLoadingVenues(true);
    try {
      const v = await api.getSuitableVenues({
        num_students: 1,
        date: examInfo.date,
        start_time: examInfo.start_time,
        end_time: examInfo.end_time,
      });
      setVenues(v);
    } catch (err) { console.error(err); }
    finally { setLoadingVenues(false); }
  }, [examInfo.date, examInfo.start_time, examInfo.end_time]);

  /* ── fetch available student counts when date+time+departments change ── */
  useEffect(() => {
    if (!examInfo.date || !examInfo.start_time || !examInfo.end_time) { setAvailableCounts({}); return; }
    const fetchAvailable = async () => {
      try {
        const counts = {};
        for (const dept of departments) {
          const students = await api.getAvailableStudents({
            department: dept,
            date: examInfo.date,
            start_time: examInfo.start_time,
            end_time: examInfo.end_time,
          });
          counts[dept] = students.length;
        }
        setAvailableCounts(counts);
      } catch (err) { console.error(err); }
    };
    fetchAvailable();
  }, [examInfo.date, examInfo.start_time, examInfo.end_time, departments]);

  /* ── department helpers ── */
  const addDept = () => setDeptEntries([...deptEntries, { name: '', count: '' }]);
  const removeDept = (i) => {
    if (deptEntries.length <= 1) return;
    setDeptEntries(deptEntries.filter((_, idx) => idx !== i));
  };
  const updateDept = (i, field, val) => {
    const copy = [...deptEntries];
    copy[i] = { ...copy[i], [field]: val };
    setDeptEntries(copy);
  };
  const totalStudents = deptEntries.reduce((s, d) => s + (parseInt(d.count) || 0), 0);

  /* ── generate seating ── */
  const handleGenerate = async () => {
    setError('');
    if (!examInfo.date || !examInfo.start_time || !examInfo.end_time) {
      setError('Please fill in date and timing first.'); setStep(1); return;
    }
    if (!selectedVenue) { setError('Please select an exam hall.'); setStep(2); return; }
    if (!examInfo.exam_name) { setError('Please enter the exam name.'); return; }
    const validDepts = deptEntries.filter(d => d.name && parseInt(d.count) > 0);
    if (validDepts.length < 1) { setError('Add at least one department with students.'); return; }
    // Check for duplicate department names
    const names = validDepts.map(d => d.name.toLowerCase());
    if (new Set(names).size !== names.length) { setError('Duplicate department names found.'); return; }

    setGenerating(true);
    try {
      const result = await api.generateSeating({
        resource_id: selectedVenue.id,
        departments: validDepts.map(d => ({ name: d.name, count: parseInt(d.count) })),
        exam_name: examInfo.exam_name,
        date: examInfo.date,
        start_time: examInfo.start_time,
        end_time: examInfo.end_time,
      });
      setSeatingResult(result);
      setConflictWarnings(result.conflictWarnings || []);
      setSaved(false);
      setStep(4);
    } catch (err) {
      setError(err.message || 'Failed to generate seating.');
    } finally { setGenerating(false); }
  };

  /* ── build dept→index map for colors ── */
  const deptIndexMap = {};
  if (seatingResult) {
    seatingResult.departments.forEach((d, i) => { deptIndexMap[d.name] = i; });
  }

  /* ── drag-and-drop seat swap ── */
  const handleSwapSeats = (fromSeatNo, toSeatNo) => {
    if (fromSeatNo === toSeatNo || !seatingResult || saved) return;
    const newSeating = [...seatingResult.seating];
    const fromIdx = newSeating.findIndex(s => s.seatNo === fromSeatNo);
    const toIdx = newSeating.findIndex(s => s.seatNo === toSeatNo);
    if (fromIdx === -1 || toIdx === -1) return;
    const fromData = newSeating[fromIdx];
    const toData = newSeating[toIdx];
    // Keep seatNo tied to position, swap student info
    newSeating[fromIdx] = { ...toData, seatNo: fromData.seatNo };
    newSeating[toIdx] = { ...fromData, seatNo: toData.seatNo };
    setSeatingResult({ ...seatingResult, seating: newSeating });
  };

  /* ── PDF export ── */
  const exportPDF = () => {
    if (!seatingResult) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    const { venue, exam_name, date, start_time, end_time, departments: depts, seating, totalStudents: total } = seatingResult;

    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Exam Hall Seating Arrangement', 105, 18, { align: 'center' });

    // Info box
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

    // Seating table
    y += 4;
    const tableData = seating.map(s => [s.seatNo, s.name || '-', s.rollNo, s.department]);
    autoTable(doc, {
      startY: y,
      head: [['Seat No', 'Student Name', 'Roll Number', 'Department']],
      body: tableData,
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

    // Department summary after table
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

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`Seating_${exam_name.replace(/\s+/g, '_')}_${date}.pdf`);
  };

  /* ── save allocation to DB ── */
  const handleSave = async () => {
    if (!seatingResult || saved) return;
    if (!window.confirm('Save this seating arrangement? Once saved, these students will be marked as allocated for this exam date.')) return;
    setSaving(true);
    setError('');
    try {
      await api.saveSeating({
        resource_id: seatingResult.venue.id,
        departments: seatingResult.departments,
        exam_name: seatingResult.exam_name,
        date: seatingResult.date,
        start_time: seatingResult.start_time,
        end_time: seatingResult.end_time,
        seating: seatingResult.seating,
      });
      setSaved(true);
      // Navigate to saved allocations to see the final result
      setTimeout(() => navigate('/saved-allocations'), 800);
    } catch (err) {
      setError(err.message || 'Failed to save allocation.');
    } finally { setSaving(false); }
  };

  /* ── reset ── */
  const handleReset = () => {
    setStep(1);
    setSelectedVenue(null);
    setVenues([]);
    setDeptEntries([{ name: '', count: '' }]);
    setExamInfo({ exam_name: '', date: '', start_time: '', end_time: '' });
    setSeatingResult(null);
    setError('');
    setHighlightDept(null);
    setConflictWarnings([]);
    setSaved(false);
    setDragFromIndex(null);
    setDragOverIndex(null);
    setAvailableCounts({});
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div style={styles.page}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>🎓 Exam Hall Allocation</h1>
          <p>Select hall, add departments, generate alternating seating &amp; export PDF</p>
        </div>
        {step === 4 && (
          <div style={{ display: 'flex', gap: 10 }}>
            {!saved && (
              <button className="btn btn-success" onClick={handleSave} disabled={saving} style={{ background: '#16a34a', color: '#fff' }}>
                {saving ? '⏳ Saving...' : '💾 Save Allocation'}
              </button>
            )}
            {saved && <span style={{ padding: '8px 16px', background: '#dcfce7', color: '#166534', borderRadius: 8, fontWeight: 600 }}>✅ Saved</span>}
            <button className="btn btn-primary" onClick={exportPDF}>📄 Download PDF</button>
            <button className="btn btn-secondary" onClick={handleReset}>↩ New Allocation</button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Step Wizard */}
      <div style={styles.wizard}>
        {[
          { n: 1, label: 'Date & Time' },
          { n: 2, label: 'Select Hall' },
          { n: 3, label: 'Exam & Departments' },
          { n: 4, label: 'Seating Result' },
        ].map(s => (
          <div key={s.n} style={styles.step(step === s.n, step > s.n)}
            onClick={() => { if (s.n < step) setStep(s.n); }}
          >
            <span style={styles.stepNum}>{step > s.n ? '✓' : s.n}</span>
            {s.label}
          </div>
        ))}
      </div>

      {/* ────── STEP 1: Date & Time ────── */}
      {step === 1 && (
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ marginBottom: 4 }}>📅 Select Date & Timing</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 16 }}>
            Enter the exam date and time slot first. Venues and students will be filtered based on availability for this slot.
          </p>

          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Date *</label>
              <input style={styles.input} type="date" value={examInfo.date}
                onChange={e => { setExamInfo({ ...examInfo, date: e.target.value }); setSelectedVenue(null); setVenues([]); }} />
            </div>
            <div />
            <div style={styles.formGroup}>
              <label style={styles.label}>Start Time *</label>
              <input style={styles.input} type="time" value={examInfo.start_time}
                onChange={e => { setExamInfo({ ...examInfo, start_time: e.target.value }); setSelectedVenue(null); setVenues([]); }} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>End Time *</label>
              <input style={styles.input} type="time" value={examInfo.end_time}
                onChange={e => { setExamInfo({ ...examInfo, end_time: e.target.value }); setSelectedVenue(null); setVenues([]); }} />
            </div>
          </div>

          {examInfo.date && examInfo.start_time && examInfo.end_time && examInfo.start_time >= examInfo.end_time && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              ⚠️ End time must be after start time.
            </div>
          )}

          <div style={styles.btnBar}>
            <div />
            <button className="btn btn-primary"
              disabled={!examInfo.date || !examInfo.start_time || !examInfo.end_time || examInfo.start_time >= examInfo.end_time}
              onClick={() => { setError(''); fetchAvailableVenues(); setStep(2); }}
            >
              Next → Select Hall
            </button>
          </div>
        </div>
      )}

      {/* ────── STEP 2: Select Hall (only available for date+time) ────── */}
      {step === 2 && (
        <div className="card" style={{ padding: 24 }}>
          {/* Date/time mini-card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(16,185,129,0.06)', border: '1.5px solid rgba(16,185,129,0.2)',
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 28 }}>📅</span>
            <div>
              <div style={{ fontWeight: 700 }}>
                {new Date(examInfo.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                {examInfo.start_time} – {examInfo.end_time}
              </div>
            </div>
            <button className="btn btn-sm btn-outline" style={{ marginLeft: 'auto' }}
              onClick={() => setStep(1)}>Change</button>
          </div>

          <h3 style={{ marginBottom: 4 }}>Select Exam Hall</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, marginBottom: 12 }}>
            Showing only venues available on {new Date(examInfo.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} from {examInfo.start_time} to {examInfo.end_time}
          </p>

          {loadingVenues ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
              Loading available venues...
            </div>
          ) : venues.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
              No available venues found for this date and time slot. Try a different time.
            </div>
          ) : (
            <div style={styles.hallGrid}>
              {venues.map(v => (
                <div key={v.id}
                  style={styles.hallCard(selectedVenue?.id === v.id)}
                  onClick={() => setSelectedVenue(v)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = selectedVenue?.id === v.id ? '0 0 0 3px rgba(26,86,219,0.15)' : 'none'; }}
                >
                  {v.capacity && <span style={styles.hallCap}>{v.capacity} seats</span>}
                  {selectedVenue?.id === v.id && <span style={styles.hallCheck}>✓</span>}
                  <div style={styles.hallName}>{v.name}</div>
                  <div style={styles.hallMeta}>{v.location}</div>
                  {v.building && <div style={styles.hallMeta}>{v.building}</div>}
                  <span style={{
                    display: 'inline-block', marginTop: 6, marginRight: 6, fontSize: 11, fontWeight: 600,
                    padding: '2px 8px', borderRadius: 6,
                    background: '#dcfce7', color: '#166534',
                  }}>
                    ✅ Available
                  </span>
                  {v.type && (
                    <span style={{
                      display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 6,
                      background: v.type === 'exam_hall' ? '#dbeafe' : v.type === 'lab' ? '#dcfce7' : '#f3e8ff',
                      color: v.type === 'exam_hall' ? '#1e40af' : v.type === 'lab' ? '#166534' : '#6b21a8',
                    }}>
                      {v.type === 'exam_hall' ? '🎓 Exam Hall' : v.type === 'lab' ? '🔬 Lab' : v.type === 'classroom' ? '🏫 Classroom' : v.type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={styles.btnBar}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" disabled={!selectedVenue}
              onClick={() => { setError(''); setStep(3); }}
            >
              Next → Exam &amp; Departments
            </button>
          </div>
        </div>
      )}

      {/* ────── STEP 3: Exam Name & Departments ────── */}
      {step === 3 && (
        <div className="card" style={{ padding: 24 }}>
          {/* Date/time + venue mini-card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(26,86,219,0.06)', border: '1.5px solid rgba(26,86,219,0.15)',
            marginBottom: 20, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 28 }}>🏫</span>
            <div>
              <div style={{ fontWeight: 700 }}>{selectedVenue?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                {selectedVenue?.location} {selectedVenue?.building && `• ${selectedVenue.building}`} • Capacity: {selectedVenue?.capacity || 'N/A'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                📅 {new Date(examInfo.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} • ⏰ {examInfo.start_time} – {examInfo.end_time}
              </div>
            </div>
            <button className="btn btn-sm btn-outline" style={{ marginLeft: 'auto' }}
              onClick={() => setStep(2)}>Change Hall</button>
          </div>

          {/* Exam name */}
          <h3 style={{ marginBottom: 8 }}>Exam Details</h3>
          <div style={styles.formGrid}>
            <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
              <label style={styles.label}>Exam Name *</label>
              <input style={styles.input} type="text" placeholder="e.g. Mid-Term Mathematics"
                value={examInfo.exam_name}
                onChange={e => setExamInfo({ ...examInfo, exam_name: e.target.value })} />
            </div>
          </div>

          {/* Department list */}
          <h3 style={{ marginTop: 20, marginBottom: 8 }}>
            Departments
            <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--gray-500)', marginLeft: 8 }}>
              ({deptEntries.filter(d => d.name).length} added • {totalStudents} students total)
            </span>
          </h3>
          <p style={{ color: 'var(--gray-500)', fontSize: 12, marginBottom: 10 }}>
            Students already allocated for {new Date(examInfo.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} {examInfo.start_time}–{examInfo.end_time} are excluded from available counts.
          </p>

          <div style={styles.deptSection}>
            {deptEntries.map((entry, i) => {
              const color = getDeptColor(i);
              return (
                <div key={i} style={styles.deptRow(color)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateX(4px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <div style={styles.deptBadge(color)} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: color.text, minWidth: 24 }}>#{i + 1}</span>
                  <select style={{ ...styles.deptInput, flex: 2 }} value={entry.name}
                    onChange={e => updateDept(i, 'name', e.target.value)}>
                    <option value="">Select Department...</option>
                    {departments.map(d => (
                      <option key={d} value={d} disabled={deptEntries.some((e, idx) => idx !== i && e.name === d)}>{d}</option>
                    ))}
                  </select>
                  <input style={styles.deptCountInput} type="number" min="1" placeholder="Students"
                    max={entry.name && availableCounts[entry.name] ? availableCounts[entry.name] : undefined}
                    value={entry.count} onChange={e => updateDept(i, 'count', e.target.value)} />
                  {entry.name && examInfo.date && examInfo.start_time && examInfo.end_time && availableCounts[entry.name] !== undefined && (
                    <span style={{ fontSize: 11, color: availableCounts[entry.name] === 0 ? 'var(--danger)' : 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                      {availableCounts[entry.name]} avail.
                    </span>
                  )}
                  <button style={styles.removeBtn} onClick={() => removeDept(i)}
                    disabled={deptEntries.length <= 1}
                    title="Remove department"
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                  >×</button>
                </div>
              );
            })}

            <button style={styles.addDeptBtn} onClick={addDept}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,86,219,0.1)'; e.currentTarget.style.borderColor = 'var(--primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(26,86,219,0.04)'; e.currentTarget.style.borderColor = 'var(--primary-light)'; }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Add Department
            </button>
          </div>

          {/* Capacity warning */}
          {selectedVenue?.capacity && totalStudents > selectedVenue.capacity && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              ⚠️ Total students ({totalStudents}) exceed hall capacity ({selectedVenue.capacity}).
              The hall may not fit all students.
            </div>
          )}
          {selectedVenue?.capacity && totalStudents > 0 && totalStudents <= selectedVenue.capacity && (
            <div className="alert alert-info" style={{ marginTop: 12 }}>
              ✅ {totalStudents} students / {selectedVenue.capacity} seats
              — {selectedVenue.capacity - totalStudents} seats will be empty
            </div>
          )}

          <div style={styles.btnBar}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? '⏳ Generating...' : '🪑 Generate Seating Arrangement'}
            </button>
          </div>
        </div>
      )}

      {/* ────── STEP 4: Result ────── */}
      {step === 4 && seatingResult && (
        <div>
          {/* Conflict warnings */}
          {conflictWarnings.length > 0 && (
            <div className="alert alert-error" style={{ marginBottom: 16 }}>
              <strong>⚠️ Conflict Warnings:</strong>
              <ul style={{ margin: '6px 0 0 16px', paddingLeft: 0 }}>
                {conflictWarnings.map((w, i) => <li key={i} style={{ marginBottom: 2 }}>{w}</li>)}
              </ul>
            </div>
          )}
          {/* Summary cards */}
          <div style={styles.summaryGrid}>
            <div style={{
              ...styles.summaryCard({ bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' }),
            }}>
              <div style={styles.summaryLabel({ text: '#1e40af' })}>Hall</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1e40af' }}>{seatingResult.venue.name}</div>
            </div>
            <div style={styles.summaryCard({ bg: '#f0fdf4', border: '#86efac', text: '#166534' })}>
              <div style={styles.summaryLabel({ text: '#166534' })}>Total Students</div>
              <div style={styles.summaryValue({ text: '#166534' })}>{seatingResult.totalStudents}</div>
            </div>
            <div style={styles.summaryCard({ bg: '#fefce8', border: '#fcd34d', text: '#92400e' })}>
              <div style={styles.summaryLabel({ text: '#92400e' })}>Departments</div>
              <div style={styles.summaryValue({ text: '#92400e' })}>{seatingResult.departments.length}</div>
            </div>
            {seatingResult.venue.capacity && (
              <div style={styles.summaryCard({ bg: '#faf5ff', border: '#c4b5fd', text: '#6b21a8' })}>
                <div style={styles.summaryLabel({ text: '#6b21a8' })}>Empty Seats</div>
                <div style={styles.summaryValue({ text: '#6b21a8' })}>
                  {Math.max(0, seatingResult.venue.capacity - seatingResult.totalStudents)}
                </div>
              </div>
            )}
          </div>

          {/* Exam info bar */}
          <div className="card" style={{ padding: '14px 20px', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <span><strong>📝 Exam:</strong> {seatingResult.exam_name}</span>
            <span><strong>📅 Date:</strong> {new Date(seatingResult.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span><strong>⏰ Time:</strong> {seatingResult.start_time} – {seatingResult.end_time}</span>
            <span><strong>📍 Venue:</strong> {seatingResult.venue.name} ({seatingResult.venue.location})</span>
          </div>

          {/* Seating Chart */}
          <div className="card" style={{ padding: 24 }}>
            <div style={styles.seatingHeader}>
              <div>
                <h3 style={{ marginBottom: 6 }}>🪑 Seating Arrangement</h3>
                <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                  Same department students are not placed next to each other (alternating pattern).
                  {!saved && ' Drag a seat onto another to swap students.'}
                  {' '}Click a department in the legend to highlight.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Seats/Row:</label>
                <select style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--gray-300)' }}
                  value={seatsPerRow} onChange={e => setSeatsPerRow(parseInt(e.target.value))}>
                  {[4, 5, 6, 7, 8, 10, 12].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {/* Legend */}
            <div style={{ ...styles.legend, marginBottom: 16 }}>
              {seatingResult.departments.map((d, i) => {
                const color = getDeptColor(i);
                const isActive = highlightDept === d.name;
                return (
                  <div key={d.name}
                    style={{
                      ...styles.legendItem(color),
                      cursor: 'pointer',
                      padding: '4px 10px', borderRadius: 6,
                      background: isActive ? color.bg : 'transparent',
                      border: isActive ? `1.5px solid ${color.border}` : '1.5px solid transparent',
                      transition: 'all 0.2s',
                    }}
                    onClick={() => setHighlightDept(highlightDept === d.name ? null : d.name)}
                  >
                    <div style={styles.legendDot(color)} />
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
            <div style={styles.grid(seatsPerRow)}>
              {(() => {
                const seatMap = {};
                seatingResult.seating.forEach(s => { seatMap[s.seatNo] = s; });
                const maxSeatNo = seatingResult.seating.length > 0
                  ? Math.max(...seatingResult.seating.map(s => s.seatNo))
                  : 0;
                const capacity = seatingResult.venue.capacity || maxSeatNo;
                const totalSlots = Math.max(capacity, maxSeatNo);
                const items = [];
                for (let i = 1; i <= totalSlots; i++) {
                  const s = seatMap[i];
                  if (s) {
                    const dIdx = deptIndexMap[s.department] || 0;
                    const color = getDeptColor(dIdx);
                    const dimmed = highlightDept && highlightDept !== s.department;
                    const highlighted = hoveredSeat === i;
                    const isDragSource = dragFromIndex === i;
                    const isDragTarget = dragOverIndex === i && dragFromIndex !== null && dragFromIndex !== i;
                    items.push(
                      <div key={i}
                        draggable={!saved}
                        onDragStart={(e) => {
                          setDragFromIndex(i);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDragOverIndex(i);
                        }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragFromIndex !== null) handleSwapSeats(dragFromIndex, i);
                          setDragFromIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDragEnd={() => { setDragFromIndex(null); setDragOverIndex(null); }}
                        style={{
                          ...styles.seat(color, highlighted),
                          opacity: isDragSource ? 0.4 : dimmed ? 0.25 : 1,
                          filter: dimmed ? 'grayscale(0.8)' : 'none',
                          outline: isDragTarget ? '2.5px dashed var(--primary)' : 'none',
                          outlineOffset: isDragTarget ? '-2px' : 0,
                          transform: isDragTarget ? 'scale(1.1)' : highlighted ? 'scale(1.08)' : 'scale(1)',
                          cursor: saved ? 'default' : 'grab',
                        }}
                        onMouseEnter={() => setHoveredSeat(i)}
                        onMouseLeave={() => setHoveredSeat(null)}
                        title={`Seat ${s.seatNo} | ${s.name || ''} | ${s.rollNo} | ${s.department}${!saved ? ' — drag to swap' : ''}`}
                      >
                        <div style={styles.seatNo}>{s.seatNo}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, marginTop: 1 }}>{s.name ? s.name.split(' ')[0] : ''}</div>
                        <div style={styles.seatRoll}>{s.rollNo}</div>
                        <div style={styles.seatDept}>{s.department.length > 8 ? s.department.substring(0, 8) + '..' : s.department}</div>
                      </div>
                    );
                  } else {
                    items.push(
                      <div key={i} style={styles.emptySeat}>
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

          {/* Department-wise Table */}
          <div className="card" style={{ padding: 24, marginTop: 20 }}>
            <h3 style={{ marginBottom: 12 }}>📋 Department-wise Seating List</h3>
            {seatingResult.departments.map((d, i) => {
              const color = getDeptColor(i);
              const deptSeats = seatingResult.seating.filter(s => s.department === d.name);
              return (
                <div key={d.name} style={{ marginBottom: 20 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                    padding: '8px 14px', borderRadius: 8, background: color.bg,
                    border: `1.5px solid ${color.border}`,
                  }}>
                    <div style={styles.deptBadge(color)} />
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

          {/* Action bar */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 24, marginBottom: 20 }}>
            {!saved && (
              <button className="btn btn-success" style={{ padding: '12px 32px', fontSize: 15, background: '#16a34a', color: '#fff' }}
                onClick={handleSave} disabled={saving}>
                {saving ? '⏳ Saving...' : '💾 Save Allocation'}
              </button>
            )}
            {saved && <span style={{ padding: '12px 24px', background: '#dcfce7', color: '#166534', borderRadius: 8, fontWeight: 700, fontSize: 15 }}>✅ Allocation Saved</span>}
            <button className="btn btn-primary" style={{ padding: '12px 32px', fontSize: 15 }} onClick={exportPDF}>
              📄 Download PDF
            </button>
            <button className="btn btn-secondary" style={{ padding: '12px 32px', fontSize: 15 }} onClick={handleReset}>
              ↩ New Allocation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamAllocationPage;
