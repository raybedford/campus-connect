const express = require('express');
const auth = require('../middleware/auth');
const keyService = require('../services/keyService');
const router = express.Router();

// Publish public encryption key
router.post('/publish', auth, async (req, res, next) => {
  try {
    const { publicKeyB64 } = req.body;
    const key = await keyService.publishKey(req.user.id, publicKeyB64);
    res.status(201).json(key);
  } catch (err) {
    next(err);
  }
});

// Get user's active public key
router.get('/:userId', auth, async (req, res, next) => {
  try {
    const key = await keyService.getKey(req.params.userId, req.user.id);
    res.json(key);
  } catch (err) {
    next(err);
  }
});

// Batch fetch public keys
router.get('/batch', auth, async (req, res, next) => {
  try {
    const { user_ids } = req.query;
    if (!user_ids) throw new Error('user_ids query parameter required');
    const ids = user_ids.split(',');
    const keys = await keyService.batchGetKeys(ids, req.user.id);
    res.json(keys);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
