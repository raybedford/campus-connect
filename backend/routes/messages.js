const express = require('express');
const auth = require('../middleware/auth');
const messageService = require('../services/messageService');
const router = express.Router();

// Fetch message history for a conversation (paginated)
router.get('/:conversationId', auth, async (req, res, next) => {
  try {
    const { cursor, limit } = req.query;
    const messages = await messageService.getMessages(
      req.params.conversationId,
      req.user.id,
      cursor,
      parseInt(limit) || 50
    );
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
