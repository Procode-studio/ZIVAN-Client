import React, { useRef, useEffect } from 'react';
import Avatar from './Avatar.jsx';
import './CallUI.css';

function CallInterface({ callAccepted, localStream, remoteStream, onLeaveCall, peerName, onMinimize, isCalling, isMinimized, isConnected, isMicOn, isCameraOn, onToggleMic, onToggleCamera }) {
  const myVideo = useRef();
  const userVideo = useRef();

  useEffect(() => {
    if (localStream && myVideo.current) {
      myVideo.current.srcObject = localStream;
      myVideo.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && userVideo.current) {
      userVideo.current.srcObject = remoteStream;
      userVideo.current.play().catch(() => {});
    }
  }, [remoteStream]);

  if (!callAccepted) return null;

  return (
    <div className={`call-overlay ${isMinimized ? 'minimized' : ''}`}>
      <div className="call-info">
        <h2>{peerName}</h2>
        <p>{isCalling ? 'Вызов...' : (isConnected ? 'Соединение установлено' : 'Ожидание...')}</p>
      </div>
      <div className="call-videos">
        <video 
          className="user-video" 
          ref={userVideo} 
          autoPlay 
          playsInline 
          style={{ display: remoteStream && isConnected ? 'block' : 'none' }} 
        />
        {(!remoteStream || !isConnected) && <div className="user-avatar-large"><Avatar username={peerName} size={150} /></div>}
        <div className="my-video-container">
          <video 
            className="my-video" 
            ref={myVideo} 
            autoPlay 
            playsInline 
            muted 
            style={{ display: localStream && isCameraOn ? 'block' : 'none' }} 
          />
          {(!localStream || !isCameraOn) && <div className="my-video"><Avatar username="You" size={100} /></div>}
        </div>
      </div>
      <div className="call-controls">
        <button className="control-btn" onClick={onMinimize}>⬇️</button>
        <button className="control-btn" onClick={onToggleMic}>{isMicOn ? '🎤' : '🔇'}</button>
        <button className="control-btn" onClick={onToggleCamera}>{isCameraOn ? '📹' : '📸'}</button>
        <button className="control-btn hang-up" onClick={onLeaveCall}>📞</button>
      </div>
    </div>
  );
}

export default CallInterface;
