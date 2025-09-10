import React from 'react';

function CallNotification({ receivingCall, callAccepted, peerName, onAnswer, onReject }) {
  if (!receivingCall || callAccepted) return null;

  return (
    <div className="caller-notification">
      <h1>Вам звонит {peerName}</h1>
      <div>
        <button className="control-btn" onClick={onAnswer}>✅</button>
        <button className="control-btn hang-up" onClick={onReject}>❌</button>
      </div>
    </div>
  );
}

export default CallNotification;
