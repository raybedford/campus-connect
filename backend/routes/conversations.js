const express = require('express');
const auth = require('../middleware/auth');
const conversationService = require('../services/conversationService');
const router = express.Router();

// List all user conversations
router.get('/', auth, async (req, res, next) => {
  try {
    const convos = await conversationService.listConversations(req.user.id);
    res.json(convos);
  } catch (err) {
    next(err);
  }
});

// Create DM or group
router.post('/', auth, async (req, res, next) => {
  try {
    const { type, name, recipientId, memberIds } = req.body;
    if (type === 'dm') {
      const convo = await conversationService.createDM(req.user.id, recipientId);
      return res.status(201).json(convo);
    } else if (type === 'group') {
      const convo = await conversationService.createGroup(req.user.id, name, memberIds);
      return res.status(201).json(convo);
    }
    res.status(400).json({ error: 'Invalid conversation type' });
  } catch (err) {
    next(err);
  }
});

// Get single conversation with members
router.get('/:id', auth, async (req, res, next) => {
  try {
    const convo = await conversationService.getConversation(req.params.id, req.user.id);
    res.json(convo);
  } catch (err) {
    next(err);
  }
});

// Add member to group
router.post('/:id/members', auth, async (req, res, next) => {
  try {
    const { userId } = req.body;
    const convo = await conversationService.addMember(req.params.id, req.user.id, userId);
    res.json(convo);
  } catch (err) {
    next(err);
  }
});

// Remove member from group
router.delete('/:id/members/:userId', auth, async (req, res, next) => {
  try {
    const convo = await conversationService.removeMember(req.params.id, req.user.id, req.params.userId);
    res.json(convo);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
