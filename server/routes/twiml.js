const express = require('express');
const twilio = require('twilio');
const { getIO } = require('../io');
const db = require('../db');

const router = express.Router();

// In-memory mapping: child CallSid → parent CallSid
const childToParentMap = new Map();

const TERMINAL_STATUSES = ['completed', 'no-answer', 'busy', 'canceled', 'failed'];
const MACHINE_TYPES = ['machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', 'fax'];

// This endpoint is called by Twilio for both outgoing (browser→phone) and
// incoming (phone→browser) calls via the TwiML App voice URL.
router.post('/voice', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const to = req.body.To;
  const from = req.body.From;
  const baseUrl = process.env.SERVER_BASE_URL;
  const isOutbound = from && from.startsWith('client:');

  console.log('TwiML /voice request:', { to, from, direction: isOutbound ? 'outbound' : 'inbound', body: req.body });

  if (isOutbound && to) {
    // --- OUTBOUND: agent in browser dialing a phone number ---
    let callerId = process.env.TWILIO_PHONE_NUMBER; // fallback
    const match = from.match(/agent_(\d+)/);
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
    dial.number({
      statusCallback: `${baseUrl}/api/twiml/child-status`,
      statusCallbackEvent: 'initiated ringing answered completed',
      statusCallbackMethod: 'POST',
      machineDetection: 'Enable',
      amdStatusCallback: `${baseUrl}/api/twiml/amd`,
      amdStatusCallbackMethod: 'POST',
    }, to);
  } else if (!isOutbound && to) {
    // --- INBOUND: external caller dialing a Twilio number ---
    // Find the agent who owns the called number
    try {
      const result = await db.query(
        'SELECT id, name FROM kc_agents WHERE phone_number = $1 AND is_active = true',
        [to]
      );

      if (result.rows.length > 0) {
        // Route to the specific agent who owns this number
        const dial = twiml.dial({
          callerId: from,
          answerOnBridge: true,
        });
        dial.client(`agent_${result.rows[0].id}`);
        console.log(`Inbound call from ${from} → routing to agent_${result.rows[0].id} (${result.rows[0].name})`);
      } else {
        // No agent owns this number — ring all active agents
        const allAgents = await db.query(
          'SELECT id, name FROM kc_agents WHERE is_active = true'
        );
        if (allAgents.rows.length > 0) {
          const dial = twiml.dial({
            callerId: from,
            answerOnBridge: true,
          });
          for (const agent of allAgents.rows) {
            dial.client(`agent_${agent.id}`);
          }
          console.log(`Inbound call from ${from} → ringing all ${allAgents.rows.length} active agents`);
        } else {
          twiml.say('Sorry, no agents are available to take your call. Please try again later.');
        }
      }
    } catch (err) {
      console.error('Failed to route inbound call:', err);
      twiml.say('An error occurred. Please try again later.');
    }
  } else {
    twiml.say('No destination number provided.');
  }

  const twimlXml = twiml.toString();
  console.log('TwiML response:', twimlXml);
  res.type('text/xml');
  res.send(twimlXml);
});

// Child call (PSTN leg) status callback
router.post('/child-status', async (req, res) => {
  const { CallSid, ParentCallSid, CallStatus, CallDuration } = req.body;
  console.log(`Child call ${CallSid} (parent: ${ParentCallSid}): ${CallStatus}`);

  try {
    // Store child→parent mapping
    if (ParentCallSid) {
      childToParentMap.set(CallSid, ParentCallSid);
    }

    const io = getIO();

    if (CallStatus === 'in-progress' && io) {
      // Child call answered by a human — notify agent to start timer
      const result = await db.query(
        'SELECT agent_id FROM kc_call_logs WHERE call_sid = $1',
        [ParentCallSid]
      );
      if (result.rows[0]) {
        io.to(`agent:${result.rows[0].agent_id}`).emit('call:answered', {
          callSid: ParentCallSid,
        });
      }
    }

    // On terminal status, use child call's duration (accurate talk time only)
    if (TERMINAL_STATUSES.includes(CallStatus)) {
      const duration = parseInt(CallDuration, 10) || 0;
      await db.query(
        'UPDATE kc_call_logs SET duration = $1 WHERE call_sid = $2',
        [duration, ParentCallSid]
      );
      // Clean up mapping
      childToParentMap.delete(CallSid);
    }
  } catch (err) {
    console.error('Child status callback error:', err);
  }

  res.sendStatus(200);
});

// Answering Machine Detection callback
router.post('/amd', async (req, res) => {
  const { CallSid, AnsweredBy } = req.body;
  const parentCallSid = childToParentMap.get(CallSid);
  console.log(`AMD result for ${CallSid} (parent: ${parentCallSid}): ${AnsweredBy}`);

  if (MACHINE_TYPES.includes(AnsweredBy) && parentCallSid) {
    try {
      // Hang up the child call (voicemail)
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.calls(CallSid).update({ status: 'completed' });

      // Mark as voicemail with 0 duration so it's not billed
      await db.query(
        'UPDATE kc_call_logs SET status = $1, duration = 0 WHERE call_sid = $2',
        ['voicemail', parentCallSid]
      );

      // Notify agent
      const result = await db.query(
        'SELECT agent_id FROM kc_call_logs WHERE call_sid = $1',
        [parentCallSid]
      );
      const io = getIO();
      if (result.rows[0] && io) {
        io.to(`agent:${result.rows[0].agent_id}`).emit('call:voicemail', {
          callSid: parentCallSid,
        });
      }

      childToParentMap.delete(CallSid);
    } catch (err) {
      console.error('AMD handling error:', err);
    }
  }

  res.sendStatus(200);
});

// Call status callback — Twilio POSTs here when call status changes
router.post('/status', async (req, res) => {
  const { CallSid, CallStatus, CallDuration, From } = req.body;
  const duration = parseInt(CallDuration, 10) || 0;
  console.log(`Call ${CallSid}: ${CallStatus} (${duration}s)`);

  try {
    // Update status and ended_at, but do NOT overwrite duration here —
    // the child-status callback sets the accurate talk-time duration.
    await db.query(
      `UPDATE kc_call_logs
       SET status = CASE WHEN status = 'voicemail' THEN status ELSE $1 END,
           ended_at = CASE WHEN $1 = ANY($2::text[]) THEN NOW() ELSE ended_at END
       WHERE call_sid = $3`,
      [CallStatus, TERMINAL_STATUSES, CallSid]
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
