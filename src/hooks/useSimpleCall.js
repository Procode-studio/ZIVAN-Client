import { useEffect, useRef, useState } from 'react';

// useSimpleCall(socket, peerId, selfId, onCallReceived, onCallEndedCb?)
export const useSimpleCall = (socket, callerId, selfId, onCallReceived, onCallEndedCb) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const incomingOfferRef = useRef(null);
  const incomingFromRef = useRef(null);
  const [rtcConfig, setRtcConfig] = useState({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    ],
  });
  const statsIntervalRef = useRef(null);
  const audioSenderRef = useRef(null);
  const videoSenderRef = useRef(null);

  useEffect(() => {
    const api = import.meta.env.VITE_API_URL;
    if (!api) return;
    fetch(`${api}/api/config/ice`).then(async (r) => {
      if (!r.ok) return;
      const cfg = await r.json();
      if (cfg && cfg.iceServers && Array.isArray(cfg.iceServers)) {
        setRtcConfig(cfg);
      }
    }).catch(() => {});
  }, []);

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      // Respect toggles
      if (!isMicOn && stream.getAudioTracks().length) stream.getAudioTracks()[0].enabled = false;
      if (!isCameraOn && stream.getVideoTracks().length) stream.getVideoTracks()[0].enabled = false;
      console.log('[RTC] getUserMedia -> tracks', {
        a: stream.getAudioTracks().map(t => t.id),
        v: stream.getVideoTracks().map(t => t.id)
      });
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      return null;
    }
  };

  const createPeer = async (initiator, streamParam, toIdForCandidates) => {
    const peer = new RTCPeerConnection(rtcConfig);

    // Create transceivers in sendrecv to ensure RTP setup across browsers
    const audioTrans = peer.addTransceiver('audio', { direction: 'sendrecv' });
    const videoTrans = peer.addTransceiver('video', { direction: 'sendrecv' });
    audioSenderRef.current = audioTrans.sender;
    videoSenderRef.current = videoTrans.sender;

    const streamToUse = streamParam || localStream;
    if (streamToUse) {
      const a = streamToUse.getAudioTracks()[0] || null;
      const v = streamToUse.getVideoTracks()[0] || null;
      try { await audioSenderRef.current.replaceTrack(a); } catch {}
      try { await videoSenderRef.current.replaceTrack(v); } catch {}
      console.log('[RTC] replaceTrack attached', { hasA: !!a, hasV: !!v });
    }

    peer.oniceconnectionstatechange = () => {
      console.log('[RTC] iceConnectionState =', peer.iceConnectionState);
      setIsConnected(peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed');
    };
    peer.onconnectionstatechange = () => {
      console.log('[RTC] connectionState =', peer.connectionState);
    };

    peer.ontrack = (event) => {
      console.log('[RTC] ontrack received');
      setRemoteStream(event.streams[0]);
      setIsConnected(true);
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        const target = toIdForCandidates || callerId || incomingFromRef.current;
        console.log('[SIGNAL] emit iceCandidate ->', target);
        if (target) socket.emit('iceCandidate', { to: target, candidate: event.candidate });
      }
    };

    if (initiator) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      console.log('[SIGNAL] emit callUser ->', callerId);
      socket.emit('callUser', { userToCall: callerId, signalData: offer, from: selfId });
    }

    return peer;
  };

  // Re-attach tracks if localStream changes after peer is created
  useEffect(() => {
    const apply = async () => {
      if (!peerRef.current || !localStream) return;
      const a = localStream.getAudioTracks()[0] || null;
      const v = localStream.getVideoTracks()[0] || null;
      try { await audioSenderRef.current?.replaceTrack(a); } catch {}
      try { await videoSenderRef.current?.replaceTrack(v); } catch {}
      console.log('[RTC] (effect) re-attached tracks', { hasA: !!a, hasV: !!v });
    };
    apply();
  }, [localStream]);

  const startStatsLogging = () => {
    if (!peerRef.current) return;
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    let count = 0;
    statsIntervalRef.current = setInterval(async () => {
      count += 1;
      if (!peerRef.current) return;
      const stats = await peerRef.current.getStats();
      let inAudio = 0, inVideo = 0, outAudio = 0, outVideo = 0;
      stats.forEach(report => {
        if (report.type === 'inbound-rtp') {
          const kind = report.kind || report.mediaType;
          if (kind === 'audio') inAudio = report.bytesReceived || inAudio;
          if (kind === 'video') inVideo = report.bytesReceived || inVideo;
        }
        if (report.type === 'outbound-rtp') {
          const kind = report.kind || report.mediaType;
          if (kind === 'audio') outAudio = report.bytesSent || outAudio;
          if (kind === 'video') outVideo = report.bytesSent || outVideo;
        }
      });
      console.log(`[RTC][stats] inA=${inAudio} inV=${inVideo} outA=${outAudio} outV=${outVideo}`);
      if (count >= 10) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    }, 2000);
  };

  const call = async () => {
    if (!callerId) return;
    const stream = localStream || await getMedia();
    if (!stream) return;
    const peer = await createPeer(true, stream, callerId);
    peerRef.current = peer;
    startStatsLogging();
  };

  const answer = async (offer) => {
    const stream = localStream || await getMedia();
    if (!stream) return;
    const targetId = incomingFromRef.current || callerId;
    const peer = await createPeer(false, stream, targetId);
    peerRef.current = peer;
    const offerToUse = offer || incomingOfferRef.current;
    if (!offerToUse) return;
    await peer.setRemoteDescription(offerToUse);
    const answerDesc = await peer.createAnswer();
    await peer.setLocalDescription(answerDesc);
    console.log('[SIGNAL] emit acceptCall ->', targetId);
    if (targetId) socket.emit('acceptCall', { signal: answerDesc, to: targetId });
    startStatsLogging();
  };

  const end = () => {
    try { peerRef.current?.close(); } catch {}
    peerRef.current = null;
    if (statsIntervalRef.current) { clearInterval(statsIntervalRef.current); statsIntervalRef.current = null; }
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }
    setIsConnected(false);
    setRemoteStream(null);
  };

  const toggleMic = () => {
    const newEnabled = !isMicOn;
    setIsMicOn(newEnabled);
    const track = localStream?.getAudioTracks?.()[0];
    if (track) track.enabled = newEnabled;
  };

  const toggleCamera = () => {
    const newEnabled = !isCameraOn;
    setIsCameraOn(newEnabled);
    const track = localStream?.getVideoTracks?.()[0];
    if (track) track.enabled = newEnabled;
  };

  useEffect(() => {
    if (!socket) return;
    const handleHey = (data) => {
      console.log('[SIGNAL] on hey from', data.from);
      incomingOfferRef.current = data.signal;
      incomingFromRef.current = data.from || null;
      if (onCallReceived) onCallReceived(data.from);
    };
    const handleCallAccepted = (signal) => {
      console.log('[SIGNAL] on callAccepted');
      peerRef.current?.setRemoteDescription(signal);
    };
    const handleIceCandidate = (candidate) => {
      console.log('[SIGNAL] on iceCandidate');
      peerRef.current?.addIceCandidate(candidate);
    };
    const handleCallEnded = () => {
      console.log('[SIGNAL] on callEnded');
      end();
      if (typeof onCallEndedCb === 'function') {
        try { onCallEndedCb(); } catch {}
      }
    };

    socket.on('hey', handleHey);
    socket.on('callAccepted', handleCallAccepted);
    socket.on('iceCandidate', handleIceCandidate);
    socket.on('callEnded', handleCallEnded);

    return () => {
      socket.off('hey', handleHey);
      socket.off('callAccepted', handleCallAccepted);
      socket.off('iceCandidate', handleIceCandidate);
      socket.off('callEnded', handleCallEnded);
    };
  }, [socket, callerId, selfId, onCallReceived, onCallEndedCb, localStream, rtcConfig]);

  return { localStream, remoteStream, call, answer, end, isConnected, toggleMic, toggleCamera, isMicOn, isCameraOn, startStatsLogging };
};
