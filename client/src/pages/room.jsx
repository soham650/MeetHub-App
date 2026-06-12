import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import Chat from '../components/Chat';
import Whiteboard from '../components/Whiteboard';
import FileShare from '../components/FileShare';

import { API_BASE_URL } from '../config';

const socket = io(API_BASE_URL);

// STUN servers for WebRTC peer connection configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

function Room() {
  const localVideoRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [roomId, setRoomId] = useState('');
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [error, setError] = useState('');
  const localStreamRef = useRef(null);
  const peersRef = useRef({});
  const navigate = useNavigate();
  const [showFiles, setShowFiles] = useState(false);
  const [localHovered, setLocalHovered] = useState(false);

  const user = JSON.parse(localStorage.getItem('user'));

  // Redirect to login if user is not authenticated
  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (!loggedInUser) navigate('/');
  }, [navigate]);

  // Attach local stream after joined becomes true
  useEffect(() => {
    if (joined && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [joined]);

  // Initialize and configure a WebRTC connection for a remote peer
  const createPeerConnection = useCallback((peerId) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    localStreamRef.current.getTracks().forEach(track => {
      peer.addTrack(track, localStreamRef.current);
    });

    peer.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [peerId]: event.streams[0]
      }));
    };

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', { candidate: event.candidate, to: peerId });
      }
    };

    peersRef.current[peerId] = peer;
    return peer;
  }, []);

  const joinRoom = async () => {
    if (!roomId.trim()) return alert('Please enter a room ID');
    setError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      setJoined(true);

      socket.emit('join-room', {
        roomId,
        userId: user.id,
        userName: user.name
      });

    } catch (err) {
      setError('Camera/Mic access denied. Please allow permissions.');
      console.error('Failed to get local stream:', err);
    }
  };

  // Set up socket event listeners for signaling and peer connection lifecycle
  useEffect(() => {
    socket.on('existing-peers', async (peers) => {
      for (const peerId of peers) {
        const peer = createPeerConnection(peerId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('send-offer', { offer, to: peerId });
      }
    });

    socket.on('receive-offer', async ({ offer, from }) => {
      const peer = createPeerConnection(from);
      await peer.setRemoteDescription(offer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('send-answer', { answer, to: from });
    });

    socket.on('receive-answer', async ({ answer, from }) => {
      const peer = peersRef.current[from];
      if (peer) await peer.setRemoteDescription(answer);
    });

    socket.on('ice-candidate', async ({ candidate, from }) => {
      const peer = peersRef.current[from];
      if (peer) await peer.addIceCandidate(candidate);
    });

    socket.on('user-left', (socketId) => {
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      setRemoteStreams(prev => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });

    return () => {
      socket.off('existing-peers');
      socket.off('receive-offer');
      socket.off('receive-answer');
      socket.off('ice-candidate');
      socket.off('user-left');
    };
  }, [createPeerConnection]);

  // Toggle microphone on/off
  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

  // Toggle camera on/off
  const toggleCam = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCamOn(videoTrack.enabled);
    }
  };

  // Start screen sharing
  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace camera track with screen track in all peer connections
      Object.values(peersRef.current).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });

      // Show screen in local preview too
      localVideoRef.current.srcObject = screenStream;
      setScreenSharing(true);

      // When user stops sharing from browser button
      screenTrack.onended = () => stopScreenShare();

    } catch (err) {
      console.error('Screen share failed:', err);
    }
  };

  // Stop screen sharing — go back to camera
  const stopScreenShare = async () => {
    const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const camTrack = camStream.getVideoTracks()[0];

    Object.values(peersRef.current).forEach(peer => {
      const sender = peer.getSenders().find(s => s.track?.kind === 'video');
      if (sender) sender.replaceTrack(camTrack);
    });

    localVideoRef.current.srcObject = localStreamRef.current;
    setScreenSharing(false);
  };

  const leaveRoom = () => {
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    socket.disconnect();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', padding: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>MeetHub App</h2>
        <span style={{ fontSize: '14px', color: '#94a3b8' }}>Logged in as: {user?.name}</span>
      </div>

      {/* Join Room */}
      {!joined ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '80px' }}>
          <div style={{ background: '#1e293b', padding: '40px', borderRadius: '12px', width: '360px' }}>
            <h3 style={{ marginBottom: '20px' }}>Join a Room</h3>

            {error && (
              <p style={{ color: '#f87171', fontSize: '14px', marginBottom: '12px' }}>{error}</p>
            )}

            <input
              type="text"
              placeholder="Enter Room ID (e.g. room123)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              style={{ width: '100%', padding: '10px', marginBottom: '14px', borderRadius: '6px', border: '1px solid #334155', background: '#0f172a', color: 'white', boxSizing: 'border-box' }}
            />
            <button
              onClick={joinRoom}
              style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px' }}
            >
              Join Room
            </button>
          </div>
        </div>

      ) : (
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

          {/* Left side — videos + controls */}
          <div style={{ flex: 1 }}>

            {/* Video Grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>

              {/* Local Video */}
              <div
                onMouseEnter={() => setLocalHovered(true)}
                onMouseLeave={() => setLocalHovered(false)}
                style={{ position: 'relative', width: '300px', height: '220px' }}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', borderRadius: '10px', background: '#1e293b', objectFit: 'cover' }}
                />
                <span style={{ position: 'absolute', bottom: '8px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                  {screenSharing ? 'You (Screen)' : `You (${user?.name})`}
                </span>
                {localHovered && (
                  <button
                    onClick={() => {
                      if (localVideoRef.current && localVideoRef.current.requestFullscreen) {
                        localVideoRef.current.requestFullscreen();
                      }
                    }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(0, 0, 0, 0.6)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      zIndex: 10
                    }}
                  >
                    Fullscreen
                  </button>
                )}
              </div>

              {/* Remote Videos */}
              {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <RemoteVideo key={peerId} stream={stream} />
              ))}

            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={toggleMic}
                style={{ padding: '10px 20px', background: micOn ? '#1e293b' : '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                {micOn ? 'Mute' : 'Unmute'}
              </button>

              <button
                onClick={toggleCam}
                style={{ padding: '10px 20px', background: camOn ? '#1e293b' : '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                {camOn ? 'Stop Cam' : 'Start Cam'}
              </button>

              <button
                onClick={screenSharing ? stopScreenShare : startScreenShare}
                style={{ padding: '10px 20px', background: screenSharing ? '#f59e0b' : '#1e293b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                {screenSharing ? 'Stop Share' : 'Share Screen'}
              </button>

              <button
                onClick={() => setShowChat(!showChat)}
                style={{ padding: '10px 20px', background: showChat ? '#7c3aed' : '#1e293b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Chat
              </button>

              <button
                onClick={() => setShowWhiteboard(true)}
                style={{ padding: '10px 20px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Whiteboard
              </button>

              <button
                onClick={() => setShowFiles(!showFiles)}
                style={{ padding: '10px 20px', background: showFiles ? '#0369a1' : '#1e293b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Files
              </button>

              <button
                onClick={leaveRoom}
                style={{ padding: '10px 20px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Leave
              </button>
            </div>

            <p style={{ color: '#475569', marginTop: '12px', fontSize: '13px' }}>
              Room ID: <strong style={{ color: '#94a3b8' }}>{roomId}</strong>
            </p>
          </div>

          {/* Right side — Chat panel */}
          {showChat && (
            <Chat
              socket={socket}
              roomId={roomId}
              userName={user?.name}
            />
          )}

          {showFiles && (
            <FileShare
              socket={socket}
              roomId={roomId}
              userName={user?.name}
            />
          )}

        </div>
      )}
      {showWhiteboard && (
        <Whiteboard
          socket={socket}
          roomId={roomId}
          onClose={() => setShowWhiteboard(false)}
        />
      )}
    </div>
  );
}

// Remote video tile
function RemoteVideo({ stream }) {
  const videoRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', width: '300px', height: '220px' }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', borderRadius: '10px', background: '#1e293b', objectFit: 'cover' }}
      />
      <span style={{ position: 'absolute', bottom: '8px', left: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
        Guest
      </span>
      {hovered && (
        <button
          onClick={() => {
            if (videoRef.current && videoRef.current.requestFullscreen) {
              videoRef.current.requestFullscreen();
            }
          }}
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 'bold',
            zIndex: 10
          }}
        >
          Fullscreen
        </button>
      )}
    </div>
  );
}

export default Room;