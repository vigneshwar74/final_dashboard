const express = require('express');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/analytics/summary - today's utilization summary
router.get('/summary', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const totalRes = await db.query('SELECT COUNT(*) as total FROM resources');
    const maintenanceRes = await db.query("SELECT COUNT(*) as count FROM resources WHERE status = 'maintenance'");

    const bookedToday = await db.query(
      `SELECT COUNT(DISTINCT resource_id) as count FROM bookings
       WHERE date = $1 AND status IN ('approved','pending')`,
      [today]
    );

    const total = parseInt(totalRes.rows[0].total);
    const maintenance = parseInt(maintenanceRes.rows[0].count);
    const booked = parseInt(bookedToday.rows[0].count);
    const free = total - booked - maintenance;

    res.json({
      total,
      free: Math.max(0, free),
      booked,
      maintenance,
      date: today,
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/analytics/by-type - utilization breakdown by resource type
router.get('/by-type', authenticate, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT r.type,
             COUNT(DISTINCT r.id) as total_resources,
             COUNT(DISTINCT CASE WHEN b.id IS NOT NULL THEN r.id END) as booked_resources
      FROM resources r
      LEFT JOIN bookings b ON r.id = b.resource_id
        AND b.date = $1 AND b.status IN ('approved','pending')
      GROUP BY r.type
      ORDER BY r.type
    `, [today]);

    res.json(result.rows);
  } catch (err) {
    console.error('By type error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/analytics/trend - utilization trend (last 7 or 30 days)
router.get('/trend', authenticate, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const limitDays = Math.min(days, 90);

    const result = await db.query(`
      SELECT d.date::date as date,
             COUNT(DISTINCT b.resource_id) as booked_resources,
             COUNT(b.id) as total_bookings
      FROM generate_series(
        CURRENT_DATE - INTERVAL '1 day' * $1,
        CURRENT_DATE,
        '1 day'
      ) AS d(date)
      LEFT JOIN bookings b ON b.date = d.date AND b.status IN ('approved','completed')
      GROUP BY d.date
      ORDER BY d.date
    `, [limitDays]);

    res.json(result.rows);
  } catch (err) {
    console.error('Trend error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/analytics/top-resources - most booked resources
router.get('/top-resources', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const result = await db.query(`
      SELECT r.id, r.name, r.type, r.location,
             COUNT(b.id) as booking_count,
             SUM(EXTRACT(EPOCH FROM (b.end_time::time - b.start_time::time)) / 3600) as total_hours
      FROM resources r
      LEFT JOIN bookings b ON r.id = b.resource_id AND b.status IN ('approved','completed')
      GROUP BY r.id, r.name, r.type, r.location
      ORDER BY booking_count DESC
      LIMIT $1
    `, [limit]);

    res.json(result.rows);
  } catch (err) {
    console.error('Top resources error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/analytics/export - export bookings as CSV
router.get('/export', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { from, to } = req.query;

    let query = `
      SELECT b.id, r.name as resource_name, r.type as resource_type,
             u.name as booked_by, u.email,
             b.date, b.start_time, b.end_time, b.purpose, b.status, b.created_at
      FROM bookings b
      JOIN resources r ON b.resource_id = r.id
      JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (from) {
      params.push(from);
      query += ` AND b.date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND b.date <= $${params.length}`;
    }

    query += ' ORDER BY b.date DESC, b.start_time';
    const result = await db.query(query, params);

    // Build CSV
    const headers = ['ID', 'Resource', 'Type', 'Booked By', 'Email', 'Date', 'Start Time', 'End Time', 'Purpose', 'Status', 'Created At'];
    let csv = headers.join(',') + '\n';

    for (const row of result.rows) {
      csv += [
        row.id,
        `"${row.resource_name}"`,
        row.resource_type,
        `"${row.booked_by}"`,
        row.email,
        row.date ? new Date(row.date).toISOString().split('T')[0] : '',
        row.start_time,
        row.end_time,
        `"${(row.purpose || '').replace(/"/g, '""')}"`,
        row.status,
        row.created_at,
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=bookings_report.csv');
    res.send(csv);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
