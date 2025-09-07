import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';
import './CallUI.css';

function CallUI({ stream, peerStream, onLeaveCall, peerName, onMinimize, isCalling }) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true); // Камера теперь включена по умолчанию
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
    const timer = isCalling ? null : setInterval(() => setCallDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isCalling]);

  const [callDuration, setCallDuration] = useState(0);
  const formatDuration = (s) => new Date(s * 1000).toISOString().substr(14, 5);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = !isMicOn;
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks()[0].enabled = !isCameraOn;
      setIsCameraOn(!isCameraOn);
    }
  };

  return (
    <div className="call-overlay">
      <div className="call-info">
        <h2>{peerName}</h2>
        <p>{isCalling ? 'Вызов...' : formatDuration(callDuration)}</p>
      </div>
      <div className="call-videos">
        <video className="user-video" ref={userVideo} autoPlay playsInline style={{ display: peerStream ? 'block' : 'none' }} />
        {!peerStream && <div className="user-avatar-large"><Avatar username={peerName} size={150} /></div>}
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