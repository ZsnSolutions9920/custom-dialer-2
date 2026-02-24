const express = require('express');
const twilio = require('twilio');
const { getIO } = require('../io');

const router = express.Router();

// This endpoint is called by Twilio when an outgoing call is initiated from the browser
router.post('/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const to = req.body.To;

  if (to) {
    const dial = twiml.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER,
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
router.post('/status', (req, res) => {
  const { CallSid, CallStatus, CallDuration, From } = req.body;
  console.log(`Call ${CallSid}: ${CallStatus} (${CallDuration || 0}s)`);

  // Emit call status to connected clients
  const io = getIO();
  if (io) {
    const match = From && From.match(/agent_(\d+)/);
    if (match) {
      io.to(`agent:${match[1]}`).emit('call:status', {
        callSid: CallSid,
        status: CallStatus,
        duration: CallDuration || 0,
      });
    }
  }

  res.sendStatus(200);
});

module.exports = router;
