const PublicKey = require('../models/PublicKey');
const User = require('../models/User');

const publishKey = async (userId, publicKeyB64) => {
  // Mark previous keys as inactive
  await PublicKey.updateMany({ user: userId }, { isActive: false });

  const newKey = new PublicKey({
    user: userId,
    publicKeyB64,
    isActive: true
  });

  return newKey.save();
};

const getKey = async (targetUserId, requesterId) => {
  // Security Fix: Ensure both users are in the same school to prevent cross-school stalking
  const [target, requester] = await Promise.all([
    User.findById(targetUserId),
    User.findById(requesterId)
  ]);

  if (!target || !requester || target.school.toString() !== requester.school.toString()) {
    throw new Error('User not found or unauthorized');
  }

  const key = await PublicKey.findOne({ user: targetUserId, isActive: true });
  if (!key) throw new Error('Public key not found');
  return key;
};

const batchGetKeys = async (targetUserIds, requesterId) => {
  const requester = await User.findById(requesterId);
  if (!requester) throw new Error('Unauthorized');

  // Security Fix: Only return keys for users in the same school
  return PublicKey.find({
    user: { $in: targetUserIds },
    isActive: true
  }).populate({
    path: 'user',
    match: { school: requester.school },
    select: '_id'
  }).then(keys => keys.filter(k => k.user)); // Filter out users not in the same school
};

module.exports = {
  publishKey,
  getKey,
  batchGetKeys
};
