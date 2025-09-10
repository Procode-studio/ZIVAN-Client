import { useEffect, useRef, useState } from 'react';

export const useSimpleCall = (socket, callerId, onCallReceived) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
      } catch (err) {
        console.error('getUserMedia error:', err);
      }
    };
    getMedia();
  }, []);

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

  const call = () => {
    const peer = createPeer(true);
    peerRef.current = peer;
  };

  const answer = (offer) => {
    const peer = createPeer(false);
    peerRef.current = peer;
    peer.setRemoteDescription(offer);
    peer.createAnswer().then((answer) => {
      peer.setLocalDescription(answer);
      socket.emit('acceptCall', { signal: answer, to: callerId });
    });
  };

  useEffect(() => {
    socket.on('hey', (data) => {
      answer(data.signal);
      if (onCallReceived) onCallReceived(data.from);
    });
    socket.on('callAccepted', (signal) => {
      peerRef.current?.setRemoteDescription(signal);
    });
    socket.on('iceCandidate', (candidate) => {
      peerRef.current?.addIceCandidate(candidate);
    });
    socket.on('callEnded', () => {
      peerRef.current?.close();
      setIsConnected(false);
    });

    return () => {
      socket.off('hey');
      socket.off('callAccepted');
      socket.off('iceCandidate');
      socket.off('callEnded');
    };
  }, [socket, callerId, onCallReceived]);

  return { localStream, remoteStream, call, isConnected };
};
