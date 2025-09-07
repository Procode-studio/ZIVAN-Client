import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';
import './CallUI.css';

function CallUI({ stream, peerStream, onLeaveCall, peerName, onMinimize }) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false); // Камера по умолчанию выключена
  const [callDuration, setCallDuration] = useState(0);
  const myVideo = useRef();

  useEffect(() => {
    if (stream) {
      myVideo.current.srcObject = stream;
      // Применяем начальное состояние камеры
      stream.getVideoTracks().forEach(track => track.enabled = isCameraOn);
    }
  }, [stream]);
  
  useEffect(() => {
    const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (seconds) => new Date(seconds * 1000).toISOString().substr(14, 5);

  const toggleMic = () => {
    stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    setIsMicOn(prev => !prev);
  };

  const toggleCamera = () => {
    stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    setIsCameraOn(prev => !prev);
  };

  return (
    <div className="call-overlay">
      <div className="call-info">
        <h2>{peerName}</h2>
        <p>{isCalling ? 'Вызов...' : formatDuration(callDuration)}</p>
      </div>

      <div className="call-videos">
        {peerStream ? (
          <video className="user-video" playsInline ref={ref => { if (ref) ref.srcObject = peerStream; }} autoPlay />
        ) : (
          <div className="user-avatar-large">
            <Avatar username={peerName} size={150} />
          </div>
        )}
        
        <div className="my-video-container">
          {isCameraOn ? (
            <video className="my-video" playsInline muted ref={myVideo} autoPlay />
          ) : (
            <Avatar username="You" size={100} />
          )}
        </div>
      </div>

      <div className="call-controls">
        <button className="control-btn" onClick={onMinimize}>⬇️</button>
        <button className="control-btn" onClick={toggleMic}>{isMicOn ? '🎤' : '🔇'}</button>
        <button className="control-btn" onClick={toggleCamera}>{isCameraOn ? '📸' : '📹'}</button>
        <button className="control-btn hang-up" onClick={onLeaveCall}>📞</button>
      </div>
    </div>
  );
}

export default CallUI;