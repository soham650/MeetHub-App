module.exports = (io) => {
  const rooms = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User joins a room
    socket.on('join-room', ({ roomId, userId, userName }) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) rooms.set(roomId, new Set());

      // Send existing peers list to the new user
      const existingPeers = [...rooms.get(roomId)];
      socket.emit('existing-peers', existingPeers);

      // Add new user to room
      rooms.get(roomId).add(socket.id);

      // Tell others someone joined
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userName
      });

      // Save roomId on socket for cleanup
      socket.roomId = roomId;

      console.log(`${userName} joined room: ${roomId}`);
    });

    // WebRTC Offer
    socket.on('send-offer', ({ offer, to }) => {
      io.to(to).emit('receive-offer', { offer, from: socket.id });
    });

    // WebRTC Answer
    socket.on('send-answer', ({ answer, to }) => {
      io.to(to).emit('receive-answer', { answer, from: socket.id });
    });

    // ICE Candidate
    socket.on('ice-candidate', ({ candidate, to }) => {
      io.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

    // Chat message
    socket.on('send-message', ({ roomId, message, sender }) => {
      // Send to everyone EXCEPT sender
      socket.to(roomId).emit('receive-message', {
        message,
        sender,
        time: Date.now()
      });
    });

    // Whiteboard drawing event — broadcast to everyone in room except sender
    socket.on('draw-event', ({ roomId, x, y, type, color, brushSize, tool }) => {
      socket.to(roomId).emit('draw-event', { x, y, type, color, brushSize, tool });
    });

    // Clear whiteboard for everyone in room
    socket.on('clear-board', ({ roomId }) => {
      socket.to(roomId).emit('clear-board');
    });

    // User disconnects
    socket.on('disconnect', () => {
      const roomId = socket.roomId;
      if (roomId && rooms.has(roomId)) {
        rooms.get(roomId).delete(socket.id);
        socket.to(roomId).emit('user-left', socket.id);
        console.log('User left room:', roomId);
      }
    });
  });
};



