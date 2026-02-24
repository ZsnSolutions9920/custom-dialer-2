const express = require('express');
const authenticate = require('../middleware/auth');
const db = require('../db');
const { getIO } = require('../io');

const router = express.Router();

// Log a new call
router.post('/', authenticate, async (req, res) => {
  try {
    const { callSid, phoneNumber, direction } = req.body;
    const result = await db.query(
      `INSERT INTO kc_call_logs (agent_id, call_sid, phone_number, direction)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.agent.id, callSid, phoneNumber, direction || 'outbound']
    );

    const callLog = result.rows[0];

    const io = getIO();
    if (io) {
      io.to(`agent:${req.agent.id}`).emit('call:logged', callLog);
    }

    res.json(callLog);
  } catch (err) {
    console.error('Create call log error:', err);
    res.status(500).json({ error: 'Failed to log call' });
  }
});

// Update call status/duration
router.patch('/:callSid', authenticate, async (req, res) => {
  try {
    const { status, duration } = req.body;
    const result = await db.query(
      `UPDATE kc_call_logs
       SET status = COALESCE($1, status),
           duration = COALESCE($2, duration),
           ended_at = CASE WHEN $1 IN ('completed','no-answer','busy','canceled','failed') THEN NOW() ELSE ended_at END
       WHERE call_sid = $3 AND agent_id = $4
       RETURNING *`,
      [status, duration, req.params.callSid, req.agent.id]
    );

    const callLog = result.rows[0] || {};

    const io = getIO();
    if (io && callLog.id) {
      io.to(`agent:${req.agent.id}`).emit('call:updated', callLog);
    }

    res.json(callLog);
  } catch (err) {
    console.error('Update call log error:', err);
    res.status(500).json({ error: 'Failed to update call' });
  }
});

// Get call history for the agent
router.get('/history', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM kc_call_logs
       WHERE agent_id = $1
       ORDER BY started_at DESC
       LIMIT 50`,
      [req.agent.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Fetch history error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;
