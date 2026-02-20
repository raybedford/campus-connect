const express = require('express');
const authService = require('../services/authService');
const rateLimiter = require('../middleware/rateLimiter');
const router = express.Router();

const auth = require('../middleware/auth');

router.post('/signup', rateLimiter, async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body;
    await authService.signup(email, password, displayName);
    res.json({ message: 'Verification code sent to your email' });
  } catch (err) {
    next(err);
  }
});

router.post('/password/update', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.updatePassword(req.user.id, currentPassword, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', rateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    const result = await authService.requestPasswordReset(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', rateLimiter, async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    const result = await authService.resetPassword(email, code, newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/verify', rateLimiter, async (req, res, next) => {
  try {
    const { email, code } = req.body;
    const tokens = await authService.verifyEmail(email, code);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

router.post('/login', rateLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const tokens = await authService.login(email, password);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    const tokens = await authService.refreshTokens(refresh_token);
    res.json(tokens);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
