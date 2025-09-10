import React, { useEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';
import './CallUI.css';

function CallUI({ stream, peerStream, onLeaveCall, peerName, onMinimize, isCalling, isMinimized, isMicOn, isCameraOn, peerCameraOn, toggleMic, toggleCamera }) {
  const myVideo = useRef();
  const userVideo = useRef();

  useEffect(() => {
    if (stream && myVideo.current) {
      myVideo.current.srcObject = stream;
      myVideo.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    if (peerStream && userVideo.current) {
      userVideo.current.srcObject = peerStream;
      userVideo.current.play().catch(() => {});
    }
  }, [peerStream]);

  return (
    <div className={`call-overlay ${isMinimized ? 'minimized' : ''}`}>
      <div className="call-info">
        <h2>{peerName}</h2>
        <p>{isCalling ? 'Вызов...' : 'Соединение установлено'}</p>
      </div>
      <div className="call-videos">
        <video 
          className="user-video" 
          ref={userVideo} 
          autoPlay 
          playsInline 
          style={{ display: peerStream && peerCameraOn ? 'block' : 'none' }} 
        />
        {(!peerStream || !peerCameraOn) && <div className="user-avatar-large"><Avatar username={peerName} size={150} /></div>}
        <div className="my-video-container">
          <video 
            className="my-video" 
            ref={myVideo} 
            autoPlay 
            playsInline 
            muted 
            style={{ display: stream && isCameraOn ? 'block' : 'none' }} 
          />
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