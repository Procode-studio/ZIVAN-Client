import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';
import './CallUI.css';

function CallUI({ stream, peerStream, onLeaveCall, peerName, onMinimize, isCalling }) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const myVideo = useRef();
  const userVideo = useRef(); // <-- Добавляем ref для видео собеседника

  useEffect(() => {
    if (stream && myVideo.current) {
      myVideo.current.srcObject = stream;
      // Применяем начальное состояние камеры
      stream.getVideoTracks().forEach(track => track.enabled = isCameraOn);
    }
  }, [stream, isCameraOn]);

  // --- НОВЫЙ useEffect для peerStream ---
  useEffect(() => {
    if (peerStream && userVideo.current) {
      userVideo.current.srcObject = peerStream;
    }
  }, [peerStream]);
  
  useEffect(() => {
    if (!isCalling) {
      const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [isCalling]);

  const formatDuration = (seconds) => new Date(seconds * 1000).toISOString().substr(14, 5);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
      setIsMicOn(prev => !prev);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
      setIsCameraOn(prev => !prev);
    }
  };

  return (
    <div className="call-overlay">
      <div className="call-info">
        <h2>{peerName}</h2>
        <p>{isCalling ? 'Вызов...' : formatDuration(callDuration)}</p>
      </div>

      <div className="call-videos">
        {peerStream ? (
          <video className="user-video" playsInline ref={userVideo} autoPlay />
        ) : (
          <div className="user-avatar-large">
            <Avatar username={peerName} size={150} />
          </div>
        )}
        
        <div className="my-video-container">
          {stream && isCameraOn ? (
            <video className="my-video" playsInline muted ref={myVideo} autoPlay />
          ) : (
            <div className="my-video">
              <Avatar username="You" size={100} />
            </div>
          )}
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