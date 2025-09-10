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
      if (!isMicOn && stream.getAudioTracks().length) stream.getAudioTracks()[0].enabled = false;
      if (!isCameraOn && stream.getVideoTracks().length) stream.getVideoTracks()[0].enabled = false;
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      return null;
    }
  };

  const createPeer = (initiator, streamParam, toIdForCandidates) => {
    const peer = new RTCPeerConnection(rtcConfig);

    const streamToUse = streamParam || localStream;

    const hasAudio = !!streamToUse && streamToUse.getAudioTracks().length > 0;
    const hasVideo = !!streamToUse && streamToUse.getVideoTracks().length > 0;
    if (!hasAudio) peer.addTransceiver('audio', { direction: 'recvonly' });
    if (!hasVideo) peer.addTransceiver('video', { direction: 'recvonly' });

    if (streamToUse) {
      streamToUse.getTracks().forEach(track => peer.addTrack(track, streamToUse));
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
      peer.createOffer().then((offer) => {
        peer.setLocalDescription(offer);
        console.log('[SIGNAL] emit callUser ->', callerId);
        socket.emit('callUser', { userToCall: callerId, signalData: offer, from: selfId });
      });
    }

    return peer;
  };

  const call = async () => {
    if (!callerId) return;
    const stream = localStream || await getMedia();
    if (!stream) return;
    const peer = createPeer(true, stream, callerId);
    peerRef.current = peer;
  };

  const answer = async (offer) => {
    const stream = localStream || await getMedia();
    if (!stream) return;
    const targetId = incomingFromRef.current || callerId;
    const peer = createPeer(false, stream, targetId);
    peerRef.current = peer;
    const offerToUse = offer || incomingOfferRef.current;
    if (!offerToUse) return;
    peer.setRemoteDescription(offerToUse);
    peer.createAnswer().then((answer) => {
      peer.setLocalDescription(answer);
      console.log('[SIGNAL] emit acceptCall ->', targetId);
      if (targetId) socket.emit('acceptCall', { signal: answer, to: targetId });
    });
  };

  const end = () => {
    try { peerRef.current?.close(); } catch {}
    peerRef.current = null;
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

  return { localStream, remoteStream, call, answer, end, isConnected, toggleMic, toggleCamera, isMicOn, isCameraOn };
};
