import { useEffect, useRef, useState } from 'react';

export const useSimpleCall = (socket, callerId, onCallReceived) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  // Helper to request media only when needed (user action)
  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('getUserMedia error:', err);
      return null;
    }
  };

  const createPeer = (initiator) => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      ],
    });

    if (localStream) {
      localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    }

    peer.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setIsConnected(true);
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('iceCandidate', { to: callerId, candidate: event.candidate });
      }
    };

    if (initiator) {
      peer.createOffer().then((offer) => {
        peer.setLocalDescription(offer);
        socket.emit('callUser', { userToCall: callerId, signalData: offer });
      });
    }

    return peer;
  };

  const call = async () => {
    if (!callerId) return;
    if (!localStream) {
      const stream = await getMedia();
      if (!stream) return;
    }
    const peer = createPeer(true);
    peerRef.current = peer;
  };

  const answer = async (offer) => {
    if (!localStream) {
      const stream = await getMedia();
      if (!stream) return;
    }
    const peer = createPeer(false);
    peerRef.current = peer;
    peer.setRemoteDescription(offer);
    peer.createAnswer().then((answer) => {
      peer.setLocalDescription(answer);
      socket.emit('acceptCall', { signal: answer, to: callerId });
    });
  };

  useEffect(() => {
    if (!socket) return;
    const onHey = (data) => {
      answer(data.signal);
      if (onCallReceived) onCallReceived(data.from);
    };
    const onCallAccepted = (signal) => {
      peerRef.current?.setRemoteDescription(signal);
    };
    const onIceCandidate = (candidate) => {
      peerRef.current?.addIceCandidate(candidate);
    };
    const onCallEnded = () => {
      peerRef.current?.close();
      setIsConnected(false);
    };

    socket.on('hey', onHey);
    socket.on('callAccepted', onCallAccepted);
    socket.on('iceCandidate', onIceCandidate);
    socket.on('callEnded', onCallEnded);

    return () => {
      socket.off('hey', onHey);
      socket.off('callAccepted', onCallAccepted);
      socket.off('iceCandidate', onIceCandidate);
      socket.off('callEnded', onCallEnded);
    };
  }, [socket, callerId, onCallReceived]);

  return { localStream, remoteStream, call, isConnected };
};
