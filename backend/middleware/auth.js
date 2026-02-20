const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

/**
 * AUTH BYPASS FOR DEMO TESTING
 */
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Demo Bypass: Use the first user in the DB (Alex Johnson)
    const demoUser = await User.findOne({ email: 'alex.j@coloradotech.edu' });
    if (demoUser) {
      req.user = { id: demoUser._id.toString() };
      return next();
    }
    return res.status(401).json({ error: 'No demo user found in DB. Run seed first.' });
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
