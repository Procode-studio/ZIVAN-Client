import React, { useEffect, useRef, useState } from 'react';
import './CallWindow.css';

function CallWindow({ stream, userVideoRef, myVideoRef, onLeaveCall }) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);

  useEffect(() => {
    if (myVideoRef.current) {
      myVideoRef.current.srcObject = stream;
    }
  }, [stream, myVideoRef]);

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCamera = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCameraOn(!isCameraOn);
    }
  };

  return (
    <div className="call-window">
      <div className="videos">
        <video className="user-video" playsInline ref={userVideoRef} autoPlay />
        {stream && <video className="my-video" playsInline muted ref={myVideoRef} autoPlay />}
      </div>
      <div className="controls">
        <button className="control-btn" onClick={toggleMic}>
          {isMicOn ? '🎤' : '🔇'}
        </button>
        <button className="control-btn" onClick={toggleCamera}>
          {isCameraOn ? '📹' : '📸'}
        </button>
        <button className="control-btn hang-up" onClick={onLeaveCall}>
          📞
        </button>
      </div>
    </div>
  );
}

export default CallWindow;