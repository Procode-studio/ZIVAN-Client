import React from 'react';
import './MinimizedCallView.css';

function MinimizedCallView({ peerName, onMaximize, onLeaveCall }) {
  return (
    <div className="minimized-call">
      <div className="minimized-call-info">
        <h4>📞 {peerName}</h4>
      </div>
      <div className="minimized-call-actions">
        <button onClick={onMaximize}>⬆️</button>
        <button className="hang-up-mini" onClick={onLeaveCall}>❌</button>
      </div>
    </div>
  );
}

export default MinimizedCallView;