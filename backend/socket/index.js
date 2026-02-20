const conversationService = require('../services/conversationService');

module.exports = (io) => {
  // Authentication Middleware for WebSockets
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      const payload = jwt.verify(token, config.JWT_SECRET);
      if (payload.type !== 'access') throw new Error('Invalid token type');
      socket.user = { id: payload.sub };
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.user.id}`);

    // Join rooms for all user's conversations
    const userConvos = await Conversation.find({ 'members.user': socket.user.id });
    userConvos.forEach((convo) => {
      socket.join(convo._id.toString());
    });

    // Send Message Handler
    socket.on('send_message', async ({ conversationId, messageType, encryptedPayloads }, callback) => {
      try {
        const newMessage = await messageService.createMessage(
          socket.user.id,
          conversationId,
          messageType,
          encryptedPayloads
        );

        // Broadcast to all room members (including sender)
        io.to(conversationId).emit('new_message', newMessage);

        if (callback) callback({ status: 'ok', messageId: newMessage._id });
      } catch (err) {
        console.error('Socket send_message error:', err);
        if (callback) callback({ status: 'error', message: err.message });
      }
    });

    // Read Receipt Handler
    socket.on('read_receipt', async ({ conversationId }) => {
      try {
        await conversationService.markAsRead(conversationId, socket.user.id);
        // Broadcast read receipt to room members so they can update UI
        socket.to(conversationId).emit('read_receipt', {
          conversationId,
          userId: socket.user.id,
          readAt: new Date()
        });
      } catch (err) {
        console.error('Socket read_receipt error:', err);
      }
    });

    // Typing Indicators
    socket.on('typing', ({ conversationId, isTyping }) => {
      socket.to(conversationId).emit('user_typing', {
        userId: socket.user.id,
        conversationId,
        isTyping
      });
    });

    // Disconnect event
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.id}`);
    });
  });
};
