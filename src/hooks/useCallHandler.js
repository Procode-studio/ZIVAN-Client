import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';

export default function useCallHandler(socket, selectedChat, userId, chats, peerConfig) {
  const [stream, setStream] = useState(null);
  const [peerStream, setPeerStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [callerInfo, setCallerInfo] = useState({ from: null, signal: null, fromName: '' });
  const [callAccepted, setCallAccepted] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  const connectionRef = useRef();

  const leaveCall = useCallback(() => {
    if (connectionRef.current) {
      const otherUserInCall = selectedChat?.members.find(m => m.id !== userId) || { id: callerInfo.from };
      if (otherUserInCall.id) {
        socket.emit("endCall", { to: otherUserInCall.id });
      }
      connectionRef.current.destroy();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
    setPeerStream(null);
    setCallAccepted(false);
    setIsCalling(false);
    setReceivingCall(false);
    setIsCallMinimized(false);
    setCallerInfo({ from: null, signal: null, fromName: '' });
    connectionRef.current = null;
  }, [socket, stream, selectedChat, userId, callerInfo.from]);

  useEffect(() => {
    if (!socket) return;

    socket.on("hey", (data) => {
      const chatWithCaller = chats.find(chat => chat.members.some(m => m.id === data.from));
      const callerName = chatWithCaller?.members.find(m => m.id === data.from)?.username || 'Unknown';
      setCallerInfo({ from: data.from, signal: data.signal, fromName: callerName });
      setReceivingCall(true);
    });
    socket.on("callAccepted", (signal) => {
      setIsCalling(false);
      setCallAccepted(true);
      if (connectionRef.current) {
        connectionRef.current.signal(signal);
      }
    });
    socket.on("iceCandidate", (candidate) => {
      if (connectionRef.current) {
        connectionRef.current.signal(candidate);
      }
    });
    socket.on("callEnded", leaveCall);

    return () => {
      socket.off("hey");
      socket.off("callAccepted");
      socket.off("iceCandidate");
      socket.off("callEnded");
    };
  }, [socket, chats, leaveCall]);

  const createPeer = (initiator, currentStream) => {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream: currentStream,
      config: peerConfig
    });

    peer.on("stream", setPeerStream);
    peer.on("close", leaveCall);
    peer.on("error", (err) => {
      console.error("Peer connection error:", err);
      alert("Ошибка соединения.");
      leaveCall();
    });

    return peer;
  };

  const getMedia = async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      console.error("Media error:", err);
      alert("Доступ к медиа запрещен.");
      return null;
    }
  };

  const callUser = async (idToCall) => {
    const currentStream = await getMedia();
    if (!currentStream) return;

    setStream(currentStream);
    setIsCalling(true);

    const peer = createPeer(true, currentStream);
    connectionRef.current = peer;

    peer.on("signal", (data) => {
      if (data.type === 'offer') {
        socket.emit("callUser", { userToCall: idToCall, signalData: data, from: userId });
      } else if (data.candidate) {
        socket.emit("iceCandidate", { to: idToCall, candidate: data });
      }
    });
  };

  const answerCall = async () => {
    const currentStream = await getMedia();
    if (!currentStream) return;

    setStream(currentStream);
    setCallAccepted(true);
    setReceivingCall(false);

    const peer = createPeer(false, currentStream);
    connectionRef.current = peer;

    peer.on("signal", (data) => {
      if (data.type === 'answer') {
        socket.emit("acceptCall", { signal: data, to: callerInfo.from });
      } else if (data.candidate) {
        socket.emit("iceCandidate", { to: callerInfo.from, candidate: data });
      }
    });

    peer.signal(callerInfo.signal);
  };

  return {
    stream,
    peerStream,
    receivingCall,
    callerInfo,
    callAccepted,
    isCalling,
    isCallMinimized,
    leaveCall,
    callUser,
    answerCall,
    setReceivingCall,
    setIsCallMinimized
  };
}