const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * PRODUCTION AUTH MIDDLEWARE
 */
module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    if (payload.type !== 'access') throw new Error('Invalid token type');
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};
