import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Chat from '../components/Chat';
import Whiteboard from '../components/Whiteboard';
import FileShare from '../components/FileShare';
import { API_BASE_URL } from '../config';

const socket = io(API_BASE_URL);

// STUN servers for WebRTC peer connection configuration
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

function Room() {
  const localVideoRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [remoteNames, setRemoteNames] = useState({});
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Set the initial room ID from the URL query parameter if present
  const [roomId, setRoomId] = useState(() => searchParams.get('roomId') || '');
  const [joined, setJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const localStreamRef = useRef(null);
  const peersRef = useRef({});

  const user = JSON.parse(localStorage.getItem('user'));

  // Auth redirect check - preserves roomId query parameter if present
  useEffect(() => {
    const loggedInUser = localStorage.getItem('user');
    if (!loggedInUser) {
      const roomIdParam = searchParams.get('roomId');
      if (roomIdParam) {
        navigate(`/?roomId=${roomIdParam}`);
      } else {
        navigate('/');
      }
    }
  }, [navigate, searchParams]);

  // Connect socket if disconnected when mounting the component
  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
  }, []);

  // Attach local stream after joining room
  useEffect(() => {
    if (joined && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [joined]);

  // Create and configure RTCPeerConnection for a remote peer
  const createPeerConnection = useCallback((peerId) => {
    // Close existing connection if any
    if (peersRef.current[peerId]) {
      peersRef.current[peerId].close();
    }

    const peer = new RTCPeerConnection(ICE_SERVERS);

    // Add all local stream tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peer.addTrack(track, localStreamRef.current);
      });
    }

    // Capture incoming remote stream tracks
    peer.ontrack = (event) => {
      console.log('Remote track received from:', peerId);
      if (event.streams && event.streams[0]) {
        setRemoteStreams(prev => ({
          ...prev,
          [peerId]: event.streams[0]
        }));
      }
    };

    // Forward ICE candidate to remote peer
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          to: peerId
        });
      }
    };

    // Monitor connection state changes
    peer.onconnectionstatechange = () => {
      console.log(`Peer ${peerId} connection state:`, peer.connectionState);
      if (peer.connectionState === 'failed') {
        peer.restartIce();
      }
    };

    peersRef.current[peerId] = peer;
    return peer;
  }, []);

  const joinRoom = async () => {
    if (!roomId.trim()) return alert('Please enter a room ID');
    setError('');

    try {
      if (!socket.connected) {
        socket.connect();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      localStreamRef.current = stream;
      setJoined(true);

      socket.emit('join-room', {
        roomId,
        userId: user?.id,
        userName: user?.name
      });

    } catch (err) {
      setError('Camera or microphone access was denied. Please allow device permissions.');
      console.error(err);
    }
  };

  useEffect(() => {
    // Receive list of existing peers upon joining
    socket.on('existing-peers', async (peers) => {
      console.log('Existing peers:', peers);
      for (const { socketId, userName } of peers) {
        setRemoteNames(prev => ({ ...prev, [socketId]: userName }));
        const peer = createPeerConnection(socketId);
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        socket.emit('send-offer', { offer, to: socketId });
      }
    });

    // Receive notification of new user joining
    socket.on('user-joined', ({ socketId, userName }) => {
      console.log('New user joined:', userName);
      setRemoteNames(prev => ({ ...prev, [socketId]: userName }));
    });

    // Receive incoming WebRTC offer
    socket.on('receive-offer', async ({ offer, from }) => {
      console.log('Received offer from:', from);
      const peer = createPeerConnection(from);
      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('send-answer', { answer, to: from });
    });

    // Receive incoming WebRTC answer
    socket.on('receive-answer', async ({ answer, from }) => {
      console.log('Received answer from:', from);
      const peer = peersRef.current[from];
      if (peer && peer.signalingState !== 'stable') {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // Receive ICE candidate
    socket.on('ice-candidate', async ({ candidate, from }) => {
      const peer = peersRef.current[from];
      if (peer) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('ICE candidate error:', err);
        }
      }
    });

    // Receive user departure notification
    socket.on('user-left', (socketId) => {
      console.log('User left:', socketId);
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      setRemoteStreams(prev => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
      setRemoteNames(prev => {
        const updated = { ...prev };
        delete updated[socketId];
        return updated;
      });
    });

    return () => {
      socket.off('existing-peers');
      socket.off('user-joined');
      socket.off('receive-offer');
      socket.off('receive-answer');
      socket.off('ice-candidate');
      socket.off('user-left');
    };
  }, [createPeerConnection]);

  const toggleMic = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
    }
  };

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
        video: { cursor: 'always' },
        audio: false
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all active peer connections
      Object.values(peersRef.current).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(screenTrack);
      });

      // Show screen in local preview window
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      setScreenSharing(true);

      // Revert screen share when stopped from browser control
      screenTrack.onended = () => stopScreenShare();

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        alert('Screen share permission was denied.');
      } else if (err.name === 'NotSupportedError') {
        alert('Screen sharing is not supported on this device/browser.');
      }
      console.error('Screen share error:', err);
    }
  };

  // Stop screen sharing and revert to camera stream
  const stopScreenShare = async () => {
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const camTrack = camStream.getVideoTracks()[0];

      Object.values(peersRef.current).forEach(peer => {
        const sender = peer.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(camTrack);
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setScreenSharing(false);
    } catch (err) {
      console.error('Stop screen share error:', err);
    }
  };

  // Copy the invite link to clipboard
  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/room?roomId=${roomId}`;
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy link: ', err);
      });
  };

  const leaveRoom = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    Object.values(peersRef.current).forEach(peer => peer.close());
    socket.disconnect();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: 'white', padding: '16px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '20px' }}>MeetHub App</h2>
        <span style={{ fontSize: '13px', color: '#94a3b8' }}>User: {user?.name}</span>
      </div>

      {/* Join Room Panel */}
      {!joined ? (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '80px' }}>
          <div style={{ background: '#1e293b', padding: '40px', borderRadius: '12px', width: '360px' }}>
            <h3 style={{ marginBottom: '20px', color: 'white' }}>Join a Room</h3>

            {error && (
              <p style={{ color: '#f87171', fontSize: '14px', marginBottom: '12px' }}>{error}</p>
            )}

            <input
              type="text"
              placeholder="Enter Room ID (e.g. room123)"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              style={{
                width: '100%', padding: '10px', marginBottom: '14px',
                borderRadius: '6px', border: '1px solid #334155',
                background: '#0f172a', color: 'white', boxSizing: 'border-box'
              }}
            />
            <button
              onClick={joinRoom}
              style={{
                width: '100%', padding: '12px', background: '#2563eb',
                color: 'white', border: 'none', borderRadius: '6px',
                cursor: 'pointer', fontSize: '15px'
              }}
            >
              Join Room
            </button>
          </div>
        </div>

      ) : (
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>

          {/* Left — Videos + Controls */}
          <div style={{ flex: 1, minWidth: '300px' }}>

            {/* Video Grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>

              {/* Local Video Preview */}
              <div style={{ position: 'relative' }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: '280px', height: '200px',
                    borderRadius: '10px', background: '#1e293b',
                    objectFit: 'cover', border: '2px solid #2563eb'
                  }}
                />
                <span style={{
                  position: 'absolute', bottom: '8px', left: '8px',
                  background: 'rgba(0,0,0,0.7)', padding: '2px 8px',
                  borderRadius: '4px', fontSize: '12px'
                }}>
                  {screenSharing ? 'Screen Share: ' : 'Camera: '}{user?.name} (You)
                </span>
                {!micOn && (
                  <span style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: '#dc2626', padding: '2px 6px',
                    borderRadius: '4px', fontSize: '11px'
                  }}>
                    Muted
                  </span>
                )}
              </div>

              {/* Remote Participant Videos */}
              {Object.entries(remoteStreams).map(([peerId, stream]) => (
                <RemoteVideo
                  key={peerId}
                  stream={stream}
                  name={remoteNames[peerId] || 'Guest'}
                />
              ))}

              {/* Empty slot message */}
              {Object.keys(remoteStreams).length === 0 && (
                <div style={{
                  width: '280px', height: '200px',
                  borderRadius: '10px', background: '#1e293b',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexDirection: 'column',
                  border: '2px dashed #334155'
                }}>
                  <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
                    Waiting for others to join...
                  </p>
                  <p style={{ color: '#334155', fontSize: '12px', margin: '6px 0 0' }}>
                    Share Room ID: <strong style={{ color: '#60a5fa' }}>{roomId}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Room Controls Panel */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={toggleMic} style={btnStyle(micOn ? '#1e293b' : '#dc2626')}>
                {micOn ? 'Mute' : 'Unmute'}
              </button>

              <button onClick={toggleCam} style={btnStyle(camOn ? '#1e293b' : '#dc2626')}>
                {camOn ? 'Camera Off' : 'Camera On'}
              </button>

              <button
                onClick={screenSharing ? stopScreenShare : startScreenShare}
                style={btnStyle(screenSharing ? '#f59e0b' : '#1e293b')}
              >
                {screenSharing ? 'Stop Share' : 'Share Screen'}
              </button>

              <button
                onClick={() => { setShowChat(!showChat); setShowFiles(false); }}
                style={btnStyle(showChat ? '#7c3aed' : '#1e293b')}
              >
                Chat
              </button>

              <button
                onClick={() => setShowWhiteboard(true)}
                style={btnStyle('#059669')}
              >
                Whiteboard
              </button>

              <button
                onClick={() => { setShowFiles(!showFiles); setShowChat(false); }}
                style={btnStyle(showFiles ? '#0369a1' : '#1e293b')}
              >
                Files
              </button>

              <button onClick={leaveRoom} style={btnStyle('#dc2626')}>
                Leave Room
              </button>
            </div>

            <p style={{ color: '#475569', marginTop: '10px', fontSize: '12px' }}>
              Room ID: <strong style={{ color: '#94a3b8' }}>{roomId}</strong> (Share this ID to invite others)
            </p>

            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                onClick={handleCopyLink}
                style={{
                  padding: '8px 14px',
                  background: '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                {copied ? 'Copied!' : 'Copy Invite Link'}
              </button>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {window.location.origin}/room?roomId={roomId}
              </span>
            </div>
          </div>

          {/* Right — Chat or Files side panel */}
          {showChat && (
            <Chat socket={socket} roomId={roomId} userName={user?.name} />
          )}
          {showFiles && (
            <FileShare socket={socket} roomId={roomId} userName={user?.name} />
          )}
        </div>
      )}

      {/* Whiteboard Overlay Modal */}
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

// Control buttons style helper
const btnStyle = (bg) => ({
  padding: '10px 16px',
  background: bg,
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '500'
});

// Remote participant video tile
function RemoteVideo({ stream, name }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => console.log('Remote play error:', err));
    }
  }, [stream]);

  return (
    <div style={{ position: 'relative' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '280px', height: '200px',
          borderRadius: '10px', background: '#1e293b',
          objectFit: 'cover', border: '2px solid #334155'
        }}
      />
      <span style={{
        position: 'absolute', bottom: '8px', left: '8px',
        background: 'rgba(0,0,0,0.7)', padding: '2px 8px',
        borderRadius: '4px', fontSize: '12px'
      }}>
        Participant: {name}
      </span>
    </div>
  );
}

export default Room;