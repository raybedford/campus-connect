const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

/**
 * Persist an encrypted message to the database.
 */
const createMessage = async (senderId, conversationId, messageType, encryptedPayloads) => {
  // Verify sender is a member of the conversation
  const convo = await Conversation.findOne({
    _id: conversationId,
    'members.user': senderId
  });

  if (!convo) throw new Error('Unauthorized or conversation not found');

  const newMessage = new Message({
    conversation: conversationId,
    sender: senderId,
    messageType,
    encryptedPayloads
  });

  await newMessage.save();

  // Update conversation timestamp for sorting in lists
  convo.updatedAt = new Date();
  await convo.save();

  return newMessage;
};

/**
 * Fetch messages for a conversation with pagination.
 */
const getMessages = async (conversationId, userId, cursor = null, limit = 50) => {
  // Verify membership
  const convo = await Conversation.findOne({
    _id: conversationId,
    'members.user': userId
  });

  if (!convo) throw new Error('Unauthorized or conversation not found');

  const query = { conversation: conversationId };
  if (cursor) {
    query._id = { $lt: cursor }; // Cursor-based pagination (older messages)
  }

  return Message.find(query)
    .sort({ _id: -1 }) // Newest first for fetching history
    .limit(limit)
    .populate('sender', 'displayName email');
};

module.exports = {
  createMessage,
  getMessages
};
