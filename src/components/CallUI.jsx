import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';
import './CallUI.css';

function CallUI({ stream, peerStream, onLeaveCall, peerName, onMinimize, isCalling, isMinimized, isMicOn, isCameraOn, peerCameraOn, toggleMic, toggleCamera }) {
  const [callDuration, setCallDuration] = useState(0);
  const myVideo = useRef();
  const userVideo = useRef();

  useEffect(() => {
    if (stream && myVideo.current) {
      myVideo.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (peerStream && userVideo.current) {
      userVideo.current.srcObject = peerStream;
    }
  }, [peerStream]);

  useEffect(() => {
    let interval;
    if (!isCalling) {
      interval = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isCalling]);

  const formatDuration = (s) => {
    const date = new Date(s * 1000);
    return date.toISOString().substr(14, 5);
  };

  return (
    <div className={`call-overlay ${isMinimized ? 'minimized' : ''}`}>
      <div className="call-info">
        <h2>{peerName}</h2>
        <p>{isCalling ? 'Вызов...' : formatDuration(callDuration)}</p>
      </div>
      <div className="call-videos">
        <video className="user-video" ref={userVideo} autoPlay playsInline style={{ display: peerStream && peerCameraOn ? 'block' : 'none' }} />
        {(!peerStream || !peerCameraOn) && <div className="user-avatar-large"><Avatar username={peerName} size={150} /></div>}
        <div className="my-video-container">
          <video className="my-video" ref={myVideo} autoPlay playsInline muted style={{ display: stream && isCameraOn ? 'block' : 'none' }} />
          {(!stream || !isCameraOn) && <div className="my-video"><Avatar username="You" size={100} /></div>}
        </div>
      </div>
      <div className="call-controls">
        <button className="control-btn" onClick={onMinimize}>⬇️</button>
        <button className="control-btn" onClick={toggleMic}>{isMicOn ? '🎤' : '🔇'}</button>
        <button className="control-btn" onClick={toggleCamera}>{isCameraOn ? '📹' : '📸'}</button>
        <button className="control-btn hang-up" onClick={onLeaveCall}>📞</button>
      </div>
    </div>
  );
}

export default CallUI;