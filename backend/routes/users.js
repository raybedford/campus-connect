const express = require('express');
const auth = require('../middleware/auth');
const userService = require('../services/userService');
const router = express.Router();

// Search users at the same school
router.get('/search', auth, async (req, res, next) => {
  try {
    const { q } = req.query;
    const users = await userService.searchUsers(req.user.id, q);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Get school directory
router.get('/directory', auth, async (req, res, next) => {
  try {
    const users = await userService.getSchoolDirectory(req.user.id);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// Get current user profile
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Update current user profile
router.patch('/me', auth, async (req, res, next) => {
  try {
    const user = await userService.updateMe(req.user.id, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// Request phone verification
router.post('/me/phone/request', auth, async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    const result = await userService.requestPhoneVerification(req.user.id, phoneNumber);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Verify phone code
router.post('/me/phone/verify', auth, async (req, res, next) => {
  try {
    const { code } = req.body;
    const result = await userService.verifyPhone(req.user.id, code);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Schedule account deletion
router.delete('/me', auth, async (req, res, next) => {
  try {
    await userService.scheduleAccountDeletion(req.user.id);
    res.json({ message: 'Account scheduled for deletion. You have 14 days to cancel.' });
  } catch (err) {
    next(err);
  }
});

// Cancel account deletion
router.post('/me/cancel-deletion', auth, async (req, res, next) => {
  try {
    const user = await userService.cancelAccountDeletion(req.user.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
