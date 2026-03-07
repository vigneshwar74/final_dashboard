const express = require('express');
const db = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper: log an audit event
const logAudit = async ({ user_id, user_name, user_role, action, entity_type, entity_id, details }) => {
  try {
    await db.query(
      `INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [user_id, user_name, user_role, action, entity_type, entity_id || null, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Audit log write error:', err);
  }
};

// GET /api/audit-logs - admin only
router.get('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { action, entity_type, limit = 100, offset = 0 } = req.query;
    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params = [];

    if (action) {
      params.push(action);
      query += ` AND action = $${params.length}`;
    }
    if (entity_type) {
      params.push(entity_type);
      query += ` AND entity_type = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC';
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
    params.push(parseInt(offset));
    query += ` OFFSET $${params.length}`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Audit log fetch error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/audit-logs/stats
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT action, entity_type, COUNT(*) as count
      FROM audit_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY action, entity_type
      ORDER BY count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
module.exports.logAudit = logAudit;
