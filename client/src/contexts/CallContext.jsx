import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api';

const CallContext = createContext(null);

export function CallProvider({ children }) {
  const deviceRef = useRef(null);
  const callRef = useRef(null);
  const initStartedRef = useRef(false);
  const [deviceReady, setDeviceReady] = useState(false);
  const [callState, setCallState] = useState('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const timerRef = useRef(null);

  const startTimer = useCallback(() => {
    setCallDuration(0);
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const initDevice = useCallback(async () => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    try {
      // Request microphone permission (browser gesture requirement)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());

      const { Device } = await import('@twilio/voice-sdk');
      const { token } = await api.getTwilioToken();

      if (deviceRef.current) {
        deviceRef.current.destroy();
      }

      const device = new Device(token, {
        codecPreferences: ['opus', 'pcmu'],
        logLevel: 1,
        allowIncomingWhileBusy: false,
      });

      device.on('registered', () => {
        console.log('Twilio Device registered');
        setDeviceReady(true);
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      });

      device.on('error', (err) => {
        console.error('Twilio Device error:', err);
      });

      device.on('tokenWillExpire', async () => {
        try {
          const { token: newToken } = await api.getTwilioToken();
          device.updateToken(newToken);
        } catch (err) {
          console.error('Failed to refresh Twilio token:', err);
        }
      });

      device.on('incoming', (call) => {
        console.log('Incoming call from:', call.parameters.From);
        setIncomingCall(call);

        call.on('cancel', () => {
          setIncomingCall(null);
        });

        call.on('disconnect', () => {
          setIncomingCall(null);
          setCallState('closed');
          stopTimer();
          setTimeout(() => {
            setCallState('idle');
            setCallDuration(0);
            setIsMuted(false);
          }, 2000);
        });
      });

      await device.register();
      deviceRef.current = device;
    } catch (err) {
      console.error('Failed to init Twilio device:', err);
      initStartedRef.current = false;
    }
  }, [stopTimer]);

  // One-time click listener to trigger device init (browser gesture requirement)
  useEffect(() => {
    const handleClick = () => {
      document.removeEventListener('click', handleClick);
      initDevice();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [initDevice]);

  const acceptIncoming = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.accept();
    setCallState('open');
    startTimer();
    setIncomingCall(null);

    const phoneNumber = incomingCall.parameters.From;
    api.logCall({
      callSid: incomingCall.parameters.CallSid,
      phoneNumber,
      direction: 'inbound',
    }).catch(() => {});

    incomingCall.on('disconnect', () => {
      setCallState('closed');
      stopTimer();
      api.updateCall(incomingCall.parameters.CallSid, {
        status: 'completed',
      }).catch(() => {});
      setTimeout(() => {
        setCallState('idle');
        setCallDuration(0);
        setIsMuted(false);
      }, 2000);
    });
  }, [incomingCall, startTimer, stopTimer]);

  const rejectIncoming = useCallback(() => {
    if (!incomingCall) return;
    incomingCall.reject();
    setIncomingCall(null);
  }, [incomingCall]);

  const makeCall = useCallback(async (phoneNumber) => {
    if (!deviceRef.current) return;

    try {
      setCallState('connecting');
      const call = await deviceRef.current.connect({
        params: { To: phoneNumber },
      });

      callRef.current = call;

      call.on('ringing', () => setCallState('ringing'));

      call.on('accept', () => {
        setCallState('open');
        startTimer();
        api.logCall({
          callSid: call.parameters.CallSid,
          phoneNumber,
          direction: 'outbound',
        }).catch(() => {});
      });

      call.on('disconnect', () => {
        setCallState('closed');
        stopTimer();
        api.updateCall(call.parameters.CallSid, {
          status: 'completed',
        }).catch(() => {});
        setTimeout(() => {
          setCallState('idle');
          setCallDuration(0);
          setIsMuted(false);
        }, 2000);
      });

      call.on('cancel', () => {
        setCallState('closed');
        stopTimer();
        setTimeout(() => {
          setCallState('idle');
          setCallDuration(0);
        }, 1500);
      });

      call.on('error', (err) => {
        console.error('Call error:', err);
        setCallState('idle');
        stopTimer();
        setCallDuration(0);
      });
    } catch (err) {
      console.error('Failed to make call:', err);
      setCallState('idle');
    }
  }, [startTimer, stopTimer]);

  const hangUp = useCallback(() => {
    if (callRef.current) {
      callRef.current.disconnect();
      callRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const muted = !callRef.current.isMuted();
      callRef.current.mute(muted);
      setIsMuted(muted);
    }
  }, []);

  const sendDtmf = useCallback((digit) => {
    if (callRef.current) {
      callRef.current.sendDigits(digit);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (deviceRef.current) {
        deviceRef.current.destroy();
      }
    };
  }, [stopTimer]);

  return (
    <CallContext.Provider value={{
      deviceReady,
      callState,
      callDuration,
      isMuted,
      incomingCall,
      makeCall,
      hangUp,
      toggleMute,
      sendDtmf,
      acceptIncoming,
      rejectIncoming,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
}
