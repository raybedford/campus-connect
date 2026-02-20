const Conversation = require('../models/Conversation');
const User = require('../models/User');

/**
 * Creates or retrieves a DM between two users.
 */
const createDM = async (senderId, recipientId) => {
  if (senderId === recipientId) throw new Error('Cannot start DM with yourself');

  const sender = await User.findById(senderId);
  const recipient = await User.findById(recipientId);

  if (!recipient || sender.school.toString() !== recipient.school.toString()) {
    throw new Error('User not found or from another school');
  }

  // Find existing DM between these two users
  const existing = await Conversation.findOne({
    type: 'dm',
    'members.user': { $all: [senderId, recipientId] }
  });

  if (existing) return existing;

  const newConvo = new Conversation({
    type: 'dm',
    school: sender.school,
    createdBy: senderId,
    members: [
      { user: senderId },
      { user: recipientId }
    ]
  });

  return newConvo.save();
};

/**
 * Creates a group conversation.
 */
const createGroup = async (creatorId, name, memberIds) => {
  const creator = await User.findById(creatorId);
  if (!name || name.trim() === '') throw new Error('Group name is required');

  // Ensure all members are from the same school
  const allMemberIds = [...new Set([...memberIds, creatorId])];
  const members = await User.find({
    _id: { $in: allMemberIds },
    school: creator.school
  });

  if (members.length !== allMemberIds.length) {
    throw new Error('Some members were not found or are from another school');
  }

  const newConvo = new Conversation({
    type: 'group',
    name: name.trim(),
    school: creator.school,
    createdBy: creatorId,
    members: allMemberIds.map(id => ({ user: id }))
  });

  return newConvo.save();
};

const listConversations = async (userId) => {
  return Conversation.find({ 'members.user': userId })
    .populate('members.user', 'displayName email')
    .sort({ updatedAt: -1 });
};

const getConversation = async (conversationId, userId) => {
  const convo = await Conversation.findOne({
    _id: conversationId,
    'members.user': userId
  }).populate('members.user', 'displayName email');

  if (!convo) throw new Error('Conversation not found');
  return convo;
};

const addMember = async (conversationId, adminId, newMemberId) => {
  const convo = await Conversation.findOne({
    _id: conversationId,
    'members.user': adminId,
    type: 'group'
  });

  if (!convo) throw new Error('Group not found or unauthorized');

  const newMember = await User.findById(newMemberId);
  if (!newMember || newMember.school.toString() !== convo.school.toString()) {
    throw new Error('User not found or from another school');
  }

  const alreadyMember = convo.members.some(m => m.user.toString() === newMemberId);
  if (alreadyMember) return convo;

  convo.members.push({ user: newMemberId });
  return convo.save();
};

const removeMember = async (conversationId, adminId, memberToRemoveId) => {
  const convo = await Conversation.findOne({
    _id: conversationId,
    'members.user': adminId,
    type: 'group'
  });

  if (!convo) throw new Error('Group not found or unauthorized');

  convo.members = convo.members.filter(m => m.user.toString() !== memberToRemoveId);
  return convo.save();
};

const markAsRead = async (conversationId, userId) => {
  return Conversation.updateOne(
    { _id: conversationId, 'members.user': userId },
    { $set: { 'members.$.lastReadAt': new Date() } }
  );
};

module.exports = {
  createDM,
  createGroup,
  listConversations,
  getConversation,
  addMember,
  removeMember,
  markAsRead
};
