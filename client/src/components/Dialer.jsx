import { useState } from 'react';
import { useCall } from '../contexts/CallContext';
import DialPad from './DialPad';
import CallControls from './CallControls';
import CallStatus from './CallStatus';

function isUSNumber(number) {
  const digits = number.replace(/[\s\-\(\)\.]/g, '');
  if (digits.startsWith('+1') && digits.length === 12) return true;
  if (digits.startsWith('1') && digits.length === 11) return true;
  if (digits.length === 10 && !digits.startsWith('+')) return true;
  return false;
}

export default function Dialer() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const { callState, callDuration, isMuted, makeCall, hangUp, toggleMute, sendDtmf, deviceReady } = useCall();

  const isInCall = callState !== 'idle' && callState !== 'closed' && callState !== 'voicemail';

  const handleDial = (digit) => {
    if (isInCall) {
      sendDtmf(digit);
    } else {
      setError('');
      setPhoneNumber((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (!isInCall) {
      setError('');
      setPhoneNumber((prev) => prev.slice(0, -1));
    }
  };

  const handleCall = () => {
    if (!phoneNumber.trim() || !deviceReady) return;
    if (!isUSNumber(phoneNumber.trim())) {
      setError('Only US numbers (+1) are allowed');
      return;
    }
    setError('');
    makeCall(phoneNumber.trim());
  };

  return (
    <div className="dialer-container">
      <div className="dialer-panel">
        <div className="dialer-header">
          <h2>Make a Call</h2>
          <span className="dialer-header-badge">Outbound</span>
        </div>

        <CallStatus callState={callState} callDuration={callDuration} phoneNumber={phoneNumber} />

        <div className="phone-input-wrapper">
          <input
            className="phone-input"
            type="tel"
            value={phoneNumber}
            onChange={(e) => { setError(''); setPhoneNumber(e.target.value); }}
            placeholder="+1 (555) 000-0000"
            disabled={isInCall}
          />
          {error && <div className="dialer-error">{error}</div>}
          {phoneNumber && !isInCall && (
            <button className="btn-backspace" onClick={handleBackspace}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            </button>
          )}
        </div>

        <DialPad onDial={handleDial} />

        <CallControls
          callState={callState}
          isMuted={isMuted}
          onCall={handleCall}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
          disabled={!deviceReady || (!phoneNumber.trim() && callState === 'idle')}
        />
      </div>
    </div>
  );
}
