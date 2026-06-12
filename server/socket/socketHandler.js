module.exports = (io) => {
  // Store room participants using Map: roomId -> Map(socketId -> userName)
  const rooms = new Map();

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user joining a room
    socket.on('join-room', ({ roomId, userId, userName }) => {
      socket.join(roomId);

      // Initialize the room map if it doesn't exist yet
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }

      const currentRoom = rooms.get(roomId);

      // Get list of existing peers in the room before adding the new user
      const existingPeers = [...currentRoom.entries()].map(([id, name]) => ({
        socketId: id,
        userName: name
      }));

      // Send the list of existing peer socket IDs to the newly connected user
      socket.emit('existing-peers', existingPeers.map(peer => peer.socketId));

      // Notify other room participants about the new user joining
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userName
      });

      // Save the user registration in the room map
      currentRoom.set(socket.id, userName);
      socket.roomId = roomId;
      socket.userName = userName;

      console.log(`User ${userName} joined room: ${roomId} | Total users: ${currentRoom.size}`);
    });

    // WebRTC signaling: forward offer
    socket.on('send-offer', ({ offer, to }) => {
      io.to(to).emit('receive-offer', { offer, from: socket.id });
    });

    // WebRTC signaling: forward answer
    socket.on('send-answer', ({ answer, to }) => {
      io.to(to).emit('receive-answer', { answer, from: socket.id });
    });

    // WebRTC signaling: forward ICE candidate
    socket.on('ice-candidate', ({ candidate, to }) => {
      io.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

    // Chat: broadcast message to other room participants
    socket.on('send-message', ({ roomId, message, sender }) => {
      socket.to(roomId).emit('receive-message', {
        message,
        sender,
        time: Date.now()
      });
    });

    // Whiteboard: broadcast drawing event to other room participants
    socket.on('draw-event', ({ roomId, x, y, type, color, brushSize, tool }) => {
      socket.to(roomId).emit('draw-event', { x, y, type, color, brushSize, tool });
    });

    // Whiteboard: broadcast clear event
    socket.on('clear-board', ({ roomId }) => {
      socket.to(roomId).emit('clear-board');
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
      const roomId = socket.roomId;
      if (roomId && rooms.has(roomId)) {
        const currentRoom = rooms.get(roomId);
        currentRoom.delete(socket.id);

        // Notify other participants that the user has left
        socket.to(roomId).emit('user-left', socket.id);
        console.log(`User ${socket.userName || socket.id} left room: ${roomId} | Remaining users: ${currentRoom.size}`);

        // Clean up empty rooms from memory
        if (currentRoom.size === 0) {
          rooms.delete(roomId);
        }
      }
    });
  });
};
