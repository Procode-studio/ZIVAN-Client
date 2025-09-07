import React, { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';
import './CallUI.css';

function CallUI({ stream, peerStream, onLeaveCall, peerName, onMinimize, isCalling }) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false); // Камера по умолчанию выключена
  const [callDuration, setCallDuration] = useState(0);
  const myVideo = useRef();
  const userVideo = useRef();

  // Этот useEffect отвечает за ВАШЕ видео
  useEffect(() => {
    if (stream && myVideo.current) {
      myVideo.current.srcObject = stream;
    }
  }, [stream]);

  // Этот useEffect отвечает за видео СОБЕСЕДНИКА
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
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicOn(prev => !prev);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
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
        {/* --- НАЧАЛО ГЛАВНОГО ИСПРАВЛЕНИЯ --- */}
        
        {/* Видео собеседника */}
        <video 
          className="user-video" 
          style={{ display: peerStream ? 'block' : 'none' }} 
          playsInline 
          ref={userVideo} 
          autoPlay 
        />
        {!peerStream && (
          <div className="user-avatar-large">
            <Avatar username={peerName} size={150} />
          </div>
        )}
        
        {/* Ваше видео */}
        <div className="my-video-container">
          <video 
            className="my-video" 
            style={{ display: stream && isCameraOn ? 'block' : 'none' }} 
            playsInline 
            muted 
            ref={myVideo} 
            autoPlay 
          />
          {(!stream || !isCameraOn) && (
            <div className="my-video">
              <Avatar username="You" size={100} />
            </div>
          )}
        </div>

        {/* --- КОНЕЦ ГЛАВНОГО ИСПРАВЛЕНИЯ --- */}
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