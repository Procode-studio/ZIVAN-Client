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
      { urls: 'stun:stun.l.google.com:19302' }
    ],
  });
  const statsIntervalRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteDescSetRef = useRef(false);
  const zeroOutCounterRef = useRef(0);
  const iceFetchTimerRef = useRef(null);

  // Fetch ICE config when API is set and token is available (with retries and storage listener)
  useEffect(() => {
    const api = import.meta.env.VITE_API_URL;
    if (!api) return;

    const fetchIce = async (tk) => {
      try {
        const r = await fetch(`${api}/api/config/ice`, {
          headers: tk ? { Authorization: `Bearer ${tk}` } : {},
          credentials: 'include',
        });
        if (!r.ok) {
          console.warn('[ICE] fetch failed', r.status);
          return false;
        }
        const cfg = await r.json();
        if (cfg && cfg.iceServers && Array.isArray(cfg.iceServers) && cfg.iceServers.length) {
          setRtcConfig(cfg);
          console.log('[ICE] remote config applied', cfg);
          return true;
        }
        return false;
      } catch (e) {
        console.warn('[ICE] fetch error', e);
        return false;
      }
    };

    let attempts = 0;
    const tryFetch = async () => {
      const token = localStorage.getItem('token');
      const ok = await fetchIce(token);
      if (!ok && attempts < 5) {
        attempts += 1;
        iceFetchTimerRef.current = setTimeout(tryFetch, 1500);
      }
    };

    // initial attempt
    tryFetch();

    // listen for token changes across tabs or after login
    const onStorage = (e) => {
      if (e.key === 'token') {
        const tk = e.newValue;
        if (tk) fetchIce(tk);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      if (iceFetchTimerRef.current) clearTimeout(iceFetchTimerRef.current);
    };
  }, []);

  const getMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
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

  // Включаем отправку на всякий случай (активируем encodings)
  const ensureSending = async () => {
    if (!peerRef.current) return;
    const senders = peerRef.current.getSenders();
    for (const s of senders) {
      try {
        const params = s.getParameters?.();
        if (params && Array.isArray(params.encodings)) {
          let changed = false;
          params.encodings = params.encodings.map(e => {
            if (e && e.active === false) { changed = true; return { ...e, active: true }; }
            return e || { active: true };
          });
          if (changed) await s.setParameters(params).catch(() => {});
        }
      } catch {}
    }
    console.log('[RTC] ensureSending applied');
  };

  // Явный запуск повторной переговоры, если одна сторона не отправляет RTP
  const triggerRenegotiate = async () => {
    if (!peerRef.current) return;
    const to = incomingFromRef.current || callerId;
    try {
      const offer = await peerRef.current.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await peerRef.current.setLocalDescription(offer);
      console.log('[SIGNAL] emit renegotiate ->', to);
      socket.emit('renegotiate', { to, offer });
    } catch (e) {
      console.warn('renegotiate failed', e);
    }
  };

  const createPeer = async (initiator, streamParam, toIdForCandidates) => {
    const peer = new RTCPeerConnection(rtcConfig);

    const streamToUse = streamParam || localStream;
    if (streamToUse) {
      streamToUse.getTracks().forEach(track => {
        try { peer.addTrack(track, streamToUse); } catch {}
      });
      console.log('[RTC] addTrack attached', {
        a: streamToUse.getAudioTracks().length,
        v: streamToUse.getVideoTracks().length,
      });
    } else {
      try { peer.addTransceiver('audio', { direction: 'recvonly' }); } catch {}
      try { peer.addTransceiver('video', { direction: 'recvonly' }); } catch {}
    }

    peer.oniceconnectionstatechange = () => {
      console.log('[RTC] iceConnectionState =', peer.iceConnectionState);
      setIsConnected(peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed');
      if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') ensureSending();
    };
    peer.onconnectionstatechange = () => {
      console.log('[RTC] connectionState =', peer.connectionState);
      if (peer.connectionState === 'connected') ensureSending();
    };

    peer.ontrack = (event) => {
      console.log('[RTC] ontrack received');
      setRemoteStream(event.streams[0]);
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        const target = toIdForCandidates || callerId || incomingFromRef.current;
        console.log('[SIGNAL] emit iceCandidate ->', target);
        if (target) socket.emit('iceCandidate', { to: target, candidate: event.candidate });
      }
    };

    if (initiator) {
      const offer = await peer.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await peer.setLocalDescription(offer);
      await ensureSending();
      console.log('[SIGNAL] emit callUser ->', callerId);
      socket.emit('callUser', { userToCall: callerId, signalData: offer, from: selfId });
    }

    return peer;
  };

  // Буфер кандидатов до установки remoteDescription
  const drainPendingCandidates = async () => {
    if (!peerRef.current || !remoteDescSetRef.current) return;
    const queue = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of queue) {
      try { await peerRef.current.addIceCandidate(c); } catch (e) { console.warn('addIceCandidate (queued) failed', e); }
    }
    console.log('[SIGNAL] drained queued ICE candidates:', queue.length);
  };

  const startStatsLogging = () => {
    if (!peerRef.current) return;
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    let count = 0;
    statsIntervalRef.current = setInterval(async () => {
      count += 1;
      if (!peerRef.current) return;
      const stats = await peerRef.current.getStats();
      let inAudio = 0, inVideo = 0, outAudio = 0, outVideo = 0;
      let selectedPair = null;
      const reports = {};
      stats.forEach(r => { reports[r.id] = r; });
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
        if (report.type === 'candidate-pair' && (report.nominated || report.selected) && report.state === 'succeeded') {
          selectedPair = report;
        }
      });
      let pairInfo = '';
      if (selectedPair) {
        const local = reports[selectedPair.localCandidateId];
        const remote = reports[selectedPair.remoteCandidateId];
        pairInfo = ` pair(local=${local?.candidateType}/${local?.protocol}, remote=${remote?.candidateType}/${remote?.protocol})`;
      }
      const senders = peerRef.current.getSenders().map(s => ({ kind: s.track?.kind, enabled: s.track?.enabled, readyState: s.track?.readyState }));
      console.log(`[RTC][stats] inA=${inAudio} inV=${inVideo} outA=${outAudio} outV=${outVideo}${pairInfo} senders=`, senders);

      // Если исходящий RTP отсутствует устойчиво — инициируем renegotiate
      if (outAudio === 0 && outVideo === 0 && isConnected) {
        zeroOutCounterRef.current += 1;
        if (zeroOutCounterRef.current === 3) {
          console.log('[RTC] trigger renegotiate due to zero outbound bytes');
          triggerRenegotiate();
        }
      } else if (outAudio > 0 || outVideo > 0) {
        zeroOutCounterRef.current = 0;
      }

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
    remoteDescSetRef.current = false;
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
    remoteDescSetRef.current = true;
    await drainPendingCandidates();
    const answerDesc = await peer.createAnswer();
    await peer.setLocalDescription(answerDesc);
    await ensureSending();
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
    pendingCandidatesRef.current = [];
    remoteDescSetRef.current = false;
    zeroOutCounterRef.current = 0;
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
      remoteDescSetRef.current = true;
      drainPendingCandidates();
      ensureSending();
    };
    const handleIceCandidate = (candidate) => {
      console.log('[SIGNAL] on iceCandidate');
      if (!peerRef.current || !remoteDescSetRef.current) {
        pendingCandidatesRef.current.push(candidate);
        console.log('[SIGNAL] queued ICE candidate (peer not ready)');
      } else {
        peerRef.current.addIceCandidate(candidate).catch(err => console.warn('addIceCandidate failed', err));
      }
    };
    const handleRenegotiate = async ({ offer }) => {
      try {
        if (!peerRef.current) return;
        await peerRef.current.setRemoteDescription(offer);
        const answer = await peerRef.current.createAnswer();
        await peerRef.current.setLocalDescription(answer);
        const to = incomingFromRef.current || callerId;
        console.log('[SIGNAL] emit renegotiateAnswer ->', to);
        socket.emit('renegotiateAnswer', { to, answer });
      } catch (e) { console.warn('renegotiate (handle) failed', e); }
    };
    const handleRenegotiateAnswer = async ({ answer }) => {
      try {
        if (!peerRef.current) return;
        await peerRef.current.setRemoteDescription(answer);
        console.log('[SIGNAL] on renegotiateAnswer');
      } catch (e) { console.warn('setRemoteDescription(answer) failed', e); }
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
    socket.on('renegotiate', handleRenegotiate);
    socket.on('renegotiateAnswer', handleRenegotiateAnswer);
    socket.on('callEnded', handleCallEnded);

    return () => {
      socket.off('hey', handleHey);
      socket.off('callAccepted', handleCallAccepted);
      socket.off('iceCandidate', handleIceCandidate);
      socket.off('renegotiate', handleRenegotiate);
      socket.off('renegotiateAnswer', handleRenegotiateAnswer);
      socket.off('callEnded', handleCallEnded);
    };
  }, [socket, callerId, selfId, onCallReceived, onCallEndedCb, localStream, rtcConfig]);

  return { localStream, remoteStream, call, answer, end, isConnected, toggleMic, toggleCamera, isMicOn, isCameraOn, startStatsLogging };
};
