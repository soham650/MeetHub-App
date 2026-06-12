import { useState, useEffect, useRef } from 'react';

function Chat({ socket, roomId, userName }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Auto scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for incoming messages
  useEffect(() => {
    socket.on('receive-message', ({ message, sender, time }) => {
      setMessages(prev => [...prev, { message, sender, time, self: false }]);
    });

    return () => socket.off('receive-message');
  }, [socket]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;

    // Add to own chat immediately
    setMessages(prev => [...prev, {
      message: newMessage,
      sender: userName,
      time: Date.now(),
      self: true
    }]);

    // Send to others via socket
    socket.emit('send-message', {
      roomId,
      message: newMessage,
      sender: userName
    });

    setNewMessage('');
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{
      width: '280px',
      background: '#1e293b',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      height: '500px'
    }}>

      {/* Chat Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155' }}>
        <h4 style={{ margin: 0, color: 'white', fontSize: '15px' }}>Chat</h4>
      </div>

      {/* Messages List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {messages.length === 0 && (
          <p style={{ color: '#475569', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              alignSelf: msg.self ? 'flex-end' : 'flex-start',
              maxWidth: '85%'
            }}
          >
            {/* Sender name — only for others */}
            {!msg.self && (
              <p style={{ margin: '0 0 3px', fontSize: '11px', color: '#60a5fa' }}>
                {msg.sender}
              </p>
            )}

            {/* Message bubble */}
            <div style={{
              background: msg.self ? '#2563eb' : '#334155',
              padding: '8px 12px',
              borderRadius: msg.self ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
              color: 'white',
              fontSize: '14px',
              wordBreak: 'break-word'
            }}>
              {msg.message}
            </div>

            {/* Timestamp */}
            <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#475569', textAlign: msg.self ? 'right' : 'left' }}>
              {formatTime(msg.time)}
            </p>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div style={{ padding: '12px', borderTop: '1px solid #334155', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid #334155',
            background: '#0f172a',
            color: 'white',
            fontSize: '13px',
            outline: 'none'
          }}
        />
        <button
          onClick={sendMessage}
          style={{
            padding: '8px 14px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default Chat;