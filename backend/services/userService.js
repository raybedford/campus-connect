const User = require('../models/User');

/**
 * Search for users at the same school as the requester.
 * @param {string} requesterId - ID of the user performing the search.
 * @param {string} query - The search query (name or email).
 */
const searchUsers = async (requesterId, query) => {
  const requester = await User.findById(requesterId);
  if (!requester) throw new Error('User not found');

  if (!query || query.length < 2) return [];

  return User.find({
    school: requester.school,
    _id: { $ne: requesterId },
    deletionScheduledAt: null, // Filter out users pending deletion
    $or: [
      { displayName: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } }
    ]
  })
  .select('displayName email _id phoneNumber showPhoneInProfile isPhoneVerified')
  .limit(20);
};

const getMe = async (userId) => {
  return User.findById(userId)
    .populate('school')
    .select('-passwordHash -verificationCode -mfaSecret');
};

const scheduleAccountDeletion = async (userId) => {
  return User.findByIdAndUpdate(userId, {
    deletionScheduledAt: new Date()
  }, { new: true });
};

const cancelAccountDeletion = async (userId) => {
  return User.findByIdAndUpdate(userId, {
    deletionScheduledAt: null
  }, { new: true });
};

const cleanupDeletedAccounts = async () => {
  const gracePeriodMs = 14 * 24 * 60 * 60 * 1000; // 14 days
  const threshold = new Date(Date.now() - gracePeriodMs);

  const result = await User.deleteMany({
    deletionScheduledAt: { $lt: threshold }
  });

  return result.deletedCount;
};

const getSchoolDirectory = async (userId) => {
  const requester = await User.findById(userId);
  if (!requester) throw new Error('User not found');

  return User.find({
    school: requester.school,
    _id: { $ne: userId },
    isVerified: true,
    deletionScheduledAt: null // Filter out users pending deletion
  })
  .select('displayName email _id phoneNumber showPhoneInProfile isPhoneVerified')
  .sort({ displayName: 1 });
};

const updateMe = async (userId, updateData) => {
  const allowedUpdates = ['displayName', 'showPhoneInProfile', 'mfaEnabled'];
  const filteredData = {};
  allowedUpdates.forEach(key => {
    if (updateData[key] !== undefined) filteredData[key] = updateData[key];
  });

  return User.findByIdAndUpdate(userId, filteredData, { new: true })
    .select('-passwordHash -verificationCode -mfaSecret');
};

const requestPhoneVerification = async (userId, phoneNumber) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60000); // 10 min

  await User.findByIdAndUpdate(userId, {
    phoneNumber,
    isPhoneVerified: false,
    phoneVerificationCode: code,
    phoneVerificationExpires: expires
  });

  // In demo mode, log to console
  console.log(`[SMS DEMO] Verification code for ${phoneNumber}: ${code}`);
  return { message: 'Verification code sent to console' };
};

const verifyPhone = async (userId, code) => {
  const user = await User.findById(userId);
  if (!user || user.phoneVerificationCode !== code || (user.phoneVerificationExpires && user.phoneVerificationExpires < new Date())) {
    throw new Error('Invalid or expired verification code');
  }

  user.isPhoneVerified = true;
  user.phoneVerificationCode = undefined;
  user.phoneVerificationExpires = undefined;
  await user.save();
  return { message: 'Phone verified successfully' };
};

module.exports = {
  searchUsers,
  getMe,
  getSchoolDirectory,
  updateMe,
  requestPhoneVerification,
  verifyPhone,
  scheduleAccountDeletion,
  cancelAccountDeletion,
  cleanupDeletedAccounts
};
