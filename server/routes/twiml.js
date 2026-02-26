const express = require('express');
const twilio = require('twilio');
const { getIO } = require('../io');
const db = require('../db');

const router = express.Router();

// This endpoint is called by Twilio when an outgoing call is initiated from the browser
router.post('/voice', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const to = req.body.To;
  const from = req.body.From; // e.g. "client:agent_1"

  if (to) {
    // Look up the agent's assigned phone number
    let callerId = process.env.TWILIO_PHONE_NUMBER; // fallback
    const match = from && from.match(/agent_(\d+)/);
    if (match) {
      try {
        const result = await db.query(
          'SELECT phone_number FROM kc_agents WHERE id = $1',
          [match[1]]
        );
        if (result.rows[0] && result.rows[0].phone_number) {
          callerId = result.rows[0].phone_number;
        }
      } catch (err) {
        console.error('Failed to look up agent phone number:', err);
      }
    }

    const dial = twiml.dial({
      callerId,
      answerOnBridge: true,
    });
    dial.number(to);
  } else {
    twiml.say('No destination number provided.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Call status callback — Twilio POSTs here when call status changes
const TERMINAL_STATUSES = ['completed', 'no-answer', 'busy', 'canceled', 'failed'];

router.post('/status', async (req, res) => {
  const { CallSid, CallStatus, CallDuration, From } = req.body;
  const duration = parseInt(CallDuration, 10) || 0;
  console.log(`Call ${CallSid}: ${CallStatus} (${duration}s)`);

  try {
    // Save Twilio's authoritative duration + status to DB
    await db.query(
      `UPDATE kc_call_logs
       SET status = $1,
           duration = $2,
           ended_at = CASE WHEN $1 = ANY($3::text[]) THEN NOW() ELSE ended_at END
       WHERE call_sid = $4`,
      [CallStatus, duration, TERMINAL_STATUSES, CallSid]
    );

    const io = getIO();
    if (io) {
      // Emit call:status to the specific agent's room
      const match = From && From.match(/agent_(\d+)/);
      if (match) {
        io.to(`agent:${match[1]}`).emit('call:status', {
          callSid: CallSid,
          status: CallStatus,
          duration,
        });
      }

      // On terminal status, send updated billing to the specific agent
      if (TERMINAL_STATUSES.includes(CallStatus) && match) {
        const agentId = match[1];
        const rate = parseFloat(process.env.RATE_PER_MINUTE) || 0;
        const billing = await db.query(
          `SELECT
             COALESCE(SUM(duration), 0) AS total_seconds,
             ROUND(COALESCE(SUM(duration), 0) / 60.0, 2) AS total_minutes,
             ROUND(COALESCE(SUM(duration), 0) / 60.0 * $1, 2) AS total_cost
           FROM kc_call_logs
           WHERE agent_id = $2
             AND started_at >= date_trunc('month', NOW())
             AND status = 'completed'`,
          [rate, agentId]
        );
        const data = billing.rows[0] || { total_seconds: 0, total_minutes: 0, total_cost: 0 };
        data.rate_per_minute = rate;
        io.to(`agent:${agentId}`).emit('billing:updated', data);
      }
    }
  } catch (err) {
    console.error('Status callback DB error:', err);
  }

  res.sendStatus(200);
});

module.exports = router;
